"use client";

import { useState } from "react";
import { BadgeCheck, Check } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

/**
 * Prompt that sends the creator into the X-connect flow. Claiming is
 * SIWX-gated server-side, so only the wallet that registered can complete
 * it — safe to show to any visitor.
 */
export function ClaimButton({ base }: { base: string }) {
  const [copied, setCopied] = useState(false);

  const command = `Use ${base}/skill.md to claim my ClaudeLines listings: connect my X account and give me the sign-in link.`;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          size="sm"
          variant="outline"
          aria-label="Copy prompt to claim your listings"
          onClick={() => {
            navigator.clipboard.writeText(command);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          }}
        >
          {copied ? <Check /> : <BadgeCheck />}
          {copied ? "Paste Into Claude Code" : "Claim"}
        </Button>
      </TooltipTrigger>
      <TooltipContent
        side="bottom"
        align="start"
        className="max-w-sm font-mono leading-5"
      >
        Yours? {command}
      </TooltipContent>
    </Tooltip>
  );
}
