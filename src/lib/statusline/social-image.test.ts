import assert from "node:assert/strict";
import test from "node:test";

import { blockArtSvgDataUri } from "./social-image";

test("collapses truecolor half-block cells into one SVG image", () => {
  const uri = blockArtSvgDataUri([
    [
      {
        text: "▀▄",
        fg: { kind: "rgb", value: "#ff0000" },
        bg: { kind: "rgb", value: "#0000ff" },
      },
    ],
  ]);

  assert.ok(uri);
  const svg = decodeURIComponent(uri.slice(uri.indexOf(",") + 1));
  assert.match(svg, /viewBox="0 0 2 1"/);
  assert.match(svg, /x="0" y="0" width="1" height="0\.5" fill="#ff0000"/);
  assert.match(svg, /x="1" y="0\.5" width="1" height="0\.5" fill="#ff0000"/);
  assert.equal((svg.match(/fill="#0000ff"/g) ?? []).length, 2);
});

test("keeps mixed terminal text on the font renderer", () => {
  assert.equal(blockArtSvgDataUri([[{ text: "ok █" }]]), null);
});
