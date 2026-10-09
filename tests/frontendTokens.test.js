const { test } = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync, readdirSync, statSync } = require("node:fs");
const { join, relative } = require("node:path");

// The frontend styles through the theme tokens (text-app, text-muted, bg-surface, border-line, ...).
// Raw grey utilities ignore the five data-theme palettes, and hand-written radii bypass the scale.
const SRC = join(__dirname, "..", "frontend", "src");
const RAW_GREY = /(?<![\w-])(?:[a-z0-9-]+:)*[a-z-]+-(?:gray|slate|zinc|neutral|stone)-\d{2,3}(?:\/\d+)?(?![\w-])/g;
const RADIUS_DECL = /border-radius:\s*([^;}]+)/g;

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

const files = walk(SRC);
const offenders = (list, find) =>
  list.map((f) => [relative(SRC, f), find(readFileSync(f, "utf8"))]).filter(([, hits]) => hits.length > 0);

test("components use theme tokens, not raw grey utilities", () => {
  const code = files.filter((f) => /\.(jsx|tsx|js|ts)$/.test(f) && !/\.test\./.test(f));
  assert.deepEqual(offenders(code, (s) => s.match(RAW_GREY) || []), []);
});

test("stylesheets keep border-radius on the token scale", () => {
  const css = files.filter((f) => f.endsWith(".css"));
  const raw = (s) => [...s.matchAll(RADIUS_DECL)].map((m) => m[1].trim()).filter((v) => !v.startsWith("var(--radius"));
  assert.deepEqual(offenders(css, raw), []);
});
