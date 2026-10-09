const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const { join } = require("node:path");
const { pathToFileURL } = require("node:url");

const MODULE = pathToFileURL(
  join(__dirname, "..", "frontend", "src", "utils", "donutArcs.js"),
).href;
const load = () => import(MODULE);

describe("donutArcs", () => {
  test("returns one arc per positive value, in input order", async () => {
    const { donutArcs } = await load();
    const arcs = donutArcs([1, 1, 1, 1], { size: 100 });
    assert.equal(arcs.length, 4);
    assert.deepEqual(arcs.map((a) => a.index), [0, 1, 2, 3]);
    for (const a of arcs) assert.match(a.d, /^M /);
  });

  test("starts the first slice at 12 o'clock and sweeps clockwise", async () => {
    const { donutArcs } = await load();
    // Four equal slices: first spans -90deg..0deg, mid-angle = -45deg.
    const [first] = donutArcs([1, 1, 1, 1], { size: 100 });
    assert.ok(Math.abs(first.midAngle - -Math.PI / 4) < 1e-6);
  });

  test("skips zero and negative slices but keeps original indices", async () => {
    const { donutArcs } = await load();
    assert.deepEqual(donutArcs([5, 0, -3, 5], { size: 100 }).map((a) => a.index), [0, 3]);
  });

  test("renders a single value as a full ring (outer ring + even-odd hole)", async () => {
    const { donutArcs } = await load();
    const [only] = donutArcs([42], { size: 100 });
    assert.equal(only.d.match(/M /g).length, 2);
  });

  test("returns empty when the total is zero", async () => {
    const { donutArcs } = await load();
    assert.deepEqual(donutArcs([0, 0], { size: 100 }), []);
    assert.deepEqual(donutArcs([], { size: 100 }), []);
    assert.deepEqual(donutArcs(null), []);
  });

  test("uses the large-arc flag for slices over 180deg", async () => {
    const { donutArcs } = await load();
    // 3:1 split: first slice is 270deg (large), second 90deg (small).
    const [big, small] = donutArcs([3, 1], { size: 100 });
    assert.match(big.d, /A \S+ \S+ 0 1 1/);
    assert.match(small.d, /A \S+ \S+ 0 0 1/);
  });
});
