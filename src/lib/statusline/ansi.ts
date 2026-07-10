import type { StyledRun } from "./render";

/**
 * Parse a captured statusline sample (ANSI text) into styled runs for web
 * preview. Only SGR color/style codes are interpreted; OSC sequences are
 * stripped (keeping any visible text), and every other escape is discarded.
 * Output is plain data rendered as React text — nothing is executed.
 */

const BASE16: Record<number, string> = {
  30: "#0d0d0d", 31: "#e5484d", 32: "#46a758", 33: "#d4a72c",
  34: "#3e63dd", 35: "#8e4ec6", 36: "#12a594", 37: "#d4d4d4",
  90: "#737373", 91: "#ff6369", 92: "#63c174", 93: "#f0c000",
  94: "#849dff", 95: "#bf7af0", 96: "#0ac5b3", 97: "#ffffff",
};

function xterm256(n: number): string {
  if (n < 16) return BASE16[n < 8 ? n + 30 : n + 82] ?? "#d4d4d4";
  if (n < 232) {
    const v = n - 16;
    const scale = [0, 95, 135, 175, 215, 255];
    const r = scale[Math.floor(v / 36)];
    const g = scale[Math.floor((v % 36) / 6)];
    const b = scale[v % 6];
    return `#${[r, g, b].map((c) => c.toString(16).padStart(2, "0")).join("")}`;
  }
  const gray = 8 + (n - 232) * 10;
  return `#${gray.toString(16).padStart(2, "0").repeat(3)}`;
}

interface State {
  fg?: string;
  bg?: string;
  bold?: boolean;
  dim?: boolean;
  italic?: boolean;
}

function applySgr(state: State, params: number[]): State {
  const s = { ...state };
  for (let i = 0; i < params.length; i++) {
    const p = params[i];
    if (p === 0) return {};
    else if (p === 1) s.bold = true;
    else if (p === 2) s.dim = true;
    else if (p === 3) s.italic = true;
    else if (p === 22) { s.bold = false; s.dim = false; }
    else if (p === 23) s.italic = false;
    else if (p === 39) s.fg = undefined;
    else if (p === 49) s.bg = undefined;
    else if ((p >= 30 && p <= 37) || (p >= 90 && p <= 97)) s.fg = BASE16[p];
    else if ((p >= 40 && p <= 47) || (p >= 100 && p <= 107)) s.bg = BASE16[p - 10];
    else if (p === 38 || p === 48) {
      const target = p === 38 ? "fg" : "bg";
      if (params[i + 1] === 2 && params.length > i + 4) {
        const [r, g, b] = params.slice(i + 2, i + 5).map((v) => Math.min(255, Math.max(0, v)));
        s[target] = `#${[r, g, b].map((c) => c.toString(16).padStart(2, "0")).join("")}`;
        i += 4;
      } else if (params[i + 1] === 5 && params.length > i + 2) {
        s[target] = xterm256(params[i + 2]);
        i += 2;
      }
    }
    // underline (4) and others: ignored for preview purposes
  }
  return s;
}

/** Lines of styled runs from raw ANSI. Caps input to keep rendering cheap. */
export function parseAnsi(raw: string): StyledRun[][] {
  const input = raw.slice(0, 8192);
  const lines: StyledRun[][] = [];
  let state: State = {};

  for (const lineText of input.split("\n").slice(0, 4)) {
    const runs: StyledRun[] = [];
    // Strip OSC (ESC ] ... BEL or ESC \) keeping nothing, then walk SGR codes.
    const cleaned = lineText.replace(/\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)/g, "");
    const parts = cleaned.split(/(\x1b\[[0-9;]*m)/);
    for (const part of parts) {
      const m = part.match(/^\x1b\[([0-9;]*)m$/);
      if (m) {
        const params = m[1] === "" ? [0] : m[1].split(";").map(Number);
        state = applySgr(state, params);
      } else if (part) {
        // Drop any remaining escapes and control chars from visible text.
        const text = part
          .replace(/\x1b[^a-zA-Z]*[a-zA-Z]/g, "")
          .replace(/[\x00-\x08\x0b-\x1f\x7f]/g, "");
        if (text) runs.push({ text, ...state });
      }
    }
    if (runs.length) lines.push(runs);
  }
  return lines.length ? lines : [[{ text: "(no preview provided)", dim: true }]];
}
