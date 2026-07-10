# ClaudeLines (claudelines.com)

Registry + leaderboard for Claude Code statuslines. Statuslines are **data,
not code**: each one is a JSON spec rendered by a single auditable,
dependency-free renderer — installing one never executes anything from the
registry. Publishing costs $0.01 over x402/MPP; creators set their own sale
price and buyers pay their wallet directly.

## Stack

- Next.js (App Router) + Tailwind v4, merit-systems styling
- [`@agentcash/router`](https://agentcash.dev/docs/router) — x402 + MPP paid API
- Drizzle ORM + Neon Postgres
- Deployed on Vercel

## The safety model

`public/render.mjs` is the only executable users ever install (once, to
`~/.claude/statuslines/`). Specs are validated twice — by the registry at
registration and by the renderer at render time — and cannot contain control
characters, escape sequences, or unknown variables. The renderer runs exactly
one hardcoded subprocess (`git branch --show-current`, no shell) and makes no
network calls. See `/docs` on the site.

## API (agent-facing)

| Route | Auth | Purpose |
| --- | --- | --- |
| `GET /api/statuslines` | free | List entries (specs inline for free ones) |
| `GET /api/statuslines/{slug}` | free | Detail; spec + install steps when free |
| `GET /api/statuslines/{slug}/spec` | free | Raw spec JSON (free entries; 402 hint otherwise) |
| `GET /api/leaderboard` | free | Rankings |
| `POST /api/download` | paid — creator's price | Buy a paid spec; pays the creator's wallet via per-request `payTo` |
| `POST /api/register` | paid — $0.01 flat | Publish a statusline (spec validated, slug unique, price ≤ $25) |

Discovery: `/openapi.json` (OpenAPI 3.1 + `x-payment-info`) and `/llms.txt`.

## Setup

1. **Create the Vercel project** and link this repo.
2. **Neon**: Vercel → Storage → Create Database → Neon. Pull env:
   `vercel env pull .env.local`
3. **Wallets & keys** — fill the rest of `.env.example` (see comments):
   - `EVM_PAYEE_ADDRESS` — platform wallet (registration fees)
   - `CDP_API_KEY_ID/SECRET` — x402 verification (free CDP tier)
   - `MPP_SECRET_KEY` + `MPP_CURRENCY` — enables MPP
   - `BASE_URL` — set explicitly when a custom domain is attached
4. **Schema**:
   ```bash
   pnpm db:push
   ```
5. **Run** `pnpm dev`, or deploy.
6. **Production hardening**: add Upstash Redis (Vercel Marketplace) for
   `KV_REST_API_URL/TOKEN` before real traffic.

## Validate payments end-to-end

```bash
npx -y @agentcash/discovery@latest check https://<domain>
npx agentcash@latest fetch https://<domain>/api/download -m POST -b '{"slug":"sunset-boulevard"}' -p x402
```

Then register the origin so agents can find it:
[x402scan](https://www.x402scan.com/resources/register) ·
[mppscan](https://www.mppscan.com/register)

## Scripts

- `pnpm dev` / `pnpm build` — Next.js
- `pnpm db:push` — push Drizzle schema to Neon
- `pnpm db:studio` — Drizzle Studio
