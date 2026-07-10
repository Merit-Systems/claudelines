import Link from "next/link";

import { StatuslineEntry } from "@/components/add-to-claude";
import { ShareButton } from "@/components/share-button";
import { ListingPreview } from "@/components/terminal-preview";
import { listStatuslines, type SortKey } from "@/lib/db/queries";
import { siteUrl } from "@/lib/site";
import { cn, formatCount } from "@/lib/utils";

export const dynamic = "force-dynamic";

const SORTS: { key: SortKey; label: string }[] = [
  { key: "installs", label: "installs" },
  { key: "revenue", label: "revenue" },
];

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string }>;
}) {
  const { sort } = await searchParams;
  const activeSort: SortKey = sort === "revenue" ? "revenue" : "installs";
  const rows = await listStatuslines({ sort: activeSort, limit: 50 });
  const base = siteUrl();

  return (
    <div className="flex flex-col gap-10">
      <section className="flex flex-col gap-4 border-b pb-8 pt-2">
        <h1 className="font-mono text-2xl font-semibold tracking-tight">
          Share and explore Claude Code status lines
        </h1>
        <ShareButton base={base} />
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-baseline justify-end gap-1 font-mono text-xs">
          <span className="text-muted-foreground mr-1">sort by</span>
          {SORTS.map((s) => (
            <Link
              key={s.key}
              href={s.key === "installs" ? "/" : `/?sort=${s.key}`}
              className={cn(
                "border px-2 py-0.5 transition-colors",
                s.key === activeSort
                  ? "bg-foreground text-background border-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {s.label}
            </Link>
          ))}
        </div>
        <ul className="flex flex-col divide-y border">
          {rows.map((row, i) => (
            <li key={row.slug}>
              <StatuslineEntry
                rank={i + 1}
                slug={row.slug}
                name={row.name}
                author={row.author}
                wallet={row.authorWallet}
                installs={
                  activeSort === "revenue"
                    ? `$${Number(row.revenueUsd).toFixed(2)} earned`
                    : `${formatCount(row.installs)} installs`
                }
                kind={row.kind}
                priceUsd={row.priceUsd}
                base={base}
              >
                <ListingPreview spec={row.spec} previewAnsi={row.previewAnsi} />
              </StatuslineEntry>
            </li>
          ))}
        </ul>
        {rows.length === 0 && (
          <p className="text-muted-foreground py-12 text-center text-sm">
            Nothing here yet — be the first to submit.
          </p>
        )}
      </section>
    </div>
  );
}
