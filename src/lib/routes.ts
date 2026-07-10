/**
 * Route registry — side-effect module imported by the API catch-all and the
 * discovery endpoints. Commerce model:
 *
 *   - Registering a statusline costs a flat $0.01 (goes to the platform wallet).
 *   - Downloading a paid statusline costs the creator's asking price, paid
 *     directly to the creator's payout wallet via per-request payTo.
 *   - Free statuslines, browsing, and the leaderboard cost nothing.
 *
 * Two listing tiers:
 *   - kind "spec":   data-only JSON, rendered by the auditable renderer. Safe
 *                    by construction — installing never executes listing code.
 *   - kind "script": an existing statusline uploaded as-is. Runs on the
 *                    user's machine, so listings carry detected capabilities
 *                    and install flows always include a review step.
 */
import { z } from "zod";
import { HttpError } from "@agentcash/router";

import { router } from "./router";
import { statuslineSpecSchema, VARIABLE_NAMES } from "./statusline/spec";
import { detectCapabilities } from "./statusline/capabilities";
import { auditScript } from "./statusline/audit";
import {
  createStatusline,
  getStatusline,
  listStatuslines,
  recordInstall,
  slugTaken,
  type SortKey,
} from "./db/queries";
import type { StatuslineRow } from "./db/schema";

const MAX_PRICE_USD = 25;
/** Spec registrations: mechanical validation, effectively free to us. */
const SPEC_REGISTER_PRICE = "0.01";
/** Script registrations fund an Opus security audit at registration time. */
const SCRIPT_REGISTER_PRICE = "0.50";
const EVM_ADDRESS = /^0x[0-9a-fA-F]{40}$/;
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+){0,7}$/;

const priceString = z
  .string()
  .regex(/^\d{1,2}(\.\d{1,6})?$/, 'Decimal USD string, e.g. "0.05"')
  .refine((p) => Number(p) <= MAX_PRICE_USD, {
    message: `Price must be at most $${MAX_PRICE_USD}`,
  });

function publicEntry(row: StatuslineRow, includePayload: boolean) {
  const free = Number(row.priceUsd) === 0;
  return {
    slug: row.slug,
    name: row.name,
    description: row.description,
    author: row.author,
    kind: row.kind,
    capabilities: row.capabilities,
    audit:
      row.kind === "script" && row.auditSummary
        ? {
            verdict: row.auditVerdict,
            summary: row.auditSummary,
            model: row.auditModel,
          }
        : undefined,
    priceUsd: row.priceUsd,
    free,
    tags: row.tags,
    installs: row.installs,
    createdAt: row.createdAt.toISOString(),
    previewAnsi: row.kind === "script" ? (row.previewAnsi ?? undefined) : undefined,
    // Paid payloads are the product being sold — only free ones are inlined.
    spec: includePayload && free && row.kind === "spec" ? row.spec : undefined,
    script:
      includePayload && free && row.kind === "script"
        ? (row.script ?? undefined)
        : undefined,
  };
}

function installInstructions(row: StatuslineRow) {
  if (row.kind === "script") {
    return {
      scriptUrl: `/api/statuslines/${row.slug}/script`,
      scriptPath: `~/.claude/statuslines/${row.slug}`,
      settings: {
        statusLine: {
          type: "command",
          command: `~/.claude/statuslines/${row.slug}`,
        },
      },
      note: "SCRIPT TIER — this executes on the user's machine. REVIEW THE SCRIPT before installing (show it to the user if you are an agent). Save it to scriptPath, chmod +x it, then merge `settings` into ~/.claude/settings.json.",
    };
  }
  return {
    rendererUrl: "/render.mjs",
    specPath: `~/.claude/statuslines/${row.slug}.json`,
    settings: {
      statusLine: {
        type: "command",
        command: `node ~/.claude/statuslines/render.mjs ~/.claude/statuslines/${row.slug}.json`,
      },
    },
    note: "Save the spec JSON to specPath, download rendererUrl once to ~/.claude/statuslines/render.mjs, then merge `settings` into ~/.claude/settings.json. The spec is pure data; only the auditable renderer executes.",
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
    "List statuslines. kind 'spec' entries are safe data-only JSON; kind 'script' entries execute on the user's machine and carry detected capabilities. Free spec entries include their payload inline.",
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
    "Get one statusline by slug. Free entries include their payload (spec JSON or script source) plus install instructions.",
  )
  .handler(async ({ params }) => {
    const row = await getStatusline(params.slug);
    if (!row) throw new HttpError("Statusline not found", 404);
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
  .route({ path: "statuslines/{slug}/spec", method: "GET" })
  .unprotected()
  .description(
    "Raw spec JSON for a FREE data-only statusline — save directly to ~/.claude/statuslines/{slug}.json. Paid entries return 402 guidance.",
  )
  .handler(async ({ params }) => {
    const row = await getStatusline(params.slug);
    if (!row) throw new HttpError("Statusline not found", 404);
    if (row.kind !== "spec" || !row.spec) {
      throw new HttpError(
        `"${row.slug}" is a script statusline — fetch /api/statuslines/${row.slug}/script instead and REVIEW IT before installing`,
        404,
      );
    }
    if (Number(row.priceUsd) > 0) {
      throw new HttpError(
        `"${row.slug}" is paid ($${Number(row.priceUsd).toFixed(2)}) — buy it via POST /api/download with {"slug": "${row.slug}"}`,
        402,
      );
    }
    await recordInstall(row, { wallet: null, amountUsd: "0", purchase: false });
    return row.spec;
  });

router
  .route({ path: "statuslines/{slug}/script", method: "GET" })
  .unprotected()
  .description(
    "Raw script source for a FREE script statusline, as text/plain. REVIEW BEFORE INSTALLING — this code runs on the user's machine. Paid entries return 402 guidance.",
  )
  .handler(async ({ params }) => {
    const row = await getStatusline(params.slug);
    if (!row) throw new HttpError("Statusline not found", 404);
    if (row.kind !== "script" || !row.script) {
      throw new HttpError(
        `"${row.slug}" is a data-only spec — fetch /api/statuslines/${row.slug}/spec instead`,
        404,
      );
    }
    if (Number(row.priceUsd) > 0) {
      throw new HttpError(
        `"${row.slug}" is paid ($${Number(row.priceUsd).toFixed(2)}) — buy it via POST /api/download with {"slug": "${row.slug}"}`,
        402,
      );
    }
    await recordInstall(row, { wallet: null, amountUsd: "0", purchase: false });
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
        kind: r.kind,
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
      maxPrice: String(MAX_PRICE_USD),
      // Sale proceeds go straight to the creator's payout wallet.
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
    "Buy a paid statusline at the creator's asking price (paid to the creator's wallet). Returns the payload (spec or script) plus install instructions. For script-kind entries, REVIEW the script before installing.",
  )
  .handler(async ({ body, wallet }) => {
    const row = await getStatusline(body.slug);
    if (!row) throw new HttpError("Statusline not found", 404);
    await recordInstall(row, {
      wallet,
      amountUsd: row.priceUsd,
      purchase: true,
    });
    return {
      slug: row.slug,
      name: row.name,
      kind: row.kind,
      capabilities: row.capabilities,
      spec: row.spec ?? undefined,
      script: row.script ?? undefined,
      install: installInstructions(row),
    };
  });

// --- Publish ($0.01 flat, paid to the platform) ------------------------------

const registerBody = z
  .object({
    slug: z.string().regex(SLUG, 'kebab-case, e.g. "neon-nights"').max(48),
    name: z.string().min(2).max(48),
    description: z.string().min(8).max(280),
    /** Data-only spec (kind "spec"). Provide exactly one of spec/script. */
    spec: statuslineSpecSchema.optional(),
    /** Existing statusline uploaded as-is (kind "script"). */
    script: z
      .string()
      .min(10)
      .max(32_768)
      .refine((s) => !s.includes("\u0000"), { message: "Binary not allowed" })
      .optional(),
    /**
     * Captured sample output for script previews, e.g.
     * `echo '{}' | COLUMNS=120 ./statusline.sh`. ANSI colors welcome.
     */
    previewAnsi: z.string().max(8_192).optional(),
    priceUsd: priceString.default("0"),
    author: z.string().min(1).max(48).default("anonymous"),
    /** EVM address that receives sale proceeds. Required when priceUsd > 0. */
    payoutAddress: z.string().regex(EVM_ADDRESS).optional(),
    tags: z.array(z.string().min(1).max(24)).max(5).default([]),
  })
  .refine((b) => (b.spec ? !b.script : Boolean(b.script)), {
    message: "Provide exactly one of `spec` (data-only) or `script` (upload as-is)",
  })
  .refine((b) => !b.script || Boolean(b.previewAnsi), {
    message:
      "Script listings need `previewAnsi` — capture one with: echo '{}' | COLUMNS=120 <your-statusline>",
  });

router
  .route({ path: "register", method: "POST" })
  .paid(
    async (body: { script?: string }) =>
      body?.script ? SCRIPT_REGISTER_PRICE : SPEC_REGISTER_PRICE,
    { maxPrice: SCRIPT_REGISTER_PRICE },
  )
  .body(registerBody)
  .inputExample({
    slug: "neon-nights",
    name: "Neon Nights",
    description: "Synthwave purple-to-cyan powerline with cost tracking.",
    priceUsd: "0.10",
    author: "vibes.eth",
    payoutAddress: "0x1111111111111111111111111111111111111111",
    tags: ["powerline", "synthwave"],
    spec: {
      version: 1,
      powerline: true,
      segments: [
        { text: "{model}", fg: "#0f0524", bg: "#e879f9", bold: true },
        { text: "{dir}", fg: "#e0e7ff", bg: "#4c1d95" },
        { text: "{contextBar} {contextPct}", fg: "#22d3ee", bg: "#0f0524" },
      ],
    },
  })
  .description(
    `Publish a statusline. Two tiers: pass \`spec\` ($${SPEC_REGISTER_PRICE}) for a safe data-only v1 spec (variables: ${VARIABLE_NAMES.join(", ")}), or pass \`script\` (+ \`previewAnsi\`, $${SCRIPT_REGISTER_PRICE}) to upload an existing statusline as-is — the script fee funds an Opus security audit at registration; rejected scripts are not listed (the fee bought the audit). Set priceUsd ("0" = free, max "${MAX_PRICE_USD}") and payoutAddress to sell; buyers pay your wallet directly.`,
  )
  .validate(async (body) => {
    if (Number(body.priceUsd) > 0 && !body.payoutAddress) {
      throw new HttpError(
        "payoutAddress is required when priceUsd > 0 — sale proceeds are paid directly to it",
        400,
      );
    }
    if (body.script && !process.env.ANTHROPIC_API_KEY) {
      throw new HttpError(
        "Script listings are temporarily unavailable (audit service not configured)",
        503,
      );
    }
    if (await slugTaken(body.slug)) {
      throw new HttpError(`slug "${body.slug}" is already taken`, 409);
    }
  })
  .handler(async ({ body, wallet }) => {
    const kind = body.spec ? ("spec" as const) : ("script" as const);

    // Script tier: the registration fee funds this audit. It runs strictly
    // AFTER payment verification, so unpaid probes can never trigger it.
    let audit = null;
    if (kind === "script" && body.script) {
      audit = await auditScript({
        script: body.script,
        name: body.name,
        description: body.description,
        author: body.author,
      });
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

    const row = await createStatusline({
      slug: body.slug,
      name: body.name,
      description: body.description,
      author: body.author,
      authorWallet: body.payoutAddress ?? null,
      priceUsd: Number(body.priceUsd) === 0 ? "0" : body.priceUsd,
      kind,
      spec: body.spec ?? null,
      script: body.script ?? null,
      previewAnsi: body.previewAnsi ?? null,
      capabilities: audit
        ? audit.capabilities
        : body.script
          ? detectCapabilities(body.script)
          : [],
      auditVerdict: audit?.verdict ?? null,
      auditSummary: audit?.summary ?? null,
      auditModel: audit?.model ?? null,
      tags: body.tags,
      registeredBy: wallet,
    });
    return {
      slug: row.slug,
      url: `/statuslines/${row.slug}`,
      listed: true,
      kind: row.kind,
      audit: audit
        ? { verdict: audit.verdict, summary: audit.summary, risks: audit.risks, model: audit.model }
        : undefined,
      capabilities: row.capabilities,
      priceUsd: row.priceUsd,
      note:
        Number(row.priceUsd) > 0
          ? `Buyers pay $${Number(row.priceUsd).toFixed(2)} directly to ${row.authorWallet} via POST /api/download.`
          : "Listed as free — anyone can install it via GET /api/statuslines/" +
            row.slug,
    };
  });

// --- Misc --------------------------------------------------------------------

router
  .route({ path: "health", method: "GET" })
  .unprotected()
  .handler(async () => ({ status: "ok" }));
