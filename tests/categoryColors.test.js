const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const { join } = require("node:path");
const { pathToFileURL } = require("node:url");

const MODULE = pathToFileURL(
  join(__dirname, "..", "frontend", "src", "utils", "categoryColors.js"),
).href;
const load = () => import(MODULE);

describe("assignCategoryColors", () => {
  test("is stable regardless of input order", async () => {
    const { assignCategoryColors } = await load();
    const a = assignCategoryColors(["Food", "Rent", "Fun"]);
    const b = assignCategoryColors(["Fun", "Food", "Rent"]);
    for (const name of ["Food", "Rent", "Fun"]) assert.equal(a.get(name), b.get(name));
  });

  test("keeps a category's colour when other categories join the set", async () => {
    const { assignCategoryColors } = await load();
    const first = assignCategoryColors(["Rent", "Transport"]);
    const after = assignCategoryColors(["Rent", "Transport", "Aaa", "Bbb", "Groceries", "Zzz"]);
    for (const name of ["Rent", "Transport"]) assert.equal(after.get(name), first.get(name));
  });

  test("assigns every category a concrete colour", async () => {
    const { assignCategoryColors } = await load();
    const m = assignCategoryColors(["A", "B", "C", "D"]);
    for (const n of ["A", "B", "C", "D"]) assert.ok(m.get(n));
  });

  test("dedupes repeated names", async () => {
    const { assignCategoryColors } = await load();
    assert.equal(assignCategoryColors(["Food", "Food", "Rent"]).size, 2);
  });
});

describe("categoryColor (Java hashCode parity with Android)", () => {
  const cases = [
    ["Food", 0],
    ["Rent", 2],
    ["Fun", 0],
    ["Groceries", 1],
    ["Lebensmittel", 2],
    ["Transport", 2],
  ];
  for (const [name, index] of cases) {
    test(`${name} maps to ramp slot ${index}`, async () => {
      const { categoryColor, CATEGORY_RAMP } = await load();
      assert.equal(categoryColor(name), CATEGORY_RAMP[index]);
    });
  }

  test("is case-insensitive", async () => {
    const { categoryColor } = await load();
    assert.equal(categoryColor("GROCERIES"), categoryColor("groceries"));
  });

  test("falls back to the last swatch for a blank or missing name", async () => {
    const { categoryColor, CATEGORY_RAMP } = await load();
    const last = CATEGORY_RAMP[CATEGORY_RAMP.length - 1];
    assert.equal(categoryColor(""), last);
    assert.equal(categoryColor(null), last);
    assert.equal(categoryColor(undefined), last);
  });

  test("uses the seven-swatch Android category palette", async () => {
    const { CATEGORY_RAMP } = await load();
    assert.equal(CATEGORY_RAMP.length, 7);
    assert.equal(CATEGORY_RAMP[0], "rgba(248, 113, 113, 0.85)");
    assert.equal(CATEGORY_RAMP[6], "rgba(209, 213, 219, 0.85)");
  });
});

describe("categorySwatch", () => {
  test("matches categoryColor for the same name", async () => {
    const { categorySwatch, categoryColor } = await load();
    for (const name of ["Food", "Rent", "Groceries", "Transport", ""]) {
      assert.equal(categorySwatch(name).main, categoryColor(name));
    }
  });

  test("exposes the raw rgb triple", async () => {
    const { categorySwatch } = await load();
    assert.equal(categorySwatch("Food").rgb, "248, 113, 113");
  });
});

describe("chip legibility (WCAG AA)", () => {
  const lum = (rgb) => {
    const [r, g, b] = rgb.split(",").map((c) => {
      const v = Number(c.trim()) / 255;
      return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const contrast = (a, b) => {
    const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
  };
  const over = (rgb, alpha, bg) =>
    rgb
      .split(",")
      .map((c, i) => Math.round(alpha * Number(c.trim()) + (1 - alpha) * bg[i]))
      .join(", ");
  const MARGIN = 5.0;
  const WHITE = [255, 255, 255];
  const NEAR_BLACK = [3, 7, 18];

  test("light theme: every swatch clears 5.0:1 on a white card", async () => {
    const { CATEGORY_SWATCHES } = await load();
    for (const sw of CATEGORY_SWATCHES) {
      const ratio = contrast(sw.rgbOnLight, over(sw.rgb, 0.16, WHITE));
      assert.ok(ratio >= MARGIN, `${sw.rgb}: ${ratio}`);
    }
  });

  test("dark theme: every swatch clears 5.0:1 on the dark ground", async () => {
    const { CATEGORY_SWATCHES } = await load();
    for (const sw of CATEGORY_SWATCHES) {
      const ratio = contrast(sw.rgbOnDark, over(sw.rgb, 0.18, NEAR_BLACK));
      assert.ok(ratio >= MARGIN, `${sw.rgb}: ${ratio}`);
    }
  });
});

describe("categoryChipStyle", () => {
  test("hands the chip the same swatch as the donut colour", async () => {
    const { categoryChipStyle, categorySwatch, categoryColor } = await load();
    for (const name of ["Lebensmittel", "Miete", "", null]) {
      const sw = categorySwatch(name);
      assert.equal(sw.main, categoryColor(name));
      assert.deepEqual(categoryChipStyle(name), { "--cat-rgb": sw.rgb, "--cat-fg-light": sw.rgbOnLight, "--cat-fg-dark": sw.rgbOnDark });
    }
  });
});
