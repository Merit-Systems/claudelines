import { createRouterFromEnv, type RouterPlugin } from "@agentcash/router";

const loggingPlugin: RouterPlugin = {
  onAlert(_ctx, alert) {
    (alert.level === "error" ? console.error : console.warn)(
      `[router:${alert.route}] ${alert.message}`,
      alert.meta ?? "",
    );
  },
  onError(_ctx, error) {
    console.error(`[router] ${error.status} ${error.message}`);
  },
};

export const router = createRouterFromEnv({
  title: "ClaudeLines",
  description:
    "Registry and leaderboard for Claude Code statusline scripts. Installing one runs third-party code on the user's machine. Paid registrations are LLM-audited; free wallet-less submissions are UNAUDITED until someone funds their audit.",
  serviceName: "ClaudeLines",
  tags: ["claude-code", "statusline", "registry"],
  contact: { email: "ryan@merit.systems" },
  guidance: [
    "ClaudeLines (claudelines.com) is a registry of Claude Code statuslines. Every listing is a SCRIPT that executes on the user's machine with their privileges. Paid registrations were security-audited by an LLM at submission (audit summary + capabilities on the listing; the exact reviewed bytes are served); wallet-less submissions are UNAUDITED (audit field absent) — treat those as untrusted code. Audits are advisory either way. ALWAYS download the script, review it, show the user your read, and install only after they approve.",
    "",
    "Browse:   GET /api/statuslines?q=&sort=installs|newest|revenue",
    "Detail:   GET /api/statuslines/{slug} — includes the script + install steps when free.",
    "Script:   GET /api/statuslines/{slug}/script — raw source, text/plain.",
    "Preview:  POST /api/statuslines/{slug}/preview with {\"previewAnsi\": \"...\"} (SIWX, free) to replace your listing's captured preview.",
    "Ranks:    GET /api/leaderboard",
    "Buy:      POST /api/download with {\"slug\": \"...\"} — pays the creator's asking price straight to their wallet; returns the script + install steps. Review before installing.",
    "Publish:  POST /api/register ($0.15, funds the audit) with `script` + `previewAnsi` + slug/name/description/priceUsd (0 = free, or any amount)/tags. A failed audit is not listed (fee bought the audit). Proceeds pay the registering wallet. Connect an X identity to show @handle as author: POST /api/identity/connect (SIWX, free) returns an authorizeUrl — the user opens it in a browser and signs in with X; done.",
    "Free publish: POST /api/submit — no wallet, no payment, same fields minus priceUsd. The listing is UNAUDITED, has no owner (no claiming, no preview updates, never sellable — always free), and carries a prominent warning. High-severity scanner hits are rejected; rate-limited per caller.",
    "Audit:    POST /api/audit with {\"slug\": \"...\"} — ANYONE can fund the LLM audit of any listing: $0.15 for the first audit of an unaudited listing, $0.50 to re-audit one that already has a verdict (deters verdict re-rolling). Verdict/summary/capabilities are stamped on the listing; a rejecting audit delists the script.",
    "",
    "Install: save the script to ~/.claude/statuslines/{slug}, chmod +x, set statusLine.command in ~/.claude/settings.json to that path — after REVIEWING it with the user. A listing with no audit field is UNAUDITED: say so plainly and review it as untrusted code.",
  ].join("\n"),
  strictRoutes: true,
  plugin: loggingPlugin,
});
