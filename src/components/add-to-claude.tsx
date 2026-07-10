"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, ChevronDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ClaudeMark } from "@/components/claude-mark";
import { CopyBlock } from "@/components/copy-block";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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
  wallet,
  installs,
  revenue,
  priceUsd,
  base,
  className,
  children,
}: {
  rank?: number;
  slug: string;
  name: string;
  /** "@handle" when the creator verified an X identity; anything else is ignored. */
  author: string;
  /** Creator wallet, when known — links the ?-avatar to their creator page. */
  wallet?: string | null;
  installs: string;
  /** Revenue label shown in the aligned leaderboard column. */
  revenue?: string;
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

  const command = `~/.claude/statuslines/${slug}`;
  const settings = JSON.stringify(
    { statusLine: { type: "command", command } },
    null,
    2,
  );

  const agentPrompt = free
    ? `Install the "${name}" statusline from ${base}/statuslines/${slug}. Fetch ${base}/llms.txt for instructions. IMPORTANT: this is a script that will run on my machine — download it, show it to me with your review of what it does, and only install after I approve.`
    : `Buy and install the "${name}" statusline (${price}) from ${base}. Fetch ${base}/llms.txt, POST /api/download with {"slug": "${slug}"} paying via x402/MPP. IMPORTANT: it runs on my machine — show me the script with your review before installing.`;

  const manual: { label: string; text: string }[] = [
    {
      label: free
        ? "Download, READ IT, then make it executable"
        : `Buy with the agentcash CLI (${price}, paid to the creator) — then READ IT`,
      text: free
        ? `mkdir -p ~/.claude/statuslines\ncurl -fsSL ${base}/api/statuslines/${slug}/script -o ~/.claude/statuslines/${slug}\n$EDITOR ~/.claude/statuslines/${slug}   # review before trusting it\nchmod +x ~/.claude/statuslines/${slug}`
        : `mkdir -p ~/.claude/statuslines\nnpx agentcash@latest fetch ${base}/api/download -m POST -b '{"slug":"${slug}"}' -p x402 | jq -r .script > ~/.claude/statuslines/${slug}\n$EDITOR ~/.claude/statuslines/${slug}   # review before trusting it\nchmod +x ~/.claude/statuslines/${slug}`,
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
      <div
        className={cn(
          "items-center gap-2 text-xs",
          revenue
            ? "grid grid-cols-[1rem_minmax(0,1fr)_4.5rem_5.5rem] sm:grid-cols-[1rem_minmax(0,1fr)_5.5rem_6.5rem_7.5rem]"
            : "flex",
        )}
      >
        {rank !== undefined && (
          <span className="text-muted-foreground w-4 shrink-0 text-right font-mono">
            {rank}
          </span>
        )}
        <div className="flex min-w-0 items-center gap-2">
          <Link
            href={`/statuslines/${slug}`}
            className={cn(
              "text-sm font-medium hover:underline",
              revenue ? "truncate" : "shrink-0",
            )}
          >
            {name}
          </Link>
          {author.startsWith("@") ? (
            <a
              href={`https://x.com/${author.slice(1)}`}
              target="_blank"
              rel="noreferrer"
              className="text-primary truncate hover:underline"
              title="Verified via X"
            >
              {author} ✓
            </a>
          ) : wallet ? (
            <Link
              href={`/creators/${wallet}`}
              title="Unverified creator — view their other statuslines"
              className="bg-muted text-muted-foreground hover:text-foreground flex size-4 shrink-0 items-center justify-center rounded-full border text-[9px] transition-colors"
            >
              ?
            </Link>
          ) : (
            <span
              title="Unverified creator"
              className="bg-muted text-muted-foreground flex size-4 shrink-0 items-center justify-center rounded-full border text-[9px]"
            >
              ?
            </span>
          )}
        </div>
        <span
          className={cn(
            "text-muted-foreground shrink-0 text-right font-mono tabular-nums",
            !revenue && "ml-auto",
          )}
        >
          {installs}
        </span>
        {revenue && (
          <span className="text-muted-foreground shrink-0 text-right font-mono tabular-nums">
            {revenue}
          </span>
        )}
        <div
          className={cn(
            "flex shrink-0 items-center",
            revenue && "col-start-2 justify-self-start sm:col-start-auto sm:justify-self-end",
          )}
        >
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="xs"
                className="rounded-r-none"
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
                    <ClaudeMark className="size-3 shrink-0" />
                    Add
                  </>
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Price: {free ? "Free" : price}</p>
            </TooltipContent>
          </Tooltip>
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
