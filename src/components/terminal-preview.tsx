import { renderRuns, type StyledRun } from "@/lib/statusline/render";
import type { StatuslineSpec, StatuslineVars } from "@/lib/statusline/spec";
import { DEFAULT_MOCK } from "@/lib/statusline/mock";
import { cn } from "@/lib/utils";

/**
 * Terminal-chrome preview. Always dark (terminals are dark), regardless of
 * site theme. Powerline arrows are CSS triangles so no patched font is needed.
 */

const TERM_BG = "#0d0d0d";
const DEFAULT_FG = "#d4d4d4";

function Run({ run }: { run: StyledRun }) {
  if (run.arrow) {
    return (
      <span
        aria-hidden
        className="inline-block h-[1.9em] w-[0.6em] shrink-0"
        style={{ background: run.arrow.to ?? "transparent" }}
      >
        <span
          className="block h-full w-full"
          style={{
            background: run.arrow.from ?? TERM_BG,
            clipPath: "polygon(0 0, 100% 50%, 0 100%)",
          }}
        />
      </span>
    );
  }
  return (
    <span
      className="inline-flex h-[1.9em] shrink-0 items-center"
      style={{
        color: run.fg ?? DEFAULT_FG,
        background: run.bg ?? "transparent",
        fontWeight: run.bold ? 700 : 400,
        opacity: run.dim ? 0.65 : 1,
        fontStyle: run.italic ? "italic" : "normal",
      }}
    >
      {/* nested span: flex containers drop whitespace-only text nodes */}
      <span className="whitespace-pre">{run.text}</span>
    </span>
  );
}

export function StatuslineRow({
  spec,
  vars = DEFAULT_MOCK,
  className,
}: {
  spec: StatuslineSpec;
  vars?: StatuslineVars;
  className?: string;
}) {
  const runs = renderRuns(spec, vars);
  return (
    <div
      className={cn(
        "flex items-center overflow-x-auto font-mono text-[13px]",
        className,
      )}
    >
      {runs.map((run, i) => (
        <Run key={i} run={run} />
      ))}
    </div>
  );
}

export function TerminalPreview({
  spec,
  vars = DEFAULT_MOCK,
  prompt = true,
  className,
}: {
  spec: StatuslineSpec;
  vars?: StatuslineVars;
  prompt?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border border-white/10",
        className,
      )}
      style={{ background: TERM_BG }}
    >
      <div className="flex items-center gap-1.5 border-b border-white/5 px-3 py-2.5">
        <span className="size-2.5 rounded-full bg-[#ff5f57]" />
        <span className="size-2.5 rounded-full bg-[#febc2e]" />
        <span className="size-2.5 rounded-full bg-[#28c840]" />
      </div>
      <div className="flex flex-col gap-1.5 px-4 py-4">
        {prompt && (
          <div className="font-mono text-[13px] leading-relaxed">
            <span style={{ color: "#525252" }}>&gt; </span>
            <span style={{ color: "#a3a3a3" }}>
              claude — fix the flaky auth test
            </span>
          </div>
        )}
        <StatuslineRow spec={spec} vars={vars} />
      </div>
    </div>
  );
}
