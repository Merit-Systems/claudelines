"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Copy } from "lucide-react";

import { Button } from "@/components/ui/button";

/** Hero actions: Share yours + a one-line prompt copyer for Claude Code. */
export function ShareButton({ base }: { base: string }) {
  const [copied, setCopied] = useState(false);
  const host = base.replace(/^https?:\/\//, "");

  const prompt = `Publish my Claude Code statusline to ${base} — fetch ${base}/llms.txt and follow the publish flow (register my current statusline with a captured preview).`;

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Link href="/submit">
        <Button size="lg">Share yours</Button>
      </Link>
      <button
        type="button"
        onClick={() => {
          navigator.clipboard.writeText(prompt);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        }}
        title="Copies a prompt — paste it into Claude Code"
        className="group flex h-10 max-w-full cursor-pointer items-center gap-2.5 border px-4 font-mono text-sm transition-colors hover:bg-muted"
      >
        <span className="truncate">
          {copied ? "Copied — paste into Claude Code" : `Set up ${host}/llms.txt`}
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
