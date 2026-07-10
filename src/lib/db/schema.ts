import {
  boolean,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import type { StatuslineSpec } from "../statusline/spec";

export const statuslines = pgTable("statuslines", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  author: text("author").notNull().default("anonymous"),
  /** EVM address paid on purchases (x402 payTo). Null → platform wallet. */
  authorWallet: text("author_wallet"),
  /** Decimal USD string; "0" = free. */
  priceUsd: numeric("price_usd", { precision: 10, scale: 6 })
    .notNull()
    .default("0"),
  /**
   * Two tiers:
   *  - "spec": data-only JSON rendered by the auditable renderer (safe badge)
   *  - "script": an existing statusline uploaded as-is; runs on the user's
   *    machine, so listings carry detected capabilities and a review gate
   */
  kind: text("kind", { enum: ["spec", "script"] })
    .notNull()
    .default("spec"),
  spec: jsonb("spec").$type<StatuslineSpec>(),
  /** Raw script source (kind = "script"). */
  script: text("script"),
  /** Captured sample output (ANSI allowed) used for previews of scripts. */
  previewAnsi: text("preview_ansi"),
  /** Heuristically detected capabilities: network, exec, fs-write, env. */
  capabilities: text("capabilities").array().notNull().default([]),
  /** LLM audit at registration (kind = "script"): approve | caution. */
  auditVerdict: text("audit_verdict"),
  /** One-paragraph, user-facing summary of what the script does. */
  auditSummary: text("audit_summary"),
  auditModel: text("audit_model"),
  tags: text("tags").array().notNull().default([]),
  installs: integer("installs").notNull().default(0),
  revenueUsd: numeric("revenue_usd", { precision: 12, scale: 6 })
    .notNull()
    .default("0"),
  featured: boolean("featured").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const events = pgTable("events", {
  id: uuid("id").primaryKey().defaultRandom(),
  statuslineId: uuid("statusline_id")
    .notNull()
    .references(() => statuslines.id, { onDelete: "cascade" }),
  kind: text("kind", { enum: ["register", "install", "purchase"] }).notNull(),
  /** Paying/authenticated wallet when known. */
  wallet: text("wallet"),
  /** Salted hash of caller IP — dedupes free installs, never stores raw IPs. */
  ipHash: text("ip_hash"),
  amountUsd: numeric("amount_usd", { precision: 10, scale: 6 })
    .notNull()
    .default("0"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type StatuslineRow = typeof statuslines.$inferSelect;
export type NewStatuslineRow = typeof statuslines.$inferInsert;
