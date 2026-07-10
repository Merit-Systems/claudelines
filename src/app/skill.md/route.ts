import { siteUrl } from "@/lib/site";

export function GET() {
  const base = siteUrl();
  const md = `---
name: claudelines
description: Browse, install, publish, and sell Claude Code statuslines via ${base}. Use when the user wants a new statusline, wants to share or sell their current statusline, asks about the bar at the bottom of Claude Code, or mentions claudelines.com.
---

# Statuslines registry

${base} is a registry of Claude Code statuslines with two tiers:

- **spec** — data-only JSON rendered by one auditable renderer (\`${base}/render.mjs\`).
  Safe to install without review: a spec cannot execute anything.
- **script** — an existing statusline uploaded as-is. It EXECUTES on the user's
  machine. Every script was security-audited by an LLM at registration (the
  audit summary is on the listing), but audits are advisory: ALWAYS download
  the script, review it yourself, show the user your review, and install only
  after they approve.

## Browse

- \`GET ${base}/api/statuslines?q=&sort=installs|newest|revenue\` — list
- \`GET ${base}/api/statuslines/{slug}\` — detail; free entries include payload + install instructions
- \`GET ${base}/api/leaderboard\` — rankings

## Install for the user

Free entries are plain HTTP — no payment tooling or agentcash needed.

Spec (free): save \`GET /api/statuslines/{slug}/spec\` to
\`~/.claude/statuslines/{slug}.json\`, download \`${base}/render.mjs\` once to
\`~/.claude/statuslines/render.mjs\`, then set in \`~/.claude/settings.json\`:

\`\`\`json
{ "statusLine": { "type": "command", "command": "node ~/.claude/statuslines/render.mjs ~/.claude/statuslines/{slug}.json" } }
\`\`\`

Script (free): save \`GET /api/statuslines/{slug}/script\` to
\`~/.claude/statuslines/{slug}\`, REVIEW IT WITH THE USER, \`chmod +x\` it, and
point \`statusLine.command\` at that path.

Paid (either tier only): \`POST ${base}/api/download\` with \`{"slug": "..."}\`
— pays the creator's asking price directly to their wallet via x402/MPP (use
agentcash or any x402 client). The response contains the payload and install
instructions.

## Publish the user's statusline

\`POST ${base}/api/register\` (x402/MPP paid):

- Their existing statusline as-is: pass \`script\` (the file contents) and
  \`previewAnsi\` — capture it with \`echo '{}' | COLUMNS=120 <their command>\`.
  Costs $0.50, which funds the security audit; a rejected script is not
  listed and the fee is not refunded.
- A data-only design: pass \`spec\` (v1 format, see ${base}/docs#spec). Costs $0.01.

Both accept: \`slug\`, \`name\`, \`description\`, \`priceUsd\` ("0" free, up to
"25"), \`payoutAddress\` (required when selling — buyers pay it directly),
\`author\`, \`tags\`.

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
