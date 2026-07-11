"use client";

import { useEffect, useRef, useState } from "react";

import { parseAnsi, type StyledRun } from "@/lib/statusline/ansi";
import { ClaudeCodeMark } from "@/components/claude-code-mark";
import { cn } from "@/lib/utils";

/**
 * Terminal-emulator preview. Renders a captured ANSI sample (the previewAnsi
 * every listing ships) as inert styled text — nothing executes. Listings that
 * ship previewFrames play them client-side at 1 fps (the statusline's own
 * refresh cadence): a flipbook of parsed text, still nothing executing.
 */

const DEFAULT_FG = "var(--term-fg)";

/** Terminal palettes as CSS custom properties, toggled client-side. */
export const TERM_THEMES = {
  dark: {
    "--term-bg": "#1a1a1a",
    "--term-fg": "#d4d4d4",
    "--term-muted": "#525252",
    "--term-border": "#333333",
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

// Grapheme segmentation so combining marks stay glued to their base char.
const segmenter =
  typeof Intl !== "undefined" && "Segmenter" in Intl
    ? new Intl.Segmenter(undefined, { granularity: "grapheme" })
    : null;

function graphemes(text: string): string[] {
  if (segmenter) return [...segmenter.segment(text)].map((s) => s.segment);
  return Array.from(text);
}

// Terminal double-width cells: East Asian Wide/Fullwidth ranges and emoji.
const WIDE =
  /[ᄀ-ᅟ⺀-꓏가-힣豈-﫿︰-﹏＀-｠￠-￦\u{1F300}-\u{1FAFF}\u{20000}-\u{2FFFD}]/u;

function Run({ run }: { run: StyledRun }) {
  // Whitespace positions the art — give it exactly its captured width.
  if (/^\s+$/.test(run.text)) {
    return (
      <span
        className="shrink-0"
        style={{ width: `${run.text.length}ch` }}
        aria-hidden
      />
    );
  }
  return (
    <span
      className="inline-flex h-full shrink-0 items-center"
      style={{
        color: run.fg ?? DEFAULT_FG,
        background: run.bg ?? "transparent",
        fontWeight: run.bold ? 700 : 400,
        opacity: run.dim ? 0.65 : 1,
        fontStyle: run.italic ? "italic" : "normal",
      }}
    >
      {/* One fixed 1ch (2ch for wide chars) cell per grapheme: font-fallback
          glyphs with off-grid advance widths can't shift the columns after
          them, so captured frames stay aligned across both lines. */}
      {graphemes(run.text).map((g, i) => (
        <span
          key={i}
          className="inline-block shrink-0 overflow-visible whitespace-pre"
          style={{ width: WIDE.test(g) ? "2ch" : "1ch" }}
        >
          {g}
        </span>
      ))}
    </span>
  );
}

/** Bare statusline preview from a captured ANSI sample; animates at 1 fps
 *  when the listing ships previewFrames (unless the viewer prefers reduced
 *  motion, which pins the first frame). */
export function ListingPreview({
  previewAnsi,
  previewFrames,
  className,
}: {
  previewAnsi?: string | null;
  previewFrames?: string[] | null;
  className?: string;
}) {
  const frames =
    previewFrames && previewFrames.length > 1 ? previewFrames : null;
  const [frame, setFrame] = useState(0);
  useEffect(() => {
    if (!frames) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = setInterval(
      () => setFrame((i) => (i + 1) % frames.length),
      1000,
    );
    return () => clearInterval(id);
  }, [frames]);

  // Small screens: captures are often wider than the viewport. All lines
  // share ONE scroll container (they must pan together — two-line art
  // desyncs with per-line scrolling), and moderately-wide captures are
  // scaled down to fit. Below MIN_SCALE text turns unreadable, so we pin
  // the scale there and let the container scroll the rest.
  const MIN_SCALE = 0.55;
  const containerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const maxNaturalW = useRef(0);
  const [fit, setFit] = useState({ scale: 1, height: 0 });

  useEffect(() => {
    maxNaturalW.current = 0; // new capture → forget the old widest frame
  }, [previewAnsi, previewFrames]);

  useEffect(() => {
    const measure = () => {
      const c = containerRef.current;
      const inner = innerRef.current;
      if (!c || !inner) return;
      // scrollWidth is pre-transform layout width. Track the widest frame so
      // the scale doesn't jitter as animation frames change width.
      maxNaturalW.current = Math.max(maxNaturalW.current, inner.scrollWidth);
      const natural = maxNaturalW.current;
      const scale =
        natural > c.clientWidth
          ? Math.max(c.clientWidth / natural, MIN_SCALE)
          : 1;
      const height = inner.offsetHeight * scale;
      setFit((prev) =>
        prev.scale === scale && prev.height === height
          ? prev
          : { scale, height },
      );
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  });

  const source = frames ? frames[frame % frames.length] : previewAnsi;
  if (!source) {
    return (
      <div className={cn("font-mono text-[13px] opacity-50", className)}>
        (no preview)
      </div>
    );
  }
  const lines = parseAnsi(source);
  // Multi-line art must stack flush — box-drawing characters are designed to
  // touch across rows. Single lines keep the taller row for presence.
  const rowHeight = lines.length > 1 ? "h-[1em] leading-none" : "h-[1.9em]";
  return (
    <div
      ref={containerRef}
      className={cn("no-scrollbar overflow-x-auto", className)}
    >
      <div style={fit.height ? { height: fit.height } : undefined}>
        <div
          ref={innerRef}
          className="flex w-max origin-top-left flex-col"
          style={fit.scale < 1 ? { transform: `scale(${fit.scale})` } : undefined}
        >
          {lines.map((runs, li) => (
            <div
              key={li}
              className={cn(
                "flex w-max items-center font-mono text-[13px]",
                rowHeight,
              )}
            >
              {runs.map((run, i) => (
                <Run key={i} run={run} />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Claude Code chrome around a preview. Pure markup. */
export function CcFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2 px-4 pt-3 pb-3 font-mono text-[13px]">
      <div
        className="flex items-center gap-1.5"
        style={{ color: "var(--term-muted)" }}
      >
        <ClaudeCodeMark /> Claude Code
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
      <div
        className="flex gap-4 text-[11px]"
        style={{ color: "var(--term-dim)" }}
      >
        <span>? for shortcuts</span>
        <span>⏵⏵ accept edits on</span>
      </div>
    </div>
  );
}

/** Full emulator frame with the statusline where Claude Code renders it. */
export function TerminalPreview({
  previewAnsi,
  previewFrames,
  className,
}: {
  previewAnsi?: string | null;
  previewFrames?: string[] | null;
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
        <ListingPreview previewAnsi={previewAnsi} previewFrames={previewFrames} />
      </CcFrame>
    </div>
  );
}
