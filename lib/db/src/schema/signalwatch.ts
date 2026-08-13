import { createInsertSchema } from "drizzle-zod";
import {
  boolean,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export const signalwatchProfilesTable = pgTable("signalwatch_profiles", {
  id: uuid("id").defaultRandom().primaryKey(),
  clerkUserId: text("clerk_user_id").notNull().unique(),
  language: text("language").notNull().default("pt-BR"),
  theme: text("theme").notNull().default("system"),
  timezone: text("timezone").notNull().default("America/Sao_Paulo"),
  dateFormat: text("date_format").notNull().default("dd/MM/yyyy"),
  timeFormat: text("time_format").notNull().default("24h"),
  inAppNotifications: boolean("in_app_notifications").notNull().default(true),
  isAdmin: boolean("is_admin").notNull().default(false),
  billingState: text("billing_state").notNull().default("trial"),
  planId: text("plan_id").notNull().default("starter"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const signalwatchGroupsTable = pgTable("signalwatch_groups", {
  id: uuid("id").defaultRandom().primaryKey(),
  clerkUserId: text("clerk_user_id").notNull(),
  telegramId: text("telegram_id").notNull(),
  name: text("name").notNull(),
  username: text("username"),
  status: text("status").notNull().default("paused"),
  monitored: boolean("monitored").notNull().default(false),
  messageCount: integer("message_count").notNull().default(0),
  lastEventAt: timestamp("last_event_at", { withTimezone: true }),
  appliedRules: integer("applied_rules").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const signalwatchRulesTable = pgTable("signalwatch_rules", {
  id: uuid("id").defaultRandom().primaryKey(),
  clerkUserId: text("clerk_user_id").notNull(),
  name: text("name").notNull(),
  keywords: text("keywords").array().notNull(),
  requiredKeywords: text("required_keywords").array().notNull().default([]),
  excludedKeywords: text("excluded_keywords").array().notNull().default([]),
  groupIds: text("group_ids").array().notNull(),
  matchType: text("match_type").notNull().default("partial"),
  active: boolean("active").notNull().default(true),
  priority: integer("priority").notNull().default(50),
  cooldownMinutes: integer("cooldown_minutes").notNull().default(15),
  matchedCount: integer("matched_count").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const signalwatchAlertsTable = pgTable("signalwatch_alerts", {
  id: uuid("id").defaultRandom().primaryKey(),
  clerkUserId: text("clerk_user_id").notNull(),
  groupId: text("group_id").notNull(),
  groupName: text("group_name").notNull(),
  ruleId: text("rule_id").notNull(),
  ruleName: text("rule_name").notNull(),
  message: text("message").notNull(),
  author: text("author"),
  matchedKeywords: text("matched_keywords").array().notNull(),
  receivedAt: timestamp("received_at", { withTimezone: true }).notNull(),
  status: text("status").notNull().default("unread"),
  favorite: boolean("favorite").notNull().default(false),
  messageLink: text("message_link"),
  deliveryStatus: text("delivery_status").notNull().default("internal"),
});

export const signalwatchConnectionsTable = pgTable("signalwatch_connections", {
  id: uuid("id").defaultRandom().primaryKey(),
  clerkUserId: text("clerk_user_id").notNull().unique(),
  status: text("status").notNull().default("not_connected"),
  accountLabel: text("account_label"),
  authorizedAt: timestamp("authorized_at", { withTimezone: true }),
  lastSyncAt: timestamp("last_sync_at", { withTimezone: true }),
  lastEventAt: timestamp("last_event_at", { withTimezone: true }),
  availableGroups: integer("available_groups").notNull().default(0),
  monitoringEnabled: boolean("monitoring_enabled").notNull().default(false),
  connectorAvailable: boolean("connector_available").notNull().default(false),
  message: text("message"),
  sessionCiphertext: text("session_ciphertext"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const signalwatchCheckoutsTable = pgTable("signalwatch_checkouts", {
  id: uuid("id").defaultRandom().primaryKey(),
  clerkUserId: text("clerk_user_id").notNull(),
  planId: text("plan_id").notNull(),
  cycle: text("cycle").notNull(),
  status: text("status").notNull().default("unavailable"),
  amountCents: integer("amount_cents").notNull(),
  qrCode: text("qr_code"),
  copyPaste: text("copy_paste"),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  mercadoPagoPaymentId: text("mercado_pago_payment_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ── Auth: email verifications (signup) ────────────────────────────────────────
export const signalwatchEmailVerificationsTable = pgTable(
  "signalwatch_email_verifications",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    email: text("email").notNull(),
    code: text("code").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    used: boolean("used").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
);

// ── Auth: password reset tokens ────────────────────────────────────────────────
export const signalwatchPasswordResetsTable = pgTable(
  "signalwatch_password_resets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    email: text("email").notNull(),
    tokenHash: text("token_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    used: boolean("used").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
);

export const insertSignalwatchProfileSchema = createInsertSchema(
  signalwatchProfilesTable,
).omit({ id: true, createdAt: true, updatedAt: true });
export const insertSignalwatchGroupSchema = createInsertSchema(
  signalwatchGroupsTable,
).omit({ id: true, createdAt: true });
export const insertSignalwatchRuleSchema = createInsertSchema(
  signalwatchRulesTable,
).omit({ id: true, createdAt: true, updatedAt: true });
export const insertSignalwatchAlertSchema = createInsertSchema(
  signalwatchAlertsTable,
).omit({ id: true });
export const insertSignalwatchConnectionSchema = createInsertSchema(
  signalwatchConnectionsTable,
).omit({ id: true, createdAt: true });
export const insertSignalwatchCheckoutSchema = createInsertSchema(
  signalwatchCheckoutsTable,
).omit({ id: true, createdAt: true });

export type SignalwatchProfile = typeof signalwatchProfilesTable.$inferSelect;
export type SignalwatchGroup = typeof signalwatchGroupsTable.$inferSelect;
export type SignalwatchRule = typeof signalwatchRulesTable.$inferSelect;
export type SignalwatchAlert = typeof signalwatchAlertsTable.$inferSelect;
export type SignalwatchConnection = typeof signalwatchConnectionsTable.$inferSelect;
export type SignalwatchCheckout = typeof signalwatchCheckoutsTable.$inferSelect;
export type SignalwatchPreferenceInput = z.infer<typeof insertSignalwatchProfileSchema>;
export type SignalwatchEmailVerification = typeof signalwatchEmailVerificationsTable.$inferSelect;
export type SignalwatchPasswordReset = typeof signalwatchPasswordResetsTable.$inferSelect;