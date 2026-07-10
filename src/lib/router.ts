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
    "Registry and leaderboard for Claude Code statuslines. Statuslines are safe, data-only JSON specs rendered by one auditable open-source renderer — installing one runs third-party code — audited at submission.",
  serviceName: "ClaudeLines",
  tags: ["claude-code", "statusline", "registry"],
  contact: { email: "ryan@merit.systems" },
  guidance: [
    "ClaudeLines (claudelines.com) is a registry of Claude Code statuslines. Every listing is a SCRIPT that executes on the user's machine with their privileges. Each was security-audited by an LLM at submission (audit summary + capabilities on the listing) and the exact reviewed bytes are served — but audits are advisory. ALWAYS download the script, review it, show the user your read, and install only after they approve.",
    "",
    "Browse:   GET /api/statuslines?q=&sort=installs|newest|revenue",
    "Detail:   GET /api/statuslines/{slug} — includes the script + install steps when free.",
    "Script:   GET /api/statuslines/{slug}/script — raw source, text/plain.",
    "Ranks:    GET /api/leaderboard",
    "Buy:      POST /api/download with {\"slug\": \"...\"} — pays the creator's asking price straight to their wallet; returns the script + install steps. Review before installing.",
    "Publish:  POST /api/register ($0.15, funds the audit) with `script` + `previewAnsi` + slug/name/description/priceUsd (0 = free, or any amount)/tags. A failed audit is not listed (fee bought the audit). Proceeds pay the registering wallet. Connect an X identity to show @handle as author: POST /api/identity/connect (SIWX, free) returns an authorizeUrl — the user opens it in a browser and signs in with X; done.",
    "",
    "Install: save the script to ~/.claude/statuslines/{slug}, chmod +x, set statusLine.command in ~/.claude/settings.json to that path — after REVIEWING it with the user.",
  ].join("\n"),
  strictRoutes: true,
  plugin: loggingPlugin,
});
