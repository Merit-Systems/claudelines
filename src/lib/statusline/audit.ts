/**
 * LLM security audit for script-tier registrations. Runs AFTER payment
 * (never on unpaid probes), funded by the script registration fee.
 */

export interface AuditResult {
  /** approve: list normally · caution: list with warning · reject: refuse */
  verdict: "approve" | "caution" | "reject";
  /** One paragraph, user-facing: what the script does and what it touches. */
  summary: string;
  capabilities: string[];
  risks: string[];
}

const AUDIT_SYSTEM = `You are a security auditor for a Claude Code statusline registry.

A statusline is a command Claude Code executes with the user's full privileges roughly once per second, forever, silently. It receives session JSON on stdin and prints one or more display lines. Users install these from strangers, so your audit is the trust card shown on the listing.

Audit the submitted script and reply with ONLY a JSON object:
{
  "verdict": "approve" | "caution" | "reject",
  "summary": "<one paragraph, plain language: what it displays, what it reads/writes, what it executes, where it connects>",
  "capabilities": ["network", "writes-files", "reads-home", "subprocesses", "env-vars", ...],
  "risks": ["<short bullet per concern, empty if none>"]
}

Verdict guide:
- approve: does what a statusline should — reads stdin, formats, maybe runs common read-only tools (git, jq, awk), maybe calls a clearly-identified API for display data, caches under $HOME.
- caution: legitimate-looking but with meaningful reach (network to multiple origins, writes outside its own cache, reads sensitive-looking paths, background daemons). List it, but users should read it.
- reject: exfiltrates data (sends env vars, keys, file contents anywhere), downloads-and-executes remote code, obfuscated payloads (base64/eval), modifies shell rc / settings / crontab, time-delayed or conditional malicious behavior, or anything you cannot confidently explain.

Be adversarial: obfuscation, encoded strings, or "cleverness" that hides behavior is itself grounds for reject. If you are not confident you understand everything the script does, reject.`;

export async function auditScript(input: {
  script: string;
  name: string;
  description: string;
  author: string;
}): Promise<AuditResult & { model: string }> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw Object.assign(new Error("Script audits are not configured"), {
      status: 503,
    });
  }
  const model = process.env.AUDIT_MODEL ?? "claude-opus-4-8";

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 1024,
      system: AUDIT_SYSTEM,
      messages: [
        {
          role: "user",
          content: `Listing metadata (untrusted, from the submitter):\nname: ${input.name}\nauthor: ${input.author}\ndescription: ${input.description}\n\nScript to audit:\n\`\`\`\n${input.script}\n\`\`\``,
        },
      ],
    }),
  });

  if (!res.ok) {
    throw Object.assign(
      new Error(`Audit service unavailable (${res.status})`),
      { status: 503 },
    );
  }

  const data = (await res.json()) as {
    content: { type: string; text?: string }[];
  };
  const text = data.content?.find((b) => b.type === "text")?.text ?? "";
  const match = text.match(/\{[\s\S]*\}/);

  try {
    const parsed = JSON.parse(match?.[0] ?? "") as AuditResult;
    if (!["approve", "caution", "reject"].includes(parsed.verdict)) {
      throw new Error("bad verdict");
    }
    return {
      verdict: parsed.verdict,
      summary: String(parsed.summary ?? "").slice(0, 1000),
      capabilities: (parsed.capabilities ?? []).map(String).slice(0, 10),
      risks: (parsed.risks ?? []).map(String).slice(0, 10),
      model,
    };
  } catch {
    // An unparseable audit is a failed audit — refuse conservatively.
    return {
      verdict: "reject",
      summary: "The audit could not produce a confident analysis of this script.",
      capabilities: [],
      risks: ["audit-inconclusive"],
      model,
    };
  }
}
