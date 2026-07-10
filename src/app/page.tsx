import Link from "next/link";
import { Download, ShieldCheck, FileCode2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { AddToClaude } from "@/components/add-to-claude";
import { SubmitCta } from "@/components/submit-cta";
import { ListingPreview, TerminalPreview } from "@/components/terminal-preview";
import { listStatuslines } from "@/lib/db/queries";
import { siteUrl } from "@/lib/site";
import { formatCount, formatUsd } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const rows = await listStatuslines({ sort: "installs", limit: 50 });
  const hero = rows.find((r) => r.slug === "merit-line") ?? rows[0];
  const base = siteUrl();

  return (
    <>
      <section className="flex flex-col gap-6 pt-2">
        <div className="flex flex-col gap-3">
          <h1 className="max-w-xl text-3xl font-medium tracking-tight">
            Statuslines for Claude Code
          </h1>
          <p className="text-muted-foreground max-w-lg text-sm">
            Upload your statusline as-is — every script is security-audited by
            Opus at registration — or ship a data-only spec that installs with
            zero trust. Sell at your price; buyers pay your wallet directly
            over x402/MPP.
          </p>
        </div>
        <SubmitCta base={base} />
        {hero && (
          <TerminalPreview spec={hero.spec} previewAnsi={hero.previewAnsi} />
        )}
      </section>

      <section className="flex flex-col gap-4">
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg font-medium">Leaderboard</h2>
          <p className="text-muted-foreground text-xs">
            ranked by installs · revenue goes to creators
          </p>
        </div>
        <ul className="flex flex-col">
          {rows.map((row, i) => (
            <li
              key={row.slug}
              className="flex flex-col gap-3 border-b py-4 last:border-0"
            >
              <div className="flex items-center gap-3">
                <span className="text-muted-foreground w-6 shrink-0 text-right font-mono text-xs">
                  {i + 1}
                </span>
                <Link
                  href={`/statuslines/${row.slug}`}
                  className="min-w-0 flex-1"
                >
                  <span className="text-sm font-medium hover:underline">
                    {row.name}
                  </span>
                  <span className="text-muted-foreground ml-2 text-xs">
                    by {row.author}
                  </span>
                </Link>
                {row.kind === "spec" ? (
                  <Badge variant="success">
                    <ShieldCheck />
                    data-only
                  </Badge>
                ) : (
                  <Badge variant="outline">
                    <FileCode2 />
                    script · audited
                  </Badge>
                )}
                <span className="text-muted-foreground inline-flex shrink-0 items-center gap-1 font-mono text-xs">
                  <Download className="size-3" />
                  {formatCount(row.installs)}
                </span>
                <Badge
                  variant={Number(row.priceUsd) === 0 ? "secondary" : "success"}
                >
                  {formatUsd(row.priceUsd)}
                </Badge>
              </div>
              <div className="ml-9 rounded-lg bg-[#0d0d0d] px-3 py-2.5">
                <ListingPreview spec={row.spec} previewAnsi={row.previewAnsi} />
              </div>
              <AddToClaude
                className="ml-9 items-start"
                slug={row.slug}
                name={row.name}
                kind={row.kind}
                priceUsd={row.priceUsd}
                base={base}
              />
            </li>
          ))}
        </ul>
        {rows.length === 0 && (
          <p className="text-muted-foreground py-12 text-center text-sm">
            Nothing here yet — be the first to submit.
          </p>
        )}
      </section>
    </>
  );
}
