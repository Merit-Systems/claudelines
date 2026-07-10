import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { StatuslineEntry } from "@/components/add-to-claude";
import { ClaimButton } from "@/components/claim-button";
import { ListingPreview } from "@/components/terminal-preview";
import { XAuthor } from "@/components/x-author";
import { listByWallet } from "@/lib/db/queries";
import { getIdentity } from "@/lib/identity";
import { siteUrl } from "@/lib/site";
import { displayAuthor, formatCount, shortWallet } from "@/lib/utils";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ wallet: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { wallet } = await params;
  return { title: `Creator ${shortWallet(wallet)}` };
}

export default async function CreatorPage({ params }: Props) {
  const { wallet } = await params;
  if (!/^0x[0-9a-fA-F]{40}$/.test(wallet)) notFound();

  const [rows, identity] = await Promise.all([
    listByWallet(wallet),
    getIdentity(wallet),
  ]);
  if (rows.length === 0) notFound();

  const verified = identity?.verified ? identity.twitterHandle : null;
  const base = siteUrl();
  const totalInstalls = rows.reduce((n, r) => n + r.installs, 0);
  const totalRevenue = rows.reduce((n, r) => n + Number(r.revenueUsd), 0);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        {verified ? (
          <h1 className="text-2xl font-medium tracking-tight">
            <XAuthor
              handle={verified}
              avatarUrl={identity?.twitterAvatarUrl}
              size={28}
              className="gap-2.5"
            />
          </h1>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-mono text-2xl font-medium tracking-tight">
              {shortWallet(wallet)}
            </h1>
            <ClaimButton base={base} />
          </div>
        )}
        <p className="text-muted-foreground font-mono text-xs">
          {rows.length} statusline{rows.length === 1 ? "" : "s"} ·{" "}
          {formatCount(totalInstalls)} installs · ${totalRevenue.toFixed(2)}{" "}
          earned
          {!verified && " · identity unverified"}
        </p>
      </div>

      <ul className="flex flex-col divide-y border">
        {rows.map((row) => (
          <li key={row.slug}>
            <StatuslineEntry
              slug={row.slug}
              name={row.name}
              author={displayAuthor(row.authorHandle)}
              avatarUrl={row.authorAvatarUrl}
              wallet={row.authorWallet}
              installs={`${formatCount(row.installs)} installs`}
              priceUsd={row.priceUsd}
              base={base}
            >
              <ListingPreview previewAnsi={row.previewAnsi} />
            </StatuslineEntry>
          </li>
        ))}
      </ul>
    </div>
  );
}
