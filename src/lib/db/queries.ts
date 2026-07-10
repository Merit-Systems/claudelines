import { and, desc, eq, gt, ilike, or, sql } from "drizzle-orm";

import { db, events, statuslines, type StatuslineRow } from "./index";
import type { StatuslineSpec } from "../statusline/spec";

export type SortKey = "installs" | "newest" | "revenue";

export async function listStatuslines(
  opts: { q?: string; sort?: SortKey; limit?: number } = {},
): Promise<StatuslineRow[]> {
  const { q, sort = "installs", limit = 60 } = opts;

  const order =
    sort === "newest"
      ? desc(statuslines.createdAt)
      : sort === "revenue"
        ? desc(statuslines.revenueUsd)
        : desc(statuslines.installs);

  return db()
    .select()
    .from(statuslines)
    .where(
      q
        ? or(
            ilike(statuslines.name, `%${q}%`),
            ilike(statuslines.description, `%${q}%`),
            ilike(statuslines.slug, `%${q}%`),
          )
        : undefined,
    )
    .orderBy(order, desc(statuslines.createdAt))
    .limit(limit);
}

export async function getStatusline(
  slug: string,
): Promise<StatuslineRow | null> {
  const rows = await db()
    .select()
    .from(statuslines)
    .where(eq(statuslines.slug, slug))
    .limit(1);
  return rows[0] ?? null;
}

export async function getFeatured(limit = 4): Promise<StatuslineRow[]> {
  return db()
    .select()
    .from(statuslines)
    .orderBy(desc(statuslines.featured), desc(statuslines.installs))
    .limit(limit);
}

export async function createStatusline(input: {
  slug: string;
  name: string;
  description: string;
  author: string;
  authorWallet: string | null;
  priceUsd: string;
  kind: "spec" | "script";
  spec: StatuslineSpec | null;
  script: string | null;
  previewAnsi: string | null;
  capabilities: string[];
  auditVerdict: string | null;
  auditSummary: string | null;
  auditModel: string | null;
  tags: string[];
  registeredBy: string | null;
}): Promise<StatuslineRow> {
  const [row] = await db()
    .insert(statuslines)
    .values({
      slug: input.slug,
      name: input.name,
      description: input.description,
      author: input.author,
      authorWallet: input.authorWallet,
      priceUsd: input.priceUsd,
      kind: input.kind,
      spec: input.spec,
      script: input.script,
      previewAnsi: input.previewAnsi,
      capabilities: input.capabilities,
      auditVerdict: input.auditVerdict,
      auditSummary: input.auditSummary,
      auditModel: input.auditModel,
      tags: input.tags,
    })
    .returning();

  await db().insert(events).values({
    statuslineId: row.id,
    kind: "register",
    wallet: input.registeredBy,
    amountUsd: "0.01",
  });

  return row;
}

export async function recordInstall(
  row: StatuslineRow,
  opts: {
    wallet: string | null;
    amountUsd: string;
    purchase: boolean;
    ipHash?: string | null;
  },
): Promise<void> {
  // Free installs dedupe per caller per day; purchases always count.
  if (!opts.purchase && opts.ipHash) {
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recent = await db()
      .select({ id: events.id })
      .from(events)
      .where(
        and(
          eq(events.statuslineId, row.id),
          eq(events.ipHash, opts.ipHash),
          gt(events.createdAt, dayAgo),
        ),
      )
      .limit(1);
    if (recent.length > 0) return;
  }

  await db()
    .update(statuslines)
    .set({
      installs: sql`${statuslines.installs} + 1`,
      revenueUsd: sql`${statuslines.revenueUsd} + ${opts.amountUsd}`,
    })
    .where(eq(statuslines.id, row.id));

  await db().insert(events).values({
    statuslineId: row.id,
    kind: opts.purchase ? "purchase" : "install",
    wallet: opts.wallet,
    amountUsd: opts.amountUsd,
    ipHash: opts.ipHash ?? null,
  });
}

export async function slugTaken(slug: string): Promise<boolean> {
  return (await getStatusline(slug)) !== null;
}
