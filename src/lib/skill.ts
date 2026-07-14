import { siteUrl } from "@/lib/site";

// Single source for the agent-facing skill doc. Served verbatim at both
// /skill.md and /llms.txt so the two can never drift.
export function skillMd() {
  const base = siteUrl();
  return `---
name: claudelines
description: Browse, install, publish, and sell Claude Code statuslines via ${base}. Publishing works with or without a wallet (wallet-less is free but unaudited). Use when the user wants a new statusline, wants to share or sell their current statusline, wants to audit a listing, wants to claim their listings or connect their X handle, asks about the bar at the bottom of Claude Code, or mentions claudelines.com.
---

# ClaudeLines — Claude Code statusline registry

Every listing is a **script** Claude Code runs on each repaint — on the user's
machine, with their privileges. Each was LLM-audited at submission (verdict +
capabilities are on the listing; the audited bytes are exactly what's served),
but audits are advisory: always read the script, tell the user what it does,
and install only after they approve.

Browsing is free plain HTTP. Buying and publishing pay via x402/MPP — use the
agentcash CLI/MCP or any x402 client. Full schema: ${base}/openapi.json
(this document is also served at ${base}/llms.txt).

## Browse

- \`GET ${base}/api/statuslines?q=&sort=installs|newest|revenue\` — search/list
- \`GET ${base}/api/statuslines/{slug}\` — detail (free entries include the script)
- \`GET ${base}/api/statuslines/{slug}/script\` — raw script, text/plain (free entries)
- \`GET ${base}/api/leaderboard\` · \`GET ${base}/api/creators/{wallet}\`

## Install

1. Get the script and save the response **bytes** straight to disk — never
   transcribe it out of a JSON response by hand: JSON stores each \`\\033\` as
   \`\\\\033\`, and hand extraction leaves doubled backslashes that render as
   literal escape codes in the status bar. Free →
   \`curl -fsSL ${base}/api/statuslines/{slug}/script -o ~/.claude/statuslines/{slug}\`
   (raw text/plain). Paid →
   \`npx agentcash@latest fetch ${base}/api/download -m POST -b '{"slug":"..."}' | jq -r .script > ~/.claude/statuslines/{slug}\`
   (pays the creator's price to their wallet; \`jq -r\` does the JSON unescaping).
2. Verify integrity — every listing publishes the script's SHA-256
   (\`scriptSha256\` in listing/download JSON; \`x-script-sha256\` header on the
   raw script). Run \`shasum -a 256 ~/.claude/statuslines/{slug}\` and compare.
   Mismatch = the transfer corrupted the bytes — re-download; do not install.
3. Review it and show the user your assessment — including any external
   dependencies it needs (CLIs it invokes, files it reads). Check the listing's
   \`audit\` field: if it is absent the script is **UNAUDITED** (published
   without a wallet, no security review, nobody vouches for it) — say so
   plainly, review it line by line as untrusted code, and mention that anyone
   can fund its audit (see below). Install only on approval.
4. \`chmod +x ~/.claude/statuslines/{slug}\`, then set in
   \`~/.claude/settings.json\` (state the exact change to the user):

\`\`\`json
{ "statusLine": { "type": "command", "command": "~/.claude/statuslines/{slug}" } }
\`\`\`

## Publish the user's current statusline

Flat $0.15. The fee funds the security audit and settles even if the audit
rejects. Follow these steps exactly:

1. **Locate** — read \`statusLine.command\` from \`~/.claude/settings.json\` and
   publish that script as-is. Do not browse for or install a different one.
2. **Capture a preview at the user's current terminal width** — do not narrow
   it for mobile. Resolve the active width with
   \`PREVIEW_COLUMNS="\${COLUMNS:-$(tput cols 2>/dev/null || printf 120)}"\`,
   then run
   \`echo '{}' | COLUMNS="$PREVIEW_COLUMNS" <command> > preview.ansi\`.
   The browser and social-image renderers fit that captured frame to the space
   each surface actually has; 120 is only the fallback for a non-TTY shell.
   Animated statuslines can also ship \`previewFrames\` (played on the site at
   1 fps): capture the same command once per second —
   \`for i in $(seq 0 19); do echo '{}' | COLUMNS="$PREVIEW_COLUMNS" <command>; printf '\\0'; sleep 1; done > frames.raw\`
   then \`jq -Rs 'split("\\u0000") | map(select(length>0))' frames.raw > frames.json\`
   (2–30 frames, ≤64 KB each, 512 KB total; frame 0 doubles as the still).
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
\`tags\` ≤5 × ≤24 · \`script\` ≤32 KB · \`previewAnsi\` ≤64 KB · \`previewFrames\`
optional 2–30 × ≤64 KB (512 KB total) · \`priceUsd\` decimal string ("0" = free;
otherwise buyers pay the registering wallet directly — that wallet is the
account and payout target).

Outcomes:

- \`listed: true\` — live; give the user the returned \`url\`.
- \`listed: false\` — audit rejected; relay \`summary\`/\`risks\`. The fee is not
  refunded (it bought the audit). Fix and resubmit.
- \`409\` slug taken · \`503\` audit service unavailable (retry later). Both fail
  **before** payment — nothing was charged.

## Publish without a wallet (free, UNAUDITED)

For users without agentcash/x402: \`POST ${base}/api/submit\` — plain HTTP, no
payment, no signature. Same fields as register **minus \`priceUsd\`** (no
wallet means no payout target, so the listing is always free to install).
Trade-offs, which you must tell the user before submitting:

- **No security audit** — the listing carries a prominent UNAUDITED warning.
  Only the deterministic scanner runs; high-severity hits are rejected.
- **No owner** — authorship can't be claimed, the preview can't be updated,
  it can't be archived, and it can never be sold.
- Rate-limited to a few submissions per caller per day.

## Fund an audit on any listing

\`POST ${base}/api/audit\` with \`{"slug": "..."}\` — via x402/MPP, payable by
**anyone**, not just the publisher. **$0.15 for the first audit** of an
unaudited listing; **$0.50 to re-audit** one that already has a verdict
(10x the audit's actual cost, to deter verdict re-rolling — owners already
got an audit with registration). Runs the same LLM security
audit used at registration and stamps the verdict, summary, and capabilities
on the listing. An audit that **rejects delists the script**. The fee bought
the analysis and is not refunded regardless of verdict.

**Not sure which wallet you're signing with?** \`POST ${base}/api/whoami\`
(SIWX-signed, free) echoes the wallet your signature proves and its verified
X identity, if any. Useful before publishing: that wallet becomes the payout
target and authorship anchor.

**Optional identity**: listings show "anonymous" until the wallet connects an
X account — \`POST ${base}/api/identity/connect\` (SIWX-signed, free, no body)
returns an \`authorizeUrl\`. Give it to the user to open in a browser; signing
in with X stamps their @handle on all the wallet's listings. Nothing else to call.

## Update a preview

The publishing wallet can replace a preview without republishing or rerunning
the audit. Capture and sanitize the new output, then make a free SIWX-signed
\`POST ${base}/api/statuslines/{slug}/preview\` with \`{"previewAnsi":"..."}\`,
\`{"previewFrames":["...", ...]}\` (1 fps animation, 2–30 frames — frame 0
becomes the still), or both. This changes only the inert preview stored by
the site.

## Archive (delist) your listing

The publishing wallet can take its own listing down — and bring it back — at
any time. Free SIWX-signed \`POST ${base}/api/statuslines/{slug}/archive\` with
\`{"archived": true}\` to delist or \`{"archived": false}\` to relist. Archived
listings disappear from browsing, installs, and purchases, but the slug stays
reserved for the owner. Archiving is independent of moderation: it cannot
restore a listing delisted by an audit reject, community reports, or an admin.

## Feedback

\`POST ${base}/api/report\` (SIWX-signed, free): \`rating\` 0–5 to review, or
\`comment\` alone to flag a malicious/broken listing.

## Rules

1. Never install a script without user-visible review and approval.
2. Never edit \`~/.claude/settings.json\` without stating the exact change.
3. Never publish a preview containing real personal data — sanitize first.
`;
}
