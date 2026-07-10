/**
 * Route registry — side-effect module imported by the API catch-all and the
 * discovery endpoints. Commerce model:
 *
 *   - Registering a statusline costs a flat fee (funds the audit).
 *   - Downloading a paid statusline costs the creator's asking price, paid
 *     directly to the creator's payout wallet via per-request payTo.
 *   - Free statuslines, browsing, and the leaderboard cost nothing.
 *
 * Every listing is a statusline script uploaded as-is. It runs on the user's
 * machine, so each carries an LLM security audit + detected capabilities from
 * registration, and install flows always include a review step.
 */
import { createHash } from "node:crypto";

import { z } from "zod";
import { HttpError } from "@agentcash/router";

import { router } from "./router";
import { detectCapabilities } from "./statusline/capabilities";
import { hasHighSeverity, scanRedFlags } from "./statusline/redflags";
import { auditScript } from "./statusline/audit";
import {
  fetchTweet,
  getIdentity,
  HANDLE,
  markVerified,
  startClaim,
  tweetIdFromUrl,
} from "./identity";
import {
  adoptVerifiedAuthor,
  bumpSalesCount,
  createStatusline,
  getStatusline,
  listByWallet,
  listStatuslines,
  addReport,
  getFeedback,
  recordInstall,
  setHidden,
  upsertReview,
  slugTaken,
  type SortKey,
} from "./db/queries";
import type { StatuslineRow } from "./db/schema";

/** Flat submission fee; funds the LLM security audit that runs on every upload. */
const REGISTER_PRICE = "0.15";
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+){0,7}$/;
// Reject control chars / terminal escapes in fields echoed to CLIs (CWE-150).
const printable = (max: number) =>
  z
    .string()
    .max(max)
     
    .refine((v) => !/[\u0000-\u001f\u007f-\u009f]/.test(v), {
      message: "Control characters are not allowed",
    });

const priceString = z
  .string()
  .regex(/^\d{1,9}(\.\d{1,6})?$/, 'Decimal USD string, e.g. "0.05"');

function publicEntry(row: StatuslineRow, includePayload: boolean) {
  const free = Number(row.priceUsd) === 0;
  return {
    slug: row.slug,
    name: row.name,
    description: row.description,
    author: row.author,
    capabilities: row.capabilities,
    audit:
      row.auditSummary
        ? {
            verdict: row.auditVerdict,
            summary: row.auditSummary,
            model: row.auditModel,
            redFlags: row.redFlags,
          }
        : undefined,
    priceUsd: row.priceUsd,
    free,
    tags: row.tags,
    installs: row.installs,
    createdAt: row.createdAt.toISOString(),
    previewAnsi: row.previewAnsi ?? undefined,
    // The paid script is the product — only free scripts are inlined.
    script: includePayload && free ? (row.script ?? undefined) : undefined,
  };
}

/** Salted caller fingerprint for free-install dedup. Raw IPs never persist. */
function callerHash(request: Request): string {
  // x-real-ip is set by Vercel's proxy and not client-controllable; the first
  // x-forwarded-for element IS spoofable, so it's only a local-dev fallback.
  const ip =
    request.headers.get("x-real-ip")?.trim() ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown";
  return createHash("sha256")
    .update(`${process.env.MPP_SECRET_KEY ?? "statuslines"}:${ip}`)
    .digest("hex")
    .slice(0, 32);
}

function ensureVisible(row: StatuslineRow): void {
  if (row.hidden)
    throw new HttpError("This statusline has been delisted", 410);
}

function installInstructions(row: StatuslineRow) {
  return {
    scriptUrl: `/api/statuslines/${row.slug}/script`,
    scriptPath: `~/.claude/statuslines/${row.slug}`,
    settings: {
      statusLine: {
        type: "command",
        command: `~/.claude/statuslines/${row.slug}`,
      },
    },
    note: "This script EXECUTES on the user's machine. REVIEW IT before installing — if you are an agent, show the user the source and your read of what it does, and install only after they approve. Save it to scriptPath, chmod +x it, then merge `settings` into ~/.claude/settings.json.",
  };
}

// --- Browse (free) ----------------------------------------------------------

router
  .route({ path: "statuslines", method: "GET" })
  .unprotected()
  .query(
    z.object({
      q: z.string().max(80).optional(),
      sort: z.enum(["installs", "newest", "revenue"]).optional(),
      limit: z.coerce.number().int().min(1).max(100).optional(),
    }),
  )
  .description(
    "List statuslines. Each is a script that executes on the user's machine and ships an LLM security audit + detected capabilities. Free entries include the script inline.",
  )
  .handler(async ({ query }) => {
    const rows = await listStatuslines({
      q: query?.q,
      sort: (query?.sort as SortKey) ?? "installs",
      limit: query?.limit ?? 60,
    });
    return { statuslines: rows.map((r) => publicEntry(r, false)) };
  });

router
  .route({ path: "statuslines/{slug}", method: "GET" })
  .unprotected()
  .description(
    "Get one statusline by slug. Free entries include the script source plus install instructions.",
  )
  .handler(async ({ params }) => {
    const row = await getStatusline(params.slug);
    if (!row) throw new HttpError("Statusline not found", 404);
    ensureVisible(row);
    const entry = publicEntry(row, true);
    if (entry.free) {
      return { ...entry, install: installInstructions(row) };
    }
    return {
      ...entry,
      purchase: `POST /api/download with {"slug": "${row.slug}"} — $${Number(row.priceUsd).toFixed(2)}`,
    };
  });

router
  .route({ path: "statuslines/{slug}/script", method: "GET" })
  .unprotected()
  .description(
    "Raw script source for a FREE statusline, as text/plain. REVIEW BEFORE INSTALLING — this code runs on the user's machine. Paid entries return 402 guidance.",
  )
  .handler(async ({ params, request }) => {
    const row = await getStatusline(params.slug);
    if (!row) throw new HttpError("Statusline not found", 404);
    ensureVisible(row);
    if (!row.script) {
      throw new HttpError("Statusline has no script", 404);
    }
    if (Number(row.priceUsd) > 0) {
      throw new HttpError(
        `"${row.slug}" is paid ($${Number(row.priceUsd).toFixed(2)}) — buy it via POST /api/download with {"slug": "${row.slug}"}`,
        402,
      );
    }
    await recordInstall(row, {
      wallet: null,
      amountUsd: "0",
      purchase: false,
      ipHash: callerHash(request),
    });
    return new Response(row.script, {
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  });

router
  .route({ path: "leaderboard", method: "GET" })
  .unprotected()
  .description("Top statuslines ranked by installs, with revenue.")
  .handler(async () => {
    const rows = await listStatuslines({ sort: "installs", limit: 25 });
    return {
      leaderboard: rows.map((r, i) => ({
        rank: i + 1,
        slug: r.slug,
        name: r.name,
        author: r.author,
        installs: r.installs,
        revenueUsd: r.revenueUsd,
        priceUsd: r.priceUsd,
      })),
    };
  });

// --- Purchase (creator-set price, paid to the creator) -----------------------

const downloadBody = z.object({
  slug: z.string().regex(SLUG),
});

router
  .route({ path: "download", method: "POST" })
  .paid(
    async (body: { slug?: string }) => {
      const row = body?.slug ? await getStatusline(body.slug) : null;
      if (!row) throw new HttpError("Statusline not found", 404);
      if (Number(row.priceUsd) === 0) {
        throw new HttpError(
          `"${row.slug}" is free — fetch it via GET /api/statuslines/${row.slug}`,
          400,
        );
      }
      return row.priceUsd;
    },
    {
      maxPrice: "1000000",
      // Sale proceeds settle directly to the creator's wallet (the wallet
      // that registered). No platform fee, no custody.
      payTo: async (_request, body) => {
        const slug = (body as { slug?: string } | undefined)?.slug;
        const row = slug ? await getStatusline(slug) : null;
        return row?.authorWallet ?? process.env.EVM_PAYEE_ADDRESS!;
      },
    },
  )
  .body(downloadBody)
  .inputExample({ slug: "sunset-boulevard" })
  .description(
    "Buy a paid statusline at the creator's asking price — payment settles directly to their wallet, no platform fee. Returns the script plus install instructions. REVIEW the script before installing.",
  )
  .handler(async ({ body, wallet }) => {
    const row = await getStatusline(body.slug);
    if (!row) throw new HttpError("Statusline not found", 404);
    ensureVisible(row);
    await bumpSalesCount(row);
    // Wash-trade guard: self-buys (payer == creator wallet) are served but
    // never counted toward installs or revenue.
    const selfBuy =
      !!wallet &&
      !!row.authorWallet &&
      wallet.toLowerCase() === row.authorWallet.toLowerCase();
    if (!selfBuy) {
      await recordInstall(row, {
        wallet,
        amountUsd: row.priceUsd,
        purchase: true,
      });
    }
    return {
      slug: row.slug,
      name: row.name,
      capabilities: row.capabilities,
      script: row.script ?? undefined,
      install: installInstructions(row),
    };
  });

// --- Publish (flat fee, funds the audit) -------------------------------------

const registerBody = z.object({
  slug: z.string().regex(SLUG, 'kebab-case, e.g. "neon-nights"').max(48),
  name: printable(48).refine((v) => v.length >= 2, "Too short"),
  description: printable(280).refine((v) => v.length >= 8, "Too short"),
  /** The statusline script, uploaded as-is. */
  script: z
    .string()
    .min(10)
    .max(32_768)
    .refine((v) => !v.includes("\u0000"), { message: "Binary not allowed" }),
  /** Captured sample output for the preview (echo '{}' | COLUMNS=120 <script>). */
  previewAnsi: z.string().min(1).max(8_192),
  priceUsd: priceString.default("0"),
  tags: z
    .array(printable(24).refine((v) => v.length >= 1, "Empty tag"))
    .max(5)
    .default([]),
});

router
  .route({ path: "register", method: "POST" })
  .paid(REGISTER_PRICE)
  .body(registerBody)
  .inputExample({
    slug: "neon-nights",
    name: "Neon Nights",
    description: "Synthwave banner with cost tracking.",
    priceUsd: "0.10",
    tags: ["powerline", "synthwave"],
    script: "#!/usr/bin/env bash\nIN=$(cat)\n# ... your statusline ...",
    previewAnsi: "Neon Nights ~/proj $1.42",
  })
  .description(
    `Publish a Claude Code statusline for a flat $${REGISTER_PRICE}. Upload your script as-is in \`script\` with a captured \`previewAnsi\`. The fee funds an LLM security audit at registration; scripts that fail are not listed (the fee bought the audit). Set priceUsd ("0" = free, or any amount) to sell — buyers pay the wallet you registered from, directly. Verify an X identity (identity/claim + identity/verify) to display @handle as author; otherwise unclaimed.`,
  )
  .validate(async (body) => {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new HttpError(
        "Submissions are temporarily unavailable (audit service not configured)",
        503,
      );
    }
    if (await slugTaken(body.slug)) {
      throw new HttpError(`slug "${body.slug}" is already taken`, 409);
    }
  })
  .handler(async ({ body, wallet }) => {
    // The submission fee funds this audit. It runs strictly AFTER payment
    // verification, so unpaid probes can never trigger it.
    const audit = await auditScript({
      script: body.script,
      name: body.name,
      description: body.description,
      author: wallet ?? "unknown",
    });
    {
      const flags = scanRedFlags(body.script);
      // Deterministic backstop: a high-severity pattern hit is an automatic
      // reject regardless of the LLM verdict; medium hits downgrade approve
      // to caution so the listing carries the warning.
      if (audit.verdict === "approve" && hasHighSeverity(flags)) {
        audit.verdict = "reject";
        audit.risks = [
          ...audit.risks,
          ...flags.filter((f) => f.severity === "high").map((f) => f.label),
        ];
      } else if (audit.verdict === "approve" && flags.length > 0) {
        audit.verdict = "caution";
      }
      if (audit.verdict === "reject") {
        // Deliberate 200: the fee bought the audit, so it settles. The
        // script is simply not listed.
        return {
          listed: false,
          verdict: "reject",
          summary: audit.summary,
          risks: audit.risks,
          auditedBy: audit.model,
          note: "The audit fee is non-refundable — it paid for this analysis. Fix the issues and register again.",
        };
      }
    }

    const identity = wallet ? await getIdentity(wallet) : null;
    const row = await createStatusline({
      slug: body.slug,
      name: body.name,
      description: body.description,
      // Twitter is the only identity: @handle when verified, else anonymous.
      author: identity?.verified ? `@${identity.twitterHandle}` : "anonymous",
      // The registering wallet is the payout wallet and the identity anchor.
      authorWallet: wallet ? wallet.toLowerCase() : null,
      priceUsd: Number(body.priceUsd) === 0 ? "0" : body.priceUsd,
      script: body.script,
      previewAnsi: body.previewAnsi,
      capabilities: audit.capabilities.length
        ? audit.capabilities
        : detectCapabilities(body.script),
      auditVerdict: audit.verdict,
      auditSummary: audit.summary,
      auditModel: audit.model,
      redFlags: scanRedFlags(body.script).map((f) => `${f.severity}: ${f.label}`),
      tags: body.tags,
      registeredBy: wallet,
    });
    return {
      slug: row.slug,
      url: `/statuslines/${row.slug}`,
      listed: true,
      audit: {
        verdict: audit.verdict,
        summary: audit.summary,
        risks: audit.risks,
        model: audit.model,
      },
      capabilities: row.capabilities,
      priceUsd: row.priceUsd,
      note:
        Number(row.priceUsd) > 0
          ? `Buyers pay $${Number(row.priceUsd).toFixed(2)} directly to ${row.authorWallet} via POST /api/download.`
          : "Listed as free — anyone can install it via GET /api/statuslines/" +
            row.slug,
    };
  });

// --- Identity (wallet -> verified X handle) -----------------------------------

router
  .route({ path: "identity/claim", method: "POST" })
  .siwx()
  .body(z.object({ handle: z.string().regex(HANDLE, "X handle without @") }))
  .inputExample({ handle: "yourhandle" })
  .description(
    "Start claiming an X (Twitter) identity for your wallet. Sign with SIWX. Returns a one-time code — post it in a tweet from that handle, then call identity/verify with the tweet URL. Verified wallets get their @handle shown as the author on their listings.",
  )
  .handler(async ({ body, wallet }) => {
    if (!wallet) throw new HttpError("Wallet identity required", 401);
    const row = await startClaim(wallet, body.handle);
    return {
      handle: row.twitterHandle,
      code: row.code,
      next: `Post a tweet from @${row.twitterHandle} containing "${row.code}", then POST /api/identity/verify with {"tweetUrl": "https://x.com/${row.twitterHandle}/status/..."}`,
    };
  });

router
  .route({ path: "identity/verify", method: "POST" })
  .siwx()
  .body(z.object({ tweetUrl: z.string().url().max(200) }))
  .inputExample({ tweetUrl: "https://x.com/yourhandle/status/1234567890123456789" })
  .description(
    "Verify a pending X identity claim: we read the tweet and check it contains your code and was posted by the claimed handle. On success, your listings display @handle as a verified author.",
  )
  .handler(async ({ body, wallet }) => {
    if (!wallet) throw new HttpError("Wallet identity required", 401);
    const identity = await getIdentity(wallet);
    if (!identity) throw new HttpError("No pending claim — call identity/claim first", 404);
    if (identity.verified) return { verified: true, handle: identity.twitterHandle };

    const id = tweetIdFromUrl(body.tweetUrl);
    if (!id) throw new HttpError("Not a valid x.com status URL", 400);
    const tweet = await fetchTweet(id);
    if (!tweet) throw new HttpError("Could not read that tweet — is it public?", 503);
    if (tweet.screenName.toLowerCase() !== identity.twitterHandle.toLowerCase()) {
      throw new HttpError(
        `Tweet is by @${tweet.screenName}, but the claim is for @${identity.twitterHandle}`,
        403,
      );
    }
    if (!tweet.text.includes(identity.code)) {
      throw new HttpError("Tweet does not contain your verification code", 403);
    }

    await markVerified(wallet);
    await adoptVerifiedAuthor(wallet, identity.twitterHandle);
    return { verified: true, handle: identity.twitterHandle };
  });

router
  .route({ path: "creators/{wallet}", method: "GET" })
  .unprotected()
  .description("A creator wallet's verified identity (if any) and everything they've published.")
  .handler(async ({ params }) => {
    const [rows, identity] = await Promise.all([
      listByWallet(params.wallet),
      getIdentity(params.wallet),
    ]);
    return {
      wallet: params.wallet.toLowerCase(),
      identity: identity?.verified ? { handle: identity.twitterHandle } : null,
      statuslines: rows.map((r) => publicEntry(r, false)),
    };
  });

router
  .route({ path: "identity/{wallet}", method: "GET" })
  .unprotected()
  .description("Public identity lookup: verified X handle for a wallet, if any.")
  .handler(async ({ params }) => {
    const identity = await getIdentity(params.wallet);
    if (!identity?.verified) return { verified: false };
    return { verified: true, handle: identity.twitterHandle };
  });

// --- Report & takedown -------------------------------------------------------

router
  .route({ path: "report", method: "POST" })
  .siwx()
  .body(
    z
      .object({
        slug: z.string().regex(SLUG),
        // review: 0–5 stars (+ optional comment). report: text only.
        rating: z.coerce.number().int().min(0).max(5).optional(),
        comment: printable(1000).optional(),
      })
      .refine((b) => b.rating !== undefined || (b.comment && b.comment.length >= 3), {
        message: "Provide a rating (review) or a comment (report)",
      }),
  )
  .inputExample({ slug: "some-slug", rating: 5, comment: "clean and fast" })
  .description(
    "Leave signed feedback on a statusline (SIWX, free). Include `rating` (0–5) to post/update your review; include only `comment` to file a report. Enough distinct wallets reporting auto-hides the listing pending review.",
  )
  .handler(async ({ body, wallet }) => {
    if (!wallet) throw new HttpError("Wallet identity required", 401);
    const row = await getStatusline(body.slug);
    if (!row) throw new HttpError("Statusline not found", 404);
    if (body.rating !== undefined) {
      await upsertReview(row, wallet, body.rating, body.comment ?? null);
      return { kind: "review", rating: body.rating };
    }
    const { hidden } = await addReport(row, wallet, body.comment!);
    return { kind: "report", hidden };
  });

router
  .route({ path: "statuslines/{slug}/feedback", method: "GET" })
  .unprotected()
  .description("Reviews (0–5 + comments) and reports for a statusline, with the rating average.")
  .handler(async ({ params }) => {
    const row = await getStatusline(params.slug);
    if (!row) throw new HttpError("Statusline not found", 404);
    const fb = await getFeedback(row.id);
    return {
      average: fb.avg,
      count: fb.count,
      reviews: fb.reviews.map((r) => ({
        wallet: r.wallet,
        rating: r.rating,
        comment: r.comment,
        at: r.createdAt.toISOString(),
      })),
      reports: fb.reports.map((r) => ({
        wallet: r.wallet,
        comment: r.comment,
        at: r.createdAt.toISOString(),
      })),
    };
  });

router
  .route({ path: "admin/delist", method: "POST" })
  .apiKey((key) => (key === process.env.ADMIN_TOKEN ? { admin: true } : null))
  .body(z.object({ slug: z.string().regex(SLUG), hidden: z.boolean().default(true) }))
  .description("Admin: delist or relist a statusline. Requires ADMIN_TOKEN.")
  .handler(async ({ body }) => {
    await setHidden(body.slug, body.hidden);
    return { slug: body.slug, hidden: body.hidden };
  });

// --- Misc --------------------------------------------------------------------

router
  .route({ path: "health", method: "GET" })
  .unprotected()
  .handler(async () => ({ status: "ok" }));
