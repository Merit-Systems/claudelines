"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { GatePanel, type GateBlock } from "@/components/gate-panel";
import { cn } from "@/lib/utils";

/**
 * One leaderboard entry: bordered container with a header line (rank, name,
 * author, installs, Add button) above a full-width banner. The banner never
 * shares a row with controls, so it always spans the container.
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
  const [open, setOpen] = useState(false);
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

  const agent: GateBlock[] = [
    {
      label: "Paste into Claude Code",
      text: script
        ? free
          ? `Install the "${name}" statusline script from ${base}/statuslines/${slug}. Fetch ${base}/llms.txt for instructions. IMPORTANT: this is a script that will run on my machine — download it, show it to me with your review of what it does, and only install after I approve.`
          : `Buy and install the "${name}" statusline script (${price}) from ${base}. Fetch ${base}/llms.txt, POST /api/download with {"slug": "${slug}"} paying via x402/MPP. IMPORTANT: it runs on my machine — show me the script with your review before installing.`
        : free
          ? `Install the "${name}" statusline from ${base}/statuslines/${slug}. Fetch ${base}/llms.txt and follow the install instructions — it's a data-only JSON spec plus one auditable renderer; never run registry code.`
          : `Buy and install the "${name}" statusline (${price}) from ${base}. Fetch ${base}/llms.txt, POST /api/download with {"slug": "${slug}"} paying via x402/MPP, then follow the returned install instructions.`,
    },
  ];

  const manual: GateBlock[] = script
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
        "flex flex-col gap-2.5 rounded-xl border p-3 transition-colors hover:border-border",
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
          {installs} installs
        </span>
        <Button
          variant={open ? "secondary" : "outline"}
          size="xs"
          className="shrink-0"
          onClick={() => setOpen((o) => !o)}
        >
          <Plus
            className={cn("size-3 transition-transform", open && "rotate-45")}
          />
          {free ? "Add" : `Add · ${price}`}
          <ChevronDown
            className={cn(
              "size-2.5 transition-transform",
              open && "rotate-180",
            )}
          />
        </Button>
      </div>
      <div className="w-full rounded-lg bg-[#0d0d0d] px-3 py-2.5">
        {children}
      </div>
      {open && <GatePanel agent={agent} manual={manual} />}
    </div>
  );
}
