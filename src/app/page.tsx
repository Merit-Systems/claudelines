import Link from "next/link";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";

import { StatuslineEntry } from "@/components/add-to-claude";
import { ClaudeCodeMark } from "@/components/claude-code-mark";
import { ShareButton } from "@/components/share-button";
import { ListingPreview } from "@/components/terminal-preview";
import {
  listStatuslines,
  type SortDirection,
  type SortKey,
} from "@/lib/db/queries";
import { siteUrl } from "@/lib/site";
import { displayAuthor, formatCount } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string; direction?: string }>;
}) {
  const { sort, direction } = await searchParams;
  const activeSort: SortKey = sort === "revenue" ? "revenue" : "installs";
  const activeDirection: SortDirection =
    direction === "asc" ? "asc" : "desc";
  const rows = await listStatuslines({
    sort: activeSort,
    direction: activeDirection,
    limit: 50,
  });
  const base = siteUrl();

  const sortControl = (key: Extract<SortKey, "installs" | "revenue">) => {
    const nextDirection =
      key === activeSort && activeDirection === "desc" ? "asc" : "desc";
    const Icon =
      key !== activeSort
        ? ArrowUpDown
        : activeDirection === "asc"
          ? ArrowUp
          : ArrowDown;

    return (
      <Link
        href={`/?sort=${key}&direction=${nextDirection}`}
        className="hover:text-foreground flex items-center justify-end gap-1 transition-colors"
        aria-label={`Sort by ${key}, ${nextDirection}ending`}
      >
        <span>{key === "installs" ? "Installs" : "Revenue"}</span>
        <Icon
          className={key === activeSort ? "size-3" : "size-3 opacity-40"}
          aria-hidden
        />
      </Link>
    );
  };

  return (
    <div className="flex flex-col gap-10">
      <section className="flex flex-col gap-4 pb-8 pt-2">
        <div className="flex max-w-2xl flex-col gap-2">
          <h1 className="font-mono text-4xl font-semibold tracking-tight sm:text-5xl">
            Share and explore status lines for{" "}
            <span className="text-primary">Claude Code</span>
            <ClaudeCodeMark className="ml-2 inline-block size-[0.8em] align-[-0.08em]" />
          </h1>
          <p className="text-muted-foreground text-sm leading-6">
            ClaudeLines is a registry of customizable bars that sit at the
            bottom of Claude Code and keep context usage, costs, Git status,
            and more visible while you work. Explore community-built status
            lines and install one with a single prompt. {" "}
            <a
              href="https://code.claude.com/docs/en/statusline"
              target="_blank"
              rel="noreferrer"
              className="text-foreground underline underline-offset-4 transition-colors hover:text-primary"
            >
              Learn how status lines work
            </a>
            .
          </p>
        </div>
        <ShareButton base={base} />
      </section>

      <section className="flex flex-col gap-3">
        <div>
          <div className="text-muted-foreground grid grid-cols-[1rem_minmax(0,1fr)_4.5rem_5.5rem] items-center gap-2 border border-b-0 bg-muted/30 px-3 py-2 font-mono text-[11px] sm:grid-cols-[1rem_minmax(0,1fr)_5.5rem_6.5rem_7.5rem]">
            <span className="text-right">#</span>
            <span>Status line</span>
            {sortControl("installs")}
            {sortControl("revenue")}
            <span className="hidden sm:block" aria-hidden />
          </div>
          <ul className="flex flex-col divide-y border">
            {rows.map((row, i) => (
              <li key={row.slug}>
                <StatuslineEntry
                  rank={i + 1}
                  defaultCc={i === 0}
                  slug={row.slug}
                  name={row.name}
                  author={displayAuthor(row.authorHandle)}
                  avatarUrl={row.authorAvatarUrl}
                  wallet={row.authorWallet}
                  installs={formatCount(row.installs)}
                  revenue={`$${Number(row.revenueUsd).toFixed(2)}`}
                  priceUsd={row.priceUsd}
                  base={base}
                >
                  <ListingPreview previewAnsi={row.previewAnsi} previewFrames={row.previewFrames} />
                </StatuslineEntry>
              </li>
            ))}
          </ul>
        </div>
        {rows.length === 0 && (
          <p className="text-muted-foreground py-12 text-center text-sm">
            Nothing here yet — be the first to submit.
          </p>
        )}
      </section>
    </div>
  );
}
