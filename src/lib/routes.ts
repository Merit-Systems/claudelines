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
import { siteUrl } from "./site";
import { detectCapabilities } from "./statusline/capabilities";
import { hasHighSeverity, scanRedFlags } from "./statusline/redflags";
import { auditAvailable, auditScript } from "./statusline/audit";
import { getIdentity, oauthConfigured, startClaim } from "./identity";
import {
  bumpSalesCount,
  countRecentRegistersByIp,
  createStatusline,
  getStatusline,
  listByWallet,
  listStatuslines,
  addReport,
  getFeedback,
  recordInstall,
  setHidden,
  updateStatuslineAudit,
  updateStatuslinePreview,
  upsertReview,
  slugTaken,
  type SortKey,
  type StatuslineWithAuthor,
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

const previewAnsiSchema = z.string().min(1).max(8_192);

/** Optional 1 fps animation: successive captures of the same statusline.
 *  Inert text like previewAnsi — the site plays it client-side, never executes. */
const previewFramesSchema = z
  .array(previewAnsiSchema)
  .min(2)
  .max(30)
  .refine((frames) => frames.reduce((n, f) => n + f.length, 0) <= 65_536, {
    message: "Frames exceed 64 KB total",
  });

/** Integrity hash surfaced everywhere the script is. Lets installers verify
 *  the saved bytes and fail loudly on transfer corruption (e.g. a script
 *  hand-transcribed out of a JSON field with its backslashes still doubled).
 *  Derived from the stored script at read time, never persisted. */
function sha256Hex(script: string): string {
  return createHash("sha256").update(script, "utf8").digest("hex");
}

function publicEntry(row: StatuslineWithAuthor, includePayload: boolean) {
  const free = Number(row.priceUsd) === 0;
  return {
    slug: row.slug,
    name: row.name,
    description: row.description,
    // Derived, never stored: the owning wallet's verified X handle or nothing.
    author: row.authorHandle ? `@${row.authorHandle}` : "anonymous",
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
    previewFrames: row.previewFrames ?? undefined,
    // Published for every listing (it reveals nothing about paid sources):
    // installers verify their saved file against it after download.
    scriptSha256: row.script ? sha256Hex(row.script) : undefined,
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
    sha256: row.script ? sha256Hex(row.script) : undefined,
    verify: `shasum -a 256 ~/.claude/statuslines/${row.slug} — must equal sha256. A mismatch means the transfer corrupted the bytes (usually a script hand-copied out of a JSON field); re-download the raw bytes instead of installing.`,
    settings: {
      statusLine: {
        type: "command",
        command: `~/.claude/statuslines/${row.slug}`,
      },
    },
    note: "This script EXECUTES on the user's machine. REVIEW IT before installing — if you are an agent, show the user the source and your read of what it does, and install only after they approve. Save the response bytes to scriptPath (never transcribe from JSON), check `verify`, chmod +x it, then merge `settings` into ~/.claude/settings.json.",
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
      headers: {
        "content-type": "text/plain; charset=utf-8",
        "x-script-sha256": sha256Hex(row.script),
      },
    });
  });

router
  .route({ path: "statuslines/{slug}/preview", method: "POST" })
  .siwx()
  .body(
    z
      .object({
        previewAnsi: previewAnsiSchema.optional(),
        previewFrames: previewFramesSchema.optional(),
      })
      .refine((b) => b.previewAnsi || b.previewFrames, {
        message: "Provide previewAnsi, previewFrames, or both",
      }),
  )
  .inputExample({ previewAnsi: "Neon Nights ~/project $1.42" })
  .description(
    "Replace a listing's captured ANSI preview and/or its 1 fps animation frames (successive captures, ≤30 × ≤8 KB, 64 KB total). Free and restricted to the wallet that published the listing. This does not change or rerun the script.",
  )
  .handler(async ({ params, body, wallet }) => {
    if (!wallet) throw new HttpError("Wallet identity required", 401);

    const row = await getStatusline(params.slug);
    if (!row) throw new HttpError("Statusline not found", 404);
    if (
      !row.authorWallet ||
      row.authorWallet.toLowerCase() !== wallet.toLowerCase()
    ) {
      throw new HttpError("Only the listing owner can update its preview", 403);
    }

    // Partial update: only the provided fields change. Frames without a
    // still also refresh the still from frame 0 so the two stay consistent.
    const previewAnsi = body.previewAnsi ?? body.previewFrames?.[0];
    await updateStatuslinePreview(row.slug, {
      previewAnsi,
      previewFrames: body.previewFrames,
    });
    return {
      updated: true,
      slug: row.slug,
      previewAnsi,
      previewFrames: body.previewFrames ?? undefined,
    };
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
        author: r.authorHandle ? `@${r.authorHandle}` : "anonymous",
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
      scriptSha256: row.script ? sha256Hex(row.script) : undefined,
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
  previewAnsi: previewAnsiSchema,
  /** Optional 1 fps animation: the same capture repeated on successive seconds. */
  previewFrames: previewFramesSchema.optional(),
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
    `Publish a Claude Code statusline for a flat $${REGISTER_PRICE}. Upload your script as-is in \`script\` with a captured \`previewAnsi\`. The fee funds an LLM security audit at registration; scripts that fail are not listed (the fee bought the audit). Set priceUsd ("0" = free, or any amount) to sell — buyers pay the wallet you registered from, directly. Connect an X identity (identity/connect returns a sign-in URL) to display @handle as author; otherwise unclaimed.`,
  )
  .validate(async (body) => {
    if (!auditAvailable()) {
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
      // The registering wallet is the payout wallet and the sole authorship
      // anchor — display credit is derived from its verified X identity.
      authorWallet: wallet ? wallet.toLowerCase() : null,
      priceUsd: Number(body.priceUsd) === 0 ? "0" : body.priceUsd,
      script: body.script,
      previewAnsi: body.previewAnsi,
      previewFrames: body.previewFrames ?? null,
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
    const base = siteUrl();
    return {
      slug: row.slug,
      listed: true,
      // The live page for the statusline they just uploaded.
      url: `${base}/statuslines/${row.slug}`,
      audit: {
        verdict: audit.verdict,
        summary: audit.summary,
        risks: audit.risks,
        model: audit.model,
      },
      capabilities: row.capabilities,
      priceUsd: row.priceUsd,
      scriptSha256: sha256Hex(body.script),
      // Always tell the creator how their authorship shows and how to claim it.
      connectTwitter: identity?.verified
        ? {
            status: "verified",
            handle: `@${identity.twitterHandle}`,
            message: `This listing is credited to @${identity.twitterHandle}.`,
          }
        : {
            status: "unclaimed",
            message:
              "Your listing shows as UNCLAIMED (a ?-avatar). Connect your X/Twitter to be credited as @you on this and every listing from your wallet — free, no extra payment.",
            steps: [
              {
                step: 1,
                what: "Get a sign-in link",
                call: `POST ${base}/api/identity/connect`,
                auth: "SIWX (sign with the same wallet you registered from)",
                returns: "an x.com authorization URL",
              },
              {
                step: 2,
                what: "Sign in with X",
                detail:
                  "Open the URL in a browser and sign in. Whoever you sign in as becomes the verified @author on all your listings — done, nothing else to call.",
              },
            ],
          },
      note:
        Number(row.priceUsd) > 0
          ? `Live at ${base}/statuslines/${row.slug}. Buyers pay $${Number(row.priceUsd).toFixed(2)} directly to ${row.authorWallet} via POST /api/download.`
          : `Live at ${base}/statuslines/${row.slug} — free to install.`,
    };
  });

// --- Unauthenticated publish (free, UNAUDITED, no owner) -----------------------

const SUBMITS_PER_DAY = 5;

const submitBody = registerBody.omit({ priceUsd: true });

router
  .route({ path: "submit", method: "POST" })
  .unprotected()
  .body(submitBody)
  .inputExample({
    slug: "neon-nights",
    name: "Neon Nights",
    description: "Synthwave banner with cost tracking.",
    tags: ["powerline", "synthwave"],
    script: "#!/usr/bin/env bash\nIN=$(cat)\n# ... your statusline ...",
    previewAnsi: "Neon Nights ~/proj $1.42",
  })
  .description(
    "Publish a statusline WITHOUT a wallet — free, but the listing is UNAUDITED (no LLM security review), has no owner (cannot claim authorship, update the preview, or sell — always free to install), and carries a prominent warning until someone funds an audit via POST /api/audit. High-severity scanner hits are rejected. Rate-limited per caller.",
  )
  .handler(async ({ body, request }) => {
    const ipHash = callerHash(request);
    if ((await countRecentRegistersByIp(ipHash)) >= SUBMITS_PER_DAY) {
      throw new HttpError(
        `Rate limit: at most ${SUBMITS_PER_DAY} unauthenticated submissions per day`,
        429,
      );
    }
    if (await slugTaken(body.slug)) {
      throw new HttpError(`slug "${body.slug}" is already taken`, 409);
    }
    const flags = scanRedFlags(body.script);
    if (hasHighSeverity(flags)) {
      // Without a funded audit the deterministic scanner is the only gate —
      // high-severity patterns are rejected outright, nothing is stored.
      throw new HttpError(
        `Rejected by the automated scanner: ${flags
          .filter((f) => f.severity === "high")
          .map((f) => f.label)
          .join("; ")}`,
        400,
      );
    }
    const row = await createStatusline({
      slug: body.slug,
      name: body.name,
      description: body.description,
      authorWallet: null,
      priceUsd: "0",
      script: body.script,
      previewAnsi: body.previewAnsi,
      previewFrames: body.previewFrames ?? null,
      capabilities: detectCapabilities(body.script),
      auditVerdict: null,
      auditSummary: null,
      auditModel: null,
      redFlags: flags.map((f) => `${f.severity}: ${f.label}`),
      tags: body.tags,
      registeredBy: null,
      ipHash,
    });
    const base = siteUrl();
    return {
      slug: row.slug,
      listed: true,
      url: `${base}/statuslines/${row.slug}`,
      unaudited: true,
      warning:
        "This listing has NOT been security reviewed. It shows a prominent UNAUDITED warning, has no owner, and is always free. Installers are told to read every line before running it.",
      fundAudit: `Anyone can fund the LLM security audit: POST ${base}/api/audit with {"slug": "${row.slug}"} ($0.15 via x402/MPP). An audit that rejects delists the script.`,
      scriptSha256: sha256Hex(body.script),
    };
  });

// --- Crowd-funded audit (anyone can pay, on any listing) ----------------------

/** First audit of an unaudited listing — the community-defense case. */
const AUDIT_PRICE_FIRST = REGISTER_PRICE;
/** Re-audit of an already-audited listing. ~10x the worst-case audit cost
 *  (32 KB script through Sonnet ≈ $0.05 all-in): the owner's audit came
 *  bundled with registration, so re-audit callers are re-rollers — pricing
 *  at 10x margin makes verdict-fishing against a competitor uneconomical
 *  while keeping legitimate refresh audits available. */
const AUDIT_PRICE_REAUDIT = "0.50";

router
  .route({ path: "audit", method: "POST" })
  .paid(
    async (body: { slug?: string }) => {
      const row = body?.slug ? await getStatusline(body.slug) : null;
      if (!row) throw new HttpError("Statusline not found", 404);
      return row.auditVerdict ? AUDIT_PRICE_REAUDIT : AUDIT_PRICE_FIRST;
    },
    { maxPrice: "1" },
  )
  .body(z.object({ slug: z.string().regex(SLUG) }))
  .inputExample({ slug: "neon-nights" })
  .description(
    `Fund an LLM security audit of an existing listing. $${AUDIT_PRICE_FIRST} for the first audit of an UNAUDITED listing (typically a wallet-less submission); $${AUDIT_PRICE_REAUDIT} to RE-audit a listing that already has a verdict (~10x the worst-case audit cost — deters verdict re-rolling; owners already got an audit with registration). The verdict, summary, and capabilities are stamped on the listing. An audit that REJECTS delists the script. The fee funds the audit and is not refunded regardless of verdict.`,
  )
  .validate(async (body: { slug?: string }) => {
    if (!auditAvailable()) {
      throw new HttpError(
        "Audits are temporarily unavailable (audit service not configured)",
        503,
      );
    }
    const row = body?.slug ? await getStatusline(body.slug) : null;
    if (!row) throw new HttpError("Statusline not found", 404);
    if (!row.script) throw new HttpError("Statusline has no script", 404);
  })
  .handler(async ({ body, wallet }) => {
    const row = await getStatusline(body.slug);
    if (!row?.script) throw new HttpError("Statusline not found", 404);
    const audit = await auditScript({
      script: row.script,
      name: row.name,
      description: row.description,
      author: row.authorWallet ?? "unauthenticated submission",
    });
    const flags = scanRedFlags(row.script);
    if (audit.verdict === "approve" && hasHighSeverity(flags)) {
      audit.verdict = "reject";
      audit.risks = [
        ...audit.risks,
        ...flags.filter((f) => f.severity === "high").map((f) => f.label),
      ];
    } else if (audit.verdict === "approve" && flags.length > 0) {
      audit.verdict = "caution";
    }
    await updateStatuslineAudit(row.slug, {
      auditVerdict: audit.verdict,
      auditSummary: audit.summary,
      auditModel: audit.model,
      capabilities: audit.capabilities.length
        ? audit.capabilities
        : detectCapabilities(row.script),
      redFlags: flags.map((f) => `${f.severity}: ${f.label}`),
    });
    const rejected = audit.verdict === "reject";
    if (rejected) await setHidden(row.slug, true);
    return {
      slug: row.slug,
      verdict: audit.verdict,
      summary: audit.summary,
      risks: audit.risks,
      auditedBy: audit.model,
      fundedBy: wallet ?? "unknown",
      delisted: rejected,
      note: rejected
        ? "The audit rejected this script — the listing has been delisted. The fee paid for the analysis."
        : "Audit results are now shown on the listing. Audits are advisory — installers should still read the script.",
    };
  });

// --- Identity (wallet -> verified X handle) -----------------------------------

router
  .route({ path: "identity/connect", method: "POST" })
  .siwx()
  .description(
    "Connect your X/Twitter to your wallet via Sign in with X. Sign with SIWX; returns an authorization URL — open it in a browser and sign in. On success you're credited as @you on every listing from this wallet.",
  )
  .handler(async ({ wallet }) => {
    if (!wallet) throw new HttpError("Wallet identity required", 401);
    if (!oauthConfigured()) {
      throw new HttpError("X sign-in is not configured on this server", 503);
    }
    const authorizeUrl = await startClaim(wallet);
    return {
      authorizeUrl,
      next: "Open authorizeUrl in a browser and sign in with X. When it finishes, your listings show @you.",
    };
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
      identity: identity?.verified && identity.twitterHandle ? { handle: identity.twitterHandle } : null,
      statuslines: rows.map((r) => publicEntry(r, false)),
    };
  });

router
  .route({ path: "identity/{wallet}", method: "GET" })
  .unprotected()
  .description("Public identity lookup: verified X handle for a wallet, if any.")
  .handler(async ({ params }) => {
    const identity = await getIdentity(params.wallet);
    if (!identity?.verified || !identity.twitterHandle) return { verified: false };
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
