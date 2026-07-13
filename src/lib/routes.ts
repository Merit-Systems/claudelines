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
import {
  hasHighSeverity,
  scanRedFlags,
  type RedFlag,
} from "./statusline/redflags";
import { auditAvailable, auditScript } from "./statusline/audit";
import { getIdentity, oauthConfigured, startClaim } from "./identity";
import {
  bumpSalesCount,
  countRecentRegistersByIp,
  createStatusline,
  getStatusline,
  listByWallet,
  listUnaudited,
  listStatuslines,
  addReport,
  getFeedback,
  recordInstall,
  deleteStatusline,
  setArchived,
  setHidden,
  updateStatuslineAudit,
  updateStatuslinePreview,
  updateStatuslineScript,
  upsertReview,
  slugTaken,
  type SortKey,
  type StatuslineWithAuthor,
} from "./db/queries";
import type { CompanionFile, StatuslineRow } from "./db/schema";

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

/** The statusline script, uploaded as-is. Shared by register and update. */
const scriptSchema = z
  .string()
  .min(10)
  .max(32_768)
  .refine((v) => !v.includes("\u0000"), { message: "Binary not allowed" });

/** Companion Claude Code slash-command files (`commands/<name>.md`) that ship
 *  with a statusline — e.g. the interaction command that drives it. SECURITY:
 *  unlike previews these are NOT inert. Each installs to ~/.claude/commands/
 *  and is a PROMPT the user's agent executes with full tool access — a bigger
 *  injection surface than the script itself. Every file therefore goes through
 *  scanRedFlags AND into the LLM audit alongside the script, and install flows
 *  tell users to read each one first. */
const COMMAND_FILE_PATH = /^commands\/[a-z0-9][a-z0-9-]{0,31}\.md$/;
const companionFileSchema = z.object({
  path: z
    .string()
    .regex(
      COMMAND_FILE_PATH,
      'commands/<kebab-name>.md, e.g. "commands/statusline-theme.md"',
    )
    .meta({ example: "commands/statusline-theme.md" }),
  content: z
    .string()
    .min(10)
    .max(16_384)
    .refine((v) => !v.includes("\u0000"), { message: "Binary not allowed" }),
});
const filesSchema = z
  .array(companionFileSchema)
  .min(1)
  .max(3)
  .refine((files) => new Set(files.map((f) => f.path)).size === files.length, {
    message: "Duplicate file paths",
  })
  .refine(
    (files) => files.reduce((n, f) => n + f.content.length, 0) <= 49_152,
    { message: "Files exceed 48 KB total" },
  );

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

/** Red-flag scan over the full artifact set. Companion command files are
 *  agent-executed prose — a `curl | sh` instruction in one is as hot as in
 *  the script — so each gets the same deterministic scan, with hits prefixed
 *  by the file path so the listing shows where. */
function scanSubmission(
  script: string,
  files?: CompanionFile[] | null,
): RedFlag[] {
  const flags = scanRedFlags(script);
  for (const f of files ?? []) {
    for (const hit of scanRedFlags(f.content)) {
      flags.push({ ...hit, label: `${f.path}: ${hit.label}` });
    }
  }
  return flags;
}

/** Deterministic backstop shared by every audit path: a high-severity scanner
 *  hit vetoes an LLM "approve" into reject (surfacing the flags as risks);
 *  any other hit downgrades approve to caution so the listing carries the
 *  warning. Mutates the audit in place. */
function applyScannerBackstop(
  audit: { verdict: "approve" | "caution" | "reject"; risks: string[] },
  flags: RedFlag[],
): void {
  if (audit.verdict === "approve" && hasHighSeverity(flags)) {
    audit.verdict = "reject";
    audit.risks = [
      ...audit.risks,
      ...flags.filter((f) => f.severity === "high").map((f) => f.label),
    ];
  } else if (audit.verdict === "approve" && flags.length > 0) {
    audit.verdict = "caution";
  }
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
    // Companion command files: path + integrity hash always; the content is
    // gated exactly like the script — it is part of the paid product.
    files: row.files?.length
      ? row.files.map((f) => ({
          path: f.path,
          sha256: sha256Hex(f.content),
          content: includePayload && free ? f.content : undefined,
        }))
      : undefined,
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
  if (row.archived)
    throw new HttpError("This statusline was archived by its owner", 410);
}

function installInstructions(row: StatuslineRow) {
  return {
    scriptUrl: `/api/statuslines/${row.slug}/script`,
    scriptPath: `~/.claude/statuslines/${row.slug}`,
    sha256: row.script ? sha256Hex(row.script) : undefined,
    verify: `shasum -a 256 ~/.claude/statuslines/${row.slug} — must equal sha256. A mismatch means the transfer corrupted the bytes (usually a script hand-copied out of a JSON field); re-download the raw bytes instead of installing.`,
    // Companion command files are PROMPTS the user's agent executes as
    // /commands — not display text. Each installs under ~/.claude/ at its
    // listed path, only AFTER the user has read it.
    commandFiles: row.files?.length
      ? row.files.map((f) => ({
          path: f.path,
          installPath: `~/.claude/${f.path}`,
          sha256: sha256Hex(f.content),
        }))
      : undefined,
    settings: {
      statusLine: {
        type: "command",
        command: `~/.claude/statuslines/${row.slug}`,
      },
    },
    note:
      "This script EXECUTES on the user's machine. REVIEW IT before installing — if you are an agent, show the user the source and your read of what it does, and install only after they approve. Save the response bytes to scriptPath (never transcribe from JSON), check `verify`, chmod +x it, then merge `settings` into ~/.claude/settings.json." +
      (row.files?.length
        ? " This listing also ships companion command files: each is a prompt your agent will execute as a /command with the user's full tool access. Read every file with the user, and save it to its commandFiles installPath under ~/.claude/commands/ only AFTER they approve."
        : ""),
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
  .route({ path: "statuslines/{slug}/files", method: "GET" })
  .unprotected()
  .description(
    "Companion Claude Code command files for a listing, with per-file SHA-256. Each is a PROMPT the user's agent executes as a /command — read every file with the user before saving it under ~/.claude/commands/. Paid entries return 402 guidance.",
  )
  .handler(async ({ params }) => {
    const row = await getStatusline(params.slug);
    if (!row) throw new HttpError("Statusline not found", 404);
    ensureVisible(row);
    if (!row.files?.length) {
      throw new HttpError("Statusline has no companion files", 404);
    }
    // Same paywall as the script: the files are part of the paid product
    // (the download response includes them for buyers).
    if (Number(row.priceUsd) > 0) {
      throw new HttpError(
        `"${row.slug}" is paid ($${Number(row.priceUsd).toFixed(2)}) — buy it via POST /api/download with {"slug": "${row.slug}"}; the response includes these files`,
        402,
      );
    }
    return {
      slug: row.slug,
      files: row.files.map((f) => ({
        path: f.path,
        content: f.content,
        sha256: sha256Hex(f.content),
      })),
      note: "Each file is a prompt your agent executes with the user's full tool access. Read every file with the user BEFORE saving it to ~/.claude/commands/.",
    };
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
  .route({ path: "statuslines/{slug}/archive", method: "POST" })
  .siwx()
  .body(z.object({ archived: z.boolean().default(true) }))
  .inputExample({ archived: true })
  .description(
    "Archive (delist) or restore your own listing. Free and restricted to the wallet that published it. Archiving hides the listing from browsing, installs, and purchases; the slug stays reserved and {archived: false} relists it. This is separate from moderation — it cannot restore a listing delisted by an audit reject, reports, or an admin.",
  )
  .handler(async ({ params, body, wallet }) => {
    if (!wallet) throw new HttpError("Wallet identity required", 401);

    const row = await getStatusline(params.slug);
    if (!row) throw new HttpError("Statusline not found", 404);
    if (
      !row.authorWallet ||
      row.authorWallet.toLowerCase() !== wallet.toLowerCase()
    ) {
      throw new HttpError("Only the listing owner can archive it", 403);
    }

    await setArchived(row.slug, body.archived);
    return {
      slug: row.slug,
      archived: body.archived,
      note: body.archived
        ? "The listing is archived — hidden from browsing and downloads. The slug stays yours; restore it anytime with {archived: false}."
        : row.hidden
          ? "Unarchived, but the listing is still delisted by moderation and remains hidden."
          : "The listing is live again.",
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

const downloadBody = z
  .object({
    slug: z.string().regex(SLUG).meta({ example: "cat-walk" }),
  })
  .meta({ example: { slug: "cat-walk" } });

const installOutputSchema = z.object({
  scriptUrl: z.string(),
  scriptPath: z.string(),
  sha256: z.string().optional(),
  verify: z.string(),
  commandFiles: z
    .array(
      z.object({
        path: z.string(),
        installPath: z.string(),
        sha256: z.string(),
      }),
    )
    .optional(),
  settings: z.object({
    statusLine: z.object({ type: z.literal("command"), command: z.string() }),
  }),
  note: z.string(),
});

const downloadOutputSchema = z.object({
  slug: z.string(),
  name: z.string(),
  capabilities: z.array(z.string()),
  script: z.string().optional(),
  scriptSha256: z.string().optional(),
  files: z
    .array(
      z.object({ path: z.string(), content: z.string(), sha256: z.string() }),
    )
    .optional(),
  install: installOutputSchema,
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
  .inputExample({ slug: "cat-walk" })
  .output(downloadOutputSchema)
  .outputExample({
    slug: "cat-walk",
    name: "Cat Walk",
    capabilities: [],
    script: "#!/bin/sh\nprintf 'example'\n",
    scriptSha256:
      "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
    install: {
      scriptUrl: "/api/statuslines/cat-walk/script",
      scriptPath: "~/.claude/statuslines/cat-walk",
      sha256:
        "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
      verify: "Compare the downloaded script SHA-256 with scriptSha256.",
      settings: {
        statusLine: {
          type: "command",
          command: "~/.claude/statuslines/cat-walk",
        },
      },
      note: "Review the script before installing it.",
    },
  })
  .description(
    "Buy and download a paid status line. The publisher sets the price and receives the payment directly with no platform fee. Returns the script, integrity hash, and install instructions. Review the script before installing.",
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
      // Paid delivery of the companion command files — the only way to get
      // their content for a paid listing.
      files: row.files?.length
        ? row.files.map((f) => ({
            path: f.path,
            content: f.content,
            sha256: sha256Hex(f.content),
          }))
        : undefined,
      install: installInstructions(row),
    };
  });

// --- Publish (flat fee, funds the audit) -------------------------------------

const registerExample = {
  slug: "x402scan-registration-probe",
  name: "Discovery Probe",
  description: "Valid unpaid discovery probe payload.",
  priceUsd: "0",
  tags: ["discovery"],
  script: "#!/bin/sh\nprintf 'discovery'\n",
  previewAnsi: "discovery",
};

const registerBody = z.object({
  slug: z
    .string()
    .regex(SLUG, 'kebab-case, e.g. "neon-nights"')
    .max(48)
    .meta({ example: registerExample.slug }),
  name: printable(48)
    .refine((v) => v.length >= 2, "Too short")
    .meta({ example: registerExample.name }),
  description: printable(280)
    .refine((v) => v.length >= 8, "Too short")
    .meta({ example: registerExample.description }),
  /** The statusline script, uploaded as-is. */
  script: scriptSchema.meta({ example: registerExample.script }),
  /** Sample output captured at the publisher's current terminal width. */
  previewAnsi: previewAnsiSchema.meta({ example: registerExample.previewAnsi }),
  /** Optional 1 fps animation: the same capture repeated on successive seconds. */
  previewFrames: previewFramesSchema.optional(),
  /** Optional companion command files — audited together with the script and
   *  scanned like it: they are agent-executed prompts, not data. */
  files: filesSchema.optional(),
  priceUsd: priceString.default("0").meta({ example: registerExample.priceUsd }),
  tags: z
    .array(printable(24).refine((v) => v.length >= 1, "Empty tag"))
    .max(5)
    .default([])
    .meta({ example: registerExample.tags }),
}).meta({ example: registerExample });

const registerOutputSchema = z.union([
  z.object({
    listed: z.literal(false),
    verdict: z.literal("reject"),
    summary: z.string(),
    risks: z.array(z.string()),
    auditedBy: z.string(),
    note: z.string(),
  }),
  z.object({
    slug: z.string(),
    listed: z.literal(true),
    url: z.string(),
    audit: z.object({
      verdict: z.enum(["approve", "caution", "reject"]),
      summary: z.string(),
      risks: z.array(z.string()),
      model: z.string(),
    }),
    capabilities: z.array(z.string()),
    priceUsd: z.string(),
    scriptSha256: z.string(),
    files: z
      .array(z.object({ path: z.string(), sha256: z.string() }))
      .optional(),
    connectTwitter: z
      .object({ status: z.enum(["verified", "unclaimed"]) })
      .passthrough(),
    note: z.string(),
  }),
]);

router
  .route({ path: "register", method: "POST" })
  .paid(REGISTER_PRICE)
  .body(registerBody)
  .inputExample(registerExample)
  .output(registerOutputSchema)
  .outputExample({
    slug: registerExample.slug,
    listed: true,
    url: `https://claudelines.com/statuslines/${registerExample.slug}`,
    audit: {
      verdict: "approve",
      summary: "The script prints a static status line.",
      risks: [],
      model: "claude-sonnet-4-5",
    },
    capabilities: [],
    priceUsd: "0",
    scriptSha256:
      "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
    connectTwitter: { status: "unclaimed" },
    note: "The listing is live.",
  })
  .description(
    `Publish and audit a Claude Code status line for $${REGISTER_PRICE}. Submit the script, captured preview, listing metadata, price, and optionally up to 3 companion command files (commands/<name>.md — audited with the script). Rejected scripts are not listed and the audit fee is not refunded. Paid downloads settle directly to the publishing wallet with no platform fee.`,
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
    // verification, so unpaid probes can never trigger it. Companion files
    // ride along so the LLM reviews their prose too — they are agent-executed
    // prompts, not data.
    const audit = await auditScript({
      script: body.script,
      name: body.name,
      description: body.description,
      author: wallet ?? "unknown",
      files: body.files,
    });
    const flags = scanSubmission(body.script, body.files);
    applyScannerBackstop(audit, flags);
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
      files: body.files ?? null,
      capabilities: audit.capabilities.length
        ? audit.capabilities
        : detectCapabilities(body.script),
      auditVerdict: audit.verdict,
      auditSummary: audit.summary,
      auditModel: audit.model,
      redFlags: flags.map((f) => `${f.severity}: ${f.label}`),
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
      files: body.files?.length
        ? body.files.map((f) => ({
            path: f.path,
            sha256: sha256Hex(f.content),
          }))
        : undefined,
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

// --- Owner update (same flat fee — every update re-runs the audit) -----------

const updateExample = {
  script: "#!/bin/sh\nprintf 'discovery v2'\n",
};

const updateBody = z
  .object({
    /** The replacement script; same shape and limits as register. */
    script: scriptSchema.meta({ example: updateExample.script }),
    /** Fresh captured preview for the new script, if it changed. */
    previewAnsi: previewAnsiSchema.optional(),
    previewFrames: previewFramesSchema.optional(),
    /** Replacement companion files. Omitted = the update ships none: the
     *  stored set must always be exactly what this audit reviewed, so stale
     *  files never survive a script swap. */
    files: filesSchema.optional(),
  })
  .meta({ example: updateExample });

const updateOutputSchema = z.union([
  z.object({
    updated: z.literal(false),
    verdict: z.literal("reject"),
    summary: z.string(),
    risks: z.array(z.string()),
    auditedBy: z.string(),
    note: z.string(),
  }),
  z.object({
    updated: z.literal(true),
    slug: z.string(),
    url: z.string(),
    audit: z.object({
      verdict: z.enum(["approve", "caution", "reject"]),
      summary: z.string(),
      risks: z.array(z.string()),
      model: z.string(),
    }),
    capabilities: z.array(z.string()),
    scriptSha256: z.string(),
    files: z
      .array(z.object({ path: z.string(), sha256: z.string() }))
      .optional(),
    note: z.string(),
  }),
]);

router
  .route({ path: "statuslines/{slug}/update", method: "POST" })
  // Same flat fee as register: every update re-runs the full LLM audit on the
  // replacement script + files. Deliberately NOT chained with .siwx(): on
  // this router `.paid().siwx()` means pay-once-then-replay — an entitlement
  // lets later SIWX-signed calls skip payment entirely — which would hand the
  // owner unlimited free audits after their first update. The settled payment
  // already proves control of the paying wallet; the handler requires that
  // wallet to be the listing owner.
  .paid(REGISTER_PRICE)
  .body(updateBody)
  .inputExample(updateExample)
  .output(updateOutputSchema)
  .outputExample({
    updated: true,
    slug: "x402scan-registration-probe",
    url: "https://claudelines.com/statuslines/x402scan-registration-probe",
    audit: {
      verdict: "approve",
      summary: "The script prints a static status line.",
      risks: [],
      model: "claude-sonnet-4-5",
    },
    capabilities: [],
    scriptSha256:
      "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
    note: "The listing now serves the updated script.",
  })
  .description(
    `Update an owned listing's script — and optionally its companion command files and preview — for $${REGISTER_PRICE}: the fee funds the same LLM audit as registration, re-run on the replacement. Only the wallet that published the listing may pay for an update. A rejected update changes NOTHING: the existing listing stays live as-is. Slug, price, installs, sales, and feedback all carry over.`,
  )
  .validate(async () => {
    if (!auditAvailable()) {
      throw new HttpError(
        "Updates are temporarily unavailable (audit service not configured)",
        503,
      );
    }
  })
  .handler(async ({ params, body, wallet }) => {
    // Ownership gate BEFORE the audit: any throw here means the payment never
    // settles and no audit spend happens.
    const row = await getStatusline(params.slug);
    if (!row) throw new HttpError("Statusline not found", 404);
    ensureVisible(row);
    if (!wallet) throw new HttpError("Wallet identity required", 401);
    if (
      !row.authorWallet ||
      row.authorWallet.toLowerCase() !== wallet.toLowerCase()
    ) {
      throw new HttpError("Only the listing owner can update its script", 403);
    }

    const audit = await auditScript({
      script: body.script,
      name: row.name,
      description: row.description,
      author: wallet,
      files: body.files,
    });
    const flags = scanSubmission(body.script, body.files);
    applyScannerBackstop(audit, flags);
    if (audit.verdict === "reject") {
      // Fail-safe (deliberate): a rejected UPDATE leaves the existing listing
      // untouched and live — the served version passed its own audit and is
      // still exactly what installers reviewed. Maintainers who'd rather
      // treat a rejected update as evidence against the current listing can
      // flip this to also setHidden(row.slug, true).
      // Deliberate 200: the fee bought the audit, so it settles.
      return {
        updated: false,
        verdict: "reject",
        summary: audit.summary,
        risks: audit.risks,
        auditedBy: audit.model,
        note: "The existing listing is unchanged and still live. The audit fee is non-refundable — it paid for this analysis. Fix the issues and update again.",
      };
    }

    const capabilities = audit.capabilities.length
      ? audit.capabilities
      : detectCapabilities(body.script);
    await updateStatuslineScript(row.slug, {
      script: body.script,
      files: body.files ?? null,
      capabilities,
      auditVerdict: audit.verdict,
      auditSummary: audit.summary,
      auditModel: audit.model,
      redFlags: flags.map((f) => `${f.severity}: ${f.label}`),
      previewAnsi: body.previewAnsi,
      previewFrames: body.previewFrames,
    });
    const base = siteUrl();
    return {
      updated: true,
      slug: row.slug,
      url: `${base}/statuslines/${row.slug}`,
      audit: {
        verdict: audit.verdict,
        summary: audit.summary,
        risks: audit.risks,
        model: audit.model,
      },
      capabilities,
      scriptSha256: sha256Hex(body.script),
      files: body.files?.length
        ? body.files.map((f) => ({
            path: f.path,
            sha256: sha256Hex(f.content),
          }))
        : undefined,
      note: "The listing now serves the updated script. Installs, sales, and feedback carry over.",
    };
  });

// --- Unauthenticated publish (free, UNAUDITED, no owner) -----------------------

const SUBMITS_PER_DAY = 5;

// No `files` on the wallet-less path: companion command files are
// agent-executed prompts, and without the funded LLM audit the deterministic
// scanner alone is far too weak a gate for that injection surface.
const submitBody = registerBody.omit({ priceUsd: true, files: true });

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
/** Re-audit of an already-audited listing. Priced at ~10x the measured
 *  audit cost (one Opus 4.8 call with adaptive thinking ≈ $0.05 estimated; re-measure from billing): the owner's
 *  audit came bundled with registration, so re-audit callers are
 *  re-rollers — the margin makes verdict-fishing against a competitor
 *  uneconomical while keeping legitimate refresh audits available. */
const AUDIT_PRICE_REAUDIT = "0.50";

const auditBody = z
  .object({
    slug: z.string().regex(SLUG).meta({ example: "agentcash-banner" }),
  })
  .meta({ example: { slug: "agentcash-banner" } });

const auditOutputSchema = z.object({
  slug: z.string(),
  verdict: z.enum(["approve", "caution", "reject"]),
  summary: z.string(),
  risks: z.array(z.string()),
  auditedBy: z.string(),
  fundedBy: z.string(),
  delisted: z.boolean(),
  note: z.string(),
});

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
  .body(auditBody)
  .inputExample({ slug: "agentcash-banner" })
  .output(auditOutputSchema)
  .outputExample({
    slug: "agentcash-banner",
    verdict: "caution",
    summary: "The script reads local data and invokes an external CLI.",
    risks: ["Review external command usage before installing."],
    auditedBy: "claude-sonnet-4-5",
    fundedBy: "0x0000000000000000000000000000000000000000",
    delisted: false,
    note: "Audit results are now shown on the listing.",
  })
  .description(
    `Fund an LLM security audit of an existing listing. The first audit costs $${AUDIT_PRICE_FIRST}; a re-audit costs $${AUDIT_PRICE_REAUDIT}. Results are saved to the listing, and a rejected script is delisted. The audit fee is not refunded.`,
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
    // Stored companion files are part of the audited artifact set — a verdict
    // that never saw them would vouch for prompts it never read.
    const audit = await auditScript({
      script: row.script,
      name: row.name,
      description: row.description,
      author: row.authorWallet ?? "unauthenticated submission",
      files: row.files ?? undefined,
    });
    const flags = scanSubmission(row.script, row.files);
    applyScannerBackstop(audit, flags);
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

router
  .route({ path: "whoami", method: "POST" })
  .siwx()
  .description(
    "Echo the wallet your SIWX signature proves, plus its verified X identity if connected. Free. Lets an agent confirm which wallet it is signing with before publishing or claiming.",
  )
  .handler(async ({ wallet }) => {
    if (!wallet) throw new HttpError("Wallet identity required", 401);
    const identity = await getIdentity(wallet);
    return {
      wallet: wallet.toLowerCase(),
      identity:
        identity?.verified && identity.twitterHandle
          ? { handle: identity.twitterHandle }
          : null,
    };
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

router
  .route({ path: "admin/delete", method: "POST" })
  .apiKey((key) => (key === process.env.ADMIN_TOKEN ? { admin: true } : null))
  .body(z.object({ slug: z.string().regex(SLUG) }))
  .description(
    "Admin: permanently delete a listing and its events, freeing the slug. Unlike delist, this is irreversible — use for cleanup of broken or malicious uploads (unowned wallet-less submissions have no other update path). Requires ADMIN_TOKEN.",
  )
  .handler(async ({ body }) => {
    const deleted = await deleteStatusline(body.slug);
    if (!deleted) throw new HttpError("Statusline not found", 404);
    return { slug: body.slug, deleted: true };
  });

/** Run the standard audit + red-flag pipeline on one script, persist, hide on reject. */
async function auditAndPersist(entry: {
  slug: string;
  script: string | null;
  name: string;
  description: string;
  files?: CompanionFile[] | null;
}) {
  if (!entry.script) return { slug: entry.slug, skipped: "no script" };
  const audit = await auditScript({
    script: entry.script,
    name: entry.name,
    description: entry.description,
    author: "backfill",
    files: entry.files ?? undefined,
  });
  const flags = scanSubmission(entry.script, entry.files);
  applyScannerBackstop(audit, flags);
  await updateStatuslineAudit(entry.slug, {
    auditVerdict: audit.verdict,
    auditSummary: audit.summary,
    auditModel: audit.model,
    capabilities: audit.capabilities.length
      ? audit.capabilities
      : detectCapabilities(entry.script),
    redFlags: flags.map((f) => `${f.severity}: ${f.label}`),
  });
  if (audit.verdict === "reject") await setHidden(entry.slug, true);
  return {
    slug: entry.slug,
    verdict: audit.verdict,
    model: audit.model,
    hidden: audit.verdict === "reject",
  };
}

router
  .route({ path: "reaudit", method: "POST" })
  .unprotected()
  .body(z.object({ slug: z.string().regex(SLUG).optional() }))
  .description(
    "Permissionlessly audit any statusline that has never been audited (e.g. seeded rows). Pass a slug for one, or omit to audit every unaudited listing. Cost-bounded: a listing that already has a verdict is a no-op — the audit never re-runs, so this can't be used to burn the audit budget. Persists verdict/summary/capabilities and auto-hides rejects.",
  )
  .inputExample({ slug: "usage-bars" })
  .handler(async ({ body }) => {
    if (body.slug) {
      const row = await getStatusline(body.slug);
      if (!row) throw new HttpError("Statusline not found", 404);
      if (row.auditVerdict) {
        // Already audited — return the stored result, no LLM call.
        return {
          results: [
            {
              slug: row.slug,
              verdict: row.auditVerdict,
              model: row.auditModel,
              alreadyAudited: true,
            },
          ],
        };
      }
      return { results: [await auditAndPersist(row)] };
    }
    // Bulk: only ever touches rows with no verdict, so repeated calls converge
    // to a no-op instead of re-billing audits.
    const pending = await listUnaudited();
    const results = [];
    for (const entry of pending) results.push(await auditAndPersist(entry));
    return { audited: results.length, results };
  });

// --- Misc --------------------------------------------------------------------

router
  .route({ path: "health", method: "GET" })
  .unprotected()
  .handler(async () => ({ status: "ok" }));
