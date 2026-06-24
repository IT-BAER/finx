const { test } = require("node:test");
const assert = require("node:assert/strict");
const { parseSourceIds, buildSourceFilterClause } = require("../utils/sourceFilter");

test("parseSourceIds parses a CSV of ints", () => {
  assert.deepEqual(parseSourceIds("42,7"), [42, 7]);
});

test("parseSourceIds trims whitespace", () => {
  assert.deepEqual(parseSourceIds(" 42 , 7 "), [42, 7]);
});

test("parseSourceIds de-dupes and drops non-positive / non-numeric", () => {
  assert.deepEqual(parseSourceIds("a,3,-1,0,3,5"), [3, 5]);
});

test("parseSourceIds accepts an array", () => {
  assert.deepEqual(parseSourceIds([10, "20"]), [10, 20]);
});

test("parseSourceIds returns [] for null / empty / garbage", () => {
  assert.deepEqual(parseSourceIds(null), []);
  assert.deepEqual(parseSourceIds(""), []);
  assert.deepEqual(parseSourceIds(undefined), []);
  assert.deepEqual(parseSourceIds("abc"), []);
});

test("buildSourceFilterClause returns empty for no ids", () => {
  const r = buildSourceFilterClause([], 5);
  assert.equal(r.clause, "");
  assert.deepEqual(r.values, []);
  assert.equal(r.nextIndex, 5);
});

test("buildSourceFilterClause matches expense source side by id", () => {
  const r = buildSourceFilterClause([42, 7], 3);
  assert.match(r.clause, /t\.source_id = ANY\(\$3::int\[\]\)/);
});

test("buildSourceFilterClause matches income via target name resolved per owner", () => {
  const r = buildSourceFilterClause([42, 7], 3);
  assert.match(r.clause, /LOWER\(t\.type\) = 'income'/);
  assert.match(r.clause, /t\.target_id IN \(/);
  assert.match(r.clause, /JOIN sources s2 ON s2\.user_id = tg2\.user_id/);
  assert.match(r.clause, /LOWER\(TRIM\(s2\.name\)\) = LOWER\(TRIM\(tg2\.name\)\)/);
  assert.match(r.clause, /WHERE s2\.id = ANY\(\$3::int\[\]\)/);
});

test("buildSourceFilterClause binds the id array once and advances the index", () => {
  const r = buildSourceFilterClause([42, 7], 3);
  assert.deepEqual(r.values, [[42, 7]]);
  assert.equal(r.nextIndex, 4);
});

test("buildSourceFilterClause supports an unaliased table", () => {
  const r = buildSourceFilterClause([1], 2, "");
  assert.match(r.clause, /(^|\s)source_id = ANY\(\$2::int\[\]\)/);
  assert.match(r.clause, /LOWER\(type\) = 'income'/);
  assert.ok(!/t\.source_id/.test(r.clause), "should not prefix with t.");
});
