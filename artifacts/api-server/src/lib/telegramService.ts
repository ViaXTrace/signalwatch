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
import { eq, and } from "drizzle-orm";
import {
  db,
  signalwatchConnectionsTable,
  signalwatchGroupsTable,
  signalwatchRulesTable,
  signalwatchAlertsTable,
} from "@workspace/db";

const API_ID = parseInt(process.env.TELEGRAM_API_ID ?? "0", 10);
const API_HASH = process.env.TELEGRAM_API_HASH ?? "";

// ── In-memory state ────────────────────────────────────────────────────────────
interface PendingQR {
  dataUrl: string;       // base64 PNG data URL for <img src>
  rawUrl: string;        // tg://login?token=... for deep link
  expiresAt: Date;
}

const pendingQRs = new Map<string, PendingQR>();
const activeClients = new Map<string, TelegramClient>();

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
  // Save session
  const sessionStr = client.session.save() as string;
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
  pendingQRs.delete(userId);
  pending2FA.delete(userId);

  // Notify all SSE clients that connection is established
  sendSSEEvent(userId, { type: "connected", accountLabel });

  // Sync groups in background
  syncGroups(userId, client).catch(console.error);
}

// ── Message listener ───────────────────────────────────────────────────────────
function attachMessageListener(userId: string, client: TelegramClient): void {
  client.addEventHandler(async (event: NewMessageEvent) => {
    try {
      const msg = event.message;
      if (!msg.isGroup && !msg.isChannel) return;

      const text = (msg.text ?? (msg as { message?: string }).message ?? "").trim();
      if (!text) return;

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

      const group = groups.find(
        (g) =>
          g.telegramId === chatId ||
          g.telegramId === `-100${chatId}` ||
          chatId.endsWith(g.telegramId.replace(/^-100/, "")),
      );
      if (!group) return;

      // Load active rules
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

        // Create alert
        await db.insert(signalwatchAlertsTable).values({
          clerkUserId: userId,
          groupId: group.id,
          groupName: group.name,
          ruleId: rule.id,
          ruleName: rule.name,
          message: text.slice(0, 2000),
          matchedKeywords: matched,
          receivedAt: new Date(),
          status: "unread",
          deliveryStatus: "internal",
        });

        // Push real-time notification to any open browser tabs for this user
        sendSSEEvent(userId, { type: "new_alert" });

        // Increment rule match count
        await db
          .update(signalwatchRulesTable)
          .set({ matchedCount: rule.matchedCount + 1 })
          .where(eq(signalwatchRulesTable.id, rule.id));

        // Update group last event
        await db
          .update(signalwatchGroupsTable)
          .set({ lastEventAt: new Date() })
          .where(eq(signalwatchGroupsTable.id, group.id));
      }
    } catch (err) {
      console.error("[telegram] message handler error:", err);
    }
  }, new NewMessage({ incoming: true }));
}

// ── Group sync ─────────────────────────────────────────────────────────────────
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

    if (!existing) {
      await db.insert(signalwatchGroupsTable).values({
        clerkUserId: userId,
        telegramId,
        name,
        username,
        status: "available",
        monitored: false,
      });
    } else {
      await db
        .update(signalwatchGroupsTable)
        .set({ name, username, status: "available" })
        .where(eq(signalwatchGroupsTable.id, existing.id));
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
          return false;
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
    console.info(`[telegram] session restored for user ${userId}`);
  } catch (err) {
    console.error(`[telegram] restoreSession failed for ${userId}:`, err);
  }
}

// ── Disconnect ─────────────────────────────────────────────────────────────────
export async function disconnectClient(userId: string): Promise<void> {
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
