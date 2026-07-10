"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

/** Prompt that sends the user's current status line into the publish flow. */
export function ShareButton({ base }: { base: string }) {
  const [copied, setCopied] = useState(false);

  const command = `Use ${base}/skill.md to share my current Claude Code status line.`;

  return (
    <div className="flex max-w-xl flex-col gap-3">
      <p className="font-mono text-sm font-medium">Share my status line:</p>
      <button
        type="button"
        onClick={() => {
          navigator.clipboard.writeText(command);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        }}
        className="group bg-muted/50 hover:bg-muted flex cursor-pointer items-center gap-3 border px-4 py-3.5 text-left font-mono text-sm transition-colors"
      >
        <span className="text-muted-foreground shrink-0">&gt;</span>
        <span className="no-scrollbar flex-1 overflow-x-auto whitespace-nowrap">
          {command}
        </span>
        {copied ? (
          <Check className="text-primary size-4 shrink-0" />
        ) : (
          <Copy className="text-muted-foreground group-hover:text-foreground size-4 shrink-0 transition-colors" />
        )}
      </button>
    </div>
  );
}
