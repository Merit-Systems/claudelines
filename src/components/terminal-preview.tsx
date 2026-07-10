import { renderLines, type StyledRun } from "@/lib/statusline/render";
import { parseAnsi } from "@/lib/statusline/ansi";
import type { StatuslineSpec, StatuslineVars } from "@/lib/statusline/spec";
import { DEFAULT_MOCK } from "@/lib/statusline/mock";
import { cn } from "@/lib/utils";

/**
 * Terminal-emulator preview. Always dark (terminals are dark), regardless of
 * site theme. Powerline arrows are CSS triangles so no patched font is needed.
 * Scroll is possible but scrollbars are hidden — like a real terminal.
 */

/** Terminal palettes applied as CSS custom properties, so a client-side
 * toggle can re-theme server-rendered banners without re-rendering. */
export const TERM_THEMES = {
  dark: {
    "--term-bg": "#0d0d0d",
    "--term-fg": "#d4d4d4",
    "--term-muted": "#525252",
    "--term-border": "#2e2e2e",
    "--term-dim": "#3f3f3f",
    "--term-cursor": "#a3a3a3",
  },
  light: {
    "--term-bg": "#ffffff",
    "--term-fg": "#404040",
    "--term-muted": "#a3a3a3",
    "--term-border": "#d4d4d4",
    "--term-dim": "#c8c8c8",
    "--term-cursor": "#525252",
  },
} as const;

export type TermTheme = keyof typeof TERM_THEMES;

function Run({ run }: { run: StyledRun }) {
  if (run.arrow) {
    return (
      <span
        aria-hidden
        className="inline-block h-[1.9em] w-[0.6em] shrink-0"
        style={{ background: run.arrow.to ?? "transparent" }}
      >
        <span
          className="block h-full w-full"
          style={{
            background: run.arrow.from ?? "var(--term-bg)",
            clipPath: "polygon(0 0, 100% 50%, 0 100%)",
          }}
        />
      </span>
    );
  }
  return (
    <span
      className="inline-flex h-[1.9em] shrink-0 items-center"
      style={{
        color: run.fg ?? "var(--term-fg)",
        background: run.bg ?? "transparent",
        fontWeight: run.bold ? 700 : 400,
        opacity: run.dim ? 0.65 : 1,
        fontStyle: run.italic ? "italic" : "normal",
      }}
    >
      {/* nested span: flex containers drop whitespace-only text nodes */}
      <span className="whitespace-pre">{run.text}</span>
    </span>
  );
}

function RunsView({
  lines,
  className,
}: {
  lines: StyledRun[][];
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col", className)}>
      {lines.map((runs, li) => (
        <div
          key={li}
          className="no-scrollbar flex items-center overflow-x-auto font-mono text-[13px]"
        >
          {runs.map((run, i) => (
            <Run key={i} run={run} />
          ))}
        </div>
      ))}
    </div>
  );
}

/** Bare statusline rows (multi-line aware) rendered live from a spec. */
export function StatuslineRow({
  spec,
  vars = DEFAULT_MOCK,
  className,
}: {
  spec: StatuslineSpec;
  vars?: StatuslineVars;
  className?: string;
}) {
  return <RunsView lines={renderLines(spec, vars)} className={className} />;
}

/** Captured-sample preview for script listings (SGR colors only; inert). */
export function AnsiRow({
  ansi,
  className,
}: {
  ansi: string;
  className?: string;
}) {
  return <RunsView lines={parseAnsi(ansi)} className={className} />;
}

/** Renders whichever preview a listing supports. */
export function ListingPreview({
  spec,
  previewAnsi,
  vars,
  className,
}: {
  spec?: StatuslineSpec | null;
  previewAnsi?: string | null;
  vars?: StatuslineVars;
  className?: string;
}) {
  if (spec) return <StatuslineRow spec={spec} vars={vars} className={className} />;
  if (previewAnsi) return <AnsiRow ansi={previewAnsi} className={className} />;
  return (
    <div className={cn("font-mono text-[13px] opacity-50", className)}>
      (no preview)
    </div>
  );
}

/**
 * Claude Code chrome: dim transcript line, the bordered `>` input box, the
 * statusline row exactly where CC renders it, and the footer hint row.
 * Pure markup — usable from both server and client components.
 */
export function CcFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2 px-4 pt-3 pb-3 font-mono text-[13px]">
      <div style={{ color: "var(--term-muted)" }}>
        <span style={{ color: "#4ade80" }}>●</span> Refactored the auth
        middleware and updated 3 tests.
      </div>
      <div
        className="flex items-center gap-2 rounded-[6px] border px-3 py-2"
        style={{ borderColor: "var(--term-border)" }}
      >
        <span style={{ color: "var(--term-muted)" }}>&gt;</span>
        <span
          className="inline-block h-[1.1em] w-[0.55em]"
          style={{ background: "var(--term-cursor)" }}
        />
      </div>
      {children}
      <div className="flex gap-4 text-[11px]" style={{ color: "var(--term-dim)" }}>
        <span>? for shortcuts</span>
        <span>⏵⏵ accept edits on</span>
      </div>
    </div>
  );
}

/**
 * Full emulator frame mimicking Claude Code's actual layout: transcript,
 * input box, then the statusline row beneath it — where it really renders.
 */
export function TerminalPreview({
  spec,
  previewAnsi,
  vars = DEFAULT_MOCK,
  className,
}: {
  spec?: StatuslineSpec | null;
  previewAnsi?: string | null;
  vars?: StatuslineVars;
  className?: string;
}) {
  return (
    <div
      className={cn("overflow-hidden border", className)}
      style={{
        ...(TERM_THEMES.dark as React.CSSProperties),
        background: "var(--term-bg)",
        borderColor: "var(--term-border)",
      }}
    >
      <CcFrame>
        <ListingPreview spec={spec} previewAnsi={previewAnsi} vars={vars} />
      </CcFrame>
    </div>
  );
}
