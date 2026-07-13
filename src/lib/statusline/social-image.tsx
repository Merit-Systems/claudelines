import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

import {
  parseAnsi,
  terminalCellWidth,
  terminalGraphemes,
  type StyledRun,
} from "@/lib/statusline/ansi";
import type { StatuslineWithAuthor } from "@/lib/db/queries";
import { displayAuthor, formatCount, formatUsd } from "@/lib/utils";

import type { CSSProperties } from "react";

export const socialImageSize = {
  width: 1200,
  height: 630,
};

const monoFont = readFile(
  join(
    process.cwd(),
    "node_modules/@fontsource/dejavu-mono/files/dejavu-mono-latin-400-normal.woff",
  ),
);
const geistFont = readFile(
  join(
    process.cwd(),
    "node_modules/next/dist/compiled/@vercel/og/Geist-Regular.ttf",
  ),
);

const terminal = {
  background: "#171717",
  foreground: "#d4d4d4",
  muted: "#737373",
  border: "#383838",
  dim: "#525252",
  cursor: "#a3a3a3",
};

function PreviewRun({
  cellWidth,
  fontSize,
  rowHeight,
  run,
}: {
  cellWidth: number;
  fontSize: number;
  rowHeight: number;
  run: StyledRun;
}) {
  return (
    <div
      style={{
        display: "flex",
        height: rowHeight,
        color: run.fg ?? terminal.foreground,
        backgroundColor: run.bg ?? "transparent",
        fontWeight: run.bold ? 700 : 400,
        opacity: run.dim ? 0.65 : 1,
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
            fontFamily: "DejaVu Mono",
            fontSize,
            lineHeight: 1,
            whiteSpace: "pre",
          }}
        >
          {/\s/.test(grapheme.text) ? "\u00a0" : grapheme.text}
        </div>
      ))}
    </div>
  );
}

function StatuslinePreview({ preview }: { preview: string | null }) {
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
  const widthFitFontSize = cellWidth * 1.58;
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
  const [monoFontData, geistFontData] = await Promise.all([
    monoFont,
    geistFont,
  ]);

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
          fontFamily: "geist",
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
              fontFamily: "DejaVu Mono",
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
              fontFamily: "DejaVu Mono",
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
            <StatuslinePreview preview={preview} />
          </div>
          <div
            style={{
              display: "flex",
              height: 20,
              alignItems: "center",
              gap: 28,
              color: terminal.dim,
              fontFamily: "DejaVu Mono",
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
      fonts: [
        {
          name: "geist",
          data: geistFontData,
          style: "normal",
          weight: 400,
        },
        {
          name: "geist",
          data: geistFontData,
          style: "normal",
          weight: 700,
        },
        {
          name: "DejaVu Mono",
          data: monoFontData,
          style: "normal",
          weight: 400,
        },
        {
          name: "DejaVu Mono",
          data: monoFontData,
          style: "normal",
          weight: 700,
        },
      ],
    },
  );
}
