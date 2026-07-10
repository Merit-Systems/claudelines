/**
 * Heuristic capability detection for uploaded script statuslines. Advisory
 * labels shown on listings — the review gate is the real control.
 */

const CHECKS: { cap: string; pattern: RegExp }[] = [
  {
    cap: "network",
    pattern:
      /\b(curl|wget|nc|ncat|fetch\(|XMLHttpRequest|https?:\/\/)|\bagentcash\b/i,
  },
  {
    cap: "writes-files",
    pattern: /(>>?\s*["']?[~/$\w]|\btee\b|\bmkdir\b|\btouch\b|\bmv\b|\bcp\b|writeFileSync|createWriteStream)/,
  },
  {
    cap: "reads-home",
    pattern: /(\$HOME|~\/|homedir\(\)|\$\{HOME\})/,
  },
  {
    cap: "background-jobs",
    pattern: /(&\s*$|&\s*\)|nohup|setsid)/m,
  },
  {
    cap: "env-vars",
    pattern: /(\$\{?[A-Z_]{3,}\}?|process\.env)/,
  },
];

export function detectCapabilities(script: string): string[] {
  return CHECKS.filter((c) => c.pattern.test(script)).map((c) => c.cap);
}
