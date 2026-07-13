import type { Metadata } from "next";

import { GatePanel } from "@/components/gate-panel";
import { siteUrl } from "@/lib/site";

export const metadata: Metadata = {
  description: "Publish a statusline to the registry.",
};

export default function SubmitPage() {
  const base = siteUrl();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1.5">
        <h1 className="text-3xl font-medium tracking-tight">Submit yours</h1>
        <p className="text-muted-foreground text-sm">
          Upload your existing statusline as-is ($0.15 — funds the security
          audit). Set a price and buyers pay your wallet directly. No wallet?
          Publish free — the listing shows an unaudited warning until someone
          funds its audit.
        </p>
      </div>
      <GatePanel
        agent={[
          {
            label: "Publish your current statusline ($0.15)",
            text: `Publish my current Claude Code statusline to ${base}. Fetch ${base}/skill.md and follow its publish steps: read the statusLine command from ~/.claude/settings.json, capture a preview at my current terminal width (use COLUMNS when set, otherwise tput cols, with 120 only as a non-TTY fallback), sanitize any personal data out of the preview, confirm the listing details with me, then POST /api/register ($0.15 via x402/MPP) with the script, previewAnsi, name/description, and my price (or "0" for free). Sales pay the wallet that registers.`,
          },
          {
            label: "No wallet? Publish free (unaudited)",
            text: `Publish my current Claude Code statusline to ${base} without a wallet. Fetch ${base}/skill.md and follow its publish steps: read the statusLine command from ~/.claude/settings.json, capture a preview at my current terminal width (use COLUMNS when set, otherwise tput cols, with 120 only as a non-TTY fallback), sanitize any personal data, confirm the listing details with me, then POST /api/submit (plain HTTP, free, no payment) with the script, previewAnsi, name/description, and tags. Warn me first: the listing will be marked UNAUDITED, has no owner, and is always free until someone funds its $0.15 audit.`,
          },
        ]}
        manual={[
          {
            label: "Register with the agentcash CLI",
            text: `# capture at the current terminal width; 120 is only a non-TTY fallback\nPREVIEW_COLUMNS="\${COLUMNS:-$(tput cols 2>/dev/null || printf 120)}"\nPREVIEW=$(echo '{}' | COLUMNS="$PREVIEW_COLUMNS" ~/.claude/statusline.sh)\n\n# upload it ($0.15 — funds the security audit; authorship comes from your wallet's verified X identity)\nnpx agentcash@latest fetch ${base}/api/register -m POST -b "$(jq -n \\\n  --rawfile script ~/.claude/statusline.sh --arg preview \"$PREVIEW\" \\\n  '{slug: \"my-statusline\", name: \"My Statusline\", description: \"...\", script: $script, previewAnsi: $preview, priceUsd: \"0\", tags: []}')"`,
          },
        ]}
      />
    </div>
  );
}
