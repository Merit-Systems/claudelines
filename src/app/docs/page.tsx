import type { Metadata } from "next";
import { ShieldCheck, FileJson, Coins, Terminal } from "lucide-react";

import { CopyBlock } from "@/components/copy-block";
import { Separator } from "@/components/ui/separator";
import { TerminalPreview } from "@/components/terminal-preview";
import { STATUSLINE_VARIABLES } from "@/lib/statusline/spec";
import { siteUrl } from "@/lib/site";

export const metadata: Metadata = {
  title: "Docs",
  description:
    "How statuslines.dev keeps installs safe, and how to publish and sell statuslines to agents.",
};

const EXAMPLE_SPEC = {
  version: 1 as const,
  powerline: true,
  segments: [
    { text: "{model}", fg: "#052e16", bg: "#4ade80", bold: true },
    { text: "{dir}", fg: "#e5e5e5", bg: "#262626" },
    { text: " {gitBranch}", fg: "#a3a3a3", bg: "#171717", when: "gitBranch" as const },
    { text: "{cost}", fg: "#4ade80", bg: "#0a0a0a", bold: true },
  ],
};

export default function DocsPage() {
  const base = siteUrl();

  return (
    <div className="flex flex-col gap-10">
      <div className="flex flex-col gap-1.5">
        <h1 className="text-3xl font-medium tracking-tight">Docs</h1>
        <p className="text-muted-foreground text-sm">
          The safety model, the install flow, and how to sell statuslines to
          agents.
        </p>
      </div>

      {/* ------------------------------------------------ safety model */}
      <section className="flex flex-col gap-4" id="safety">
        <div className="flex items-center gap-2">
          <ShieldCheck className="text-primary size-4" />
          <h2 className="text-lg font-medium">Statuslines are data, not code</h2>
        </div>
        <p className="text-muted-foreground text-sm leading-relaxed">
          A Claude Code statusline is normally an arbitrary command that runs
          on your machine every second — which makes &ldquo;install this cool
          statusline&rdquo; a supply-chain problem. This registry removes the
          problem instead of asking you to trust it — with two tiers. A{" "}
          <strong>data-only spec</strong> is JSON (segments, colors, variables)
          interpreted by one open-source renderer: nothing to trust, nothing to
          review. A <strong>script</strong> is an existing statusline uploaded
          as-is: it runs on your machine, so every script is security-audited
          by Opus at registration (the $0.50 fee pays for it), labeled with its
          capabilities, and installed behind a read-it-first gate.
        </p>
        <ul className="text-muted-foreground flex flex-col gap-2 text-sm">
          {[
            "Specs cannot contain code, shell, or escape sequences — the schema rejects control characters and unknown variables, both at registration and again locally at render time.",
            "The renderer is a single dependency-free file (~250 lines) you install once and can read in one sitting. It never evaluates spec content.",
            "It runs at most two subprocesses, both hardcoded git commands (no shell, 500 ms timeouts): branch --show-current and status --porcelain — and only when a spec uses {gitBranch} or {gitDirty}.",
            "Installing a new statusline just writes a JSON file. Nothing new executes.",
          ].map((t) => (
            <li key={t} className="flex gap-2">
              <span className="text-primary">—</span>
              <span>{t}</span>
            </li>
          ))}
        </ul>
        <p className="text-muted-foreground text-sm">
          Audit the renderer yourself:{" "}
          <a
            href="/render.mjs"
            className="text-foreground font-mono text-xs underline underline-offset-2"
          >
            {base}/render.mjs
          </a>
        </p>
      </section>

      <Separator />

      {/* ------------------------------------------------ spec format */}
      <section className="flex flex-col gap-4" id="spec">
        <div className="flex items-center gap-2">
          <FileJson className="text-primary size-4" />
          <h2 className="text-lg font-medium">The spec format</h2>
        </div>
        <p className="text-muted-foreground text-sm">
          Up to 16 segments, each with template text, optional{" "}
          <span className="font-mono text-xs">#rrggbb</span> colors and
          bold/dim/italic flags, joined plainly or as a powerline. A{" "}
          <span className="font-mono text-xs">when</span> field hides a segment
          if its variable is empty, and{" "}
          <span className="font-mono text-xs">newline</span> starts a second
          row — Claude Code supports multi-line statuslines.
        </p>
        <CopyBlock text={JSON.stringify(EXAMPLE_SPEC, null, 2)} />
        <TerminalPreview spec={EXAMPLE_SPEC} />
        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-medium">Variables</h3>
          <div className="grid gap-x-6 gap-y-1.5 rounded-xl border p-4 sm:grid-cols-2">
            {Object.entries(STATUSLINE_VARIABLES).map(([name, desc]) => (
              <div key={name} className="flex items-baseline gap-2 text-sm">
                <span className="text-primary shrink-0 font-mono text-xs">
                  {"{" + name + "}"}
                </span>
                <span className="text-muted-foreground text-xs">{desc}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <Separator />

      {/* ------------------------------------------------ install */}
      <section className="flex flex-col gap-4" id="install">
        <div className="flex items-center gap-2">
          <Terminal className="text-primary size-4" />
          <h2 className="text-lg font-medium">Installing</h2>
        </div>
        <p className="text-muted-foreground text-sm">
          Two files, both readable: the renderer (once) and a spec. Free specs
          download directly; every statusline page has the exact commands.
        </p>
        <CopyBlock
          label="One-time renderer install"
          text={`mkdir -p ~/.claude/statuslines\ncurl -fsSL ${base}/render.mjs -o ~/.claude/statuslines/render.mjs`}
        />
        <CopyBlock
          label="Then per statusline (example: merit-line)"
          text={`curl -fsSL ${base}/api/statuslines/merit-line/spec -o ~/.claude/statuslines/merit-line.json`}
        />
        <CopyBlock
          label="Point Claude Code at it (~/.claude/settings.json)"
          text={JSON.stringify(
            {
              statusLine: {
                type: "command",
                command:
                  "node ~/.claude/statuslines/render.mjs ~/.claude/statuslines/merit-line.json",
              },
            },
            null,
            2,
          )}
        />
        <p className="text-muted-foreground text-sm">
          Or ask your agent to do it — this site publishes{" "}
          <a href="/llms.txt" className="font-mono text-xs underline underline-offset-2">
            /llms.txt
          </a>{" "}
          and{" "}
          <a href="/openapi.json" className="font-mono text-xs underline underline-offset-2">
            /openapi.json
          </a>{" "}
          so agents can browse, buy, and install on their own.
        </p>
      </section>

      <Separator />

      {/* ------------------------------------------------ sell */}
      <section className="flex flex-col gap-4" id="sell">
        <div className="flex items-center gap-2">
          <Coins className="text-primary size-4" />
          <h2 className="text-lg font-medium">Publishing &amp; selling</h2>
        </div>
        <p className="text-muted-foreground text-sm leading-relaxed">
          Registration is agent-native and priced by tier:{" "}
          <span className="text-foreground font-medium">$0.01</span> for
          data-only specs,{" "}
          <span className="text-foreground font-medium">$0.50</span> for
          scripts (the fee funds the Opus security audit — rejected scripts
          aren\u2019t listed and the fee bought the audit). Both settle over{" "}
          <a href="https://agentcash.dev" className="underline underline-offset-2">
            x402/MPP
          </a>
          . Set <span className="font-mono text-xs">priceUsd</span> to
          &ldquo;0&rdquo; for a free listing, or up to $25 to sell — buyers pay
          your <span className="font-mono text-xs">payoutAddress</span>{" "}
          directly, on-chain, with no platform cut.
        </p>
        <CopyBlock
          label="Ask your agent to publish"
          text={`Publish my statusline to ${base} — fetch ${base}/llms.txt, then POST /api/register ($0.01 via x402/MPP) with my spec, priceUsd "0.10", and my payout wallet.`}
        />
        <CopyBlock
          label="Or the raw request"
          text={`POST ${base}/api/register\n${JSON.stringify(
            {
              slug: "neon-nights",
              name: "Neon Nights",
              description: "Synthwave purple-to-cyan powerline with cost tracking.",
              priceUsd: "0.10",
              author: "you",
              payoutAddress: "0xYourWallet…",
              tags: ["powerline", "synthwave"],
              spec: { version: 1, segments: ["…"] },
            },
            null,
            2,
          )}`}
        />
        <p className="text-muted-foreground text-sm">
          Payments settle on Base (x402) or Tempo (MPP). Discovery is spec-based
          — this registry is indexed by agentcash.dev, x402scan, and mppscan, so
          any funded agent can find and buy from it.
        </p>
      </section>
    </div>
  );
}
