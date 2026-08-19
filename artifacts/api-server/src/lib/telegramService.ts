/**
 * TelegramService — manages one GramJS client per Clerk user.
 *
 * Responsibilities:
 *  - QR code auth flow (generates QR on server, returns data-URL to frontend)
 *  - Real-time QR rotation via SSE (Server-Sent Events)
 *  - 2FA support via password resolver
 *  - Session persistence via AES-256-GCM encryption stored in DB
 *  - Message listener that matches incoming messages against user rules
 *  - Group sync from Telegram dialogs
 *  - Session restore on server restart
 */

import crypto from "node:crypto";
import QRCode from "qrcode";
import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions";
import { NewMessage, type NewMessageEvent } from "telegram/events";
import { eq, and, desc, sql } from "drizzle-orm";
import {
  db,
  signalwatchConnectionsTable,
  signalwatchGroupsTable,
  signalwatchRulesTable,
  signalwatchAlertsTable,
  type SignalwatchGroup,
} from "@workspace/db";

// TEMPORARY (dev-only): hardcoded fallback so the connector works without
// env secrets configured. Env vars still take precedence when set. Remove
// before shipping to production — these values are committed to a public repo.
export const API_ID = parseInt(process.env.TELEGRAM_API_ID ?? "35802846", 10);
export const API_HASH = process.env.TELEGRAM_API_HASH ?? "d06678e2bd2db3ea8ce3a7ce94232845";

// ── In-memory state ────────────────────────────────────────────────────────────
interface PendingQR {
  dataUrl: string;       // base64 PNG data URL for <img src>
  rawUrl: string;        // tg://login?token=... for deep link
  expiresAt: Date;
}

const pendingQRs = new Map<string, PendingQR>();
const activeClients = new Map<string, TelegramClient>();
const pollTimers = new Map<string, ReturnType<typeof setInterval>>();

// GramJS's live update push is the fast path, but it isn't something we can
// fully rely on — the connection is a long-lived, mostly-idle socket, which
// is exactly the shape of connection flaky networks/NATs silently drop
// without either side noticing. Polling on a short interval is the
// pragmatic backstop: it reuses the same cheap getDialogs() call the manual
// "Sincronizar" button already made reliable, so monitoring keeps working
// even on a run where the push channel goes quiet.
const POLL_INTERVAL_MS = 25_000;

function startPolling(userId: string, client: TelegramClient): void {
  stopPolling(userId);
  const timer = setInterval(() => {
    syncGroups(userId, client).catch((err) =>
      console.error(`[telegram] poll failed for ${userId}:`, err),
    );
  }, POLL_INTERVAL_MS);
  pollTimers.set(userId, timer);
}

function stopPolling(userId: string): void {
  const timer = pollTimers.get(userId);
  if (timer) {
    clearInterval(timer);
    pollTimers.delete(userId);
  }
}

// ── SSE clients ────────────────────────────────────────────────────────────────
interface SSEClient {
  write: (chunk: string) => boolean;
  writableEnded: boolean;
}

const sseClients = new Map<string, Set<SSEClient>>();

export function registerSSEClient(userId: string, res: SSEClient): () => void {
  if (!sseClients.has(userId)) sseClients.set(userId, new Set());
  sseClients.get(userId)!.add(res);
  return () => {
    sseClients.get(userId)?.delete(res);
    if (sseClients.get(userId)?.size === 0) sseClients.delete(userId);
  };
}

function sendSSEEvent(userId: string, event: Record<string, unknown>): void {
  const clients = sseClients.get(userId);
  if (!clients || clients.size === 0) return;
  const payload = `data: ${JSON.stringify(event)}\n\n`;
  for (const client of clients) {
    if (!client.writableEnded) {
      try { client.write(payload); } catch { /* client disconnected */ }
    }
  }
}

// Group message counters update on every incoming message, which for
// high-traffic channels can be many times a second — pushing an SSE event
// per message would flood the connection. Throttle to at most one
// "group_activity" push per user per window; the frontend just refetches
// the group list on it, so coalescing bursts into one event is correct.
const GROUP_ACTIVITY_THROTTLE_MS = 3000;
const lastGroupActivitySSE = new Map<string, number>();

function notifyGroupActivity(userId: string): void {
  const now = Date.now();
  const last = lastGroupActivitySSE.get(userId) ?? 0;
  if (now - last < GROUP_ACTIVITY_THROTTLE_MS) return;
  lastGroupActivitySSE.set(userId, now);
  sendSSEEvent(userId, { type: "group_activity" });
}

// ── 2FA pending resolvers ──────────────────────────────────────────────────────
const pending2FA = new Map<string, (password: string) => void>();

export async function submit2FA(userId: string, password: string): Promise<boolean> {
  const resolve = pending2FA.get(userId);
  if (!resolve) return false;
  pending2FA.delete(userId);
  resolve(password);
  return true;
}

// ── Crypto helpers ─────────────────────────────────────────────────────────────
function deriveKey(): Buffer {
  return crypto
    .createHash("sha256")
    .update(process.env.SESSION_SECRET ?? "signalwatch-dev-key")
    .digest();
}

export function encryptSession(plaintext: string): string {
  const key = deriveKey();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${tag.toString("hex")}:${enc.toString("hex")}`;
}

export function decryptSession(ciphertext: string): string {
  const parts = ciphertext.split(":");
  if (parts.length !== 3) throw new Error("Invalid ciphertext format");
  const [ivHex, tagHex, encHex] = parts;
  const key = deriveKey();
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    key,
    Buffer.from(ivHex, "hex"),
  );
  decipher.setAuthTag(Buffer.from(tagHex, "hex"));
  const dec = Buffer.concat([
    decipher.update(Buffer.from(encHex, "hex")),
    decipher.final(),
  ]);
  return dec.toString("utf8");
}

// ── Client factory ─────────────────────────────────────────────────────────────
function makeClient(sessionStr = ""): TelegramClient {
  return new TelegramClient(new StringSession(sessionStr), API_ID, API_HASH, {
    connectionRetries: 5,
    retryDelay: 1000,
    useWSS: false,
  });
}

// ── Post-auth setup ────────────────────────────────────────────────────────────
async function onSessionEstablished(
  userId: string,
  client: TelegramClient,
): Promise<void> {
  // Save session — client is always constructed with a StringSession (see createClient),
  // whose save() returns a string, but the base Session type declares save(): void.
  const sessionStr = (client.session as StringSession).save();
  const ciphertext = encryptSession(sessionStr);

  // Get account label
  let accountLabel = "Conta Telegram";
  try {
    const me = await client.getMe();
    if (me && "firstName" in me) {
      const parts = [me.firstName, (me as { lastName?: string }).lastName]
        .filter(Boolean)
        .join(" ");
      const uname = (me as { username?: string }).username;
      accountLabel = uname ? `${parts} (@${uname})` : parts;
    }
  } catch { /* ignore */ }

  await db
    .update(signalwatchConnectionsTable)
    .set({
      status: "connected",
      sessionCiphertext: ciphertext,
      accountLabel,
      authorizedAt: new Date(),
      connectorAvailable: true,
      monitoringEnabled: true,
      message: null,
    })
    .where(eq(signalwatchConnectionsTable.clerkUserId, userId));

  activeClients.set(userId, client);
  attachMessageListener(userId, client);
  startPolling(userId, client);
  pendingQRs.delete(userId);
  pending2FA.delete(userId);

  // Notify all SSE clients that connection is established
  sendSSEEvent(userId, { type: "connected", accountLabel });

  // Sync groups in background
  syncGroups(userId, client).catch(console.error);
}

// Builds the t.me deep link for a message — public groups/channels use the
// username form, private ones use the internal-id "/c/" form (the stored
// telegramId is already the raw internal id, no "-100" prefix).
function buildMessageLink(group: SignalwatchGroup, messageId: number): string {
  return group.username
    ? `https://t.me/${group.username}/${messageId}`
    : `https://t.me/c/${group.telegramId.replace(/^-100/, "")}/${messageId}`;
}

// Shared by both the live event listener and the polling fallback so the
// two paths can never drift apart on what counts as a match.
async function matchMessageAgainstRules(
  userId: string,
  group: SignalwatchGroup,
  text: string,
  messageId: number,
  receivedAt: Date,
): Promise<void> {
  if (!text) return;

  const rules = await db
    .select()
    .from(signalwatchRulesTable)
    .where(
      and(
        eq(signalwatchRulesTable.clerkUserId, userId),
        eq(signalwatchRulesTable.active, true),
      ),
    );

  const lower = text.toLowerCase();
  const messageLink = buildMessageLink(group, messageId);

  for (const rule of rules) {
    if (rule.groupIds.length > 0 && !rule.groupIds.includes(group.id))
      continue;

    const hasExcluded = rule.excludedKeywords.some((kw) =>
      lower.includes(kw.toLowerCase()),
    );
    if (hasExcluded) continue;

    const matched = rule.keywords.filter((kw) =>
      lower.includes(kw.toLowerCase()),
    );
    if (matched.length === 0) continue;

    if (rule.requiredKeywords.length > 0) {
      const allRequired = rule.requiredKeywords.every((kw) =>
        lower.includes(kw.toLowerCase()),
      );
      if (!allRequired) continue;
    }

    // Cooldown: a rule broad enough to match repost/spam bots (identical
    // promo text sent over and over) would otherwise mint one alert per
    // repost with no limit. cooldownMinutes was already a rule field the
    // UI exposed but nothing enforced it — this is what makes it real.
    if (rule.cooldownMinutes > 0) {
      const [lastAlert] = await db
        .select({ receivedAt: signalwatchAlertsTable.receivedAt })
        .from(signalwatchAlertsTable)
        .where(
          and(
            eq(signalwatchAlertsTable.ruleId, rule.id),
            eq(signalwatchAlertsTable.groupId, group.id),
          ),
        )
        .orderBy(desc(signalwatchAlertsTable.receivedAt))
        .limit(1);
      if (lastAlert) {
        const elapsedMs = receivedAt.getTime() - lastAlert.receivedAt.getTime();
        if (elapsedMs < rule.cooldownMinutes * 60_000) continue;
      }
    }

    // onConflictDoNothing makes this idempotent on (rule, group, telegram
    // message): the live listener and the polling fallback both call this
    // function for the same message whenever they race, and a crash mid
    // poll batch (this environment's syscalls die under it more often than
    // not) leaves the group's high-water mark unadvanced, so the next boot
    // re-scans and re-matches messages already alerted on. Without this,
    // each of those re-runs mints a fresh duplicate alert.
    const [inserted] = await db
      .insert(signalwatchAlertsTable)
      .values({
        clerkUserId: userId,
        groupId: group.id,
        groupName: group.name,
        ruleId: rule.id,
        ruleName: rule.name,
        message: text.slice(0, 2000),
        matchedKeywords: matched,
        telegramMessageId: messageId,
        receivedAt,
        status: "unread",
        deliveryStatus: "internal",
        messageLink,
      })
      .onConflictDoNothing({
        target: [
          signalwatchAlertsTable.ruleId,
          signalwatchAlertsTable.groupId,
          signalwatchAlertsTable.telegramMessageId,
        ],
      })
      .returning({ id: signalwatchAlertsTable.id });
    if (!inserted) continue;

    // Push real-time notification to any open browser tabs for this user
    sendSSEEvent(userId, { type: "new_alert" });

    // Atomic increment — the live listener and the poller can both be
    // matching messages for this user around the same time, and a
    // read-then-write of the JS-side `rule.matchedCount` snapshot would
    // drop increments whenever they land close together.
    await db
      .update(signalwatchRulesTable)
      .set({ matchedCount: sql`${signalwatchRulesTable.matchedCount} + 1` })
      .where(eq(signalwatchRulesTable.id, rule.id));
  }
}

// ── Message listener (fast path) ─────────────────────────────────────────────
// Not fully reliable on its own — see startPolling() — but when the push
// channel is healthy this delivers matches instantly instead of waiting for
// the next poll tick.
function attachMessageListener(userId: string, client: TelegramClient): void {
  client.addEventHandler(async (event: NewMessageEvent) => {
    try {
      const msg = event.message;
      if (!msg.isGroup && !msg.isChannel) return;

      const text = (msg.text ?? (msg as { message?: string }).message ?? "").trim();

      // Resolve chatId — GramJS can return BigInt or object
      const rawId = msg.chatId;
      if (!rawId) return;
      const chatId = rawId.toString();

      // Find a monitored group matching this chatId
      const groups = await db
        .select()
        .from(signalwatchGroupsTable)
        .where(
          and(
            eq(signalwatchGroupsTable.clerkUserId, userId),
            eq(signalwatchGroupsTable.monitored, true),
          ),
        );

      let group = groups.find(
        (g) =>
          g.telegramId === chatId ||
          g.telegramId === `-100${chatId}` ||
          chatId.endsWith(g.telegramId.replace(/^-100/, "")),
      );

      // Every synced group is monitored — a message from a group we've never
      // seen before means the user joined/was added to it since the last
      // sync. Auto-register it instead of dropping the message, so
      // monitoring stays live without a manual re-sync.
      if (!group) {
        const entity = await msg.getChat();
        if (!entity) return;
        const name =
          "title" in entity && entity.title ? entity.title : "Grupo sem nome";
        const username =
          "username" in entity ? ((entity as { username?: string }).username ?? null) : null;
        [group] = await db
          .insert(signalwatchGroupsTable)
          .values({
            clerkUserId: userId,
            telegramId: chatId,
            name,
            username,
            status: "active",
            monitored: true,
            lastMessageId: msg.id,
          })
          .returning();
      }

      // The poller picks up from lastMessageId, so keep it moving even when
      // the live path is the one that actually saw the message.
      await db
        .update(signalwatchGroupsTable)
        .set({
          messageCount: group.messageCount + 1,
          lastEventAt: new Date(),
          lastMessageId: Math.max(group.lastMessageId ?? 0, msg.id),
        })
        .where(eq(signalwatchGroupsTable.id, group.id));
      notifyGroupActivity(userId);

      await matchMessageAgainstRules(userId, group, text, msg.id, new Date());
    } catch (err) {
      console.error("[telegram] message handler error:", err);
    }
    // No `incoming: true` filter here on purpose: the monitored account is
    // the same account used to browse/post in these groups, so restricting
    // to incoming-only silently drops the user's own messages — including
    // anything they type themselves to test a rule.
  }, new NewMessage({}));
}

// ── Group sync ─────────────────────────────────────────────────────────────────
// Fetches and matches whatever's new in one group since `sinceMessageId`
// against active rules, then advances the group's high-water mark. Used
// both by the periodic poller and (implicitly, via its baseline) by the
// live listener catching up after a gap.
async function processNewMessagesForGroup(
  userId: string,
  group: SignalwatchGroup,
  client: TelegramClient,
  entity: Parameters<TelegramClient["getMessages"]>[0],
  sinceMessageId: number,
): Promise<void> {
  const messages = await client.getMessages(entity, {
    minId: sinceMessageId,
    limit: 100,
    reverse: true,
  });
  if (messages.length === 0) return;

  let highestId = sinceMessageId;
  for (const msg of messages) {
    if (msg.id > highestId) highestId = msg.id;
    const text = (msg.text ?? (msg as { message?: string }).message ?? "").trim();
    if (!text) continue;
    const receivedAt = msg.date ? new Date(msg.date * 1000) : new Date();
    await matchMessageAgainstRules(userId, group, text, msg.id, receivedAt);
  }

  await db
    .update(signalwatchGroupsTable)
    .set({ lastMessageId: highestId, lastEventAt: new Date() })
    .where(eq(signalwatchGroupsTable.id, group.id));
  notifyGroupActivity(userId);
}

export async function syncGroups(
  userId: string,
  client: TelegramClient,
): Promise<number> {
  const dialogs = await client.getDialogs({ limit: 200 });
  let count = 0;

  for (const dialog of dialogs) {
    if (!dialog.isGroup && !dialog.isChannel) continue;
    const entity = dialog.entity;
    if (!entity || !("id" in entity)) continue;

    const telegramId = (entity.id as { toString(): string })?.toString() ?? "";
    if (!telegramId) continue;

    const name = dialog.title ?? dialog.name ?? "Grupo sem nome";
    const username =
      "username" in entity
        ? ((entity as { username?: string }).username ?? null)
        : null;

    const [existing] = await db
      .select()
      .from(signalwatchGroupsTable)
      .where(
        and(
          eq(signalwatchGroupsTable.clerkUserId, userId),
          eq(signalwatchGroupsTable.telegramId, telegramId),
        ),
      )
      .limit(1);

    const latestMessageId = Number((dialog as { message?: { id?: number } }).message?.id ?? 0);

    let group: SignalwatchGroup;
    if (!existing) {
      // Every group the account has access to is monitored — there's no
      // per-group opt-in step. Rules decide what's noise, not a toggle here.
      // Baseline lastMessageId to the current latest so we don't backfill
      // (and alert on) the group's entire history the moment it's found.
      [group] = await db
        .insert(signalwatchGroupsTable)
        .values({
          clerkUserId: userId,
          telegramId,
          name,
          username,
          messageCount: latestMessageId,
          lastMessageId: latestMessageId,
          status: "active",
          monitored: true,
        })
        .returning();
    } else {
      [group] = await db
        .update(signalwatchGroupsTable)
        .set({
          name,
          username,
          messageCount: Math.max(existing.messageCount, latestMessageId),
          status: "active",
          monitored: true,
        })
        .where(eq(signalwatchGroupsTable.id, existing.id))
        .returning();

      // Rows created before lastMessageId existed start null — baseline
      // them the same way as a brand-new group instead of backfilling.
      if (existing.lastMessageId === null) {
        await db
          .update(signalwatchGroupsTable)
          .set({ lastMessageId: latestMessageId })
          .where(eq(signalwatchGroupsTable.id, group.id));
      } else if (latestMessageId > existing.lastMessageId) {
        try {
          await processNewMessagesForGroup(
            userId,
            group,
            client,
            entity,
            existing.lastMessageId,
          );
        } catch (err) {
          console.error(
            `[telegram] failed to process new messages for group ${group.id}:`,
            err,
          );
        }
      }
    }

    count++;
  }

  await db
    .update(signalwatchConnectionsTable)
    .set({ availableGroups: count, lastSyncAt: new Date() })
    .where(eq(signalwatchConnectionsTable.clerkUserId, userId));

  return count;
}

// ── QR auth ────────────────────────────────────────────────────────────────────
export async function startQRAuth(
  userId: string,
): Promise<PendingQR | { error: string }> {
  // Return cached QR if still fresh
  const cached = pendingQRs.get(userId);
  if (cached && cached.expiresAt > new Date()) {
    return cached;
  }

  if (!API_ID || !API_HASH) {
    return { error: "Credenciais da API do Telegram não configuradas." };
  }

  const client = makeClient();
  try {
    await client.connect();
  } catch (err) {
    return { error: `Falha ao conectar ao Telegram: ${(err as Error).message}` };
  }

  // Resolve when first QR is ready
  let firstQRResolve: ((v: PendingQR | { error: string }) => void) | null =
    null;
  const firstQRPromise = new Promise<PendingQR | { error: string }>(
    (resolve) => {
      firstQRResolve = resolve;
    },
  );

  // Start auth in background
  client
    .signInUserWithQrCode(
      { apiId: API_ID, apiHash: API_HASH },
      {
        qrCode: async (code: { token: Buffer }) => {
          try {
            const token = code.token.toString("base64url");
            const rawUrl = `tg://login?token=${token}`;
            const dataUrl = await QRCode.toDataURL(rawUrl, {
              width: 256,
              margin: 2,
              color: { dark: "#12383a", light: "#edf7f3" },
            });
            const expiresAt = new Date(Date.now() + 25_000);
            const qr: PendingQR = { dataUrl, rawUrl, expiresAt };
            pendingQRs.set(userId, qr);

            // Resolve first QR for the HTTP response
            if (firstQRResolve) {
              firstQRResolve(qr);
              firstQRResolve = null;
            }

            // Push every QR rotation to SSE clients in real-time
            sendSSEEvent(userId, {
              type: "qr",
              dataUrl,
              expiresAt: expiresAt.toISOString(),
            });

            // Wait before cycling to next QR
            await new Promise<void>((r) => setTimeout(r, 25_000));
          } catch (err) {
            console.error("[telegram] qrCode callback error:", err);
          }
        },

        password: async () => {
          // Notify frontend that 2FA password is required
          sendSSEEvent(userId, { type: "needs_2fa" });
          console.info("[telegram] 2FA required for user", userId);

          // Wait for user to submit password (5-minute timeout)
          const pwd = await new Promise<string>((resolve) => {
            pending2FA.set(userId, resolve);
            setTimeout(() => {
              if (pending2FA.get(userId) === resolve) {
                pending2FA.delete(userId);
                resolve("");
              }
            }, 300_000);
          });

          if (!pwd) {
            throw new Error(
              "Tempo esgotado para inserir a senha de verificação em duas etapas.",
            );
          }
          return pwd;
        },

        onError: (err: Error) => {
          console.error("[telegram] signInUserWithQrCode error:", err);
          if (firstQRResolve) {
            firstQRResolve({ error: err.message });
            firstQRResolve = null;
          }
          sendSSEEvent(userId, { type: "error", message: err.message });
          return Promise.resolve(false);
        },
      },
    )
    .then(() => {
      onSessionEstablished(userId, client).catch(console.error);
    })
    .catch((err: Error) => {
      console.error("[telegram] auth flow failed:", err);
      sendSSEEvent(userId, { type: "error", message: err.message });
      pendingQRs.delete(userId);
    });

  // Wait up to 8s for the first QR to appear
  const timeout = new Promise<{ error: string }>((resolve) =>
    setTimeout(
      () => resolve({ error: "Timeout ao gerar QR Code. Tente novamente." }),
      8_000,
    ),
  );
  return Promise.race([firstQRPromise, timeout]);
}

// ── Session restore ────────────────────────────────────────────────────────────
export async function restoreSession(
  userId: string,
  ciphertext: string,
): Promise<void> {
  if (activeClients.has(userId)) return;

  try {
    const sessionStr = decryptSession(ciphertext);
    const client = makeClient(sessionStr);
    await client.connect();

    const authorized = await client.isUserAuthorized();
    if (!authorized) {
      await db
        .update(signalwatchConnectionsTable)
        .set({
          status: "disconnected",
          message:
            "Sessão expirada. Reconecte seu Telegram para continuar recebendo alertas.",
        })
        .where(eq(signalwatchConnectionsTable.clerkUserId, userId));
      return;
    }

    activeClients.set(userId, client);
    attachMessageListener(userId, client);
    startPolling(userId, client);
    console.info(`[telegram] session restored for user ${userId}`);
  } catch (err) {
    console.error(`[telegram] restoreSession failed for ${userId}:`, err);
  }
}

// ── Disconnect ─────────────────────────────────────────────────────────────────
export async function disconnectClient(userId: string): Promise<void> {
  stopPolling(userId);
  const client = activeClients.get(userId);
  if (client) {
    try {
      await client.disconnect();
    } catch { /* ignore */ }
    activeClients.delete(userId);
  }
  pendingQRs.delete(userId);
  pending2FA.delete(userId);
}

// ── Startup restore ────────────────────────────────────────────────────────────
export async function restoreAllSessions(): Promise<void> {
  if (!API_ID || !API_HASH) return;

  try {
    const connections = await db
      .select()
      .from(signalwatchConnectionsTable)
      .where(eq(signalwatchConnectionsTable.status, "connected"));

    for (const conn of connections) {
      if (!conn.sessionCiphertext) continue;
      restoreSession(conn.clerkUserId, conn.sessionCiphertext).catch(
        console.error,
      );
    }
  } catch (err) {
    console.error("[telegram] restoreAllSessions error:", err);
  }
}

export function getActiveClient(userId: string): TelegramClient | undefined {
  return activeClients.get(userId);
}
