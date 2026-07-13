---
name: verify
description: Build, run, and drive the claudelines app locally to verify changes end-to-end.
---

# Verifying claudelines locally

## Stack handle

- `pnpm dev --port 3456` — Next.js dev server. DB access goes through the
  Neon HTTP driver: `DATABASE_URL` (local Postgres in Docker on
  `localhost:5433`) + `NEON_HTTP_PROXY` (local-neon-http-proxy container on
  `localhost:4444/sql`). Both from `.env.local`.
- If API routes 500 with `Failed query …` on every DB endpoint, the proxy
  container is likely wedged (it returns `Control plane request failed` for
  even `select 1`, while direct `psql` on 5433 works). Workaround that
  avoids restarting Docker: run the ~50-line Neon-protocol shim over `pg`
  (POST `/sql`, raw-text types, honor the `Neon-Array-Mode` header) against
  5433 and start dev with `NEON_HTTP_PROXY=http://localhost:<shim>/sql`.
- Migrations: `drizzle-kit migrate` hangs locally (the neon driver can't
  reach a non-Neon Postgres). Apply by hand: `psql "$DATABASE_URL" -f
  drizzle/NNNN_*.sql`, then insert `(hash, created_at)` into
  `drizzle.__drizzle_migrations` — hash = sha256 of the SQL file,
  created_at = the `when` from `drizzle/meta/_journal.json`. Recent
  migrations are hand-written SQL + hand-edited journal (snapshots stopped
  at 0010). Beware `0016_wipe_data.sql` truncates `statuslines`.

## Driving flows

- Public reads are plain curl: `/api/statuslines?q=`, `/api/statuslines/{slug}`,
  `/{slug}/script`, `/api/leaderboard`, site pages at `/statuslines/{slug}`.
- SIWX-signed routes (preview, archive, report, identity/connect): use the
  agentcash MCP `fetch` tool against `http://localhost:3456/...` — it signs
  automatically. The local agentcash wallet address (for seeding owned rows)
  is `address` in `~/.agentcash/wallet.json`.
- Paid routes (register, download, audit) charge real USDC even locally —
  prefer seeding rows straight into Postgres via psql for fixtures, and
  delete them after.
