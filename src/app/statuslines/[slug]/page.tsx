import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Download, Bot } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { CopyBlock } from "@/components/copy-block";
import { TerminalPreview, StatuslineRow } from "@/components/terminal-preview";
import { getStatusline } from "@/lib/db/queries";
import { MOCK_SESSIONS } from "@/lib/statusline/mock";
import { siteUrl } from "@/lib/site";
import { formatCount, formatUsd } from "@/lib/utils";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const row = await getStatusline(slug);
  if (!row) return { title: "Not found" };
  return { title: row.name, description: row.description };
}

export default async function StatuslinePage({ params }: Props) {
  const { slug } = await params;
  const row = await getStatusline(slug);
  if (!row) notFound();

  const free = Number(row.priceUsd) === 0;
  const base = siteUrl();

  const freeInstall = [
    `mkdir -p ~/.claude/statuslines`,
    `curl -fsSL ${base}/render.mjs -o ~/.claude/statuslines/render.mjs`,
    `curl -fsSL ${base}/api/statuslines/${row.slug}/spec -o ~/.claude/statuslines/${row.slug}.json`,
  ].join("\n");

  const settingsSnippet = JSON.stringify(
    {
      statusLine: {
        type: "command",
        command: `node ~/.claude/statuslines/render.mjs ~/.claude/statuslines/${row.slug}.json`,
      },
    },
    null,
    2,
  );

  const agentPrompt = free
    ? `Install the "${row.name}" statusline from ${base}/statuslines/${row.slug} — fetch ${base}/llms.txt and follow the install instructions. It's a data-only spec: download the spec JSON and the auditable renderer, never run registry code.`
    : `Buy and install the "${row.name}" statusline (${formatUsd(row.priceUsd)}) from ${base} — fetch ${base}/llms.txt, then POST /api/download with {"slug": "${row.slug}"} paying via x402/MPP, and follow the returned install instructions.`;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-medium tracking-tight">{row.name}</h1>
          <Badge variant={free ? "secondary" : "success"}>
            {formatUsd(row.priceUsd)}
          </Badge>
        </div>
        <p className="text-muted-foreground text-sm">{row.description}</p>
        <div className="text-muted-foreground flex flex-wrap items-center gap-4 text-xs">
          <span>by {row.author}</span>
          <span className="inline-flex items-center gap-1">
            <Download className="size-3" />
            {formatCount(row.installs)} installs
          </span>
          {row.tags.map((t) => (
            <Badge key={t} variant="outline">
              {t}
            </Badge>
          ))}
        </div>
      </div>

      <TerminalPreview spec={row.spec} />

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium">Across sessions</h2>
        <div className="flex flex-col gap-2.5 rounded-xl border border-white/10 bg-[#0d0d0d] px-4 py-4">
          {MOCK_SESSIONS.map((s) => (
            <div key={s.label} className="flex flex-col gap-1">
              <span className="font-mono text-[10px] text-[#525252]">
                {s.label}
              </span>
              <StatuslineRow spec={row.spec} vars={s.vars} />
            </div>
          ))}
        </div>
      </section>

      <Separator />

      <section className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-medium">Install</h2>
          <p className="text-muted-foreground text-sm">
            No <span className="font-mono text-xs">curl | bash</span>. The spec
            is inert JSON; the renderer is one auditable file you install once.
          </p>
        </div>

        {free ? (
          <>
            <CopyBlock
              label="1 — Download the renderer (once) and the spec"
              text={freeInstall}
            />
            <CopyBlock
              label="2 — Point Claude Code at it (~/.claude/settings.json)"
              text={settingsSnippet}
            />
          </>
        ) : (
          <div className="flex flex-col gap-2 rounded-xl border p-4">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Bot className="text-primary size-4" />
              Purchase via your agent
            </div>
            <p className="text-muted-foreground text-sm">
              This statusline costs {formatUsd(row.priceUsd)}, paid directly to
              the creator&apos;s wallet over x402/MPP. Any agent with{" "}
              <a
                href="https://agentcash.dev"
                className="underline underline-offset-2"
              >
                agentcash
              </a>{" "}
              (or another x402 client) can buy it:
            </p>
            <CopyBlock text={`POST ${base}/api/download\n{"slug": "${row.slug}"}`} />
          </div>
        )}

        <CopyBlock label="Or just ask your agent" text={agentPrompt} />
      </section>

      {free && (
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-medium">The spec (this is all of it)</h2>
          <CopyBlock text={JSON.stringify(row.spec, null, 2)} />
        </section>
      )}
    </div>
  );
}
