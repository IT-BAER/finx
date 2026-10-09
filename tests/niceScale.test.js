const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const { join } = require("node:path");
const { pathToFileURL } = require("node:url");

const MODULE = pathToFileURL(
  join(__dirname, "..", "frontend", "src", "utils", "niceScale.js"),
).href;
const load = () => import(MODULE);

// A step is "round" if it is one of {1,2,2.5,5}x10^n.
function isRoundStep(step) {
  if (!(step > 0)) return false;
  const exp = Math.floor(Math.log10(step));
  const m = step / 10 ** exp;
  return [1, 2, 2.5, 5].some((r) => Math.abs(m - r) < 1e-9);
}
const isMultiple = (v, step) => Math.abs(v / step - Math.round(v / step)) < 1e-9;

describe("niceScale", () => {
  test("covers the data with round, evenly spaced ticks (0..148)", async () => {
    const { niceScale } = await load();
    const { min, max, ticks } = niceScale(0, 148);
    assert.equal(min, 0);
    assert.ok(max >= 148);
    assert.ok(ticks.length <= 6);
    const step = ticks[1] - ticks[0];
    assert.ok(isRoundStep(step), `step ${step}`);
    for (let i = 1; i < ticks.length; i++) {
      assert.ok(Math.abs(ticks[i] - ticks[i - 1] - step) < 1e-6);
    }
    assert.equal(ticks[0], 0);
    assert.equal(ticks[ticks.length - 1], max);
    assert.ok(isMultiple(max, step));
  });

  test("scales a large max to a round top, not 11.3k", async () => {
    const { niceScale } = await load();
    const { max, ticks } = niceScale(0, 11340);
    assert.ok(max >= 11340);
    const step = ticks[1] - ticks[0];
    assert.ok(isRoundStep(step), `step ${step}`);
    assert.ok(isMultiple(max, step));
    assert.notEqual(max, 11340);
  });

  test("keeps a negative floor on diverging data, still on a round step", async () => {
    const { niceScale } = await load();
    const { min, max, ticks } = niceScale(-9800, 7300);
    assert.ok(min <= -9800);
    assert.ok(max >= 7300);
    const step = ticks[1] - ticks[0];
    assert.ok(isRoundStep(step), `step ${step}`);
    assert.ok(isMultiple(min, step));
    assert.ok(isMultiple(max, step));
  });

  test("does not divide by zero on a flat range", async () => {
    const { niceScale } = await load();
    const { min, max, ticks } = niceScale(0, 0);
    assert.ok(max > min);
    assert.ok(ticks.length >= 2);
    assert.ok(Number.isFinite(ticks[0]));
  });
});
