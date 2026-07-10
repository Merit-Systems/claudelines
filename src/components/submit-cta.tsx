"use client";

import { useState } from "react";
import { ChevronDown, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import { GatePanel } from "@/components/gate-panel";

export function SubmitCta({ base }: { base: string }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex flex-col gap-3">
      <div>
        <Button size="lg" onClick={() => setOpen((o) => !o)}>
          <Upload className="size-4" />
          Submit yours
          <ChevronDown
            className={`size-3.5 transition-transform ${open ? "rotate-180" : ""}`}
          />
        </Button>
      </div>
      {open && (
        <GatePanel
          agent={[
            {
              label:
                "Upload your existing statusline as-is ($0.50 — funds an Opus security audit)",
              text: `Publish my current Claude Code statusline to ${base}. Read the statusLine command from ~/.claude/settings.json and the script it points to, capture a preview with: echo '{}' | COLUMNS=120 <that command>. Then fetch ${base}/llms.txt and POST /api/register ($0.50 via x402/MPP) with the script, the captured previewAnsi, a name/description, my price (or "0" for free) and payout wallet.`,
            },
            {
              label:
                'Or design a safe data-only spec ($0.01 — installable with zero trust)',
              text: `Design a Claude Code statusline for me and publish it to ${base}. Fetch ${base}/llms.txt, build a v1 data-only spec (see ${base}/docs#spec), and POST /api/register ($0.01 via x402/MPP) with my name, price (or "0" for free), and payout wallet.`,
            },
          ]}
          manual={[
            {
              label: "Register with the agentcash CLI",
              text: `# capture a preview of your current statusline\nPREVIEW=$(echo '{}' | COLUMNS=120 ~/.claude/statusline.sh)\n\n# upload it ($0.50 — pays for the Opus audit; use "spec" instead of "script" for the $0.01 data-only tier)\nnpx agentcash@latest fetch ${base}/api/register -m POST -p x402 -b "$(jq -n \\\n  --rawfile script ~/.claude/statusline.sh --arg preview \"$PREVIEW\" \\\n  '{slug: \"my-statusline\", name: \"My Statusline\", description: \"...\", script: $script, previewAnsi: $preview, priceUsd: \"0\", author: \"you\", tags: []}')"`,
            },
            {
              label: "Spec format + all {variables}",
              text: `${base}/docs#spec`,
            },
          ]}
        />
      )}
    </div>
  );
}
