import { StatuslineEntry } from "@/components/add-to-claude";
import { ListingPreview } from "@/components/terminal-preview";
import { Input } from "@/components/ui/input";
import { listStatuslines } from "@/lib/db/queries";
import { siteUrl } from "@/lib/site";
import { formatCount } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const rows = await listStatuslines({ q, sort: "installs", limit: 50 });
  const base = siteUrl();

  return (
    <section className="flex flex-col">
      <div className="flex items-center justify-between gap-4 pb-5">
        <h1 className="text-2xl font-medium tracking-tight">
          Statuslines for Claude Code
        </h1>
        <form action="/" className="max-w-55 flex-1">
          <Input name="q" defaultValue={q} placeholder="Search…" />
        </form>
      </div>
      <ul className="flex flex-col gap-3">
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
          {q
            ? `Nothing matches “${q}”.`
            : "Nothing here yet — be the first to submit."}
        </p>
      )}
    </section>
  );
}
