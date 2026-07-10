import type { StatuslineSpec } from "../statusline/spec";

export interface SeedStatusline {
  slug: string;
  name: string;
  description: string;
  author: string;
  priceUsd: string;
  tags: string[];
  featured: boolean;
  installs: number;
  spec: StatuslineSpec;
}

export const SEED_STATUSLINES: SeedStatusline[] = [
  {
    slug: "agentcash-mark",
    name: "AgentCash Mark",
    description:
      "Static homage to the AgentCash banner — cube, wordmark, fading slashes and session cost — as a zero-trust data spec. (The live-balance original is the script-tier agentcash-banner.)",
    author: "merit systems",
    priceUsd: "0",
    tags: ["brand", "green", "wordmark"],
    featured: false,
    installs: 0,
    spec: {
      version: 1,
      join: " ",
      segments: [
        { text: "⬢", fg: "#48e05b" },
        { text: "AGENT", fg: "#ffffff", bold: true },
        { text: "CASH", fg: "#48e05b", bold: true },
        { text: "////", fg: "#3fe15a" },
        { text: "////", fg: "#28663f" },
        { text: "///", fg: "#12451c" },
        { text: "{cost}", fg: "#60e870", bold: true },
        { text: "{dir} {gitBranch}", fg: "#4ea860", dim: true },
      ],
    },
  },
  {
    slug: "mission-control",
    name: "Mission Control",
    description:
      "Two lines of full instrumentation: model, directory and branch up top; live context bar, session cost, and rate-limit gauges below.",
    author: "statuslines.dev",
    priceUsd: "0",
    tags: ["multi-line", "context", "powerline"],
    featured: true,
    installs: 0,
    spec: {
      version: 1,
      powerline: true,
      segments: [
        { text: "{model}", fg: "#0c0a09", bg: "#fafaf9", bold: true },
        { text: "{dir}{gitDirty}", fg: "#e7e5e4", bg: "#44403c" },
        { text: " {gitBranch}", fg: "#a8a29e", bg: "#292524", when: "gitBranch" },
        { text: "{contextBar}", fg: "#4ade80", bg: "#0c0a09", newline: true },
        { text: "{contextPct} used", fg: "#86efac", bg: "#0c0a09", dim: true },
        { text: "{cost} · {duration}", fg: "#fbbf24", bg: "#0c0a09" },
        {
          text: "5h {limit5h} · 7d {limit7d}",
          fg: "#78716c",
          bg: "#0c0a09",
          when: "limit5h",
        },
      ],
    },
  },
  {
    slug: "merit-line",
    name: "Merit Line",
    description:
      "The house style, two lines: model, directory, branch and cost up top; a live context bar with rate limits below.",
    author: "statuslines.dev",
    priceUsd: "0",
    tags: ["powerline", "green", "context", "multi-line"],
    featured: true,
    installs: 0,
    spec: {
      version: 1,
      powerline: true,
      segments: [
        { text: "{model}", fg: "#052e16", bg: "#4ade80", bold: true },
        { text: "{dir}{gitDirty}", fg: "#e5e5e5", bg: "#262626" },
        { text: " {gitBranch}", fg: "#a3a3a3", bg: "#171717", when: "gitBranch" },
        { text: "{cost}", fg: "#4ade80", bg: "#0a0a0a", bold: true },
        {
          text: "{contextBar} {contextPct}",
          fg: "#86efac",
          bg: "#0a0a0a",
          newline: true,
          when: "contextPct",
        },
        { text: "5h {limit5h}", fg: "#525252", bg: "#0a0a0a", when: "limit5h" },
      ],
    },
  },
  {
    slug: "quiet-mono",
    name: "Quiet Mono",
    description:
      "Barely there. Dim monochrome text for people who think statuslines should whisper.",
    author: "statuslines.dev",
    priceUsd: "0",
    tags: ["minimal", "mono"],
    featured: true,
    installs: 0,
    spec: {
      version: 1,
      join: "  ·  ",
      segments: [
        { text: "{model}", fg: "#737373" },
        { text: "{dir}", fg: "#525252", dim: true },
        { text: "{gitBranch}", fg: "#525252", dim: true, when: "gitBranch" },
        { text: "{cost}", fg: "#737373" },
      ],
    },
  },
  {
    slug: "tokyo-drift",
    name: "Tokyo Drift",
    description:
      "Tokyo Night palette in powerline form — storm blues, neon accents, zero chill.",
    author: "statuslines.dev",
    priceUsd: "0",
    tags: ["powerline", "tokyo-night", "dark"],
    featured: true,
    installs: 0,
    spec: {
      version: 1,
      powerline: true,
      segments: [
        { text: "{model}", fg: "#1a1b26", bg: "#7aa2f7", bold: true },
        { text: "{dir}", fg: "#c0caf5", bg: "#3b4261" },
        { text: " {gitBranch}", fg: "#bb9af7", bg: "#24283b", when: "gitBranch" },
        { text: "+{linesAdded} -{linesRemoved}", fg: "#9ece6a", bg: "#1a1b26" },
      ],
    },
  },
  {
    slug: "cost-hawk",
    name: "Cost Hawk",
    description:
      "For the budget-anxious: cost front and center, duration and burn detail beside it.",
    author: "statuslines.dev",
    priceUsd: "0",
    tags: ["cost", "metrics"],
    featured: false,
    installs: 0,
    spec: {
      version: 1,
      join: "  ",
      segments: [
        { text: "{cost}", fg: "#facc15", bold: true },
        { text: "{duration}", fg: "#a16207" },
        { text: "{model}", fg: "#737373", dim: true },
        { text: "{dir}", fg: "#737373", dim: true },
      ],
    },
  },
  {
    slug: "catppuccin-mocha",
    name: "Catppuccin Mocha",
    description:
      "The beloved pastel dark theme, rendered as a soft powerline with mauve and peach.",
    author: "statuslines.dev",
    priceUsd: "0",
    tags: ["powerline", "catppuccin", "pastel"],
    featured: false,
    installs: 0,
    spec: {
      version: 1,
      powerline: true,
      segments: [
        { text: "{model}", fg: "#1e1e2e", bg: "#cba6f7", bold: true },
        { text: "{dir}", fg: "#cdd6f4", bg: "#313244" },
        { text: " {gitBranch}", fg: "#fab387", bg: "#1e1e2e", when: "gitBranch" },
        { text: "{cost}", fg: "#a6e3a1", bg: "#11111b" },
      ],
    },
  },
  {
    slug: "nord-passage",
    name: "Nord Passage",
    description: "Arctic blues and frost. Calm, cold, and legible at a glance.",
    author: "statuslines.dev",
    priceUsd: "0",
    tags: ["powerline", "nord", "blue"],
    featured: false,
    installs: 0,
    spec: {
      version: 1,
      powerline: true,
      segments: [
        { text: "{model}", fg: "#2e3440", bg: "#88c0d0", bold: true },
        { text: "{dir}", fg: "#eceff4", bg: "#4c566a" },
        { text: " {gitBranch}", fg: "#a3be8c", bg: "#3b4252", when: "gitBranch" },
        { text: "{time}", fg: "#81a1c1", bg: "#2e3440" },
      ],
    },
  },
  {
    slug: "matrix-rain",
    name: "Matrix Rain",
    description:
      "Phosphor green on black. Follow the white rabbit, or at least the session cost.",
    author: "statuslines.dev",
    priceUsd: "0.05",
    tags: ["green", "retro", "terminal"],
    featured: false,
    installs: 0,
    spec: {
      version: 1,
      join: " ",
      segments: [
        { text: "[{model}]", fg: "#00ff41", bold: true },
        { text: "{cwd}", fg: "#008f11" },
        { text: "{gitBranch}", fg: "#00ff41", dim: true, when: "gitBranch" },
        { text: "{cost}", fg: "#00ff41", bold: true },
      ],
    },
  },
  {
    slug: "ship-it",
    name: "Ship It",
    description:
      "Diff-focused: lines added and removed with branch context. For people who measure days in commits.",
    author: "statuslines.dev",
    priceUsd: "0",
    tags: ["metrics", "git"],
    featured: false,
    installs: 0,
    spec: {
      version: 1,
      join: "  ",
      segments: [
        { text: " {gitBranch}", fg: "#c084fc", bold: true, when: "gitBranch" },
        { text: "+{linesAdded}", fg: "#4ade80", bold: true },
        { text: "-{linesRemoved}", fg: "#f87171" },
        { text: "{dir}", fg: "#737373", dim: true },
        { text: "{duration}", fg: "#737373", dim: true },
      ],
    },
  },
  {
    slug: "dracula-midnight",
    name: "Dracula Midnight",
    description:
      "Purple, pink, and a bite of cyan on the classic Dracula background.",
    author: "statuslines.dev",
    priceUsd: "0.10",
    tags: ["powerline", "dracula", "purple"],
    featured: false,
    installs: 0,
    spec: {
      version: 1,
      powerline: true,
      segments: [
        { text: "{model}", fg: "#282a36", bg: "#bd93f9", bold: true },
        { text: "{dir}", fg: "#f8f8f2", bg: "#44475a" },
        { text: " {gitBranch}", fg: "#ff79c6", bg: "#282a36", when: "gitBranch" },
        { text: "{cost} · {duration}", fg: "#8be9fd", bg: "#191a21" },
      ],
    },
  },
  {
    slug: "sunset-boulevard",
    name: "Sunset Boulevard",
    description:
      "A warm gradient from amber to rose — golden hour for your terminal.",
    author: "statuslines.dev",
    priceUsd: "0.25",
    tags: ["powerline", "warm", "gradient"],
    featured: true,
    installs: 0,
    spec: {
      version: 1,
      powerline: true,
      segments: [
        { text: "{model}", fg: "#431407", bg: "#fbbf24", bold: true },
        { text: "{dir}", fg: "#451a03", bg: "#fb923c" },
        { text: " {gitBranch}", fg: "#4c0519", bg: "#fb7185", when: "gitBranch" },
        { text: "{cost}", fg: "#fda4af", bg: "#4c0519", bold: true },
      ],
    },
  },
];
