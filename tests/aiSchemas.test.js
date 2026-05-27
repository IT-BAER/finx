const { test } = require("node:test");
const assert = require("node:assert/strict");
const { parseRequestSchema, parseResponseSchema } = require("../utils/aiSchemas");

test("parseRequestSchema accepts minimal valid body", () => {
  const r = parseRequestSchema.safeParse({ text: "Spent 5 EUR at Coffee" });
  assert.equal(r.success, true);
});

test("parseRequestSchema rejects missing text", () => {
  const r = parseRequestSchema.safeParse({});
  assert.equal(r.success, false);
});

test("parseRequestSchema rejects text > 2000 chars", () => {
  const r = parseRequestSchema.safeParse({ text: "a".repeat(2001) });
  assert.equal(r.success, false);
});

test("parseRequestSchema strips unknown fields", () => {
  const r = parseRequestSchema.safeParse({ text: "hi", evil: "payload" });
  assert.equal(r.success, true);
  assert.equal(r.data.evil, undefined);
});

test("parseResponseSchema enforces amount + type + 80-char description", () => {
  const ok = parseResponseSchema.safeParse({
    amount: 5.5,
    type: "expense",
    description: "Coffee",
    category: null,
    source: null,
    target: null,
    date: null,
  });
  assert.equal(ok.success, true);
  const bad = parseResponseSchema.safeParse({
    amount: 5.5,
    type: "lol",
    description: "x".repeat(200),
  });
  assert.equal(bad.success, false);
});
