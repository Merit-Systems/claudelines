import type { StatuslineVars } from "./spec";

function bar(pct: number): string {
  const filled = Math.round(pct / 10);
  return "▓".repeat(filled) + "░".repeat(10 - filled);
}

/** Mock sessions used for previews on the site. */
export const MOCK_SESSIONS: { label: string; vars: StatuslineVars }[] = [
  {
    label: "mid-session",
    vars: {
      model: "Opus 4.8",
      dir: "acme-api",
      cwd: "~/workspace/acme-api",
      gitBranch: "feat/payments",
      gitDirty: "*",
      cost: "$1.42",
      duration: "38m",
      apiDuration: "12m",
      linesAdded: "412",
      linesRemoved: "97",
      contextPct: "37%",
      contextLeft: "63%",
      contextBar: bar(37),
      limit5h: "24%",
      limit7d: "41%",
      version: "2.1.9",
      outputStyle: "default",
      time: "14:32",
    },
  },
  {
    label: "fresh session",
    vars: {
      model: "Fable 5",
      cwd: "~/projects/statuslines",
      dir: "statuslines",
      gitBranch: "main",
      gitDirty: "",
      cost: "$0.03",
      duration: "2m",
      apiDuration: "40s",
      linesAdded: "12",
      linesRemoved: "0",
      contextPct: "4%",
      contextLeft: "96%",
      contextBar: bar(4),
      limit5h: "6%",
      limit7d: "38%",
      version: "2.1.9",
      outputStyle: "default",
      time: "09:05",
    },
  },
  {
    label: "long session, no git",
    vars: {
      model: "Haiku 4.5",
      cwd: "~/scratch",
      dir: "scratch",
      gitBranch: "",
      gitDirty: "",
      cost: "$0.87",
      duration: "1h 12m",
      apiDuration: "31m",
      linesAdded: "1204",
      linesRemoved: "356",
      contextPct: "82%",
      contextLeft: "18%",
      contextBar: bar(82),
      limit5h: "68%",
      limit7d: "74%",
      version: "2.1.9",
      outputStyle: "explanatory",
      time: "23:47",
    },
  },
];

export const DEFAULT_MOCK = MOCK_SESSIONS[0].vars;
