"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";

/** Copies the publish-your-statusline prompt — paste into Claude Code. */
export function ShareButton({ base }: { base: string }) {
  const [copied, setCopied] = useState(false);

  const prompt = `Publish my current Claude Code statusline to ${base}. Read the statusLine command from ~/.claude/settings.json and the script it points to, capture a preview with: echo '{}' | COLUMNS=120 <that command>. Then fetch ${base}/llms.txt and POST /api/register ($0.50 via x402/MPP — funds a security audit) with the script, the captured previewAnsi, a name/description, my price (or "0" for free) and payout wallet.`;

  return (
    <div className="flex items-center gap-2">
      <Button
        onClick={() => {
          navigator.clipboard.writeText(prompt);
          setCopied(true);
          setTimeout(() => setCopied(false), 2500);
        }}
      >
        {copied ? (
          <>
            <Check className="size-4" />
            Copied — paste into Claude Code
          </>
        ) : (
          <>
            <Upload className="size-4" />
            Share yours
          </>
        )}
      </Button>
      <Link href="/docs">
        <Button variant="outline">Docs</Button>
      </Link>
    </div>
  );
}
