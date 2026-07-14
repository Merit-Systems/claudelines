import assert from "node:assert/strict";
import test from "node:test";

import { blockArtGrid } from "./social-image";

test("collapses truecolor half-block cells into one SVG image", () => {
  const grid = blockArtGrid([
    [
      {
        text: "▀▄",
        fg: { kind: "rgb", value: "#ff0000" },
        bg: { kind: "rgb", value: "#0000ff" },
      },
    ],
  ]);

  assert.deepEqual(grid, {
    width: 2,
    height: 1,
    rects: [
      { x: 0, y: 0.5, width: 1, height: 0.5, fill: "#0000ff" },
      { x: 0, y: 0, width: 1, height: 0.5, fill: "#ff0000", opacity: undefined },
      { x: 1, y: 0, width: 1, height: 0.5, fill: "#0000ff" },
      { x: 1, y: 0.5, width: 1, height: 0.5, fill: "#ff0000", opacity: undefined },
    ],
  });
});

test("keeps mixed terminal text on the font renderer", () => {
  assert.equal(blockArtGrid([[{ text: "ok █" }]]), null);
});
