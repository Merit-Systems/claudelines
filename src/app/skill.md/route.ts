import { siteUrl } from "@/lib/site";

export function GET() {
  const base = siteUrl();
  const md = `---
name: claudelines
description: Browse, install, publish, and sell Claude Code statuslines via ${base}. Use when the user wants a new statusline, wants to share or sell their current statusline, asks about the bar at the bottom of Claude Code, or mentions claudelines.com.
---

# ClaudeLines — Claude Code statusline registry

${base} (ClaudeLines) is a registry of Claude Code statuslines. Every listing
is a **script** — a command Claude Code runs on each repaint. It executes on
the user's machine with their privileges, so treat installing one like any
third-party script.

Every listing was **security-audited by an LLM at submission** (the audit
summary and detected capabilities are on the listing), and the exact reviewed
bytes are what get served. Audits are advisory, not a guarantee: ALWAYS
download the script, review it yourself, show the user your read of what it
does, and install only after they approve.

If the user asks to **share their current statusline**, use the publishing flow
below. Read their configured statusLine command and publish the script it points
to. Do not browse for or install a different statusline.

## Browse (free, plain HTTP)

- \`GET ${base}/api/statuslines?q=&sort=installs|newest|revenue\` — list
- \`GET ${base}/api/statuslines/{slug}\` — detail; free entries include the script + install steps
- \`GET ${base}/api/statuslines/{slug}/script\` — raw script (free entries), text/plain
- \`GET ${base}/api/leaderboard\` — rankings
- \`GET ${base}/api/creators/{wallet}\` — a creator's identity + listings

## Install for the user

1. \`GET ${base}/api/statuslines/{slug}/script\` (free) — or buy it (below).
2. **Review it. Show the user the source and your assessment.** Install only on approval.
3. Save to \`~/.claude/statuslines/{slug}\`, \`chmod +x\`, and set in \`~/.claude/settings.json\`:

\`\`\`json
{ "statusLine": { "type": "command", "command": "~/.claude/statuslines/{slug}" } }
\`\`\`

## Buy a paid statusline

\`POST ${base}/api/download\` with \`{"slug": "..."}\` — pays the creator's
asking price directly to their wallet via x402/MPP (use agentcash or any x402
client). Returns the script and install steps. Review before installing.

## Publish the user's statusline

\`POST ${base}/api/register\` ($0.15 via x402/MPP — the fee funds the audit):

- \`script\`: the statusline script, as-is.
- \`previewAnsi\`: a captured sample — \`echo '{}' | COLUMNS=120 <their command>\`.
- \`slug\`, \`name\`, \`description\`, \`priceUsd\` ("0" free, or any amount), \`tags\`.

Sale proceeds pay the wallet that registered — one wallet is the account. A
failed audit means the script is not listed (the fee bought the audit).

Verify an X identity (POST /api/identity/claim then /api/identity/verify with a
tweeted code, both SIWX-signed) and the user's listings display @handle as a
verified author; otherwise they are unclaimed.

## Leave feedback

\`POST ${base}/api/report\` (SIWX-signed, free): include \`rating\` (0–5) to
review, or only \`comment\` to report a malicious/broken listing.

## Rules

1. Never install a script without user-visible review and approval.
2. Never edit \`~/.claude/settings.json\` without telling the user what changes.
3. Prices are decimal USD strings; payment settles on Base (x402) or Tempo (MPP).
4. Full API schema: ${base}/openapi.json · terse guide: ${base}/llms.txt
`;

  return new Response(md, {
    headers: {
      "content-type": "text/markdown; charset=utf-8",
      "access-control-allow-origin": "*",
    },
  });
}
