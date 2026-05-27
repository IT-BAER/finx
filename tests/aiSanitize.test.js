const { test } = require("node:test");
const assert = require("node:assert/strict");
const { sanitizeText, sanitizeStringArray } = require("../utils/aiSanitize");

test("sanitizeText returns empty string for non-string", () => {
  assert.equal(sanitizeText(null), "");
  assert.equal(sanitizeText(undefined), "");
  assert.equal(sanitizeText(42), "");
  assert.equal(sanitizeText({}), "");
  assert.equal(sanitizeText([]), "");
});

test("sanitizeText trims and slices to maxLen", () => {
  assert.equal(sanitizeText("  hello  "), "hello");
  assert.equal(sanitizeText("a".repeat(5000)).length, 2000);
  assert.equal(sanitizeText("a".repeat(5000), 10).length, 10);
});

test("sanitizeText strips control chars but keeps newlines and tabs", () => {
  assert.equal(sanitizeText("hi\x01there"), "hi there");
  assert.equal(sanitizeText("hi\x1Fthere"), "hi there");
  assert.equal(sanitizeText("hi\nthere"), "hi\nthere");
  assert.equal(sanitizeText("hi\ttab"), "hi\ttab");
});

test("sanitizeStringArray rejects non-arrays", () => {
  assert.deepEqual(sanitizeStringArray(null), []);
  assert.deepEqual(sanitizeStringArray("foo"), []);
  assert.deepEqual(sanitizeStringArray({}), []);
});

test("sanitizeStringArray drops non-string and empty items", () => {
  assert.deepEqual(
    sanitizeStringArray(["a", 1, null, "", "  ", "b"]),
    ["a", "b"],
  );
});

test("sanitizeStringArray slices each item to MAX_ITEM_LEN (64)", () => {
  const long = "a".repeat(200);
  const [first] = sanitizeStringArray([long]);
  assert.equal(first.length, 64);
});

test("sanitizeStringArray caps array length at MAX_ITEMS (200)", () => {
  const arr = Array.from({ length: 500 }, (_, i) => `c${i}`);
  assert.equal(sanitizeStringArray(arr).length, 200);
});

test("sanitizeStringArray stops at MAX_TOTAL_ARR_BYTES (8000)", () => {
  const big = Array.from({ length: 200 }, () => "x".repeat(64));
  const result = sanitizeStringArray(big);
  assert.ok(result.length < 200);
  const totalBytes = result.reduce((sum, s) => sum + s.length + 2, 0);
  assert.ok(totalBytes <= 8000);
});

test("sanitizeStringArray collapses newlines/tabs to space", () => {
  assert.deepEqual(sanitizeStringArray(["a\nb\tc"]), ["a b c"]);
});
