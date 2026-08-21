const { test } = require("node:test");
const assert = require("node:assert");
const { buildTransactionOrderBy } = require("../utils/transactionSort");

test("defaults to date DESC with a stable id tiebreak", () => {
  assert.strictEqual(
    buildTransactionOrderBy(undefined, undefined),
    "ORDER BY t.date DESC NULLS LAST, t.id DESC",
  );
});

test("sorts by a whitelisted column and direction", () => {
  assert.strictEqual(
    buildTransactionOrderBy("amount", "asc"),
    "ORDER BY t.amount ASC NULLS LAST, t.id DESC",
  );
  assert.strictEqual(
    buildTransactionOrderBy("description", "desc"),
    "ORDER BY t.description DESC NULLS LAST, t.id DESC",
  );
  assert.strictEqual(
    buildTransactionOrderBy("category", "asc"),
    "ORDER BY c.name ASC NULLS LAST, t.id DESC",
  );
});

test("is case-insensitive on both arguments", () => {
  assert.strictEqual(
    buildTransactionOrderBy("AMOUNT", "ASC"),
    "ORDER BY t.amount ASC NULLS LAST, t.id DESC",
  );
});

test("falls back to date for an unknown or malicious sort key", () => {
  for (const bad of ["t.date; DROP TABLE transactions", "user_id", "", null, 42]) {
    assert.strictEqual(
      buildTransactionOrderBy(bad, "asc"),
      "ORDER BY t.date ASC NULLS LAST, t.id DESC",
      `sort=${JSON.stringify(bad)} must fall back to date`,
    );
  }
});

test("any order that is not 'asc' becomes DESC", () => {
  for (const bad of ["descending", "; DROP", "", null]) {
    assert.strictEqual(
      buildTransactionOrderBy("date", bad),
      "ORDER BY t.date DESC NULLS LAST, t.id DESC",
    );
  }
});
