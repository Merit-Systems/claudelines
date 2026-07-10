"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, ChevronDown, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { CopyBlock } from "@/components/copy-block";
import { CcFrame, TERM_THEMES } from "@/components/terminal-preview";
import { usePreviewTheme } from "@/components/preview-theme";
import { cn } from "@/lib/utils";

/**
 * One leaderboard entry: bordered container with a header line (rank, name,
 * author, installs, Add button) above a full-width banner.
 *
 * "Add" is a split button: the main action copies the agent install prompt
 * to the clipboard (paste into Claude Code and go); the chevron reveals
 * manual install commands.
 */
export function StatuslineEntry({
  rank,
  slug,
  name,
  author,
  installs,
  kind,
  priceUsd,
  base,
  className,
  children,
}: {
  rank?: number;
  slug: string;
  name: string;
  author: string;
  installs: string;
  kind: "spec" | "script";
  priceUsd: string;
  base: string;
  className?: string;
  /** The rendered banner strip. */
  children?: React.ReactNode;
}) {
  const [manualOpen, setManualOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [cc, setCc] = useState(false);
  const { theme } = usePreviewTheme();
  const free = Number(priceUsd) === 0;
  const price = `$${Number(priceUsd).toFixed(2)}`;
  const script = kind === "script";

  const command = script
    ? `~/.claude/statuslines/${slug}`
    : `node ~/.claude/statuslines/render.mjs ~/.claude/statuslines/${slug}.json`;
  const settings = JSON.stringify(
    { statusLine: { type: "command", command } },
    null,
    2,
  );

  const agentPrompt = script
    ? free
      ? `Install the "${name}" statusline script from ${base}/statuslines/${slug}. Fetch ${base}/llms.txt for instructions. IMPORTANT: this is a script that will run on my machine — download it, show it to me with your review of what it does, and only install after I approve.`
      : `Buy and install the "${name}" statusline script (${price}) from ${base}. Fetch ${base}/llms.txt, POST /api/download with {"slug": "${slug}"} paying via x402/MPP. IMPORTANT: it runs on my machine — show me the script with your review before installing.`
    : free
      ? `Install the "${name}" statusline from ${base}/statuslines/${slug}. Fetch ${base}/llms.txt and follow the install instructions — it's a data-only JSON spec plus one auditable renderer; never run registry code.`
      : `Buy and install the "${name}" statusline (${price}) from ${base}. Fetch ${base}/llms.txt, POST /api/download with {"slug": "${slug}"} paying via x402/MPP, then follow the returned install instructions.`;

  const manual: { label: string; text: string }[] = script
    ? [
        {
          label: free
            ? "Download, READ IT, then make it executable"
            : `Buy with the agentcash CLI (${price}, paid to the creator) — then READ IT`,
          text: free
            ? `mkdir -p ~/.claude/statuslines\ncurl -fsSL ${base}/api/statuslines/${slug}/script -o ~/.claude/statuslines/${slug}\n$EDITOR ~/.claude/statuslines/${slug}   # review before trusting it\nchmod +x ~/.claude/statuslines/${slug}`
            : `mkdir -p ~/.claude/statuslines\nnpx agentcash@latest fetch ${base}/api/download -m POST -b '{"slug":"${slug}"}' -p x402 | jq -r .script > ~/.claude/statuslines/${slug}\n$EDITOR ~/.claude/statuslines/${slug}   # review before trusting it\nchmod +x ~/.claude/statuslines/${slug}`,
        },
        { label: "Merge into ~/.claude/settings.json", text: settings },
      ]
    : free
      ? [
          {
            label: "Download the renderer (once) and the spec",
            text: [
              "mkdir -p ~/.claude/statuslines",
              `curl -fsSL ${base}/render.mjs -o ~/.claude/statuslines/render.mjs`,
              `curl -fsSL ${base}/api/statuslines/${slug}/spec -o ~/.claude/statuslines/${slug}.json`,
            ].join("\n"),
          },
          { label: "Merge into ~/.claude/settings.json", text: settings },
        ]
      : [
          {
            label: `Buy with the agentcash CLI (${price}, paid to the creator)`,
            text: `mkdir -p ~/.claude/statuslines\ncurl -fsSL ${base}/render.mjs -o ~/.claude/statuslines/render.mjs\nnpx agentcash@latest fetch ${base}/api/download -m POST -b '{"slug":"${slug}"}' -p x402 | jq .spec > ~/.claude/statuslines/${slug}.json`,
          },
          { label: "Merge into ~/.claude/settings.json", text: settings },
        ];

  return (
    <div
      className={cn(
        "flex flex-col gap-2.5 p-3",
        className,
      )}
    >
      <div className="flex items-center gap-2 text-xs">
        {rank !== undefined && (
          <span className="text-muted-foreground w-4 shrink-0 text-right font-mono">
            {rank}
          </span>
        )}
        <Link
          href={`/statuslines/${slug}`}
          className="shrink-0 text-sm font-medium hover:underline"
        >
          {name}
        </Link>
        <span className="text-muted-foreground truncate">{author}</span>
        <span className="text-muted-foreground ml-auto shrink-0 font-mono">
          {installs}
        </span>
        <div className="flex shrink-0 items-center">
          <Button
            variant="outline"
            size="xs"
            className="rounded-r-none"
            title="Copies an install prompt — paste it into Claude Code"
            onClick={() => {
              navigator.clipboard.writeText(agentPrompt);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            }}
          >
            {copied ? (
              <>
                <Check className="size-3 text-primary" />
                Prompt copied
              </>
            ) : (
              <>
                <Plus className="size-3" />
                {free ? "Add" : `Add · ${price}`}
              </>
            )}
          </Button>
          <Button
            variant={manualOpen ? "secondary" : "outline"}
            size="xs"
            className="-ml-px rounded-l-none px-1"
            aria-label="Manual install"
            onClick={() => setManualOpen((o) => !o)}
          >
            <ChevronDown
              className={cn(
                "size-3 transition-transform",
                manualOpen && "rotate-180",
              )}
            />
          </Button>
        </div>
      </div>
      {/* click anywhere on the black area to preview it inside Claude Code */}
      <button
        type="button"
        onClick={() => setCc((v) => !v)}
        title={cc ? "Back to the bare statusline" : "Preview in Claude Code"}
        className="w-full cursor-pointer border text-left"
        style={{
          ...(TERM_THEMES[theme] as React.CSSProperties),
          background: "var(--term-bg)",
          borderColor: "var(--term-border)",
        }}
      >
        {cc ? (
          <CcFrame>{children}</CcFrame>
        ) : (
          <div className="px-3 py-2.5">{children}</div>
        )}
      </button>
      {manualOpen && (
        <div className="flex flex-col gap-3 rounded-lg border p-3">
          <p className="text-muted-foreground text-xs font-medium">
            Add manually
          </p>
          {manual.map((b, i) => (
            <CopyBlock key={i} label={b.label} text={b.text} />
          ))}
        </div>
      )}
    </div>
  );
}
