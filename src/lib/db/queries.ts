import { and, asc, desc, eq, gt, ilike, or, sql } from "drizzle-orm";

import { db, events, feedback, statuslines, type StatuslineRow } from "./index";

export type SortKey = "installs" | "newest" | "revenue";
export type SortDirection = "asc" | "desc";

export async function listStatuslines(
  opts: {
    q?: string;
    sort?: SortKey;
    direction?: SortDirection;
    limit?: number;
  } = {},
): Promise<StatuslineRow[]> {
  const { q, sort = "installs", direction = "desc", limit = 60 } = opts;

  const orderColumn =
    sort === "newest"
      ? statuslines.createdAt
      : sort === "revenue"
        ? statuslines.revenueUsd
        : statuslines.installs;
  const order = direction === "asc" ? asc(orderColumn) : desc(orderColumn);

  return db()
    .select()
    .from(statuslines)
    .where(
      q
        ? and(
            eq(statuslines.hidden, false),
            or(
              ilike(statuslines.name, `%${q}%`),
              ilike(statuslines.description, `%${q}%`),
              ilike(statuslines.slug, `%${q}%`),
            ),
          )
        : eq(statuslines.hidden, false),
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
    .where(eq(statuslines.hidden, false))
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
  script: string;
  previewAnsi: string | null;
  capabilities: string[];
  auditVerdict: string | null;
  auditSummary: string | null;
  auditModel: string | null;
  redFlags: string[];
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
      kind: "script",
      script: input.script,
      previewAnsi: input.previewAnsi,
      capabilities: input.capabilities,
      auditVerdict: input.auditVerdict,
      auditSummary: input.auditSummary,
      auditModel: input.auditModel,
      redFlags: input.redFlags,
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

/** Counts every settled sale (incl. self-buys) — drives the fee rotation. */
export async function bumpSalesCount(row: StatuslineRow): Promise<void> {
  await db()
    .update(statuslines)
    .set({ salesCount: sql`${statuslines.salesCount} + 1` })
    .where(eq(statuslines.id, row.id));
}

/** After identity verification, stamp @handle on everything this wallet owns. */
export async function adoptVerifiedAuthor(
  wallet: string,
  handle: string,
): Promise<void> {
  await db()
    .update(statuslines)
    .set({ author: `@${handle}` })
    .where(eq(statuslines.authorWallet, wallet.toLowerCase()));
}

/** Everything a creator wallet has published. */
export async function listByWallet(wallet: string): Promise<StatuslineRow[]> {
  return db()
    .select()
    .from(statuslines)
    .where(
      and(
        eq(statuslines.authorWallet, wallet.toLowerCase()),
        eq(statuslines.hidden, false),
      ),
    )
    .orderBy(desc(statuslines.installs), desc(statuslines.createdAt));
}

const REPORT_HIDE_THRESHOLD = 5;

export type FeedbackRow = typeof feedback.$inferSelect;

/** Upsert a wallet's review (one per wallet per listing). */
export async function upsertReview(
  row: StatuslineRow,
  wallet: string,
  rating: number,
  comment: string | null,
): Promise<void> {
  const w = wallet.toLowerCase();
  const existing = await db()
    .select({ id: feedback.id })
    .from(feedback)
    .where(
      and(
        eq(feedback.statuslineId, row.id),
        eq(feedback.wallet, w),
        eq(feedback.kind, "review"),
      ),
    )
    .limit(1);
  if (existing[0]) {
    await db()
      .update(feedback)
      .set({ rating, comment, createdAt: new Date() })
      .where(eq(feedback.id, existing[0].id));
  } else {
    await db()
      .insert(feedback)
      .values({ statuslineId: row.id, kind: "review", wallet: w, rating, comment });
  }
}

/** Record a report; auto-hide once enough DISTINCT wallets report. */
export async function addReport(
  row: StatuslineRow,
  wallet: string,
  comment: string,
): Promise<{ hidden: boolean }> {
  const w = wallet.toLowerCase();
  await db()
    .insert(feedback)
    .values({ statuslineId: row.id, kind: "report", wallet: w, comment });
  const distinct = await db()
    .selectDistinct({ wallet: feedback.wallet })
    .from(feedback)
    .where(and(eq(feedback.statuslineId, row.id), eq(feedback.kind, "report")));
  const hide = row.hidden || distinct.length >= REPORT_HIDE_THRESHOLD;
  if (hide !== row.hidden) {
    await db()
      .update(statuslines)
      .set({ hidden: hide, reportCount: distinct.length })
      .where(eq(statuslines.id, row.id));
  }
  return { hidden: hide };
}

/** Reviews + reports for a listing, plus the rating aggregate. */
export async function getFeedback(statuslineId: string): Promise<{
  reviews: FeedbackRow[];
  reports: FeedbackRow[];
  avg: number | null;
  count: number;
}> {
  const rows = await db()
    .select()
    .from(feedback)
    .where(eq(feedback.statuslineId, statuslineId))
    .orderBy(desc(feedback.createdAt));
  const reviews = rows.filter((r) => r.kind === "review");
  const reports = rows.filter((r) => r.kind === "report");
  const rated = reviews.filter((r) => typeof r.rating === "number");
  const avg = rated.length
    ? rated.reduce((n, r) => n + (r.rating ?? 0), 0) / rated.length
    : null;
  return { reviews, reports, avg, count: rated.length };
}

/** Admin delist / relist. */
export async function setHidden(slug: string, hidden: boolean): Promise<void> {
  await db()
    .update(statuslines)
    .set({ hidden })
    .where(eq(statuslines.slug, slug));
}
