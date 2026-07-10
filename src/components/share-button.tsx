"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

/** skills.sh-style "try it now": one dark command box that copies itself. */
export function ShareButton({ base }: { base: string }) {
  const [copied, setCopied] = useState(false);
  const host = base.replace(/^https?:\/\//, "");

  const command = `curl -fsSL ${host}/skill.md --create-dirs -o ~/.claude/skills/statuslines/SKILL.md`;

  return (
    <div className="flex max-w-xl flex-col gap-3">
      <p className="text-muted-foreground font-mono text-xs tracking-widest">
        TRY IT NOW
      </p>
      <button
        type="button"
        onClick={() => {
          navigator.clipboard.writeText(command);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        }}
        className="group flex cursor-pointer items-center gap-3 bg-[#141414] px-4 py-3.5 text-left font-mono text-sm text-[#e5e5e5] transition-colors hover:bg-[#1c1c1c]"
      >
        <span className="shrink-0 text-[#737373]">$</span>
        <span className="no-scrollbar flex-1 overflow-x-auto whitespace-nowrap">
          {command}
        </span>
        {copied ? (
          <Check className="size-4 shrink-0 text-[#4ade80]" />
        ) : (
          <Copy className="size-4 shrink-0 text-[#737373] transition-colors group-hover:text-[#e5e5e5]" />
        )}
      </button>
    </div>
  );
}
