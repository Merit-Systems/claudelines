"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

import { cn } from "@/lib/utils";

export function CopyBlock({
  text,
  label,
  className,
}: {
  text: string;
  label?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {label && (
        <p className="text-muted-foreground text-xs font-medium">{label}</p>
      )}
      <div className="group relative rounded-lg border bg-muted/50">
        <pre className="overflow-x-auto px-3 py-2.5 font-mono text-xs leading-relaxed whitespace-pre">
          {text}
        </pre>
        <button
          type="button"
          aria-label="Copy"
          onClick={() => {
            navigator.clipboard.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
          className="text-muted-foreground hover:text-foreground absolute top-2 right-2 cursor-pointer rounded-md border bg-background p-1.5 opacity-0 transition-opacity group-hover:opacity-100"
        >
          {copied ? (
            <Check className="size-3.5 text-primary" />
          ) : (
            <Copy className="size-3.5" />
          )}
        </button>
      </div>
    </div>
  );
}
