import type {
  StatuslineSpec,
  StatuslineSegment,
  StatuslineVars,
} from "./spec";

/**
 * Resolves a spec + variable values into styled runs, grouped into lines
 * (Claude Code supports multi-line statuslines via segment.newline). This
 * mirrors exactly what the installable renderer (public/render.mjs) does with
 * ANSI codes, so web previews are faithful to the terminal.
 */

export interface StyledRun {
  text: string;
  fg?: string;
  bg?: string;
  bold?: boolean;
  dim?: boolean;
  italic?: boolean;
  /** Marks a powerline arrow between segments. */
  arrow?: { from?: string; to?: string };
}

function substitute(template: string, vars: StatuslineVars): string {
  return template.replace(/\{([a-zA-Z0-9]+)\}/g, (_, name: string) =>
    name in vars ? vars[name as keyof StatuslineVars] : "",
  );
}

function visibleLines(
  spec: StatuslineSpec,
  vars: StatuslineVars,
): { seg: StatuslineSegment; text: string }[][] {
  const lines: { seg: StatuslineSegment; text: string }[][] = [[]];
  for (const seg of spec.segments) {
    if (seg.newline && lines[lines.length - 1].length > 0) lines.push([]);
    if (seg.when && !vars[seg.when]) continue;
    const text = substitute(seg.text, vars);
    if (text.length === 0) continue;
    lines[lines.length - 1].push({ seg, text });
  }
  return lines.filter((l) => l.length > 0);
}

function renderLine(
  line: { seg: StatuslineSegment; text: string }[],
  spec: StatuslineSpec,
): StyledRun[] {
  const runs: StyledRun[] = [];
  const join = spec.join ?? "  ";

  line.forEach(({ seg, text }, i) => {
    if (spec.powerline) {
      if (i > 0) {
        runs.push({
          text: "",
          arrow: { from: line[i - 1].seg.bg, to: seg.bg },
        });
      }
      runs.push({
        text: ` ${text} `,
        fg: seg.fg,
        bg: seg.bg,
        bold: seg.bold,
        dim: seg.dim,
        italic: seg.italic,
      });
    } else {
      if (i > 0 && join) runs.push({ text: join });
      runs.push({
        text,
        fg: seg.fg,
        bg: seg.bg,
        bold: seg.bold,
        dim: seg.dim,
        italic: seg.italic,
      });
    }
  });

  if (spec.powerline && line.length > 0) {
    runs.push({ text: "", arrow: { from: line[line.length - 1].seg.bg } });
  }
  return runs;
}

/** Lines of styled runs — one entry per visual statusline row. */
export function renderLines(
  spec: StatuslineSpec,
  vars: StatuslineVars,
): StyledRun[][] {
  return visibleLines(spec, vars).map((line) => renderLine(line, spec));
}

/** Plain-text projection, useful for length checks and alt text. */
export function renderPlain(
  spec: StatuslineSpec,
  vars: StatuslineVars,
): string {
  return renderLines(spec, vars)
    .map((line) => line.map((r) => (r.arrow ? "" : r.text)).join(""))
    .join("\n");
}
