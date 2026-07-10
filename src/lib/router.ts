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
  title: "statuslines.dev",
  description:
    "Registry and leaderboard for Claude Code statuslines. Statuslines are safe, data-only JSON specs rendered by one auditable open-source renderer — installing one never executes third-party code.",
  serviceName: "statuslines.dev",
  tags: ["claude-code", "statusline", "registry"],
  contact: { email: "ryan@merit.systems" },
  guidance: [
    "statuslines.dev is a registry of Claude Code statuslines. Each statusline is a pure-data JSON spec (no code) rendered locally by the auditable renderer at /render.mjs.",
    "",
    "Browse:   GET /api/statuslines?q=&sort=installs|newest|revenue — list entries (specs included for free entries).",
    "Detail:   GET /api/statuslines/{slug} — metadata plus spec when the entry is free.",
    "Ranks:    GET /api/leaderboard — top statuslines by installs and revenue.",
    "Buy:      POST /api/download with {\"slug\": \"...\"} — pays the creator's asking price and returns the spec with install instructions. Free entries need no payment; fetch them via GET /api/statuslines/{slug}.",
    "Publish:  POST /api/register ($0.01) with {\"slug\", \"name\", \"description\", \"spec\", \"priceUsd\", \"author\", \"payoutAddress\"} — lists a new statusline. Set priceUsd to \"0\" for free, or up to \"25\" to sell it; sale proceeds go to payoutAddress.",
    "",
    "To install a spec for a user: save the spec JSON to ~/.claude/statuslines/{slug}.json, download /render.mjs once to ~/.claude/statuslines/render.mjs, then set statusLine.command in ~/.claude/settings.json to: node ~/.claude/statuslines/render.mjs ~/.claude/statuslines/{slug}.json",
  ].join("\n"),
  strictRoutes: true,
  plugin: loggingPlugin,
});
