const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const { join } = require("node:path");
const { pathToFileURL } = require("node:url");

const MODULE = pathToFileURL(
  join(__dirname, "..", "frontend", "src", "utils", "percentShares.js"),
).href;
const load = () => import(MODULE);
const sum = (xs) => xs.reduce((a, b) => a + b, 0);

describe("percentShares", () => {
  test("sums to exactly 100", async () => {
    const { percentShares } = await load();
    const cases = [
      [213.27, 80, 70, 13, 11.28],
      [1, 1, 1],
      [1, 1, 1, 1, 1, 1, 1],
      [999, 1],
      [50, 50],
    ];
    for (const c of cases) assert.equal(sum(percentShares(c)), 100);
  });

  test("gives leftover points to the largest remainders", async () => {
    const { percentShares } = await load();
    // Three equal thirds: floors 33,33,33, leftover 1 goes to one slice.
    const shares = percentShares([1, 1, 1]);
    assert.equal(shares.filter((s) => s === 34).length, 1);
    assert.equal(shares.filter((s) => s === 33).length, 2);
  });

  test("keeps input order", async () => {
    const { percentShares } = await load();
    const shares = percentShares([80, 213.27, 70, 13, 11.28]);
    assert.equal(shares.length, 5);
    assert.equal(shares.indexOf(Math.max(...shares)), 1);
  });

  test("treats zero and negative values as 0 share", async () => {
    const { percentShares } = await load();
    assert.deepEqual(percentShares([100, 0, -5]), [100, 0, 0]);
  });

  test("returns all zeros when the total is non-positive", async () => {
    const { percentShares } = await load();
    assert.deepEqual(percentShares([0, 0]), [0, 0]);
    assert.deepEqual(percentShares([]), []);
    assert.deepEqual(percentShares(null), []);
  });
});
