import { StatuslineEntry } from "@/components/add-to-claude";
import { ListingPreview } from "@/components/terminal-preview";
import { listStatuslines } from "@/lib/db/queries";
import { siteUrl } from "@/lib/site";
import { formatCount } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const rows = await listStatuslines({ sort: "installs", limit: 50 });
  const base = siteUrl();

  return (
    <div className="flex flex-col gap-10">
      {/* hero — placeholder copy for now */}
      <section className="flex flex-col gap-3 border-b pb-8 pt-2">
        <h1 className="font-mono text-2xl font-semibold tracking-tight">
          Share your Claude Code status line
        </h1>
        <p className="text-muted-foreground max-w-lg font-mono text-sm">
          {"// the bar at the bottom of your Claude Code. browse, add, sell."}
        </p>
      </section>

      <section className="flex flex-col gap-3">
        <ul className="flex flex-col divide-y border">
          {rows.map((row, i) => (
            <li key={row.slug}>
              <StatuslineEntry
                rank={i + 1}
                slug={row.slug}
                name={row.name}
                author={row.author}
                installs={formatCount(row.installs)}
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
