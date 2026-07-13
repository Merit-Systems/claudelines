# ClaudeLines

[ClaudeLines](https://claudelines.com) is a registry and marketplace for
[Claude Code status line](https://code.claude.com/docs/en/statusline) scripts.
People can share a status line for free or sell it. Others can preview, review,
and install it.

A status line is executable code. Claude Code runs it on the user's computer
with the user's permissions. ClaudeLines checks every submitted script, but the
checks do not prove that a script is safe. Read a script before installing it.

## How it works

Each listing contains:

- The status line script.
- A captured ANSI preview supplied by the publisher.
- Its name, description, tags, price, and publisher wallet.
- An LLM audit summary, detected capabilities, and deterministic scanner flags.
- Install, sales, and revenue counts.

The site renders the stored preview. It does not execute the script in the
browser.

### Publishing

Publishing costs $0.15 through x402 or MPP. The fee pays for the security audit
and is charged even when the audit rejects the script.

The publisher submits the script, a sanitized preview, listing metadata, and a
price. The service then:

1. Verifies the registration payment.
2. Runs an LLM review of the script.
3. Scans for deterministic high-risk patterns.
4. Rejects scripts that fail the checks.
5. Stores accepted scripts and their audit results.

The wallet that pays for registration owns the listing and receives payments
for paid downloads. A publisher can connect an X account to that wallet through
SIWX and OAuth.

Publishing without a wallet is free through `POST /api/submit`. These listings
skip the LLM audit (only the deterministic scanner runs, and high severity
hits are rejected), have no owner, and can never be sold. They are marked
unaudited with a prominent warning until someone funds the audit. Anyone —
not just the publisher — can pay through `POST /api/audit` to run the full
LLM review on any listing: $0.15 for the first audit of an unaudited
listing, $0.50 to re-audit one that already has a verdict (ten times the
audit's actual cost, so re-rolling a competitor's verdict is uneconomical).
An audit that rejects delists the script. Free submissions are rate-limited
per caller.

### Installing

Free scripts are served as raw text. Paid scripts are returned after payment.
The install flow tells the user or agent to:

1. Download the exact stored script bytes.
2. Read the script and explain what it does.
3. Install only after the user approves.
4. Save it under `~/.claude/statuslines/` and make it executable.
5. Set `statusLine.command` in `~/.claude/settings.json`.

### Payments

- Free downloads require no payment.
- Publishing costs $0.15 and funds the audit; wallet-less publishing is free
  and unaudited.
- Anyone can fund an audit of any listing: $0.15 first audit, $0.50 re-audit.
- Publishers choose the price of paid scripts.
- Paid downloads settle directly to the publisher's wallet.
- ClaudeLines takes no platform fee and does not hold creator payments.
- Self-purchases do not increase installs or revenue.

## API

| Method | Path | Auth or payment | Purpose |
| --- | --- | --- | --- |
| `GET` | `/api/statuslines` | None | Search and list public status lines |
| `GET` | `/api/statuslines/{slug}` | None | Get listing details |
| `GET` | `/api/statuslines/{slug}/script` | None for free listings | Download a free script as raw text |
| `POST` | `/api/statuslines/{slug}/preview` | SIWX | Update a listing's captured preview |
| `POST` | `/api/statuslines/{slug}/archive` | SIWX | Owner: archive (delist) or restore a listing |
| `GET` | `/api/leaderboard` | None | List installs and revenue |
| `GET` | `/api/creators/{wallet}` | None | Get a creator identity and listings |
| `POST` | `/api/download` | Creator-set price | Buy and download a paid script |
| `POST` | `/api/register` | $0.15 | Audit and publish a script |
| `POST` | `/api/submit` | None | Publish free without a wallet (unaudited) |
| `POST` | `/api/audit` | $0.15 / $0.50 | Fund an LLM audit (first / re-audit) |
| `POST` | `/api/identity/connect` | SIWX | Start X account verification |
| `POST` | `/api/whoami` | SIWX | Echo the signing wallet and its identity |
| `POST` | `/api/report` | SIWX | Submit a review or report |
| `GET` | `/api/statuslines/{slug}/feedback` | None | Get reviews and reports |

See [`/openapi.json`](https://claudelines.com/openapi.json) for the complete
schema. Agent instructions are served at
[`/skill.md`](https://claudelines.com/skill.md) and
[`/llms.txt`](https://claudelines.com/llms.txt).

## Stack

- Next.js App Router and React
- Tailwind CSS
- Drizzle ORM and Neon Postgres
- `@agentcash/router` for x402, MPP, and SIWX
- Anthropic for script audits
- Vercel for hosting

## Local setup

Requirements:

- Node.js
- pnpm
- A Postgres or Neon database

Install dependencies and create a local environment file:

```bash
pnpm install
cp .env.example .env.local
```

Set at least:

- `DATABASE_URL`: Postgres connection string.
- `BASE_URL`: Public service origin. Use `http://localhost:3000` locally.
- `EVM_PAYEE_ADDRESS`: Wallet that receives registration payments.
- `ANTHROPIC_API_KEY`: Required for audits in a serverless deployment.
- Payment protocol credentials for x402, MPP, or both.

Optional features use:

- `X_OAUTH_CLIENT_ID` and `X_OAUTH_CLIENT_SECRET` for X verification.
- `KV_REST_API_URL` and `KV_REST_API_TOKEN` for distributed nonces and replay
  protection.
- `ADMIN_TOKEN` for the delist endpoint.

Apply the schema and start the development server:

```bash
pnpm db:push
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

## Commands

| Command | Purpose |
| --- | --- |
| `pnpm dev` | Start the development server |
| `pnpm build` | Apply migrations and build for production |
| `pnpm start` | Start the production server |
| `pnpm lint` | Run ESLint |
| `pnpm db:push` | Push the current Drizzle schema |
| `pnpm db:generate` | Generate a migration |
| `pnpm db:studio` | Open Drizzle Studio |

## Production

The production deployment uses Vercel with a Neon database. The build command
runs `drizzle-kit migrate` before `next build`.

Before accepting real traffic:

1. Configure production payment credentials and the audit API key.
2. Configure Upstash Redis for SIWX nonces and MPP replay protection.
3. Set the X OAuth callback to
   `{BASE_URL}/api/identity/callback` if identity verification is enabled.
4. Set a strong `ADMIN_TOKEN`.
5. Review scripts before installing them. Automated checks are advisory.
