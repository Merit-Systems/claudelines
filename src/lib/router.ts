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
    "Registry and leaderboard for Claude Code statuslines. Statuslines are safe, data-only JSON specs rendered by one auditable open-source renderer — installing one never executes third-party code.",
  serviceName: "ClaudeLines",
  tags: ["claude-code", "statusline", "registry"],
  contact: { email: "ryan@merit.systems" },
  guidance: [
    "ClaudeLines (claudelines.com) is a registry of Claude Code statuslines with two tiers:",
    "  - kind 'spec': pure-data JSON (no code) rendered locally by the auditable renderer at /render.mjs. Safe to install without review.",
    "  - kind 'script': an existing statusline uploaded as-is. It EXECUTES on the user's machine. Every script was security-audited by an LLM at registration (audit summary on the listing), but audits are advisory — ALWAYS show the script and your own review to the user before installing.",
    "",
    "Browse:   GET /api/statuslines?q=&sort=installs|newest|revenue",
    "Detail:   GET /api/statuslines/{slug} — metadata + payload and install instructions when free.",
    "Ranks:    GET /api/leaderboard",
    "Buy:      POST /api/download with {\"slug\": \"...\"} — pays the creator's asking price straight to their wallet; returns the payload with install instructions.",
    "Publish:  POST /api/register — pass `spec` ($0.01) for the data-only tier, or `script` + `previewAnsi` ($0.50, funds the security audit; rejected scripts are not listed and the fee is not refunded). Set priceUsd (\"0\" free, up to \"25\") to sell — proceeds pay the registering wallet. Verify an X identity via identity/claim + identity/verify to show @handle as author.",
    "",
    "Install a spec: save the JSON to ~/.claude/statuslines/{slug}.json, download /render.mjs once to ~/.claude/statuslines/render.mjs, set statusLine.command in ~/.claude/settings.json to: node ~/.claude/statuslines/render.mjs ~/.claude/statuslines/{slug}.json",
    "Install a script: REVIEW IT WITH THE USER FIRST, then save to ~/.claude/statuslines/{slug}, chmod +x, and set statusLine.command to that path.",
  ].join("\n"),
  strictRoutes: true,
  plugin: loggingPlugin,
});
