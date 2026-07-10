"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

/** skills.sh-style "try it now": one dark command box that copies itself. */
export function ShareButton({ base }: { base: string }) {
  const [copied, setCopied] = useState(false);
  const host = base.replace(/^https?:\/\//, "");

  // A prompt, not a shell command: the agent fetches the skill and follows
  // it. Free installs are plain HTTP; only purchases and publishing pay
  // via agentcash (x402/MPP).
  const command = `Set up ${host}/skill.md`;

  return (
    <div className="flex max-w-xl flex-col gap-3">
      <p className="text-muted-foreground text-sm">
        Paste in Claude Code
      </p>
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
