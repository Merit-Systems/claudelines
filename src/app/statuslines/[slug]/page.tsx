import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Download, FileCode2, ShieldCheck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { CopyBlock } from "@/components/copy-block";
import { StatuslineEntry } from "@/components/add-to-claude";
import { FeedbackSection } from "@/components/feedback-section";
import {
  ListingPreview,
  StatuslineRow,
  TerminalPreview,
} from "@/components/terminal-preview";
import { getStatusline, getFeedback } from "@/lib/db/queries";
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
  const isScript = row.kind === "script";
  const feedback = await getFeedback(row.id);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-medium tracking-tight">{row.name}</h1>
          {isScript ? (
            <Badge variant="outline">
              <FileCode2 />
              script · audited
            </Badge>
          ) : (
            <Badge variant="success">
              <ShieldCheck />
              data-only
            </Badge>
          )}
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

      <TerminalPreview spec={row.spec} previewAnsi={row.previewAnsi} />

      {isScript && row.auditSummary && (
        <div className="flex flex-col gap-2 rounded-xl border p-4">
          <div className="flex items-center gap-2 text-sm font-medium">
            <ShieldCheck className="text-primary size-4" />
            Security audit
            {row.auditModel && (
              <span className="text-muted-foreground text-xs font-normal">
                by {row.auditModel}
                {row.auditVerdict === "caution" && " · verdict: caution"}
              </span>
            )}
          </div>
          <p className="text-muted-foreground text-sm leading-relaxed">
            {row.auditSummary}
          </p>
          {row.capabilities.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {row.capabilities.map((c) => (
                <Badge key={c} variant="outline">
                  {c}
                </Badge>
              ))}
            </div>
          )}
          {row.redFlags.length > 0 && (
            <div className="border-destructive/30 bg-destructive/5 flex flex-col gap-1 rounded border p-2.5">
              <p className="text-destructive text-xs font-medium">
                Automated scanner flags
              </p>
              <ul className="text-muted-foreground text-xs">
                {row.redFlags.map((f) => (
                  <li key={f}>— {f}</li>
                ))}
              </ul>
            </div>
          )}
          <p className="text-muted-foreground text-xs">
            Audits are advisory. This script runs on your machine — read it
            before installing.
          </p>
        </div>
      )}

      <StatuslineEntry
        className="border"
        slug={row.slug}
        name={row.name}
        author={row.author}
        wallet={row.authorWallet}
        installs={`${formatCount(row.installs)} installs`}
        kind={row.kind}
        priceUsd={row.priceUsd}
        base={siteUrl()}
      >
        <ListingPreview spec={row.spec} previewAnsi={row.previewAnsi} />
      </StatuslineEntry>

      <FeedbackSection
        slug={row.slug}
        name={row.name}
        base={siteUrl()}
        data={{
          average: feedback.avg,
          count: feedback.count,
          reviews: feedback.reviews.map((r) => ({
            wallet: r.wallet,
            rating: r.rating,
            comment: r.comment,
            at: r.createdAt.toISOString(),
          })),
          reports: feedback.reports.map((r) => ({
            wallet: r.wallet,
            comment: r.comment,
            at: r.createdAt.toISOString(),
          })),
        }}
      />

      {row.spec && (
        <>
          <Separator />
          <section className="flex flex-col gap-3">
            <h2 className="text-sm font-medium">Across sessions</h2>
            <div className="flex flex-col gap-2.5 rounded-xl border border-white/10 bg-[#1a1a1a] px-4 py-4">
              {MOCK_SESSIONS.map((s) => (
                <div key={s.label} className="flex flex-col gap-1">
                  <span className="font-mono text-[10px] text-[#525252]">
                    {s.label}
                  </span>
                  <StatuslineRow spec={row.spec!} vars={s.vars} />
                </div>
              ))}
            </div>
          </section>
        </>
      )}

      {free && row.spec && (
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-medium">The spec (this is all of it)</h2>
          <CopyBlock text={JSON.stringify(row.spec, null, 2)} />
        </section>
      )}

      {free && isScript && row.script && (
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-medium">
            The script — read it before you run it
          </h2>
          <CopyBlock text={row.script} />
        </section>
      )}
    </div>
  );
}
