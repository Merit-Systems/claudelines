import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

import {
  parseAnsi,
  terminalCellWidth,
  terminalColorHex,
  terminalGraphemes,
  type TerminalPalette,
  type StyledRun,
} from "@/lib/statusline/ansi";
import type { StatuslineWithAuthor } from "@/lib/db/queries";
import { displayAuthor, formatCount, formatUsd } from "@/lib/utils";

import type { CSSProperties } from "react";

export const socialImageSize = {
  width: 1200,
  height: 630,
};

const terminal = {
  background: "#171717",
  foreground: "#d4d4d4",
  muted: "#737373",
  border: "#383838",
  dim: "#525252",
  cursor: "#a3a3a3",
};

const socialPalette: TerminalPalette = {
  foreground: terminal.foreground,
  background: terminal.background,
  colors: [
    "#0d0d0d", "#e5484d", "#46a758", "#d4a72c",
    "#3e63dd", "#8e4ec6", "#12a594", "#d4d4d4",
    "#737373", "#ff6369", "#63c174", "#f0c000",
    "#849dff", "#bf7af0", "#0ac5b3", "#ffffff",
  ],
};

const TERMINAL_SYMBOL = /[\u2190-\u2bff]/u;

function glyphFontFamily(grapheme: string, primary: string): string {
  if (TERMINAL_SYMBOL.test(grapheme)) return "monospace";
  return primary;
}

function VectorGlyph({
  color,
  fontSize,
  glyph,
}: {
  color: string;
  fontSize: number;
  glyph: string;
}) {
  const size = { width: fontSize * 0.62, height: fontSize };
  if (glyph === "⬢") {
    return (
      <svg {...size} viewBox="0 0 100 100">
        <path d="M25 6h50l22 44-22 44H25L3 50 25 6Z" fill={color} />
      </svg>
    );
  }
  if (glyph === "◆") {
    return (
      <svg {...size} viewBox="0 0 100 100">
        <path d="M50 3 97 50 50 97 3 50 50 3Z" fill={color} />
      </svg>
    );
  }
  if (glyph === "⟐") {
    return (
      <svg {...size} viewBox="0 0 100 100">
        <path
          d="M50 8 92 50 50 92 8 50 50 8Z"
          fill="none"
          stroke={color}
          strokeWidth="9"
        />
        <circle cx="50" cy="50" r="8" fill={color} />
      </svg>
    );
  }
  if (glyph === "↳") {
    return (
      <svg {...size} viewBox="0 0 100 100">
        <path
          d="M14 8v43c0 17 9 26 27 26h43M67 60l17 17-17 17"
          fill="none"
          stroke={color}
          strokeWidth="10"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  if (glyph === "█") {
    return (
      <svg {...size} width="100%" height="100%" viewBox="0 0 100 100">
        <path d="M0 0h100v100H0Z" fill={color} />
      </svg>
    );
  }
  if (glyph === "▀" || glyph === "▄") {
    return (
      <svg {...size} width="100%" height="100%" viewBox="0 0 100 100">
        <path
          d={glyph === "▀" ? "M0 0h100v50H0Z" : "M0 50h100v50H0Z"}
          fill={color}
        />
      </svg>
    );
  }
  return null;
}

const VECTOR_GLYPHS = new Set(["⬢", "◆", "⟐", "↳", "█", "▀", "▄"]);

const terminalFontFiles = [
  {
    name: "JetBrains Mono",
    directory: "@fontsource/jetbrains-mono/files",
    file: "jetbrains-mono-latin-400-normal.woff",
    weight: 400,
    style: "normal",
  },
  {
    name: "JetBrains Mono",
    directory: "@fontsource/jetbrains-mono/files",
    file: "jetbrains-mono-latin-400-italic.woff",
    weight: 400,
    style: "italic",
  },
  {
    name: "JetBrains Mono",
    directory: "@fontsource/jetbrains-mono/files",
    file: "jetbrains-mono-latin-700-normal.woff",
    weight: 700,
    style: "normal",
  },
  {
    name: "JetBrains Mono",
    directory: "@fontsource/jetbrains-mono/files",
    file: "jetbrains-mono-latin-700-italic.woff",
    weight: 700,
    style: "italic",
  },
] as const;

async function loadTerminalFonts() {
  try {
    return await Promise.all(
      terminalFontFiles.map(async ({ name, directory, file, weight, style }) => ({
        name,
        data: await readFile(
          join(process.cwd(), "node_modules", directory, file),
        ),
        weight,
        style,
      })),
    );
  } catch {
    // Social cards must remain valid even if a deployment misses an optional
    // font asset. The tracing config normally guarantees these are present.
    return [];
  }
}

function PreviewRun({
  cellWidth,
  fontFamily,
  fontSize,
  rowHeight,
  run,
}: {
  cellWidth: number;
  fontFamily: string;
  fontSize: number;
  rowHeight: number;
  run: StyledRun;
}) {
  const foreground = run.inverse
    ? terminalColorHex(run.bg, socialPalette, "background")
    : terminalColorHex(run.fg, socialPalette, "foreground");
  const background = run.inverse
    ? terminalColorHex(run.fg, socialPalette, "foreground")
    : run.bg
      ? terminalColorHex(run.bg, socialPalette, "background")
      : "transparent";
  const textDecoration = [
    run.underline ? "underline" : "",
    run.strikethrough ? "line-through" : "",
  ].filter(Boolean).join(" ") || "none";

  return (
    <div
      style={{
        display: "flex",
        height: rowHeight,
        color: foreground,
        backgroundColor: background,
        fontWeight: run.bold ? 700 : 400,
        fontStyle: run.italic ? "italic" : "normal",
        textDecoration,
      }}
    >
      {terminalGraphemes(run.text).map((grapheme, index) => (
        <div
          key={index}
          style={{
            display: "flex",
            width: cellWidth * grapheme.cells,
            height: rowHeight,
            flexShrink: 0,
            alignItems: "center",
            justifyContent: "center",
            fontFamily: glyphFontFamily(grapheme.text, fontFamily),
            fontSize,
            lineHeight: 1,
            opacity: run.invisible ? 0 : run.dim ? 0.65 : 1,
            whiteSpace: "pre",
          }}
        >
          {VECTOR_GLYPHS.has(grapheme.text) ? (
            <VectorGlyph
              color={foreground}
              fontSize={fontSize}
              glyph={grapheme.text}
            />
          ) : /\s/.test(grapheme.text) ? (
            "\u00a0"
          ) : (
            grapheme.text
          )}
        </div>
      ))}
    </div>
  );
}

function StatuslinePreview({
  fontFamily,
  preview,
}: {
  fontFamily: string;
  preview: string | null;
}) {
  const lines = parseAnsi(preview ?? "");
  const maxCells = Math.max(
    1,
    ...lines.map((line) =>
      line.reduce((width, run) => width + terminalCellWidth(run.text), 0),
    ),
  );
  const availableWidth = 956;
  const availableHeight = 142;
  const cellWidth = Math.min(13, availableWidth / maxCells);
  // JetBrains Mono's advance is 0.6em. This keeps every glyph centered in the
  // exact cell width used to fit the complete captured frame.
  const widthFitFontSize = cellWidth / 0.6;
  const heightFitFontSize = availableHeight / (lines.length * 1.24);
  const fontSize = Math.min(21, widthFitFontSize, heightFitFontSize);
  const rowHeight = fontSize * 1.24;

  return (
    <div
      style={{
        display: "flex",
        width: "100%",
        height: availableHeight,
        flexDirection: "column",
        justifyContent: "center",
        overflow: "hidden",
      }}
    >
      {lines.map((runs, lineIndex) => (
        <div
          key={lineIndex}
          style={{
            display: "flex",
            width: "100%",
            height: rowHeight,
            alignItems: "center",
          }}
        >
          {runs.map((run, runIndex) => (
            <PreviewRun
              key={runIndex}
              cellWidth={cellWidth}
              fontFamily={fontFamily}
              fontSize={fontSize}
              rowHeight={rowHeight}
              run={run}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

function BrandMark() {
  const bar = (width: number, opacity: number): CSSProperties => ({
    width,
    height: 14,
    backgroundColor: "#d97757",
    opacity,
  });

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
      <div style={bar(22, 1)} />
      <div style={bar(14, 0.58)} />
      <div style={bar(8, 0.3)} />
    </div>
  );
}

function ClaudeMark() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24">
      <path
        fill="#d97757"
        fillRule="evenodd"
        clipRule="evenodd"
        d="M20.998 10.949H24v3.102h-3v3.028h-1.487V20H18v-2.921h-1.487V20H15v-2.921H9V20H7.488v-2.921H6V20H4.487v-2.921H3V14.05H0V10.95h3V5h17.998v5.949zM6 10.949h1.488V8.102H6v2.847zm10.51 0H18V8.102h-1.49v2.847z"
      />
    </svg>
  );
}

export async function createStatuslineSocialImage(row: StatuslineWithAuthor) {
  const preview = row.previewFrames?.[0] ?? row.previewAnsi;
  const fonts = await loadTerminalFonts();
  const terminalFontFamily = fonts.length ? "JetBrains Mono" : "monospace";

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          width: "100%",
          height: "100%",
          flexDirection: "column",
          padding: "46px 56px",
          color: "#171717",
          backgroundColor: "#f8f7f5",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            height: 34,
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <BrandMark />
            <span style={{ fontSize: 25, fontWeight: 700 }}>ClaudeLines</span>
          </div>
          <span style={{ color: "#737373", fontSize: 19 }}>
            claudelines.com/statuslines/{row.slug}
          </span>
        </div>

        <div
          style={{
            display: "flex",
            height: 92,
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div
            style={{
              display: "flex",
              minWidth: 0,
              flexDirection: "column",
            }}
          >
            <span
              style={{
                maxWidth: 820,
                overflow: "hidden",
                fontSize: 48,
                fontWeight: 700,
                letterSpacing: -1.5,
                whiteSpace: "nowrap",
              }}
            >
              {row.name}
            </span>
            <span style={{ color: "#737373", fontSize: 18 }}>
              by {displayAuthor(row.authorHandle)} · {formatCount(row.installs)}{" "}
              installs
            </span>
          </div>
          <div
            style={{
              display: "flex",
              padding: "9px 15px",
              border: "1px solid #d7d4cf",
              color: "#9f4f35",
              backgroundColor: "#fffaf7",
              fontSize: 18,
              fontWeight: 700,
            }}
          >
            {formatUsd(row.priceUsd)}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            width: "100%",
            flex: 1,
            flexDirection: "column",
            padding: "23px 28px 20px",
            border: `1px solid ${terminal.border}`,
            color: terminal.foreground,
            backgroundColor: terminal.background,
          }}
        >
          <div
            style={{
              display: "flex",
              height: 28,
              alignItems: "center",
              gap: 9,
              color: terminal.muted,
              fontFamily: terminalFontFamily,
              fontSize: 17,
            }}
          >
            <ClaudeMark />
            Claude Code
          </div>
          <div
            style={{
              display: "flex",
              height: 54,
              marginTop: 10,
              alignItems: "center",
              gap: 12,
              padding: "0 15px",
              border: `1px solid ${terminal.border}`,
              fontFamily: terminalFontFamily,
              fontSize: 18,
            }}
          >
            <span style={{ color: terminal.muted }}>&gt;</span>
            <span
              style={{
                display: "flex",
                width: 9,
                height: 20,
                backgroundColor: terminal.cursor,
              }}
            />
          </div>
          <div
            style={{
              display: "flex",
              flex: 1,
              alignItems: "center",
              padding: "10px 0",
            }}
          >
            <StatuslinePreview
              fontFamily={terminalFontFamily}
              preview={preview}
            />
          </div>
          <div
            style={{
              display: "flex",
              height: 20,
              alignItems: "center",
              gap: 28,
              color: terminal.dim,
              fontFamily: terminalFontFamily,
              fontSize: 14,
            }}
          >
            <span>? for shortcuts</span>
            <span>&gt;&gt; accept edits on</span>
          </div>
        </div>
      </div>
    ),
    {
      ...socialImageSize,
      emoji: "noto",
      fonts,
    },
  );
}
