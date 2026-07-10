"use client";

import { useState } from "react";
import { Flag, Star } from "lucide-react";

import { CopyBlock } from "@/components/copy-block";
import { cn, shortWallet } from "@/lib/utils";

export interface FeedbackData {
  average: number | null;
  count: number;
  reviews: { wallet: string; rating: number | null; comment: string | null; at: string }[];
  reports: { wallet: string; comment: string | null; at: string }[];
}

function Stars({ n, className }: { n: number; className?: string }) {
  return (
    <span className={cn("inline-flex", className)}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={cn(
            "size-3.5",
            i <= Math.round(n)
              ? "fill-primary text-primary"
              : "text-muted-foreground/40",
          )}
        />
      ))}
    </span>
  );
}

export function FeedbackSection({
  slug,
  name,
  base,
  data,
}: {
  slug: string;
  name: string;
  base: string;
  data: FeedbackData;
}) {
  const [open, setOpen] = useState<"review" | "report" | null>(null);

  const reviewPrompt = `Review the "${name}" statusline on ${base}: POST /api/report (SIWX-signed, free) with {"slug": "${slug}", "rating": <0-5>, "comment": "<your take>"}.`;
  const reportPrompt = `Report the "${name}" statusline on ${base} as malicious or broken: POST /api/report (SIWX-signed, free) with {"slug": "${slug}", "comment": "<what's wrong>"}.`;

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-medium">Reviews</h2>
          {data.average !== null ? (
            <span className="text-muted-foreground inline-flex items-center gap-1.5 text-xs">
              <Stars n={data.average} />
              {data.average.toFixed(1)} · {data.count}
            </span>
          ) : (
            <span className="text-muted-foreground text-xs">no reviews yet</span>
          )}
        </div>
        <div className="flex items-center gap-3 text-xs">
          <button
            onClick={() => setOpen(open === "review" ? null : "review")}
            className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 transition-colors"
          >
            <Star className="size-3" />
            Leave a review
          </button>
          <button
            onClick={() => setOpen(open === "report" ? null : "report")}
            className="text-muted-foreground hover:text-destructive inline-flex items-center gap-1 transition-colors"
          >
            <Flag className="size-3" />
            Report
          </button>
        </div>
      </div>

      {open && (
        <CopyBlock
          label={
            open === "review"
              ? "Ask your agent to review it (signs with your wallet, free)"
              : "Ask your agent to report it (signs with your wallet, free)"
          }
          text={open === "review" ? reviewPrompt : reportPrompt}
        />
      )}

      {data.reviews.length > 0 && (
        <ul className="flex flex-col divide-y border">
          {data.reviews.map((r, i) => (
            <li key={i} className="flex flex-col gap-1 p-3">
              <div className="flex items-center gap-2">
                {typeof r.rating === "number" && <Stars n={r.rating} />}
                <span className="text-muted-foreground font-mono text-xs">
                  {shortWallet(r.wallet)}
                </span>
              </div>
              {r.comment && <p className="text-sm">{r.comment}</p>}
            </li>
          ))}
        </ul>
      )}

      {data.reports.length > 0 && (
        <div className="flex flex-col gap-2">
          <h3 className="text-destructive text-xs font-medium">
            Reports ({data.reports.length})
          </h3>
          <ul className="border-destructive/30 flex flex-col divide-y border">
            {data.reports.map((r, i) => (
              <li key={i} className="flex flex-col gap-1 p-3">
                <span className="text-muted-foreground font-mono text-xs">
                  {shortWallet(r.wallet)}
                </span>
                {r.comment && <p className="text-sm">{r.comment}</p>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
