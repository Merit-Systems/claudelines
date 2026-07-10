"use client";

import { useState } from "react";
import { Bot, Terminal } from "lucide-react";

import { CopyBlock } from "@/components/copy-block";
import { cn } from "@/lib/utils";

export interface GateBlock {
  label?: string;
  text: string;
}

/**
 * Two-gate panel: everything on this site is doable by your agent or by hand.
 */
export function GatePanel({
  agent,
  manual,
  className,
}: {
  agent: GateBlock[];
  manual: GateBlock[];
  className?: string;
}) {
  const [tab, setTab] = useState<"agent" | "manual">("agent");
  const blocks = tab === "agent" ? agent : manual;

  return (
    <div className={cn("flex flex-col gap-3 rounded-xl border p-4", className)}>
      <div className="flex items-center gap-1">
        {(
          [
            { key: "agent", label: "Ask your agent", icon: Bot },
            { key: "manual", label: "Do it yourself", icon: Terminal },
          ] as const
        ).map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={cn(
              "inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-2.5 py-1 text-sm transition-colors",
              tab === t.key
                ? "bg-secondary font-medium"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <t.icon className="size-3.5" />
            {t.label}
          </button>
        ))}
      </div>
      <div className="flex flex-col gap-3">
        {blocks.map((b, i) => (
          <CopyBlock key={`${tab}-${i}`} label={b.label} text={b.text} />
        ))}
      </div>
    </div>
  );
}
