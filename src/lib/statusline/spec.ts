import { z } from "zod";

/**
 * Statuslines on this registry are pure data — never code.
 *
 * A spec is a JSON document describing styled segments with {variable}
 * placeholders. One open-source, auditable renderer (public/render.mjs,
 * installed once) interprets specs locally. Installing a statusline from the
 * registry downloads a JSON file; nothing from the registry is ever executed.
 */

/**
 * Variables the renderer resolves from Claude Code's statusline stdin JSON
 * (https://code.claude.com/docs/en/statusline), plus git state it derives
 * itself via hardcoded subprocesses.
 */
export const STATUSLINE_VARIABLES = {
  model: "Model display name (e.g. “Opus 4.8”)",
  dir: "Basename of the current workspace directory",
  cwd: "Current workspace directory, ~-abbreviated",
  gitBranch: "Current git branch, empty outside a repo",
  gitDirty: "“*” when the worktree has uncommitted changes",
  cost: "Session cost in USD (e.g. “$1.42”)",
  duration: "Wall-clock session duration (e.g. “38m”)",
  apiDuration: "Time spent waiting on the API (e.g. “12m”)",
  linesAdded: "Lines added this session",
  linesRemoved: "Lines removed this session",
  contextPct: "Context window used, e.g. “37%”",
  contextLeft: "Context window remaining, e.g. “63%”",
  contextBar: "10-cell context usage bar: ▓▓▓▓░░░░░░",
  limit5h: "5-hour rate limit used, e.g. “24%” (subscribers)",
  limit7d: "7-day rate limit used, e.g. “41%” (subscribers)",
  version: "Claude Code version",
  outputStyle: "Active output style name",
  time: "Local time, HH:MM",
} as const;

export type StatuslineVariable = keyof typeof STATUSLINE_VARIABLES;

export const VARIABLE_NAMES = Object.keys(
  STATUSLINE_VARIABLES,
) as StatuslineVariable[];

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

/**
 * Printable text only: no control characters, so a spec can never smuggle
 * ANSI escapes, OSC sequences, or terminal exploits past the renderer.
 */
const CONTROL_CHARS = /[\u0000-\u001f\u007f-\u009f]/;

const templateString = (maxLength: number) =>
  z
    .string()
    .max(maxLength)
    .refine((s) => !CONTROL_CHARS.test(s), {
      message: "Control characters are not allowed",
    });

const variableName = z.enum(
  VARIABLE_NAMES as [StatuslineVariable, ...StatuslineVariable[]],
);

export const segmentSchema = z.object({
  /** Template text; `{var}` placeholders resolve from the variable whitelist. */
  text: templateString(120).refine(
    (s) => {
      const placeholders = s.match(/\{([^}]*)\}/g) ?? [];
      return placeholders.every((p) =>
        (VARIABLE_NAMES as string[]).includes(p.slice(1, -1)),
      );
    },
    { message: "Unknown {variable} placeholder" },
  ),
  /** Foreground color, #rrggbb. */
  fg: z.string().regex(HEX_COLOR).optional(),
  /** Background color, #rrggbb. */
  bg: z.string().regex(HEX_COLOR).optional(),
  bold: z.boolean().optional(),
  dim: z.boolean().optional(),
  italic: z.boolean().optional(),
  /** Only render when this variable resolves to a non-empty value. */
  when: variableName.optional(),
  /** Start a new statusline row before this segment (Claude Code supports multi-line). */
  newline: z.boolean().optional(),
});

export const statuslineSpecSchema = z.object({
  version: z.literal(1),
  /**
   * powerline: segments render as bg-colored blocks joined with  arrows.
   * Otherwise segments are joined with `join` (default two spaces).
   */
  powerline: z.boolean().optional(),
  join: templateString(8).optional(),
  segments: z.array(segmentSchema).min(1).max(16),
});

export type StatuslineSegment = z.infer<typeof segmentSchema>;
export type StatuslineSpec = z.infer<typeof statuslineSpecSchema>;

/** Values a renderer resolves per repaint; empty string means "absent". */
export type StatuslineVars = Record<StatuslineVariable, string>;
