"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

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
    <Tooltip>
      <TooltipTrigger asChild>
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
          {copied ? <Check className="size-5" /> : <Copy className="size-4" />}
          {copied ? "Paste Into Claude Code" : "Share Your Status Line"}
        </Button>
      </TooltipTrigger>
      <TooltipContent
        side="bottom"
        align="start"
        className="max-w-sm font-mono leading-5"
      >
        {command}
      </TooltipContent>
    </Tooltip>
  );
}
