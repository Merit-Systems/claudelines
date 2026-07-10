import type { Metadata } from "next";

import { GatePanel } from "@/components/gate-panel";
import { siteUrl } from "@/lib/site";

export const metadata: Metadata = {
  title: "Submit",
  description: "Publish a statusline to the registry.",
};

export default function SubmitPage() {
  const base = siteUrl();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1.5">
        <h1 className="text-3xl font-medium tracking-tight">Submit yours</h1>
        <p className="text-muted-foreground text-sm">
          Upload your existing statusline as-is ($0.50 — funds an Opus security
          audit), or a data-only spec ($0.01 — installs with zero trust). Set a
          price and buyers pay your wallet directly.
        </p>
      </div>
      <GatePanel
        agent={[
          {
            label: "Upload your existing statusline as-is ($0.50)",
            text: `Publish my current Claude Code statusline to ${base}. Read the statusLine command from ~/.claude/settings.json and the script it points to, capture a preview with: echo '{}' | COLUMNS=120 <that command>. Then fetch ${base}/llms.txt and POST /api/register ($0.50 via x402/MPP) with the script, the captured previewAnsi, a name/description, my price (or "0" for free) and payout wallet.`,
          },
          {
            label: "Or design a safe data-only spec ($0.01)",
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
    </div>
  );
}
