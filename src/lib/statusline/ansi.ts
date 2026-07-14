/**
 * Turn a captured ANSI statusline into inert terminal cells. The renderer is
 * deliberately data-only: recognized control sequences affect styling and
 * tab stops but are never executed by the browser.
 *
 * ClaudeLines follows modern terminal conventions here: Unicode grapheme
 * clusters occupy one or two cells, tabs advance to an eight-column stop, and
 * SGR attributes persist across lines until reset.
 */

export type TerminalColor =
  | { kind: "palette"; value: number }
  | { kind: "rgb"; value: string };

export interface StyledRun {
  text: string;
  fg?: TerminalColor;
  bg?: TerminalColor;
  bold?: boolean;
  dim?: boolean;
  italic?: boolean;
  underline?: boolean;
  inverse?: boolean;
  invisible?: boolean;
  strikethrough?: boolean;
}

export interface TerminalGrapheme {
  text: string;
  cells: 1 | 2;
}

export interface TerminalPalette {
  foreground: string;
  background: string;
  colors: readonly string[];
}

/** The canonical ClaudeLines terminal palette. Browser previews and generated
 * social images both consume this object so named ANSI colors cannot drift. */
export const CANONICAL_DARK_TERMINAL_PALETTE = {
  background: "#171717",
  foreground: "#d4d4d4",
  colors: [
    "#0d0d0d", "#e5484d", "#46a758", "#d4a72c",
    "#3e63dd", "#8e4ec6", "#12a594", "#d4d4d4",
    "#737373", "#ff6369", "#63c174", "#f0c000",
    "#849dff", "#bf7af0", "#0ac5b3", "#ffffff",
  ],
} as const satisfies TerminalPalette;

export const MAX_PREVIEW_LENGTH = 65_536;
export const MAX_PREVIEW_FRAMES_LENGTH = 524_288;
const MAX_PREVIEW_ROWS = 64;
const TAB_WIDTH = 8;

// Intl.Segmenter follows the platform Unicode grapheme-break implementation,
// keeping emoji ZWJ sequences, flags, modifiers, and combining marks together.
const segmenter =
  typeof Intl !== "undefined" && "Segmenter" in Intl
    ? new Intl.Segmenter(undefined, { granularity: "grapheme" })
    : null;

const WIDE =
  /[\u1100-\u115f\u2329\u232a\u2e80-\ua4cf\uac00-\ud7a3\uf900-\ufaff\ufe10-\ufe19\ufe30-\ufe6f\uff00-\uff60\uffe0-\uffe6\u{1F000}-\u{1FAFF}\u{20000}-\u{3FFFD}]/u;

/** Ghostty's default `unicode` width behavior for the terminal glyphs we can
 * render on the web. Text-presentation symbols stay narrow; emoji-presentation
 * and ZWJ/variation-selector clusters occupy two cells. */
function graphemeCellWidth(grapheme: string): 1 | 2 {
  if (grapheme.includes("\ufe0e")) return 1; // explicit text presentation
  if (
    grapheme.includes("\ufe0f") ||
    grapheme.includes("\u200d") ||
    grapheme.includes("\u20e3") ||
    WIDE.test(grapheme)
  ) {
    return 2;
  }
  return 1;
}

export function terminalGraphemes(text: string): TerminalGrapheme[] {
  const graphemes = segmenter
    ? [...segmenter.segment(text)].map((part) => part.segment)
    : Array.from(text);

  return graphemes.map((grapheme) => ({
    text: grapheme,
    cells: graphemeCellWidth(grapheme),
  }));
}

export function terminalCellWidth(text: string): number {
  return terminalGraphemes(text).reduce((width, part) => width + part.cells, 0);
}

/** Resolve the fixed portion of the xterm-compatible 256-color palette. */
export function xterm256(index: number): string {
  const n = Math.min(255, Math.max(0, Math.trunc(index)));
  if (n < 16) {
    // Callers with a themed palette resolve 0-15 before reaching this helper.
    return [
      "#000000", "#cd0000", "#00cd00", "#cdcd00",
      "#0000ee", "#cd00cd", "#00cdcd", "#e5e5e5",
      "#7f7f7f", "#ff0000", "#00ff00", "#ffff00",
      "#5c5cff", "#ff00ff", "#00ffff", "#ffffff",
    ][n];
  }
  if (n < 232) {
    const value = n - 16;
    const scale = [0, 95, 135, 175, 215, 255];
    const r = scale[Math.floor(value / 36)];
    const g = scale[Math.floor((value % 36) / 6)];
    const b = scale[value % 6];
    return `#${[r, g, b]
      .map((channel) => channel.toString(16).padStart(2, "0"))
      .join("")}`;
  }
  const gray = 8 + (n - 232) * 10;
  return `#${gray.toString(16).padStart(2, "0").repeat(3)}`;
}

export function terminalColorHex(
  color: TerminalColor | undefined,
  palette: TerminalPalette,
  fallback: "foreground" | "background",
): string {
  if (!color) return palette[fallback];
  if (color.kind === "rgb") return color.value;
  return color.value < 16
    ? (palette.colors[color.value] ?? xterm256(color.value))
    : xterm256(color.value);
}

/** CSS resolver used by the browser renderer. Palette slots 0-15 remain theme
 * variables so switching the preview theme behaves like switching terminals. */
export function terminalColorCss(
  color: TerminalColor | undefined,
  fallback: "foreground" | "background",
): string {
  if (!color) return `var(--term-${fallback})`;
  if (color.kind === "rgb") return color.value;
  return color.value < 16
    ? `var(--term-color-${color.value})`
    : xterm256(color.value);
}

interface State {
  fg?: TerminalColor;
  bg?: TerminalColor;
  bold?: boolean;
  dim?: boolean;
  italic?: boolean;
  underline?: boolean;
  inverse?: boolean;
  invisible?: boolean;
  strikethrough?: boolean;
}

function rgb(r: number, g: number, b: number): TerminalColor {
  const value = [r, g, b]
    .map((channel) => Math.min(255, Math.max(0, channel || 0)))
    .map((channel) => channel.toString(16).padStart(2, "0"))
    .join("");
  return { kind: "rgb", value: `#${value}` };
}

function palette(value: number): TerminalColor {
  return { kind: "palette", value: Math.min(255, Math.max(0, value || 0)) };
}

function resetState(state: State): void {
  for (const key of Object.keys(state) as (keyof State)[]) delete state[key];
}

function applySgr(state: State, params: number[]): State {
  const next = { ...state };
  for (let i = 0; i < params.length; i++) {
    const p = Number.isFinite(params[i]) ? params[i] : 0;
    if (p === 0) resetState(next);
    else if (p === 1) next.bold = true;
    else if (p === 2) next.dim = true;
    else if (p === 3) next.italic = true;
    else if (p === 4) next.underline = true;
    else if (p === 7) next.inverse = true;
    else if (p === 8) next.invisible = true;
    else if (p === 9) next.strikethrough = true;
    else if (p === 22) { next.bold = false; next.dim = false; }
    else if (p === 23) next.italic = false;
    else if (p === 24) next.underline = false;
    else if (p === 27) next.inverse = false;
    else if (p === 28) next.invisible = false;
    else if (p === 29) next.strikethrough = false;
    else if (p === 39) next.fg = undefined;
    else if (p === 49) next.bg = undefined;
    else if (p >= 30 && p <= 37) next.fg = palette(p - 30);
    else if (p >= 90 && p <= 97) next.fg = palette(p - 90 + 8);
    else if (p >= 40 && p <= 47) next.bg = palette(p - 40);
    else if (p >= 100 && p <= 107) next.bg = palette(p - 100 + 8);
    else if (p === 38 || p === 48) {
      const target = p === 38 ? "fg" : "bg";
      if (params[i + 1] === 2 && params.length > i + 4) {
        next[target] = rgb(params[i + 2], params[i + 3], params[i + 4]);
        i += 4;
      } else if (params[i + 1] === 5 && params.length > i + 2) {
        next[target] = palette(params[i + 2]);
        i += 2;
      }
    }
  }
  return next;
}

/** Normalize colon-form extended colors (38:2::R:G:B) into the semicolon
 * representation consumed by applySgr. Other colon sub-parameters retain the
 * primary SGR value, e.g. underline styles still enable underline. */
function sgrParams(source: string): number[] {
  if (!source) return [0];
  const result: number[] = [];
  for (const group of source.split(";")) {
    if (!group.includes(":")) {
      result.push(Number(group));
      continue;
    }
    const parts = group.split(":");
    const command = Number(parts[0]);
    const mode = Number(parts[1]);
    if ((command === 38 || command === 48) && mode === 2) {
      const channels = parts.slice(-3).map(Number);
      result.push(command, 2, ...channels);
    } else if ((command === 38 || command === 48) && mode === 5) {
      result.push(command, 5, Number(parts.at(-1)));
    } else {
      result.push(command);
    }
  }
  return result;
}

function sameStyle(a: StyledRun, b: StyledRun): boolean {
  return (
    JSON.stringify(a.fg) === JSON.stringify(b.fg) &&
    JSON.stringify(a.bg) === JSON.stringify(b.bg) &&
    a.bold === b.bold &&
    a.dim === b.dim &&
    a.italic === b.italic &&
    a.underline === b.underline &&
    a.inverse === b.inverse &&
    a.invisible === b.invisible &&
    a.strikethrough === b.strikethrough
  );
}

function appendText(
  runs: StyledRun[],
  rawText: string,
  state: State,
  startColumn: number,
): number {
  let text = "";
  let column = startColumn;
  for (const grapheme of terminalGraphemes(rawText)) {
    if (grapheme.text === "\t") {
      const spaces = TAB_WIDTH - (column % TAB_WIDTH);
      text += " ".repeat(spaces);
      column += spaces;
    } else {
      text += grapheme.text;
      column += grapheme.cells;
    }
  }
  if (!text) return column;
  const run: StyledRun = { text, ...state };
  const previous = runs.at(-1);
  if (previous && sameStyle(previous, run)) previous.text += text;
  else runs.push(run);
  return column;
}

/** Lines of terminal-styled runs from captured ANSI. All real captured rows are
 * retained (up to a defensive 64-row ceiling); no content is executed. */
export function parseAnsi(raw: string): StyledRun[][] {
  const input = raw.slice(0, MAX_PREVIEW_LENGTH);
  const lines: StyledRun[][] = [];
  let state: State = {};

  for (const lineText of input.split("\n").slice(0, MAX_PREVIEW_ROWS)) {
    const runs: StyledRun[] = [];
    let column = 0;
    // OSC strings affect terminal metadata such as hyperlinks and titles, not
    // cell content. Strip BEL- and ST-terminated variants before parsing SGR.
    const cleaned = lineText.replace(/\x1b\][\s\S]*?(?:\x07|\x1b\\)/g, "");
    const parts = cleaned.split(/((?:\x1b\[|\x9b)[0-9;:]*m)/);
    for (const part of parts) {
      const match = part.match(/^(?:\x1b\[|\x9b)([0-9;:]*)m$/);
      if (match) {
        state = applySgr(state, sgrParams(match[1]));
      } else if (part) {
        // Remaining cursor/control sequences are never surfaced as text. CR
        // is redundant after splitting captured output into display rows.
        const text = part
          .replace(/(?:\x1b\[|\x9b)[0-?]*[ -/]*[@-~]/g, "")
          .replace(/\x1b[ -/]*[@-~]/g, "")
          .replace(/[\x00-\x08\x0b-\x1f\x7f]/g, "");
        column = appendText(runs, text, state, column);
      }
    }

    // COLUMNS padding is not visible unless a background style paints it.
    while (runs.length) {
      const last = runs[runs.length - 1];
      if (last.bg || last.inverse || !/\s$/.test(last.text)) break;
      last.text = last.text.replace(/\s+$/, "");
      if (last.text) break;
      runs.pop();
    }
    lines.push(runs);
  }

  while (lines.length && lines[lines.length - 1].length === 0) lines.pop();
  return lines.length ? lines : [[{ text: "(no preview provided)", dim: true }]];
}
