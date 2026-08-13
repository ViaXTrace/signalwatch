import crypto from "node:crypto";
import { and, desc, eq, gte, ilike, or } from "drizzle-orm";
import { Router, type IRouter } from "express";
import { createClerkClient } from "@clerk/express";
import {
  ArchiveAlertBody,
  ArchiveAlertParams,
  ArchiveAlertResponse,
  CreateConnectionQrResponse,
  CreatePixCheckoutBody,
  CreatePixCheckoutResponse,
  CreateRuleBody,
  CreateRuleResponse,
  DeleteRuleParams,
  DisconnectTelegramResponse,
  FavoriteAlertBody,
  FavoriteAlertParams,
  FavoriteAlertResponse,
  GetBillingStatusResponse,
  GetConnectionStatusResponse,
  GetDashboardSummaryResponse,
  GetPreferencesResponse,
  ListAlertsQueryParams,
  ListAlertsResponse,
  ListBillingPlansResponse,
  ListGroupsQueryParams,
  ListGroupsResponse,
  ListRulesResponse,
  MarkAlertReadBody,
  MarkAlertReadParams,
  MarkAlertReadResponse,
  ReceivePaymentWebhookBody,
  ReceivePaymentWebhookResponse,
  RefreshConnectionResponse,
  SyncGroupsResponse,
  UpdateGroupMonitoringBody,
  UpdateGroupMonitoringParams,
  UpdateGroupMonitoringResponse,
  UpdatePreferencesBody,
  UpdatePreferencesResponse,
  UpdateRuleParams,
  UpdateRuleResponse,
} from "@workspace/api-zod";
import {
  db,
  signalwatchAlertsTable,
  signalwatchCheckoutsTable,
  signalwatchConnectionsTable,
  signalwatchGroupsTable,
  signalwatchProfilesTable,
  signalwatchRulesTable,
} from "@workspace/db";
import { requireAuth } from "../middlewares/auth";
import {
  BILLING_PLANS,
  connectionDto,
  ensureWorkspace,
  getBillingPlan,
  telegramConnectorAvailable,
} from "../lib/signalwatch";
import {
  startQRAuth,
  syncGroups,
  disconnectClient,
  restoreSession,
  getActiveClient,
  registerSSEClient,
  submit2FA,
} from "../lib/telegramService";

const router: IRouter = Router();

// ── SSE nonce store (single-use, 30s TTL) ─────────────────────────────────────
const sseNonces = new Map<string, { userId: string; expiresAt: number }>();

function userId(req: Express.Request): string {
  if (!req.userId) {
    throw new Error("Authenticated user is missing");
  }
  return req.userId;
}

function alertDto(alert: typeof signalwatchAlertsTable.$inferSelect) {
  return {
    id: alert.id,
    groupId: alert.groupId,
    groupName: alert.groupName,
    ruleId: alert.ruleId,
    ruleName: alert.ruleName,
    message: alert.message,
    author: alert.author,
    matchedKeywords: alert.matchedKeywords,
    receivedAt: alert.receivedAt,
    status: alert.status,
    favorite: alert.favorite,
    messageLink: alert.messageLink,
    deliveryStatus: alert.deliveryStatus,
  };
}

function groupDto(group: typeof signalwatchGroupsTable.$inferSelect) {
  return {
    id: group.id,
    name: group.name,
    username: group.username,
    status: group.status,
    monitored: group.monitored,
    messageCount: group.messageCount,
    lastEventAt: group.lastEventAt,
    appliedRules: group.appliedRules,
  };
}

function ruleDto(rule: typeof signalwatchRulesTable.$inferSelect) {
  return {
    id: rule.id,
    name: rule.name,
    keywords: rule.keywords,
    requiredKeywords: rule.requiredKeywords,
    excludedKeywords: rule.excludedKeywords,
    groupIds: rule.groupIds,
    matchType: rule.matchType,
    active: rule.active,
    priority: rule.priority,
    cooldownMinutes: rule.cooldownMinutes,
    matchedCount: rule.matchedCount,
    createdAt: rule.createdAt,
  };
}

function planDto(plan: (typeof BILLING_PLANS)[number]) {
  return { ...plan };
}

router.post("/billing/webhook", async (req, res): Promise<void> => {
  const parsed = ReceivePaymentWebhookBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  if (!process.env.MERCADOPAGO_ACCESS_TOKEN) {
    res.status(503).json({ received: false });
    return;
  }

  const paymentId =
    typeof parsed.data.data === "object" &&
    parsed.data.data !== null &&
    "id" in parsed.data.data
      ? String((parsed.data.data as { id: unknown }).id)
      : typeof parsed.data.id === "string"
        ? parsed.data.id
        : null;

  if (paymentId) {
    const response = await fetch(
      `https://api.mercadopago.com/v1/payments/${encodeURIComponent(paymentId)}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.MERCADOPAGO_ACCESS_TOKEN}`,
        },
      },
    );

    if (response.ok) {
      const payment = (await response.json()) as {
        id?: number;
        status?: string;
        external_reference?: string;
      };
      if (payment.external_reference && payment.status) {
        const nextStatus =
          payment.status === "approved"
            ? "paid"
            : payment.status === "rejected"
              ? "rejected"
              : payment.status === "cancelled"
                ? "expired"
                : "pending";
        await db
          .update(signalwatchCheckoutsTable)
          .set({ status: nextStatus, mercadoPagoPaymentId: String(payment.id ?? paymentId) })
          .where(eq(signalwatchCheckoutsTable.id, payment.external_reference));
        await db
          .update(signalwatchProfilesTable)
          .set({ billingState: nextStatus === "paid" ? "active" : "awaiting_payment" })
          .where(
            eq(
              signalwatchProfilesTable.clerkUserId,
              payment.external_reference.split(":")[0] ?? "",
            ),
          );
      }
    }
  }

  res.json(ReceivePaymentWebhookResponse.parse({ received: true }));
});

router.use(requireAuth);

router.get("/dashboard/summary", async (req, res): Promise<void> => {
  const currentUserId = userId(req);
  const { profile, connection } = await ensureWorkspace(currentUserId);
  const allAlerts = await db
    .select()
    .from(signalwatchAlertsTable)
    .where(eq(signalwatchAlertsTable.clerkUserId, currentUserId))
    .orderBy(desc(signalwatchAlertsTable.receivedAt));
  const rules = await db
    .select()
    .from(signalwatchRulesTable)
    .where(eq(signalwatchRulesTable.clerkUserId, currentUserId));
  const groups = await db
    .select()
    .from(signalwatchGroupsTable)
    .where(
      and(
        eq(signalwatchGroupsTable.clerkUserId, currentUserId),
        eq(signalwatchGroupsTable.monitored, true),
      ),
    );
  const plan = getBillingPlan(profile.planId);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const summary = {
    alertsToday: allAlerts.filter((alert) => alert.receivedAt >= today).length,
    unreadAlerts: allAlerts.filter((alert) => alert.status === "unread").length,
    activeRules: rules.filter((rule) => rule.active).length,
    monitoredGroups: groups.length,
    connection: connectionDto(connection),
    planUsage: {
      planName: plan.name,
      groupsUsed: groups.length,
      groupsLimit: plan.groupsLimit,
      keywordsUsed: rules.reduce((total, rule) => total + rule.keywords.length, 0),
      keywordsLimit: plan.keywordsLimit,
      historyDays: plan.historyDays,
    },
    recentAlerts: allAlerts.slice(0, 5).map(alertDto),
  };
  res.json(GetDashboardSummaryResponse.parse(summary));
});

router.get("/alerts", async (req, res): Promise<void> => {
  const currentUserId = userId(req);
  const query = ListAlertsQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  const conditions = [eq(signalwatchAlertsTable.clerkUserId, currentUserId)];
  const { search, groupId, ruleId, status, period, limit } = query.data;
  if (search) {
    conditions.push(
      or(
        ilike(signalwatchAlertsTable.message, `%${search}%`),
        ilike(signalwatchAlertsTable.groupName, `%${search}%`),
        ilike(signalwatchAlertsTable.ruleName, `%${search}%`),
      )!,
    );
  }
  if (groupId) conditions.push(eq(signalwatchAlertsTable.groupId, groupId));
  if (ruleId) conditions.push(eq(signalwatchAlertsTable.ruleId, ruleId));
  if (status === "favorite") conditions.push(eq(signalwatchAlertsTable.favorite, true));
  if (status === "unread" || status === "read" || status === "archived") {
    conditions.push(eq(signalwatchAlertsTable.status, status));
  }
  if (period !== "all") {
    const since = new Date();
    if (period === "today") since.setHours(0, 0, 0, 0);
    if (period === "7d") since.setDate(since.getDate() - 7);
    if (period === "30d") since.setDate(since.getDate() - 30);
    conditions.push(gte(signalwatchAlertsTable.receivedAt, since));
  }

  const alerts = await db
    .select()
    .from(signalwatchAlertsTable)
    .where(and(...conditions))
    .orderBy(desc(signalwatchAlertsTable.receivedAt))
    .limit(limit);
  res.json(ListAlertsResponse.parse(alerts.map(alertDto)));
});

router.patch("/alerts/:alertId/read", async (req, res): Promise<void> => {
  const params = MarkAlertReadParams.safeParse(req.params);
  const body = MarkAlertReadBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: (params.success ? body.error?.message : params.error?.message) ?? "Validation error" });
    return;
  }
  const [alert] = await db
    .update(signalwatchAlertsTable)
    .set({ status: body.data.read ? "read" : "unread" })
    .where(
      and(
        eq(signalwatchAlertsTable.id, params.data.alertId),
        eq(signalwatchAlertsTable.clerkUserId, userId(req)),
      ),
    )
    .returning();
  if (!alert) {
    res.status(404).json({ error: "Alert not found" });
    return;
  }
  res.json(MarkAlertReadResponse.parse(alertDto(alert)));
});

router.patch("/alerts/:alertId/archive", async (req, res): Promise<void> => {
  const params = ArchiveAlertParams.safeParse(req.params);
  const body = ArchiveAlertBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: (params.success ? body.error?.message : params.error?.message) ?? "Validation error" });
    return;
  }
  const [alert] = await db
    .update(signalwatchAlertsTable)
    .set({ status: body.data.archived ? "archived" : "read" })
    .where(
      and(
        eq(signalwatchAlertsTable.id, params.data.alertId),
        eq(signalwatchAlertsTable.clerkUserId, userId(req)),
      ),
    )
    .returning();
  if (!alert) {
    res.status(404).json({ error: "Alert not found" });
    return;
  }
  res.json(ArchiveAlertResponse.parse(alertDto(alert)));
});

router.patch("/alerts/:alertId/favorite", async (req, res): Promise<void> => {
  const params = FavoriteAlertParams.safeParse(req.params);
  const body = FavoriteAlertBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: (params.success ? body.error?.message : params.error?.message) ?? "Validation error" });
    return;
  }
  const [alert] = await db
    .update(signalwatchAlertsTable)
    .set({ favorite: body.data.favorite })
    .where(
      and(
        eq(signalwatchAlertsTable.id, params.data.alertId),
        eq(signalwatchAlertsTable.clerkUserId, userId(req)),
      ),
    )
    .returning();
  if (!alert) {
    res.status(404).json({ error: "Alert not found" });
    return;
  }
  res.json(FavoriteAlertResponse.parse(alertDto(alert)));
});

router.get("/groups", async (req, res): Promise<void> => {
  const query = ListGroupsQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }
  const currentUserId = userId(req);
  await ensureWorkspace(currentUserId);
  const conditions = [eq(signalwatchGroupsTable.clerkUserId, currentUserId)];
  if (query.data.search) {
    conditions.push(ilike(signalwatchGroupsTable.name, `%${query.data.search}%`));
  }
  if (query.data.status !== "all") {
    conditions.push(eq(signalwatchGroupsTable.status, query.data.status));
  }
  const groups = await db.select().from(signalwatchGroupsTable).where(and(...conditions));
  res.json(ListGroupsResponse.parse(groups.map(groupDto)));
});

router.patch("/groups/:groupId/monitoring", async (req, res): Promise<void> => {
  const params = UpdateGroupMonitoringParams.safeParse(req.params);
  const body = UpdateGroupMonitoringBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: (params.success ? body.error?.message : params.error?.message) ?? "Validation error" });
    return;
  }
  const [group] = await db
    .update(signalwatchGroupsTable)
    .set({ monitored: body.data.monitored, status: body.data.monitored ? "active" : "paused" })
    .where(
      and(
        eq(signalwatchGroupsTable.id, params.data.groupId),
        eq(signalwatchGroupsTable.clerkUserId, userId(req)),
      ),
    )
    .returning();
  if (!group) {
    res.status(404).json({ error: "Group not found" });
    return;
  }
  res.json(UpdateGroupMonitoringResponse.parse(groupDto(group)));
});

router.post("/groups/sync", async (req, res): Promise<void> => {
  await ensureWorkspace(userId(req));
  const groups = await db
    .select()
    .from(signalwatchGroupsTable)
    .where(eq(signalwatchGroupsTable.clerkUserId, userId(req)));
  res.json(SyncGroupsResponse.parse(groups.map(groupDto)));
});

router.get("/rules", async (req, res): Promise<void> => {
  await ensureWorkspace(userId(req));
  const rules = await db
    .select()
    .from(signalwatchRulesTable)
    .where(eq(signalwatchRulesTable.clerkUserId, userId(req)))
    .orderBy(desc(signalwatchRulesTable.createdAt));
  res.json(ListRulesResponse.parse(rules.map(ruleDto)));
});

router.post("/rules", async (req, res): Promise<void> => {
  const body = CreateRuleBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  const [rule] = await db
    .insert(signalwatchRulesTable)
    .values({
      clerkUserId: userId(req),
      ...body.data,
      requiredKeywords: body.data.requiredKeywords ?? [],
      excludedKeywords: body.data.excludedKeywords ?? [],
    })
    .returning();
  res.status(201).json(CreateRuleResponse.parse(ruleDto(rule)));
});

router.patch("/rules/:ruleId", async (req, res): Promise<void> => {
  const params = UpdateRuleParams.safeParse(req.params);
  const body = CreateRuleBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: (params.success ? body.error?.message : params.error?.message) ?? "Validation error" });
    return;
  }
  const [rule] = await db
    .update(signalwatchRulesTable)
    .set({
      ...body.data,
      requiredKeywords: body.data.requiredKeywords ?? [],
      excludedKeywords: body.data.excludedKeywords ?? [],
    })
    .where(
      and(
        eq(signalwatchRulesTable.id, params.data.ruleId),
        eq(signalwatchRulesTable.clerkUserId, userId(req)),
      ),
    )
    .returning();
  if (!rule) {
    res.status(404).json({ error: "Rule not found" });
    return;
  }
  res.json(UpdateRuleResponse.parse(ruleDto(rule)));
});

router.delete("/rules/:ruleId", async (req, res): Promise<void> => {
  const params = DeleteRuleParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [rule] = await db
    .delete(signalwatchRulesTable)
    .where(
      and(
        eq(signalwatchRulesTable.id, params.data.ruleId),
        eq(signalwatchRulesTable.clerkUserId, userId(req)),
      ),
    )
    .returning();
  if (!rule) {
    res.status(404).json({ error: "Rule not found" });
    return;
  }
  res.sendStatus(204);
});

router.get("/connection/status", async (req, res): Promise<void> => {
  const { connection } = await ensureWorkspace(userId(req));
  res.json(GetConnectionStatusResponse.parse(connectionDto(connection)));
});

router.post("/connection/qr", async (req, res): Promise<void> => {
  const { connection } = await ensureWorkspace(userId(req));

  if (!telegramConnectorAvailable()) {
    res.json(
      CreateConnectionQrResponse.parse({
        status: "unavailable",
        qrData: null,
        expiresAt: null,
        message: "A conexão Telegram ainda não está configurada.",
      }),
    );
    return;
  }

  // If already connected, restore session if needed and return connected status
  if (connection.status === "connected" && connection.sessionCiphertext) {
    restoreSession(userId(req), connection.sessionCiphertext).catch(console.error);
    res.json(
      CreateConnectionQrResponse.parse({
        status: "connected",
        qrData: null,
        expiresAt: null,
        message: null,
      }),
    );
    return;
  }

  const result = await startQRAuth(userId(req));

  if ("error" in result) {
    res.json(
      CreateConnectionQrResponse.parse({
        status: "error",
        qrData: null,
        expiresAt: null,
        message: result.error,
      }),
    );
    return;
  }

  res.json(
    CreateConnectionQrResponse.parse({
      status: "qr_pending",
      qrData: result.dataUrl,
      expiresAt: result.expiresAt,
      message: null,
    }),
  );
});

router.post("/connection/sync", async (req, res): Promise<void> => {
  const { connection } = await ensureWorkspace(userId(req));

  // If connected, restore session and sync real groups
  if (connection.status === "connected" && connection.sessionCiphertext) {
    const client = getActiveClient(userId(req));
    if (client) {
      await syncGroups(userId(req), client).catch(console.error);
    } else {
      await restoreSession(userId(req), connection.sessionCiphertext);
      const restored = getActiveClient(userId(req));
      if (restored) await syncGroups(userId(req), restored).catch(console.error);
    }
  }

  const [updated] = await db
    .select()
    .from(signalwatchConnectionsTable)
    .where(eq(signalwatchConnectionsTable.clerkUserId, userId(req)))
    .limit(1);

  res.json(RefreshConnectionResponse.parse(connectionDto(updated ?? connection)));
});

router.post("/connection/disconnect", async (req, res): Promise<void> => {
  await disconnectClient(userId(req));
  const [connection] = await db
    .update(signalwatchConnectionsTable)
    .set({
      status: "disconnected",
      monitoringEnabled: false,
      sessionCiphertext: null,
      message: "A sessão foi desconectada. Uma nova autorização será necessária.",
    })
    .where(eq(signalwatchConnectionsTable.clerkUserId, userId(req)))
    .returning();
  res.json(DisconnectTelegramResponse.parse(connectionDto(connection)));
});

router.get("/billing/plans", async (_req, res): Promise<void> => {
  res.json(ListBillingPlansResponse.parse(BILLING_PLANS.map(planDto)));
});

router.get("/billing/status", async (req, res): Promise<void> => {
  const { profile } = await ensureWorkspace(userId(req));
  const plan = getBillingPlan(profile.planId);
  const groups = await db
    .select()
    .from(signalwatchGroupsTable)
    .where(
      and(
        eq(signalwatchGroupsTable.clerkUserId, userId(req)),
        eq(signalwatchGroupsTable.monitored, true),
      ),
    );
  const rules = await db
    .select()
    .from(signalwatchRulesTable)
    .where(eq(signalwatchRulesTable.clerkUserId, userId(req)));
  const [checkout] = await db
    .select()
    .from(signalwatchCheckoutsTable)
    .where(eq(signalwatchCheckoutsTable.clerkUserId, userId(req)))
    .orderBy(desc(signalwatchCheckoutsTable.createdAt))
    .limit(1);
  const response = {
    state: profile.billingState,
    plan: planDto(plan),
    usage: {
      planName: plan.name,
      groupsUsed: groups.length,
      groupsLimit: plan.groupsLimit,
      keywordsUsed: rules.reduce((total, rule) => total + rule.keywords.length, 0),
      keywordsLimit: plan.keywordsLimit,
      historyDays: plan.historyDays,
    },
    nextBillingAt: null,
    lastPaymentAt: null,
    checkout: checkout
      ? {
          id: checkout.id,
          status: checkout.status,
          amountCents: checkout.amountCents,
          qrCode: checkout.qrCode,
          copyPaste: checkout.copyPaste,
          expiresAt: checkout.expiresAt,
          message: checkout.status === "unavailable" ? "Mercado Pago ainda não foi configurado." : null,
        }
      : null,
  };
  res.json(GetBillingStatusResponse.parse(response));
});

router.post("/billing/checkout", async (req, res): Promise<void> => {
  const body = CreatePixCheckoutBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  const plan = getBillingPlan(body.data.planId);
  const amountCents = body.data.cycle === "annual" ? plan.annualPriceCents : plan.monthlyPriceCents;
  const currentUserId = userId(req);
  let status = "unavailable";
  let qrCode: string | null = null;
  let copyPaste: string | null = null;
  let expiresAt: Date | null = null;
  let mercadoPagoPaymentId: string | null = null;
  let message: string | null = "Mercado Pago ainda não foi configurado. A cobrança ficará disponível após a credencial ser adicionada.";

  if (process.env.MERCADOPAGO_ACCESS_TOKEN) {
    try {
      const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });
      const clerkUser = await clerk.users.getUser(currentUserId);
      const email = clerkUser.primaryEmailAddress?.emailAddress;
      if (!email) throw new Error("No billing email available");
      expiresAt = new Date(Date.now() + 30 * 60 * 1000);
      const response = await fetch("https://api.mercadopago.com/v1/payments", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.MERCADOPAGO_ACCESS_TOKEN}`,
          "Content-Type": "application/json",
          "X-Idempotency-Key": `${currentUserId}:${plan.id}:${body.data.cycle}:${Date.now()}`,
        },
        body: JSON.stringify({
          transaction_amount: amountCents / 100,
          description: `SignalWatch ${plan.name} - ${body.data.cycle}`,
          payment_method_id: "pix",
          external_reference: `${currentUserId}:${crypto.randomUUID()}`,
          payer: { email },
          date_of_expiration: expiresAt.toISOString(),
        }),
      });
      if (response.ok) {
        const payment = (await response.json()) as {
          id?: number;
          status?: string;
          point_of_interaction?: {
            transaction_data?: { qr_code?: string; qr_code_base64?: string };
          };
        };
        status = payment.status === "approved" ? "paid" : "pending";
        mercadoPagoPaymentId = payment.id ? String(payment.id) : null;
        copyPaste = payment.point_of_interaction?.transaction_data?.qr_code ?? null;
        qrCode = payment.point_of_interaction?.transaction_data?.qr_code_base64
          ? `data:image/png;base64,${payment.point_of_interaction.transaction_data.qr_code_base64}`
          : null;
        message = null;
      }
    } catch (error) {
      req.log.warn({ err: error }, "Mercado Pago checkout unavailable");
    }
  }

  const [checkout] = await db
    .insert(signalwatchCheckoutsTable)
    .values({
      clerkUserId: currentUserId,
      planId: plan.id,
      cycle: body.data.cycle,
      status,
      amountCents,
      qrCode,
      copyPaste,
      expiresAt,
      mercadoPagoPaymentId,
    })
    .returning();
  const response = {
    id: checkout.id,
    status: checkout.status,
    amountCents: checkout.amountCents,
    qrCode: checkout.qrCode,
    copyPaste: checkout.copyPaste,
    expiresAt: checkout.expiresAt,
    message,
  };
  res.status(201).json(CreatePixCheckoutResponse.parse(response));
});

router.get("/preferences", async (req, res): Promise<void> => {
  const { profile } = await ensureWorkspace(userId(req));
  res.json(
    GetPreferencesResponse.parse({
      language: profile.language,
      theme: profile.theme,
      timezone: profile.timezone,
      dateFormat: profile.dateFormat,
      timeFormat: profile.timeFormat,
      inAppNotifications: profile.inAppNotifications,
    }),
  );
});

router.patch("/preferences", async (req, res): Promise<void> => {
  const body = UpdatePreferencesBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  const [profile] = await db
    .update(signalwatchProfilesTable)
    .set(body.data)
    .where(eq(signalwatchProfilesTable.clerkUserId, userId(req)))
    .returning();
  if (!profile) {
    res.status(404).json({ error: "Preferences not found" });
    return;
  }
  res.json(
    UpdatePreferencesResponse.parse({
      language: profile.language,
      theme: profile.theme,
      timezone: profile.timezone,
      dateFormat: profile.dateFormat,
      timeFormat: profile.timeFormat,
      inAppNotifications: profile.inAppNotifications,
    }),
  );
});

// ── Audit logging middleware ──────────────────────────────────────────────────
// Logs every authenticated request: userId, method, route, IP, timestamp
router.use((req, _res, next) => {
  const uid = req.userId;
  if (uid) {
    const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ?? req.socket?.remoteAddress ?? "unknown";
    console.log(
      JSON.stringify({
        level: "audit",
        ts: new Date().toISOString(),
        userId: uid,
        method: req.method,
        route: req.path,
        ip,
      }),
    );
  }
  next();
});

// ── Profile name update (via Clerk Management API) ────────────────────────────
router.post("/profile/name", requireAuth, async (req, res): Promise<void> => {
  const { firstName, lastName } = req.body as {
    firstName?: string;
    lastName?: string;
  };
  if (!firstName?.trim()) {
    res.status(400).json({ error: "firstName is required" });
    return;
  }
  const clerkResp = await fetch(
    `https://api.clerk.com/v1/users/${userId(req)}`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${process.env.CLERK_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        first_name: firstName.trim(),
        last_name: lastName?.trim() ?? "",
      }),
    },
  );
  if (!clerkResp.ok) {
    console.error("[profile/name] Clerk API error:", await clerkResp.text());
    res.status(500).json({ error: "Failed to update name" });
    return;
  }
  res.json({ ok: true });
});

// ── SSE auth — generates a single-use nonce for EventSource ──────────────────
router.post(
  "/connection/events/auth",
  requireAuth,
  async (req, res): Promise<void> => {
    const nonce = crypto.randomUUID();
    sseNonces.set(nonce, { userId: userId(req), expiresAt: Date.now() + 30_000 });
    setTimeout(() => sseNonces.delete(nonce), 30_000);
    res.json({ nonce });
  },
);

// ── SSE stream — delivers QR rotations, connected and 2FA events ──────────────
router.get("/connection/events", async (req, res): Promise<void> => {
  const nonce = req.query.nonce as string;
  const record = nonce ? sseNonces.get(nonce) : undefined;
  if (!record || Date.now() > record.expiresAt) {
    sseNonces.delete(nonce);
    res.status(401).end();
    return;
  }
  sseNonces.delete(nonce); // single-use

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no"); // disable nginx buffering
  res.flushHeaders();

  const uid = record.userId;
  const cleanup = registerSSEClient(uid, res);

  // Keepalive ping every 20s to prevent proxy timeouts
  const ping = setInterval(() => {
    if (!res.writableEnded) {
      res.write(`data: ${JSON.stringify({ type: "ping" })}\n\n`);
    } else {
      clearInterval(ping);
    }
  }, 20_000);

  req.on("close", () => {
    clearInterval(ping);
    cleanup();
  });
});

// ── 2FA password submission ───────────────────────────────────────────────────
router.post(
  "/connection/2fa",
  requireAuth,
  async (req, res): Promise<void> => {
    const { password } = req.body as { password?: string };
    if (!password?.trim()) {
      res.status(400).json({ error: "password is required" });
      return;
    }
    const ok = await submit2FA(userId(req), password);
    if (!ok) {
      res.status(404).json({ error: "No pending 2FA for this user" });
      return;
    }
    res.json({ ok: true });
  },
);

// ── Connected sessions (Clerk Management API) ─────────────────────────────────
router.get("/profile/sessions", requireAuth, async (req, res): Promise<void> => {
  const uid = userId(req);
  const resp = await fetch(
    `https://api.clerk.com/v1/sessions?user_id=${uid}&status=active&limit=20`,
    { headers: { Authorization: `Bearer ${process.env.CLERK_SECRET_KEY}` } },
  );
  if (!resp.ok) {
    console.error("[profile/sessions] Clerk API error:", resp.status);
    res.status(502).json({ error: "Failed to fetch sessions" });
    return;
  }
  const raw = (await resp.json()) as Array<{
    id: string;
    last_active_at: number;
    created_at: number;
    latest_activity?: {
      ip_address?: string;
      city?: string;
      country?: string;
      browser_name?: string;
      browser_version?: string;
      is_mobile?: boolean;
    };
  }>;
  res.json(
    raw.map((s) => ({
      id: s.id,
      lastActiveAt: new Date(s.last_active_at * 1000).toISOString(),
      createdAt: new Date(s.created_at * 1000).toISOString(),
      ip: s.latest_activity?.ip_address ?? null,
      city: s.latest_activity?.city ?? null,
      country: s.latest_activity?.country ?? null,
      browser: s.latest_activity?.browser_name
        ? `${s.latest_activity.browser_name}${s.latest_activity.browser_version ? ` ${s.latest_activity.browser_version.split(".")[0]}` : ""}`
        : null,
      deviceType: s.latest_activity?.is_mobile ? "mobile" : "desktop",
    })),
  );
});

// ── Support: report a problem ─────────────────────────────────────────────────
router.post("/support/report", requireAuth, async (req, res): Promise<void> => {
  const { category, description } = req.body as { category?: string; description?: string };
  if (!category || !description?.trim()) {
    res.status(400).json({ error: "category and description are required" });
    return;
  }
  const uid = userId(req);
  const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim()
    ?? req.socket?.remoteAddress ?? "unknown";
  console.log(
    JSON.stringify({
      level: "support",
      ts: new Date().toISOString(),
      userId: uid,
      ip,
      category,
      description,
    }),
  );
  res.json({ ok: true });
});

export default router;