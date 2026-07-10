import Link from "next/link";
import { Download } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { StatuslineRow } from "@/components/terminal-preview";
import type { StatuslineRow as Row } from "@/lib/db/schema";
import { formatCount, formatUsd } from "@/lib/utils";

export function StatuslineCard({ row }: { row: Row }) {
  const free = Number(row.priceUsd) === 0;
  return (
    <Link
      href={`/statuslines/${row.slug}`}
      className="group flex flex-col gap-3 rounded-xl border p-4 transition-colors hover:bg-muted/50"
    >
      <div className="rounded-lg bg-[#0d0d0d] px-3 py-3">
        <StatuslineRow spec={row.spec} />
      </div>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-medium">{row.name}</h3>
          <p className="text-muted-foreground truncate text-xs">
            by {row.author}
          </p>
        </div>
        <Badge variant={free ? "secondary" : "success"}>
          {formatUsd(row.priceUsd)}
        </Badge>
      </div>
      <p className="text-muted-foreground line-clamp-2 text-xs">
        {row.description}
      </p>
      <div className="text-muted-foreground flex items-center gap-1 text-xs">
        <Download className="size-3" />
        {formatCount(row.installs)} installs
      </div>
    </Link>
  );
}
