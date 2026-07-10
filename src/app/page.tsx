import Link from "next/link";
import { ArrowRight, ShieldCheck, Coins, FileJson } from "lucide-react";

import { Button } from "@/components/ui/button";
import { StatuslineCard } from "@/components/statusline-card";
import { StatuslineRow } from "@/components/terminal-preview";
import { getFeatured, listStatuslines } from "@/lib/db/queries";
import { MOCK_SESSIONS } from "@/lib/statusline/mock";
import { formatCount } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [featured, top] = await Promise.all([
    getFeatured(4),
    listStatuslines({ sort: "installs", limit: 5 }),
  ]);
  const hero = featured[0];

  return (
    <>
      <section className="flex flex-col gap-6 pt-4">
        <div className="flex flex-col gap-3">
          <h1 className="max-w-xl text-3xl font-medium tracking-tight">
            The statusline registry for Claude Code
          </h1>
          <p className="text-muted-foreground max-w-lg text-sm">
            Browse, install, and sell statuslines as safe, data-only specs.
            One auditable renderer — installing a statusline never runs
            anyone&apos;s bash.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/statuslines">
            <Button>
              Browse statuslines
              <ArrowRight data-icon="inline-end" />
            </Button>
          </Link>
          <Link href="/docs">
            <Button variant="outline">How it works</Button>
          </Link>
        </div>

        {hero && (
          <div className="overflow-hidden rounded-xl border border-white/10 bg-[#0d0d0d]">
            <div className="flex items-center gap-1.5 border-b border-white/5 px-3 py-2.5">
              <span className="size-2.5 rounded-full bg-[#ff5f57]" />
              <span className="size-2.5 rounded-full bg-[#febc2e]" />
              <span className="size-2.5 rounded-full bg-[#28c840]" />
              <span className="ml-2 font-mono text-[11px] text-[#525252]">
                {hero.slug} — the same spec, three sessions
              </span>
            </div>
            <div className="flex flex-col gap-2.5 px-4 py-4">
              {MOCK_SESSIONS.map((s) => (
                <StatuslineRow key={s.label} spec={hero.spec} vars={s.vars} />
              ))}
            </div>
          </div>
        )}
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        {[
          {
            icon: ShieldCheck,
            title: "Data, not code",
            body: "A statusline is a JSON spec — colors, segments, variables. One open-source renderer interprets it locally. Nothing from the registry executes.",
          },
          {
            icon: FileJson,
            title: "Install in seconds",
            body: "Two files land in ~/.claude/statuslines: the renderer (once) and the spec. Your agent can do it, or copy two commands.",
          },
          {
            icon: Coins,
            title: "Publish & sell",
            body: "Agents register statuslines for $0.01 via x402/MPP. Set your price and buyers pay your wallet directly.",
          },
        ].map((f) => (
          <div
            key={f.title}
            className="flex flex-col gap-2 rounded-xl border p-4"
          >
            <f.icon className="text-primary size-4" />
            <h3 className="text-sm font-medium">{f.title}</h3>
            <p className="text-muted-foreground text-xs leading-relaxed">
              {f.body}
            </p>
          </div>
        ))}
      </section>

      <section className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium">Featured</h2>
          <Link
            href="/statuslines"
            className="text-muted-foreground hover:text-foreground text-sm"
          >
            View all →
          </Link>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {featured.map((row) => (
            <StatuslineCard key={row.slug} row={row} />
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium">Leaderboard</h2>
          <Link
            href="/leaderboard"
            className="text-muted-foreground hover:text-foreground text-sm"
          >
            Full ranking →
          </Link>
        </div>
        <ul>
          {top.map((row, i) => (
            <li
              key={row.slug}
              className="relative isolate border-b transition-colors before:pointer-events-none before:absolute before:-top-px before:-right-4 before:-bottom-px before:-left-4 before:-z-10 before:rounded-lg before:border before:border-transparent before:bg-transparent before:transition-colors before:content-[''] last:border-0 hover:before:border-border hover:before:bg-muted/50"
            >
              <Link
                href={`/statuslines/${row.slug}`}
                className="flex min-w-0 items-center gap-4 py-2.5 outline-none"
              >
                <span className="text-muted-foreground w-5 text-right font-mono text-xs">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-sm">{row.name}</h3>
                  <p className="text-muted-foreground truncate text-xs">
                    by {row.author}
                  </p>
                </div>
                <span className="text-muted-foreground shrink-0 font-mono text-xs">
                  {formatCount(row.installs)} installs
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
