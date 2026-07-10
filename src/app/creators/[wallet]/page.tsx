import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { StatuslineEntry } from "@/components/add-to-claude";
import { ListingPreview } from "@/components/terminal-preview";
import { listByWallet } from "@/lib/db/queries";
import { getIdentity } from "@/lib/identity";
import { siteUrl } from "@/lib/site";
import { formatCount, shortWallet } from "@/lib/utils";

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
            <a
              href={`https://x.com/${verified}`}
              target="_blank"
              rel="noreferrer"
              className="text-primary hover:underline"
            >
              @{verified} ✓
            </a>
          </h1>
        ) : (
          <h1 className="font-mono text-2xl font-medium tracking-tight">
            {shortWallet(wallet)}
          </h1>
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
              author={row.author}
              wallet={row.authorWallet}
              installs={`${formatCount(row.installs)} installs`}
              kind={row.kind}
              priceUsd={row.priceUsd}
              base={base}
            >
              <ListingPreview spec={row.spec} previewAnsi={row.previewAnsi} />
            </StatuslineEntry>
          </li>
        ))}
      </ul>
    </div>
  );
}
