import assert from "node:assert/strict";
import test from "node:test";

import {
  parseAnsi,
  terminalCellWidth,
  terminalGraphemes,
} from "./ansi";

test("retains every captured preview row", () => {
  const lines = parseAnsi("one\ntwo\nthree\nfour\nfive\nsix\n");
  assert.equal(lines.length, 6);
  assert.equal(lines[5][0].text, "six");
});

test("applies reset followed by attributes in the same SGR", () => {
  const [[first, second]] = parseAnsi("\x1b[32mgreen\x1b[0;31mred");
  assert.deepEqual(first.fg, { kind: "palette", value: 2 });
  assert.deepEqual(second.fg, { kind: "palette", value: 1 });
});

test("preserves modern SGR styles and true color", () => {
  const [[run]] = parseAnsi(
    "\x1b[1;2;3;4;7;8;9;38;2;1;2;3;48;5;24mstyled",
  );
  assert.equal(run.bold, true);
  assert.equal(run.dim, true);
  assert.equal(run.italic, true);
  assert.equal(run.underline, true);
  assert.equal(run.inverse, true);
  assert.equal(run.invisible, true);
  assert.equal(run.strikethrough, true);
  assert.deepEqual(run.fg, { kind: "rgb", value: "#010203" });
  assert.deepEqual(run.bg, { kind: "palette", value: 24 });
});

test("supports colon-form RGB colors", () => {
  const [[run]] = parseAnsi("\x1b[38:2::10:20:30mcolor");
  assert.deepEqual(run.fg, { kind: "rgb", value: "#0a141e" });
});

test("advances tabs to eight-column terminal stops", () => {
  const [[run]] = parseAnsi("ab\tX");
  assert.equal(run.text, "ab      X");
  assert.equal(terminalCellWidth(run.text), 9);
});

test("uses Unicode grapheme clusters and modern terminal widths", () => {
  const graphemes = terminalGraphemes("e\u0301猫🌿🏳️‍🌈✉");
  assert.deepEqual(
    graphemes.map(({ text, cells }) => [text, cells]),
    [
      ["e\u0301", 1],
      ["猫", 2],
      ["🌿", 2],
      ["🏳️‍🌈", 2],
      ["✉", 1],
    ],
  );
});

test("keeps visible background padding but trims inert padding", () => {
  const [plain, painted, inverse] = parseAnsi(
    "plain   \n\x1b[41mred   \x1b[0m\n\x1b[7minverse   ",
  );
  assert.equal(plain[0].text, "plain");
  assert.equal(painted[0].text, "red   ");
  assert.equal(inverse[0].text, "inverse   ");
});

test("removes OSC metadata while retaining linked text", () => {
  const [[run]] = parseAnsi(
    "\x1b]8;;https://example.com\x07linked\x1b]8;;\x07",
  );
  assert.equal(run.text, "linked");
});
