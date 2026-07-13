import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Download, ShieldAlert, ShieldCheck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ClaimButton } from "@/components/claim-button";
import { CopyBlock } from "@/components/copy-block";
import { StatuslineEntry } from "@/components/add-to-claude";
import { FeedbackSection } from "@/components/feedback-section";
import { ListingPreview, TerminalPreview } from "@/components/terminal-preview";
import { XAuthor } from "@/components/x-author";
import { getStatusline, getFeedback } from "@/lib/db/queries";
import { siteUrl } from "@/lib/site";
import { displayAuthor, formatCount, formatUsd } from "@/lib/utils";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const row = await getStatusline(slug);
  if (!row || row.hidden || row.archived) return {};
  return { description: row.description };
}

export default async function StatuslinePage({ params }: Props) {
  const { slug } = await params;
  const row = await getStatusline(slug);
  if (!row || row.hidden || row.archived) notFound();

  const free = Number(row.priceUsd) === 0;
  const feedback = await getFeedback(row.id);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-medium tracking-tight">{row.name}</h1>
          {row.auditVerdict === "approve" && (
            <Badge variant="success">
              <ShieldCheck />
              audited
            </Badge>
          )}
          {row.auditVerdict === "caution" && (
            <Badge variant="outline">audited · caution</Badge>
          )}
          {!row.auditVerdict && (
            <Badge variant="destructive">
              <ShieldAlert />
              unaudited
            </Badge>
          )}
          <Badge variant={free ? "secondary" : "success"}>
            {formatUsd(row.priceUsd)}
          </Badge>
        </div>
        <p className="text-muted-foreground text-sm">{row.description}</p>
        <div className="text-muted-foreground flex flex-wrap items-center gap-4 text-xs">
          <span className="inline-flex items-center gap-1.5">
            by{" "}
            {row.authorHandle ? (
              <XAuthor
                handle={row.authorHandle}
                avatarUrl={row.authorAvatarUrl}
              />
            ) : (
              "anonymous"
            )}
          </span>
          <span className="inline-flex items-center gap-1">
            <Download className="size-3" />
            {formatCount(row.installs)} installs
          </span>
          {row.tags.map((t) => (
            <Badge key={t} variant="outline">
              {t}
            </Badge>
          ))}
          {!row.authorHandle && <ClaimButton base={siteUrl()} />}
        </div>
      </div>

      <TerminalPreview previewAnsi={row.previewAnsi} previewFrames={row.previewFrames} />

      {!row.auditSummary && (
        <div className="border-destructive/40 bg-destructive/5 flex flex-col gap-2 rounded-xl border p-4">
          <div className="text-destructive flex items-center gap-2 text-sm font-medium">
            <ShieldAlert className="size-4" />
            This script has NOT been security audited
          </div>
          <p className="text-muted-foreground text-sm leading-relaxed">
            It was published without a wallet, so no LLM security review ever
            ran and nobody owns or vouches for it. It executes on your machine
            with your full user privileges — <strong>read every line before
            installing</strong>. The automated scanner found no high-severity
            patterns, but that is a much weaker check than an audit.
          </p>
          {row.capabilities.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {row.capabilities.map((c) => (
                <Badge key={c} variant="outline">
                  {c}
                </Badge>
              ))}
            </div>
          )}
          {row.redFlags.length > 0 && (
            <ul className="text-muted-foreground text-xs">
              {row.redFlags.map((f) => (
                <li key={f}>— {f}</li>
              ))}
            </ul>
          )}
          <p className="text-muted-foreground text-xs font-medium">
            Anyone can fund the audit ($0.15) — ask Claude Code:
          </p>
          <CopyBlock
            text={`Fund a security audit of the "${row.name}" statusline on ${siteUrl()}. POST ${siteUrl()}/api/audit with {"slug": "${row.slug}"} paying $0.15 via x402/MPP, then tell me the verdict, summary, and risks. A rejected audit delists the script.`}
          />
        </div>
      )}

      {row.auditSummary && (
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
        unaudited={!row.auditVerdict}
        slug={row.slug}
        name={row.name}
        author={displayAuthor(row.authorHandle)}
        avatarUrl={row.authorAvatarUrl}
        wallet={row.authorWallet}
        installs={`${formatCount(row.installs)} installs`}
        priceUsd={row.priceUsd}
        base={siteUrl()}
      >
        <ListingPreview previewAnsi={row.previewAnsi} previewFrames={row.previewFrames} />
      </StatuslineEntry>

      {free && row.script && (
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-medium">
            The script — read it before you run it
          </h2>
          <CopyBlock text={row.script} />
        </section>
      )}

      {free && row.files && row.files.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-medium">
            Companion command files — read them before you install them
          </h2>
          <p className="text-muted-foreground text-xs leading-relaxed">
            These are Claude Code slash-command files that install to
            ~/.claude/commands/. Each one is a prompt your agent executes with
            your full tool access — audited together with the script, but read
            every file yourself before saving it.
          </p>
          {row.files.map((f) => (
            <details key={f.path} className="rounded-lg border">
              <summary className="text-muted-foreground hover:text-foreground cursor-pointer px-3 py-2 font-mono text-xs">
                {f.path}
              </summary>
              <div className="border-t p-3">
                <CopyBlock text={f.content} />
              </div>
            </details>
          ))}
        </section>
      )}

      <Separator />

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
    </div>
  );
}
