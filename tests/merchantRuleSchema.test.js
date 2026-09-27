const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  merchantRuleKeyParamSchema,
  merchantRuleBodySchema,
  merchantRuleImportSchema,
} = require("../middleware/validation/schemas");

test("merchantRuleKeyParamSchema normalizes key to trimmed lowercase", () => {
  const r = merchantRuleKeyParamSchema.safeParse({ key: "  Interspar  " });
  assert.equal(r.success, true);
  assert.equal(r.data.key, "interspar");
});

test("merchantRuleKeyParamSchema rejects an empty key", () => {
  const r = merchantRuleKeyParamSchema.safeParse({ key: "   " });
  assert.equal(r.success, false);
});

test("merchantRuleKeyParamSchema rejects a key over 100 chars", () => {
  const r = merchantRuleKeyParamSchema.safeParse({ key: "a".repeat(101) });
  assert.equal(r.success, false);
});

test("merchantRuleKeyParamSchema accepts a 100-char key", () => {
  const r = merchantRuleKeyParamSchema.safeParse({ key: "a".repeat(100) });
  assert.equal(r.success, true);
});

test("merchantRuleBodySchema accepts all-null fields (notification-only rule)", () => {
  const r = merchantRuleBodySchema.safeParse({
    category_id: null,
    source_name: null,
    target_name: null,
    type: null,
  });
  assert.equal(r.success, true);
});

test("merchantRuleBodySchema accepts an empty body (all fields optional)", () => {
  const r = merchantRuleBodySchema.safeParse({});
  assert.equal(r.success, true);
});

test("merchantRuleBodySchema rejects an invalid type", () => {
  const r = merchantRuleBodySchema.safeParse({ type: "transfer" });
  assert.equal(r.success, false);
});

test("merchantRuleBodySchema accepts expense and income", () => {
  assert.equal(merchantRuleBodySchema.safeParse({ type: "expense" }).success, true);
  assert.equal(merchantRuleBodySchema.safeParse({ type: "income" }).success, true);
});

test("merchantRuleBodySchema rejects a source_name over 100 chars", () => {
  const r = merchantRuleBodySchema.safeParse({ source_name: "a".repeat(101) });
  assert.equal(r.success, false);
});

test("merchantRuleImportSchema normalizes merchant_normalized per row", () => {
  const r = merchantRuleImportSchema.safeParse({
    rules: [{ merchant_normalized: "  Rewe  " }],
  });
  assert.equal(r.success, true);
  assert.equal(r.data.rules[0].merchant_normalized, "rewe");
});

test("merchantRuleImportSchema rejects more than 500 rows", () => {
  const rules = Array.from({ length: 501 }, (_, i) => ({ merchant_normalized: `vendor${i}` }));
  const r = merchantRuleImportSchema.safeParse({ rules });
  assert.equal(r.success, false);
});

test("merchantRuleImportSchema accepts exactly 500 rows", () => {
  const rules = Array.from({ length: 500 }, (_, i) => ({ merchant_normalized: `vendor${i}` }));
  const r = merchantRuleImportSchema.safeParse({ rules });
  assert.equal(r.success, true);
});

test("merchantRuleImportSchema rejects a row with a missing merchant_normalized", () => {
  const r = merchantRuleImportSchema.safeParse({ rules: [{ category_id: 1 }] });
  assert.equal(r.success, false);
});
