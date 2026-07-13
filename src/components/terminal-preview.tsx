"use client";

import { useEffect, useRef, useState } from "react";

import {
  CANONICAL_DARK_TERMINAL_PALETTE,
  parseAnsi,
  terminalCellWidth,
  terminalColorCss,
  terminalGraphemes,
  type StyledRun,
} from "@/lib/statusline/ansi";
import { ClaudeCodeMark } from "@/components/claude-code-mark";
import { cn } from "@/lib/utils";

/**
 * Terminal-emulator preview. Renders a captured ANSI sample (the previewAnsi
 * every listing ships) as inert styled text — nothing executes. Listings that
 * ship previewFrames play them client-side at 1 fps (the statusline's own
 * refresh cadence): a flipbook of parsed text, still nothing executing.
 */

const LIGHT_ANSI = [
  "#171717", "#c01c28", "#26a269", "#a2734c",
  "#1a5fb4", "#813d9c", "#0e7490", "#deddda",
  "#5e5c64", "#e01b24", "#33d17a", "#c88800",
  "#3584e4", "#c061cb", "#168a9d", "#ffffff",
] as const;

function ansiVariables(colors: readonly string[]) {
  return Object.fromEntries(
    colors.map((color, index) => [`--term-color-${index}`, color]),
  );
}

/** Terminal palettes as CSS custom properties, toggled client-side. */
export const TERM_THEMES = {
  dark: {
    "--term-bg": CANONICAL_DARK_TERMINAL_PALETTE.background,
    "--term-fg": CANONICAL_DARK_TERMINAL_PALETTE.foreground,
    "--term-muted": "#525252",
    "--term-border": "#333333",
    "--term-dim": "#3f3f3f",
    "--term-cursor": "#a3a3a3",
    ...ansiVariables(CANONICAL_DARK_TERMINAL_PALETTE.colors),
  },
  light: {
    "--term-bg": "#ffffff",
    "--term-fg": "#404040",
    "--term-muted": "#a3a3a3",
    "--term-border": "#d4d4d4",
    "--term-dim": "#c8c8c8",
    "--term-cursor": "#525252",
    ...ansiVariables(LIGHT_ANSI),
  },
} as const;

export type TermTheme = keyof typeof TERM_THEMES;

const VECTOR_GLYPHS = new Set(["⬢", "◆", "⟐", "↳", "█", "▀", "▄"]);

function TerminalVectorGlyph({ glyph }: { glyph: string }) {
  const common = {
    viewBox: "0 0 100 100",
    className: "inline-block h-[0.86em] w-[0.72em]",
    role: "img",
    "aria-label": glyph,
  } as const;
  if (glyph === "⬢") {
    return (
      <svg {...common}>
        <path d="M25 6h50l22 44-22 44H25L3 50 25 6Z" fill="currentColor" />
      </svg>
    );
  }
  if (glyph === "◆") {
    return (
      <svg {...common}>
        <path d="M50 3 97 50 50 97 3 50 50 3Z" fill="currentColor" />
      </svg>
    );
  }
  if (glyph === "⟐") {
    return (
      <svg {...common}>
        <path
          d="M50 8 92 50 50 92 8 50 50 8Z"
          fill="none"
          stroke="currentColor"
          strokeWidth="9"
        />
        <circle cx="50" cy="50" r="8" fill="currentColor" />
      </svg>
    );
  }
  if (glyph === "↳") {
    return (
      <svg {...common}>
        <path
          d="M14 8v43c0 17 9 26 27 26h43M67 60l17 17-17 17"
          fill="none"
          stroke="currentColor"
          strokeWidth="10"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  if (glyph === "█") {
    return (
      <svg {...common} className="inline-block h-full w-full">
        <path d="M0 0h100v100H0Z" fill="currentColor" />
      </svg>
    );
  }
  if (glyph === "▀" || glyph === "▄") {
    return (
      <svg {...common} className="inline-block h-full w-full">
        <path
          d={glyph === "▀" ? "M0 0h100v50H0Z" : "M0 50h100v50H0Z"}
          fill="currentColor"
        />
      </svg>
    );
  }
  return null;
}

function Run({ run }: { run: StyledRun }) {
  const foreground = run.inverse
    ? run.bg
      ? terminalColorCss(run.bg, "background")
      : "var(--term-bg)"
    : terminalColorCss(run.fg, "foreground");
  const background = run.inverse
    ? run.fg
      ? terminalColorCss(run.fg, "foreground")
      : "var(--term-fg)"
    : run.bg
      ? terminalColorCss(run.bg, "background")
      : "transparent";
  const textDecoration = [
    run.underline ? "underline" : "",
    run.strikethrough ? "line-through" : "",
  ].filter(Boolean).join(" ") || "none";

  // Whitespace positions the art — give it exactly its captured width.
  if (/^\s+$/.test(run.text)) {
    return (
      <span
        className="h-full shrink-0"
        style={{
          width: `${terminalCellWidth(run.text)}ch`,
          background,
        }}
        aria-hidden
      />
    );
  }
  return (
    <span
      className="inline-flex h-full shrink-0 items-center"
      style={{
        color: foreground,
        background,
        fontWeight: run.bold ? 700 : 400,
        fontStyle: run.italic ? "italic" : "normal",
        textDecoration,
      }}
    >
      {/* One fixed 1ch (2ch for wide chars) cell per grapheme: font-fallback
          glyphs with off-grid advance widths can't shift the columns after
          them, so captured frames stay aligned across both lines. */}
      {terminalGraphemes(run.text).map((grapheme, i) => (
        <span
          key={i}
          className="inline-block shrink-0 overflow-visible whitespace-pre"
          style={{
            width: `${grapheme.cells}ch`,
            opacity: run.invisible ? 0 : run.dim ? 0.65 : 1,
          }}
        >
          <TerminalVectorGlyph glyph={grapheme.text} />
          {!VECTOR_GLYPHS.has(grapheme.text) && grapheme.text}
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

  // Multi-line rows must be exactly one glyph-cell tall: box-drawing and
  // block characters (▓ █ ░ ╭) are drawn to the font's full cell — taller
  // than 1em — so a guessed row height either overlaps rows (too short) or
  // splits them with gaps (too tall). Measure the real ink height of █ in
  // the computed font and size rows to precisely that.
  const [cellH, setCellH] = useState<number | null>(null);
  useEffect(() => {
    const measureCell = () => {
      const el = innerRef.current;
      if (!el) return;
      const cs = getComputedStyle(el);
      const ctx = document.createElement("canvas").getContext("2d");
      if (!ctx) return;
      ctx.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
      const m = ctx.measureText("█");
      const h =
        Math.round(
          ((m.actualBoundingBoxAscent ?? 0) + (m.actualBoundingBoxDescent ?? 0)) * 10,
        ) / 10;
      if (h > 0) setCellH((prev) => (prev === h ? prev : h));
    };
    measureCell();
    // Re-measure after webfonts land — fallback-font metrics differ.
    document.fonts?.ready?.then(measureCell).catch(() => {});
  }, []);

  const source = frames ? frames[frame % frames.length] : previewAnsi;
  if (!source) {
    return (
      <div className={cn("font-terminal text-[13px] opacity-50", className)}>
        (no preview)
      </div>
    );
  }
  const lines = parseAnsi(source);
  const multiline = lines.length > 1;
  const rowStyle: React.CSSProperties | undefined = multiline
    ? cellH
      ? { height: `${cellH}px`, lineHeight: `${cellH}px` }
      : { height: "1.2em", lineHeight: "1.2em" } // pre-measure approximation
    : undefined;
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
                "font-terminal flex w-max items-center text-[13px]",
                multiline ? undefined : "h-[1.9em]",
              )}
              style={rowStyle}
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
    <div className="font-terminal flex flex-col gap-2 px-4 pt-3 pb-3 text-[13px]">
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
