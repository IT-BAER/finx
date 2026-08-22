const { test } = require("node:test");
const assert = require("node:assert/strict");
const { getTransactionsQuerySchema } = require("../middleware/validation/schemas");

// Regression: category_id was accepted by the controller (aiChat batch S2) but stripped by
// validateQuery before it ever reached the controller, because getTransactionsQuerySchema had
// no key for it — `.strip()`-style zod parsing drops any field not declared in the schema.
test("getTransactionsQuerySchema keeps category_id alongside the other list filters", () => {
  const r = getTransactionsQuerySchema.safeParse({
    category_id: "5",
    startDate: "2026-08-01",
    endDate: "2026-08-31",
  });
  assert.equal(r.success, true);
  assert.equal(r.data.category_id, "5");
});

test("getTransactionsQuerySchema rejects a non-numeric category_id", () => {
  const r = getTransactionsQuerySchema.safeParse({ category_id: "abc" });
  assert.equal(r.success, false);
});

test("getTransactionsQuerySchema treats category_id as optional", () => {
  const r = getTransactionsQuerySchema.safeParse({});
  assert.equal(r.success, true);
  assert.equal(r.data.category_id, undefined);
});
