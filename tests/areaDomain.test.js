const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const { join } = require("node:path");
const { pathToFileURL } = require("node:url");

const MODULE = pathToFileURL(
  join(__dirname, "..", "frontend", "src", "utils", "areaDomain.js"),
).href;
const load = () => import(MODULE);

describe("areaDomain", () => {
  test("widens the domain for two flat lines so neither touches a frame edge", async () => {
    const { areaDomain } = await load();
    const { min, max } = areaDomain([
      { data: [-9800, -9800, -9800] },
      { data: [7300, 7300, 7300] },
    ]);
    const range = 7300 - -9800;
    assert.ok(min <= -9800 - range * 0.2, `min ${min}`);
    assert.ok(max >= 7300 + range * 0.2, `max ${max}`);
  });

  test("gives an all-flat pair more headroom than a moving pair with the same span", async () => {
    const { areaDomain } = await load();
    const flat = areaDomain([{ data: [-9800, -9800] }, { data: [7300, 7300] }]);
    const moving = areaDomain([{ data: [-9800, -9800] }, { data: [-2000, 7300] }]);
    assert.ok(flat.max - flat.min > moving.max - moving.min);
  });

  test("is non-degenerate for empty datasets", async () => {
    const { areaDomain } = await load();
    const { min, max, step } = areaDomain([]);
    assert.ok(max > min);
    assert.ok(step > 0);
  });

  test("handles a single constant series without a zero-width domain", async () => {
    const { areaDomain } = await load();
    const { min, max } = areaDomain([{ data: [500, 500, 500] }]);
    assert.ok(min < 500);
    assert.ok(max > 500);
  });

  test("ignores null and non-finite points", async () => {
    const { areaDomain } = await load();
    const { min, max } = areaDomain([{ data: [null, 100, NaN, 200, undefined] }]);
    assert.ok(min <= 100 && max >= 200);
    assert.ok(Number.isFinite(min) && Number.isFinite(max));
  });
});
