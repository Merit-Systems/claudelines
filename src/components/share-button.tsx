"use client";

import { useState } from "react";
import { Check, Copy, Eye } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

/** Prompt that sends the user's current status line into the publish flow. */
export function ShareButton({ base }: { base: string }) {
  const [copied, setCopied] = useState(false);

  const command = `Use ${base}/skill.md to share my current Claude Code status line.`;

  return (
    <div className="flex items-center gap-3">
      <Button
        type="button"
        size="xl"
        className="w-52 rounded-[6px]"
        aria-label="Copy prompt to share my status line"
        onClick={() => {
          navigator.clipboard.writeText(command);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        }}
      >
        {copied ? (
          <Check className="size-4" />
        ) : (
          <Copy className="size-4" />
        )}
        {copied ? "Paste Into Claude Code" : "Share Your Status Line"}
      </Button>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className="text-muted-foreground hover:text-foreground cursor-pointer p-1 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2"
            aria-label="View sharing prompt"
          >
            <Eye className="size-4" />
          </button>
        </TooltipTrigger>
        <TooltipContent
          side="bottom"
          align="start"
          className="max-w-sm font-mono leading-5"
        >
          {command}
        </TooltipContent>
      </Tooltip>
    </div>
  );
}
