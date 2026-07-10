import type { Metadata } from "next";

import { StatuslineCard } from "@/components/statusline-card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { listStatuslines, type SortKey } from "@/lib/db/queries";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Browse",
  description: "Browse Claude Code statuslines.",
};

const SORTS: { key: SortKey; label: string }[] = [
  { key: "installs", label: "Popular" },
  { key: "newest", label: "Newest" },
  { key: "revenue", label: "Top earning" },
];

export default async function BrowsePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; sort?: string }>;
}) {
  const { q, sort } = await searchParams;
  const activeSort: SortKey = (["installs", "newest", "revenue"] as const).includes(
    sort as SortKey,
  )
    ? (sort as SortKey)
    : "installs";

  const rows = await listStatuslines({ q, sort: activeSort });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1.5">
        <h1 className="text-3xl font-medium tracking-tight">Browse</h1>
        <p className="text-muted-foreground text-sm">
          {rows.length} statusline{rows.length === 1 ? "" : "s"} in the registry
        </p>
      </div>

      <form className="flex flex-wrap items-center gap-2" action="/statuslines">
        <Input
          name="q"
          defaultValue={q}
          placeholder="Search statuslines…"
          className="max-w-xs"
        />
        {activeSort !== "installs" && (
          <input type="hidden" name="sort" value={activeSort} />
        )}
        <Button type="submit" variant="outline" size="default">
          Search
        </Button>
        <div className="ml-auto flex items-center gap-1">
          {SORTS.map((s) => (
            <a
              key={s.key}
              href={`/statuslines?${new URLSearchParams({
                ...(q ? { q } : {}),
                ...(s.key !== "installs" ? { sort: s.key } : {}),
              })}`}
              className={
                s.key === activeSort
                  ? "bg-secondary rounded-lg px-2.5 py-1 text-sm font-medium"
                  : "text-muted-foreground hover:text-foreground rounded-lg px-2.5 py-1 text-sm transition-colors"
              }
            >
              {s.label}
            </a>
          ))}
        </div>
      </form>

      {rows.length === 0 ? (
        <p className="text-muted-foreground py-12 text-center text-sm">
          No statuslines found.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {rows.map((row) => (
            <StatuslineCard key={row.slug} row={row} />
          ))}
        </div>
      )}
    </div>
  );
}
