/**
 * Deterministic analysis of embedded payloads (large base64 literals) in
 * submitted scripts. Self-extracting asset packs are a legitimate pattern —
 * sprite sheets, animation frames, fonts — but to a static reader they are
 * indistinguishable from an obfuscated dropper. This module decodes what can
 * be decoded so both gates get evidence instead of vibes:
 *
 *  - the red-flag scanner re-scans decoded text content (an IP or pipe-to-sh
 *    hidden inside base64 is caught exactly like plaintext), and
 *  - the LLM audit receives a machine-generated listing of what the payload
 *    actually contains (entry paths, sizes, text/binary, traversal check).
 *
 * Decoding is bounded: payloads that fail to decode, exceed the size cap, or
 * contain binary/traversing entries are reported as such — suspicion intact.
 */
import { gunzipSync } from "node:zlib";

/** Ignore base64 runs shorter than this — too small to hide anything real. */
const MIN_B64_CHARS = 256;
/** Refuse to inflate beyond this many bytes (gzip-bomb guard). */
const MAX_INFLATED_BYTES = 8 * 1024 * 1024;
/** Cap on decoded text handed back for re-scanning. */
const MAX_RESCAN_BYTES = 256 * 1024;

export interface PayloadEntry {
  path: string;
  size: number;
  kind: "text" | "binary";
}

export interface PayloadReport {
  /** Character offset of the base64 literal in the script. */
  offset: number;
  /** Length of the base64 literal in characters. */
  literalChars: number;
  /** Decoded (and inflated, where applicable) byte length. */
  bytes: number;
  format: "gzip-tar" | "tar" | "gzip" | "raw" | "undecodable";
  /** Archive listing, when the payload is a tar. */
  entries?: PayloadEntry[];
  /** True if any archive entry escapes its extraction directory. */
  traversal: boolean;
  /** True when the decoded content (or every archive entry) is text. */
  allText: boolean;
  /** Decoded text content (capped), for red-flag re-scanning. */
  decodedText: string;
}

const B64_RUN = new RegExp(`[A-Za-z0-9+/]{${MIN_B64_CHARS},}={0,2}`, "g");

function printableRatio(buf: Buffer): number {
  const sample = buf.subarray(0, 4096);
  if (sample.length === 0) return 0;
  let printable = 0;
  for (const b of sample) {
    if (b === 9 || b === 10 || b === 13 || (b >= 32 && b < 127) || b >= 128) {
      printable++;
    }
  }
  return printable / sample.length;
}

const isText = (buf: Buffer) => printableRatio(buf) > 0.9;

/** Minimal ustar reader: names, sizes, typeflags. Returns null if not a tar. */
function listTar(buf: Buffer): { entries: PayloadEntry[] } | null {
  if (buf.length < 512) return null;
  const entries: PayloadEntry[] = [];
  let off = 0;
  let sawHeader = false;
  while (off + 512 <= buf.length) {
    const block = buf.subarray(off, off + 512);
    if (block.every((b) => b === 0)) break; // end-of-archive
    const magic = block.subarray(257, 262).toString("latin1");
    if (!sawHeader && magic !== "ustar") return null; // not a tar we understand
    sawHeader = true;
    const cstr = (b: Buffer) => {
      const end = b.indexOf(0);
      return b.subarray(0, end === -1 ? b.length : end).toString("utf8");
    };
    const prefix = cstr(block.subarray(345, 500));
    const name = cstr(block.subarray(0, 100));
    const path = prefix ? `${prefix}/${name}` : name;
    const size = parseInt(cstr(block.subarray(124, 136)).trim() || "0", 8) || 0;
    const typeflag = String.fromCharCode(block[156]);
    const data = buf.subarray(off + 512, off + 512 + size);
    if (typeflag === "0" || typeflag === "\0") {
      entries.push({ path, size, kind: isText(data) ? "text" : "binary" });
    } else if (typeflag !== "5") {
      // Links, devices, extended headers: surface as binary oddities.
      entries.push({ path: `${path} (type ${typeflag})`, size, kind: "binary" });
    }
    off += 512 + Math.ceil(size / 512) * 512;
  }
  return entries.length > 0 ? { entries } : null;
}

const escapesDir = (p: string) =>
  p.startsWith("/") || p.split("/").includes("..");

/** Decode and analyze every large base64 literal in a script. */
export function analyzePayloads(script: string): PayloadReport[] {
  const reports: PayloadReport[] = [];
  for (const m of script.matchAll(B64_RUN)) {
    const literal = m[0];
    const report: PayloadReport = {
      offset: m.index ?? 0,
      literalChars: literal.length,
      bytes: 0,
      format: "undecodable",
      traversal: false,
      allText: false,
      decodedText: "",
    };
    reports.push(report);

    let buf: Buffer;
    try {
      buf = Buffer.from(literal, "base64");
    } catch {
      continue;
    }
    if (buf.length === 0) continue;

    let inflated = false;
    if (buf.length > 2 && buf[0] === 0x1f && buf[1] === 0x8b) {
      try {
        buf = gunzipSync(buf, { maxOutputLength: MAX_INFLATED_BYTES });
        inflated = true;
      } catch {
        continue; // corrupt or bomb — stays undecodable
      }
    }
    report.bytes = buf.length;

    const tar = listTar(buf);
    if (tar) {
      report.format = inflated ? "gzip-tar" : "tar";
      report.entries = tar.entries;
      report.traversal = tar.entries.some((e) => escapesDir(e.path));
      report.allText = tar.entries.every((e) => e.kind === "text");
      if (report.allText) {
        // Re-inflate entry text for scanning: entries are contiguous in buf,
        // but simplest is to take the printable content of the whole archive.
        report.decodedText = buf
          .toString("utf8")
          .replace(/\0+/g, "\n")
          .slice(0, MAX_RESCAN_BYTES);
      }
    } else {
      report.format = inflated ? "gzip" : "raw";
      report.allText = isText(buf);
      if (report.allText) {
        report.decodedText = buf.toString("utf8").slice(0, MAX_RESCAN_BYTES);
      }
    }
  }
  return reports;
}

/** Human/LLM-readable digest of payload analysis for the audit prompt. */
export function describePayloads(reports: PayloadReport[]): string {
  if (reports.length === 0) return "";
  const lines = reports.map((r, i) => {
    const head = `payload #${i + 1} @ char ${r.offset}: ${r.literalChars} base64 chars → ${r.format}, ${r.bytes} bytes decoded`;
    if (!r.entries) {
      return `${head}, ${r.allText ? "text content" : r.format === "undecodable" ? "COULD NOT DECODE" : "BINARY content"}`;
    }
    const listing = r.entries
      .slice(0, 40)
      // JSON-quote and cap names: tar entry names are attacker-controlled and
      // must not be able to smuggle instruction-like text into this section.
      .map((e) => `    ${JSON.stringify(e.path.slice(0, 80))} (${e.size} B, ${e.kind})`)
      .join("\n");
    const extra = r.entries.length > 40 ? `\n    …and ${r.entries.length - 40} more` : "";
    return `${head}, ${r.entries.length} entries, ${r.traversal ? "PATH TRAVERSAL PRESENT" : "no path traversal"}, ${r.allText ? "all text" : "CONTAINS BINARY"}:\n${listing}${extra}`;
  });
  return lines.join("\n");
}
