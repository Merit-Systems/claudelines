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

/** A companion Claude Code slash-command file shipped with a listing —
 *  installed to ~/.claude/commands/, so it is a PROMPT the user's agent
 *  executes with full tool access. Treat the content as code, not data. */
export type CompanionFile = { path: string; content: string };

export const statuslines = pgTable("statuslines", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  /** The creator's wallet: pays the registration fee, receives sale
   *  proceeds (x402 payTo), and is the sole authorship anchor — display
   *  credit is derived from its verified X identity at read time. Null only
   *  for platform seeds. */
  authorWallet: text("author_wallet"),
  /** Decimal USD string; "0" = free. */
  priceUsd: numeric("price_usd", { precision: 10, scale: 6 })
    .notNull()
    .default("0"),
  /** Retained for old rows; every listing is now a script. */
  kind: text("kind", { enum: ["spec", "script"] })
    .notNull()
    .default("script"),
  /** Legacy data-only spec column, retained for old rows; unused. */
  spec: jsonb("spec"),
  /** The uploaded statusline script source. Runs on the user's machine. */
  script: text("script"),
  /** Captured sample output (ANSI allowed) used for previews of scripts. */
  previewAnsi: text("preview_ansi"),
  /** Optional captured animation frames the site plays at 1 fps. Inert text
   *  like previewAnsi — never executed, replaceable without a re-audit. */
  previewFrames: text("preview_frames").array(),
  /** Optional companion command files (`commands/<name>.md`) shipped with the
   *  script. NOT inert: each installs to ~/.claude/commands/ and is executed
   *  by the user's agent as a prompt, so every content goes through the same
   *  red-flag scan and LLM audit as the script itself. */
  files: jsonb("files").$type<CompanionFile[]>(),
  /** Heuristically detected capabilities: network, exec, fs-write, env. */
  capabilities: text("capabilities").array().notNull().default([]),
  /** LLM audit at registration (kind = "script"): approve | caution. */
  auditVerdict: text("audit_verdict"),
  /** One-paragraph, user-facing summary of what the script does. */
  auditSummary: text("audit_summary"),
  auditModel: text("audit_model"),
  /** Deterministic red-flag scanner hits recorded at registration. */
  redFlags: text("red_flags").array().notNull().default([]),
  /** Delisted by moderation (admin, audit reject, report threshold): hidden
   *  from all public reads and payload/download endpoints. Owners cannot
   *  clear this flag. */
  hidden: boolean("hidden").notNull().default(false),
  /** Delisted by the owner. Same public effect as hidden, but freely
   *  reversible by the owning wallet; the slug stays reserved. */
  archived: boolean("archived").notNull().default(false),
  /** Community report tally; a threshold auto-hides pending human review. */
  reportCount: integer("report_count").notNull().default(0),
  tags: text("tags").array().notNull().default([]),
  installs: integer("installs").notNull().default(0),
  /** Every settled sale, including wash-guarded self-buys. Private. */
  salesCount: integer("sales_count").notNull().default(0),
  revenueUsd: numeric("revenue_usd", { precision: 12, scale: 6 })
    .notNull()
    .default("0"),
  featured: boolean("featured").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/** Wallet → verified Twitter/X identity. The wallet (SIWX) is the account. */
export const identities = pgTable("identities", {
  /** Lowercased EVM address, proven via SIWX signature. */
  wallet: text("wallet").primaryKey(),
  /** X handle without @ — set from the OAuth profile on verification. */
  twitterHandle: text("twitter_handle"),
  /** X profile picture URL, captured with the handle on verification. */
  twitterAvatarUrl: text("twitter_avatar_url"),
  /** Pending "Sign in with X" OAuth state; cleared once verified. */
  oauthState: text("oauth_state").unique(),
  /** PKCE code_verifier for the pending OAuth flow; cleared once verified. */
  oauthVerifier: text("oauth_verifier"),
  verified: boolean("verified").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  verifiedAt: timestamp("verified_at", { withTimezone: true }),
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

/**
 * Wallet-signed feedback (SIWX, free). A "review" carries a 0–5 rating and
 * optional comment (one per wallet per listing, upserted). A "report" is a
 * text flag (many allowed); enough distinct reporting wallets auto-hides.
 */
export const feedback = pgTable("feedback", {
  id: uuid("id").primaryKey().defaultRandom(),
  statuslineId: uuid("statusline_id")
    .notNull()
    .references(() => statuslines.id, { onDelete: "cascade" }),
  kind: text("kind", { enum: ["review", "report"] }).notNull(),
  /** Signing wallet (lowercased). SIWX-proven. */
  wallet: text("wallet").notNull(),
  /** 0–5 for reviews, null for reports. */
  rating: integer("rating"),
  /** Up to 1000 chars. */
  comment: text("comment"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type StatuslineRow = typeof statuslines.$inferSelect;
export type NewStatuslineRow = typeof statuslines.$inferInsert;
