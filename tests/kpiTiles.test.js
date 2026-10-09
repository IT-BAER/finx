const { test } = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");

// Dashboard, Reports and Goals share one KPI tile whose tone comes from the palette ink tokens.
const SRC = join(__dirname, "..", "frontend", "src");
const read = (p) => readFileSync(join(SRC, p), "utf8");
const RAW_HUE = /(?<![\w-])(?:[a-z0-9-]+:)*(?:text|bg|border)-(?:red|orange|amber|yellow|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|pink|rose)-\d{2,3}(?:\/\d+)?(?![\w-])/g;

test("SummaryCards renders the shared KpiTiles without hard-coded hues", () => {
  const src = read("components/SummaryCards.jsx");
  assert.match(src, /export function KpiTiles/);
  assert.deepEqual(src.match(RAW_HUE) || [], []);
  assert.doesNotMatch(src, /style=\{\{/);
});

test("Goals uses the shared KpiTiles instead of its own summary cards", () => {
  const src = read("pages/Goals.jsx");
  assert.match(src, /import \{[^}]*KpiTiles[^}]*\} from "..\/components\/SummaryCards.jsx"/);
  assert.match(src, /<KpiTiles /);
  assert.doesNotMatch(src, /const SummaryCards = \(\) =>/);
});

// --- WCAG contrast of the ink tones on the real card background of every palette ---
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const toHex = (c) => "#" + c.map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");
const mix = (a, b, p) => toHex(hex(a).map((v, i) => v * p + hex(b)[i] * (1 - p)));
const lum = (h) => {
  const [r, g, b] = hex(h).map((v) => v / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a, b) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

function paletteVars(css) {
  const blocks = {};
  for (const m of css.matchAll(/:root(?:\[data-theme="(\w+)"\])?(\.dark)?\s*\{([^}]*)\}/g)) {
    const key = `${m[1] || "base"}${m[2] ? ".dark" : ""}`;
    const vars = Object.fromEntries([...m[3].matchAll(/(--[\w-]+):\s*(#[0-9a-fA-F]{6})/g)].map((v) => [v[1], v[2].toLowerCase()]));
    blocks[key] = { ...blocks[key], ...vars };
  }
  return blocks;
}

test("KPI ink tones reach 4.5:1 on the card in every palette, light and dark", () => {
  const tokens = readFileSync(join(SRC, "styles", "tokens.css"), "utf8");
  const inks = [...tokens.matchAll(/--(\w+)-ink:\s*color-mix\(in srgb, var\((--[\w-]+)\) (\d+)%, var\(--text\)\)/g)];
  assert.deepEqual(inks.map((m) => m[1]).sort(), ["accent", "bad", "ok", "warn"]);

  const blocks = paletteVars(readFileSync(join(SRC, "styles", "index.css"), "utf8"));
  const failures = [];
  for (const theme of ["default", "ocean", "forest", "rose", "wednesday"]) {
    for (const dark of [false, true]) {
      const v = { ...blocks.base, ...blocks[theme], ...(dark ? blocks[`${theme}.dark`] : {}) };
      // Card backgrounds per index.css: palette dark cards are 80% black over the page, rose light is 85% surface.
      let card = v["--surface"];
      if (dark && theme !== "default") card = mix("#000000", v["--bg"], 0.8);
      if (!dark && theme === "rose") card = mix(v["--surface"], v["--bg"], 0.85);
      for (const [, name, source, pct] of inks) {
        const ink = mix(v[source], v["--text"], Number(pct) / 100);
        const ratio = contrast(ink, card);
        if (ratio < 4.5) failures.push(`${theme}${dark ? ".dark" : ""} ${name} ${ratio.toFixed(2)}`);
      }
    }
  }
  assert.deepEqual(failures, []);
});
