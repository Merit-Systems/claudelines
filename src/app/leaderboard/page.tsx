import type { Metadata } from "next";
import Link from "next/link";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { StatuslineRow } from "@/components/terminal-preview";
import { listStatuslines } from "@/lib/db/queries";
import { formatCount, formatUsd } from "@/lib/utils";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Leaderboard",
  description: "Top Claude Code statuslines by installs and revenue.",
};

export default async function LeaderboardPage() {
  const rows = await listStatuslines({ sort: "installs", limit: 50 });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1.5">
        <h1 className="text-3xl font-medium tracking-tight">Leaderboard</h1>
        <p className="text-muted-foreground text-sm">
          Ranked by installs. Revenue is paid straight to creators&apos;
          wallets.
        </p>
      </div>

      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="w-10">#</TableHead>
            <TableHead>Statusline</TableHead>
            <TableHead className="hidden sm:table-cell">Preview</TableHead>
            <TableHead className="text-right">Price</TableHead>
            <TableHead className="text-right">Installs</TableHead>
            <TableHead className="text-right">Revenue</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row, i) => (
            <TableRow key={row.slug}>
              <TableCell className="text-muted-foreground font-mono text-xs">
                {i + 1}
              </TableCell>
              <TableCell>
                <Link
                  href={`/statuslines/${row.slug}`}
                  className="flex flex-col gap-0.5"
                >
                  <span className="text-sm font-medium hover:underline">
                    {row.name}
                  </span>
                  <span className="text-muted-foreground text-xs">
                    by {row.author}
                  </span>
                </Link>
              </TableCell>
              <TableCell className="hidden max-w-70 sm:table-cell">
                <div className="rounded-md bg-[#0d0d0d] px-2 py-1">
                  <StatuslineRow
                    spec={row.spec}
                    className="text-[10px]"
                  />
                </div>
              </TableCell>
              <TableCell className="text-right">
                <Badge
                  variant={Number(row.priceUsd) === 0 ? "secondary" : "success"}
                >
                  {formatUsd(row.priceUsd)}
                </Badge>
              </TableCell>
              <TableCell className="text-right font-mono text-xs">
                {formatCount(row.installs)}
              </TableCell>
              <TableCell className="text-muted-foreground text-right font-mono text-xs">
                ${Number(row.revenueUsd).toFixed(2)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
