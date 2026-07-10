/**
 * Deterministic second opinion on uploaded scripts. The LLM audit can be
 * fooled or prompt-injected; these are hard pattern rules that run
 * independently. A high-severity hit VETOES an LLM "approve" (downgrades the
 * listing to caution and records the flag), so the two must agree to ship a
 * clean listing — cheap scanner diversity in the spirit of skills.sh's
 * multi-vendor model.
 */

export interface RedFlag {
  severity: "high" | "medium";
  label: string;
}

const RULES: { severity: "high" | "medium"; label: string; re: RegExp }[] = [
  {
    severity: "high",
    label: "download-and-execute (pipe to shell)",
    re: /\b(curl|wget|fetch)\b[^\n|]*\|\s*(sh|bash|zsh|python\d?|node|eval)\b/i,
  },
  {
    severity: "high",
    label: "eval of decoded/opaque data",
    re: /\beval\b[^\n]*\$\(|`[^`]*`\s*\)?\s*\|\s*(sh|bash)|\beval\s+"?\$/i,
  },
  {
    severity: "high",
    label: "base64/hex decode into an interpreter",
    re: /base64\s+(-d|--decode)[^\n|]*\|\s*(sh|bash|zsh|python|node|eval)|xxd\s+-r/i,
  },
  {
    severity: "high",
    label: "writes shell rc / profile / Claude settings",
    re: /(>>?\s*~?\/?[.\w/]*(\.(bashrc|zshrc|bash_profile|profile|zprofile)|\.claude\/settings|authorized_keys))/i,
  },
  {
    severity: "high",
    label: "installs a cron job / launch agent",
    re: /\b(crontab|launchctl\s+load|systemctl\s+enable)\b/i,
  },
  {
    severity: "high",
    label: "reads credentials / key material",
    re: /(\.ssh\/id_|\.aws\/credentials|\.env\b|\.npmrc|\.git-credentials|private[_-]?key)/i,
  },
  {
    severity: "medium",
    label: "network call to a raw IP / non-obvious host",
    re: /https?:\/\/(\d{1,3}\.){3}\d{1,3}|nc\s+-|ncat\s|\/dev\/tcp\//i,
  },
  {
    severity: "medium",
    label: "reverse-shell shape",
    re: /bash\s+-i\s+>&|sh\s+-i\s+>&|mkfifo[^\n]*\|\s*(sh|bash)/i,
  },
];

export function scanRedFlags(script: string): RedFlag[] {
  const out: RedFlag[] = [];
  for (const r of RULES) {
    if (r.re.test(script)) out.push({ severity: r.severity, label: r.label });
  }
  return out;
}

export const hasHighSeverity = (flags: RedFlag[]) =>
  flags.some((f) => f.severity === "high");
