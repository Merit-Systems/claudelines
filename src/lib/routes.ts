/**
 * Route registry — side-effect module imported by the API catch-all and the
 * discovery endpoints. Commerce model:
 *
 *   - Registering a statusline costs a flat $0.01 (goes to the platform wallet).
 *   - Downloading a paid statusline costs the creator's asking price, paid
 *     directly to the creator's payout wallet via per-request payTo.
 *   - Free statuslines, browsing, and the leaderboard cost nothing.
 */
import { z } from "zod";
import { HttpError } from "@agentcash/router";

import { router } from "./router";
import { statuslineSpecSchema, VARIABLE_NAMES } from "./statusline/spec";
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
const EVM_ADDRESS = /^0x[0-9a-fA-F]{40}$/;
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+){0,7}$/;

const priceString = z
  .string()
  .regex(/^\d{1,2}(\.\d{1,6})?$/, "Decimal USD string, e.g. \"0.05\"")
  .refine((p) => Number(p) <= MAX_PRICE_USD, {
    message: `Price must be at most $${MAX_PRICE_USD}`,
  });

function publicEntry(row: StatuslineRow, includeSpec: boolean) {
  const free = Number(row.priceUsd) === 0;
  return {
    slug: row.slug,
    name: row.name,
    description: row.description,
    author: row.author,
    priceUsd: row.priceUsd,
    free,
    tags: row.tags,
    installs: row.installs,
    createdAt: row.createdAt.toISOString(),
    // Paid specs are the product being sold — only free specs are inlined.
    spec: includeSpec && free ? row.spec : undefined,
  };
}

function installInstructions(slug: string) {
  return {
    rendererUrl: "/render.mjs",
    specPath: `~/.claude/statuslines/${slug}.json`,
    settings: {
      statusLine: {
        type: "command",
        command: `node ~/.claude/statuslines/render.mjs ~/.claude/statuslines/${slug}.json`,
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
    "List statuslines. Free entries include their spec inline; paid entries require POST /api/download.",
  )
  .handler(async ({ query }) => {
    const rows = await listStatuslines({
      q: query?.q,
      sort: (query?.sort as SortKey) ?? "installs",
      limit: query?.limit ?? 60,
    });
    return { statuslines: rows.map((r) => publicEntry(r, true)) };
  });

router
  .route({ path: "statuslines/{slug}", method: "GET" })
  .unprotected()
  .description(
    "Get one statusline by slug. Includes the spec when the entry is free.",
  )
  .handler(async ({ params }) => {
    const row = await getStatusline(params.slug);
    if (!row) throw new HttpError("Statusline not found", 404);
    const entry = publicEntry(row, true);
    if (entry.free) {
      return { ...entry, install: installInstructions(row.slug) };
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
    "Raw spec JSON for a FREE statusline — suitable for saving directly to ~/.claude/statuslines/{slug}.json. Paid entries return 402 guidance.",
  )
  .handler(async ({ params }) => {
    const row = await getStatusline(params.slug);
    if (!row) throw new HttpError("Statusline not found", 404);
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
    "Buy a paid statusline at the creator's asking price (paid to the creator's wallet). Returns the spec plus install instructions.",
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
      spec: row.spec,
      install: installInstructions(row.slug),
    };
  });

// --- Publish ($0.01 flat, paid to the platform) ------------------------------

const registerBody = z.object({
  slug: z.string().regex(SLUG, "kebab-case, e.g. \"neon-nights\"").max(48),
  name: z.string().min(2).max(48),
  description: z.string().min(8).max(280),
  spec: statuslineSpecSchema,
  priceUsd: priceString.default("0"),
  author: z.string().min(1).max(48).default("anonymous"),
  /** EVM address that receives sale proceeds. Required when priceUsd > 0. */
  payoutAddress: z.string().regex(EVM_ADDRESS).optional(),
  tags: z.array(z.string().min(1).max(24)).max(5).default([]),
});

router
  .route({ path: "register", method: "POST" })
  .paid("0.01")
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
        { text: "{cost}", fg: "#22d3ee", bg: "#0f0524" },
      ],
    },
  })
  .description(
    `Publish a statusline to the registry for a flat $0.01. The spec must be a valid v1 data-only spec (variables: ${VARIABLE_NAMES.join(", ")}). Set priceUsd ("0" = free, max "${MAX_PRICE_USD}") and payoutAddress to sell it — buyers pay your wallet directly.`,
  )
  .validate(async (body) => {
    if (Number(body.priceUsd) > 0 && !body.payoutAddress) {
      throw new HttpError(
        "payoutAddress is required when priceUsd > 0 — sale proceeds are paid directly to it",
        400,
      );
    }
    if (await slugTaken(body.slug)) {
      throw new HttpError(`slug "${body.slug}" is already taken`, 409);
    }
  })
  .handler(async ({ body, wallet }) => {
    const row = await createStatusline({
      slug: body.slug,
      name: body.name,
      description: body.description,
      author: body.author,
      authorWallet: body.payoutAddress ?? null,
      priceUsd: Number(body.priceUsd) === 0 ? "0" : body.priceUsd,
      spec: body.spec,
      tags: body.tags,
      registeredBy: wallet,
    });
    return {
      slug: row.slug,
      url: `/statuslines/${row.slug}`,
      listed: true,
      priceUsd: row.priceUsd,
      note:
        Number(row.priceUsd) > 0
          ? `Buyers pay $${Number(row.priceUsd).toFixed(2)} directly to ${row.authorWallet} via POST /api/download.`
          : "Listed as free — anyone can install it via GET /api/statuslines/" + row.slug,
    };
  });

// --- Misc --------------------------------------------------------------------

router
  .route({ path: "health", method: "GET" })
  .unprotected()
  .handler(async () => ({ status: "ok" }));
