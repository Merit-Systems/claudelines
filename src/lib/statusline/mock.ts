import type { StatuslineVars } from "./spec";

/** Mock sessions used for previews on the site. */
export const MOCK_SESSIONS: { label: string; vars: StatuslineVars }[] = [
  {
    label: "mid-session",
    vars: {
      model: "Opus 4.8",
      dir: "acme-api",
      cwd: "~/workspace/acme-api",
      gitBranch: "feat/payments",
      cost: "$1.42",
      duration: "38m",
      linesAdded: "412",
      linesRemoved: "97",
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
      cost: "$0.03",
      duration: "2m",
      linesAdded: "12",
      linesRemoved: "0",
      version: "2.1.9",
      outputStyle: "default",
      time: "09:05",
    },
  },
  {
    label: "no git repo",
    vars: {
      model: "Haiku 4.5",
      cwd: "~/scratch",
      dir: "scratch",
      gitBranch: "",
      cost: "$0.87",
      duration: "1h 12m",
      linesAdded: "1,204",
      linesRemoved: "356",
      version: "2.1.9",
      outputStyle: "explanatory",
      time: "23:47",
    },
  },
];

export const DEFAULT_MOCK = MOCK_SESSIONS[0].vars;
