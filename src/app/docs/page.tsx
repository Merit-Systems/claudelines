import type { Metadata } from "next";

import { CopyBlock } from "@/components/copy-block";
import { siteUrl } from "@/lib/site";

export const metadata: Metadata = {
  description: "How ClaudeLines stores, checks, installs, and sells Claude Code status lines.",
};

const sectionClass = "flex flex-col gap-4 border-t pt-8";
const textClass = "text-muted-foreground text-sm leading-6";

export default function DocsPage() {
  const base = siteUrl();

  return (
    <div className="flex max-w-3xl flex-col gap-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-medium tracking-tight">
          How ClaudeLines works
        </h1>
        <p className={textClass}>
          ClaudeLines is a registry for Claude Code status line scripts. It
          stores the script, a captured preview, audit results, price, install
          count, and recorded sales revenue for each listing.
        </p>
      </header>

      <section className={sectionClass} id="status-lines">
        <h2 className="text-lg font-medium">What a status line is</h2>
        <p className={textClass}>
          A Claude Code status line is a command configured in{" "}
          <code className="text-foreground text-xs">
            ~/.claude/settings.json
          </code>
          . Claude Code sends session data to the command as JSON on standard
          input. The command writes text to standard output. Claude Code shows
          that text below the prompt.
        </p>
        <p className={textClass}>
          The script runs on your computer with your user permissions. It can
          read files, write files, run programs, and make network requests if
          its code does so. See the{" "}
          <a
            href="https://code.claude.com/docs/en/statusline"
            target="_blank"
            rel="noreferrer"
            className="text-foreground underline underline-offset-4"
          >
            Claude Code status line documentation
          </a>
          .
        </p>
      </section>

      <section className={sectionClass} id="listings">
        <h2 className="text-lg font-medium">What a listing contains</h2>
        <ul className={`${textClass} list-disc space-y-2 pl-5`}>
          <li>The status line script.</li>
          <li>A captured ANSI preview supplied by the publisher.</li>
          <li>
            Optional companion Claude Code command files
            (commands/&lt;name&gt;.md). These are prompts your agent executes,
            so they are audited together with the script — read them before
            installing to ~/.claude/commands/.
          </li>
          <li>Name, description, tags, author wallet, and price.</li>
          <li>An audit summary, detected capabilities, and scanner flags.</li>
        </ul>
        <p className={textClass}>
          The preview is stored text. The site does not run the script in your
          browser. A preview can be inaccurate, so inspect the source before
          installing.
        </p>
      </section>

      <section className={sectionClass} id="install">
        <h2 className="text-lg font-medium">Installing a status line</h2>
        <p className={textClass}>
          The Add button copies an instruction for Claude Code. It does not
          install anything by itself.
        </p>
        <ol className={`${textClass} list-decimal space-y-2 pl-5`}>
          <li>Get the script source. Free scripts use a GET request.</li>
          <li>Paid scripts use POST /api/download and require payment.</li>
          <li>Read the script.</li>
          <li>Save it under ~/.claude/statuslines and make it executable.</li>
          <li>Set statusLine.command in ~/.claude/settings.json.</li>
        </ol>
        <CopyBlock
          label="Download a free script"
          text={`slug="replace-with-listing-slug"
mkdir -p ~/.claude/statuslines
curl -fsSL "${base}/api/statuslines/$slug/script" -o ~/.claude/statuslines/$slug
$EDITOR ~/.claude/statuslines/$slug
chmod +x ~/.claude/statuslines/$slug`}
        />
        <CopyBlock
          label="Claude Code settings"
          text={JSON.stringify(
            {
              statusLine: {
                type: "command",
                command:
                  "~/.claude/statuslines/replace-with-listing-slug",
              },
            },
            null,
            2,
          )}
        />
      </section>

      <section className={sectionClass} id="checks">
        <h2 className="text-lg font-medium">Checks on submitted scripts</h2>
        <p className={textClass}>
          Paid registrations ($0.15 through POST /api/register) get the full
          pipeline:
        </p>
        <ol className={`${textClass} list-decimal space-y-2 pl-5`}>
          <li>The registration payment is verified.</li>
          <li>An LLM reviews the submitted script.</li>
          <li>
            A deterministic scanner checks for risky patterns such as remote
            downloads, shell execution, settings changes, scheduled jobs,
            credential access, and reverse shells.
          </li>
          <li>A high severity scanner result rejects the submission.</li>
          <li>
            An accepted script and its audit metadata are stored in the
            database. The stored script is the source returned to installers.
          </li>
        </ol>
        <p className={textClass}>
          A rejected submission is not listed. The registration payment is not
          refunded because the audit has already run.
        </p>
        <p className={textClass}>
          Free submissions (POST /api/submit, no wallet) get only the
          deterministic scanner — high severity hits are rejected, everything
          else is listed <span className="text-foreground">unaudited</span>{" "}
          with a prominent warning. Anyone can later fund the full LLM audit
          through POST /api/audit: $0.15 for the first audit of an unaudited
          listing, $0.50 to re-audit one that already has a verdict (ten
          times the audit&apos;s actual cost, to deter verdict re-rolling).
          The verdict is
          stamped on the listing, and an audit that rejects delists the
          script.
        </p>
        <p className="text-sm font-medium leading-6">
          These checks do not prove that a script is safe. Read the script
          before running it — especially an unaudited one.
        </p>
      </section>

      <section className={sectionClass} id="publish">
        <h2 className="text-lg font-medium">Publishing</h2>
        <p className={textClass}>
          POST /api/register costs $0.15 through x402 or MPP. The request must
          include a slug, name, description, script, captured preview, price,
          and up to five tags. Scripts are limited to 32 KB. Set priceUsd to 0
          for a free listing or a positive decimal USD amount for a paid
          listing.
        </p>
        <p className={textClass}>
          The wallet that pays for registration becomes the listing owner. A
          verified X handle can be attached to that wallet through the identity
          endpoints.
        </p>
        <p className={textClass}>
          No wallet? POST /api/submit publishes for free with the same fields
          minus the price. The listing has no owner — authorship can&apos;t be
          claimed, the preview can&apos;t be updated, and it can never be
          sold — and it carries an unaudited warning until someone funds its
          audit. Free submissions are rate-limited per caller.
        </p>
        <CopyBlock
          label="Ask Claude Code to publish the configured status line"
          text={`Publish my Claude Code status line to ${base}. Read statusLine.command from ~/.claude/settings.json and read the script at that path. Show me the script before uploading it. Capture previewAnsi with COLUMNS=120 and sanitize any personal data. Read ${base}/skill.md, then POST /api/register with the script, previewAnsi, slug, name, description, priceUsd, and tags.`}
        />
      </section>

      <section className={sectionClass} id="payments">
        <h2 className="text-lg font-medium">Payments and accounting</h2>
        <ul className={`${textClass} list-disc space-y-2 pl-5`}>
          <li>Free scripts are downloaded without payment.</li>
          <li>
            Paid downloads charge the price set by the publisher through x402
            or MPP.
          </li>
          <li>
            Payment settles directly to the wallet that published the listing.
            ClaudeLines does not take a platform fee or hold the payment.
          </li>
          <li>The full purchase price is recorded in the listing revenue total.</li>
          <li>
            A purchase made by the publisher&apos;s own wallet does not increase
            installs or revenue.
          </li>
        </ul>
      </section>

      <section className={sectionClass} id="api">
        <h2 className="text-lg font-medium">API</h2>
        <div className="overflow-x-auto border">
          <table className="w-full min-w-[42rem] text-left text-sm">
            <thead className="bg-muted/50 text-xs">
              <tr>
                <th className="px-3 py-2 font-medium">Method</th>
                <th className="px-3 py-2 font-medium">Path</th>
                <th className="px-3 py-2 font-medium">Purpose</th>
              </tr>
            </thead>
            <tbody className="text-muted-foreground divide-y">
              {[
                ["GET", "/api/statuslines", "List public status lines"],
                ["GET", "/api/statuslines/{slug}", "Get listing details"],
                [
                  "GET",
                  "/api/statuslines/{slug}/script",
                  "Download a free script",
                ],
                [
                  "GET",
                  "/api/statuslines/{slug}/files",
                  "Companion command files for a free listing",
                ],
                ["POST", "/api/download", "Buy and download a paid script"],
                ["POST", "/api/register", "Audit and publish a script ($0.15)"],
                [
                  "POST",
                  "/api/statuslines/{slug}/update",
                  "Owner script update, re-audited ($0.15)",
                ],
                [
                  "POST",
                  "/api/submit",
                  "Publish free without a wallet (unaudited)",
                ],
                [
                  "POST",
                  "/api/audit",
                  "Fund an audit: $0.15 first, $0.50 re-audit",
                ],
                [
                  "POST",
                  "/api/statuslines/{slug}/preview",
                  "Update an owned listing preview",
                ],
                ["GET", "/api/leaderboard", "List installs and revenue"],
                ["POST", "/api/report", "Submit signed feedback or a report"],
              ].map(([method, path, purpose]) => (
                <tr key={`${method}-${path}`}>
                  <td className="px-3 py-2 font-mono text-xs">{method}</td>
                  <td className="text-foreground px-3 py-2 font-mono text-xs">
                    {path}
                  </td>
                  <td className="px-3 py-2">{purpose}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className={textClass}>
          Machine-readable details are available at{" "}
          <a href="/openapi.json" className="text-foreground underline underline-offset-4">
            /openapi.json
          </a>
          . Agent instructions are available at{" "}
          <a href="/skill.md" className="text-foreground underline underline-offset-4">
            /skill.md
          </a>{" "}
          (also served at /llms.txt).
        </p>
      </section>
    </div>
  );
}
