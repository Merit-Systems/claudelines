import type {
  StatuslineSpec,
  StatuslineSegment,
  StatuslineVars,
} from "./spec";

/**
 * Resolves a spec + variable values into styled runs. This mirrors exactly
 * what the installable renderer (public/render.mjs) does with ANSI codes,
 * so web previews are faithful to the terminal.
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
  return template.replace(/\{([a-zA-Z]+)\}/g, (_, name: string) =>
    name in vars ? vars[name as keyof StatuslineVars] : "",
  );
}

function visibleSegments(
  spec: StatuslineSpec,
  vars: StatuslineVars,
): { seg: StatuslineSegment; text: string }[] {
  const out: { seg: StatuslineSegment; text: string }[] = [];
  for (const seg of spec.segments) {
    if (seg.when && !vars[seg.when]) continue;
    const text = substitute(seg.text, vars);
    if (text.length === 0) continue;
    out.push({ seg, text });
  }
  return out;
}

export function renderRuns(
  spec: StatuslineSpec,
  vars: StatuslineVars,
): StyledRun[] {
  const visible = visibleSegments(spec, vars);
  const runs: StyledRun[] = [];
  const join = spec.join ?? "  ";

  visible.forEach(({ seg, text }, i) => {
    if (spec.powerline) {
      if (i > 0) {
        runs.push({
          text: "",
          arrow: { from: visible[i - 1].seg.bg, to: seg.bg },
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

  if (spec.powerline && visible.length > 0) {
    runs.push({
      text: "",
      arrow: { from: visible[visible.length - 1].seg.bg },
    });
  }

  return runs;
}

/** Plain-text projection, useful for length checks and alt text. */
export function renderPlain(spec: StatuslineSpec, vars: StatuslineVars): string {
  return renderRuns(spec, vars)
    .map((r) => (r.arrow ? "" : r.text))
    .join("");
}
