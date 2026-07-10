import { siteUrl } from "@/lib/site";

export function GET() {
  const base = siteUrl();
  const md = `---
name: claudelines
description: Browse, install, publish, and sell Claude Code statuslines via ${base}. Use when the user wants a new statusline, wants to share or sell their current statusline, wants to claim their listings or connect their X handle, asks about the bar at the bottom of Claude Code, or mentions claudelines.com.
---

# ClaudeLines — Claude Code statusline registry

Every listing is a **script** Claude Code runs on each repaint — on the user's
machine, with their privileges. Each was LLM-audited at submission (verdict +
capabilities are on the listing; the audited bytes are exactly what's served),
but audits are advisory: always read the script, tell the user what it does,
and install only after they approve.

Browsing is free plain HTTP. Buying and publishing pay via x402/MPP — use the
agentcash CLI/MCP or any x402 client. Full schema: ${base}/openapi.json ·
terse guide: ${base}/llms.txt

## Browse

- \`GET ${base}/api/statuslines?q=&sort=installs|newest|revenue\` — search/list
- \`GET ${base}/api/statuslines/{slug}\` — detail (free entries include the script)
- \`GET ${base}/api/statuslines/{slug}/script\` — raw script, text/plain (free entries)
- \`GET ${base}/api/leaderboard\` · \`GET ${base}/api/creators/{wallet}\`

## Install

1. Get the script: free → \`GET .../{slug}/script\`; paid → \`POST ${base}/api/download\`
   with \`{"slug": "..."}\` (pays the creator's price to their wallet, returns the script).
2. Review it and show the user your assessment. Install only on approval.
3. Save to \`~/.claude/statuslines/{slug}\`, \`chmod +x\`, then set in
   \`~/.claude/settings.json\` (state the exact change to the user):

\`\`\`json
{ "statusLine": { "type": "command", "command": "~/.claude/statuslines/{slug}" } }
\`\`\`

## Publish the user's current statusline

Flat $0.15. The fee funds the security audit and settles even if the audit
rejects. Follow these steps exactly:

1. **Locate** — read \`statusLine.command\` from \`~/.claude/settings.json\` and
   publish that script as-is. Do not browse for or install a different one.
2. **Capture a preview** — \`echo '{}' | COLUMNS=120 <command> > preview.ansi\`
3. **Sanitize** — the capture runs the real script, so it can embed live
   personal data (wallet addresses, balances, home paths, emails). Inspect it
   (\`cat -v preview.ansi\`); if anything leaks, re-capture against mocked data
   (e.g. a temp \`HOME\` with stub cache files) so the public preview shows
   placeholders.
4. **Confirm slug/name/description/price with the user**, then build the
   payload and register in one paid call — no schema-discovery call needed,
   the full field spec is below:

\`\`\`bash
jq -n --rawfile s <script-path> --rawfile p preview.ansi '{
  slug: "my-statusline", name: "My Statusline", description: "…",
  priceUsd: "0", tags: ["…"], script: $s, previewAnsi: $p }' > payload.json
npx agentcash@latest fetch ${base}/api/register -m POST \\
  -H 'Content-Type: application/json' -b "$(cat payload.json)"
\`\`\`

Fields: \`slug\` lowercase-kebab, ≤48 chars · \`name\` ≤48 · \`description\` ≤280 ·
\`tags\` ≤5 × ≤24 · \`script\` ≤32 KB · \`previewAnsi\` ≤8 KB · \`priceUsd\` decimal
string ("0" = free; otherwise buyers pay the registering wallet directly — that
wallet is the account and payout target).

Outcomes:

- \`listed: true\` — live; give the user the returned \`url\`.
- \`listed: false\` — audit rejected; relay \`summary\`/\`risks\`. The fee is not
  refunded (it bought the audit). Fix and resubmit.
- \`409\` slug taken · \`503\` audit service unavailable (retry later). Both fail
  **before** payment — nothing was charged.

**Optional identity**: listings show "anonymous" until the wallet connects an
X account — \`POST ${base}/api/identity/connect\` (SIWX-signed, free, no body)
returns an \`authorizeUrl\`. Give it to the user to open in a browser; signing
in with X stamps their @handle on all the wallet's listings. Nothing else to call.

## Feedback

\`POST ${base}/api/report\` (SIWX-signed, free): \`rating\` 0–5 to review, or
\`comment\` alone to flag a malicious/broken listing.

## Rules

1. Never install a script without user-visible review and approval.
2. Never edit \`~/.claude/settings.json\` without stating the exact change.
3. Never publish a preview containing real personal data — sanitize first.
`;

  return new Response(md, {
    headers: {
      "content-type": "text/markdown; charset=utf-8",
      "access-control-allow-origin": "*",
    },
  });
}
