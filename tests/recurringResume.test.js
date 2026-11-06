const { test } = require("node:test");
const assert = require("node:assert/strict");
const { skipMissedOccurrences } = require("../services/recurringProcessor");

const monthly = (over) => ({
  start_date: "2026-01-15",
  occurrences_created: 0,
  recurrence_type: "monthly",
  recurrence_interval: 1,
  max_occurrences: null,
  ...over,
});

test("resume skips every date missed while paused", () => {
  // Created Feb 15 + Mar 15; Apr/May/Jun 15 missed; Jul 15 still ahead.
  const rule = monthly({ occurrences_created: 2 });
  assert.equal(skipMissedOccurrences(rule, new Date("2026-07-10T09:00:00Z")), 5);
});

test("a date due today is not skipped", () => {
  const rule = monthly({ occurrences_created: 0 });
  assert.equal(skipMissedOccurrences(rule, new Date("2026-02-15T10:00:00Z")), 0);
});

test("skipped dates stop at max_occurrences", () => {
  const rule = monthly({ occurrences_created: 1, max_occurrences: 3 });
  assert.equal(skipMissedOccurrences(rule, new Date("2026-12-01T00:00:00Z")), 3);
});

test("nothing missed leaves the count unchanged", () => {
  const rule = monthly({ occurrences_created: 4 });
  assert.equal(skipMissedOccurrences(rule, new Date("2026-06-01T00:00:00Z")), 4);
});

test("weekly interval 2 skips in two-week steps", () => {
  // Start Thu 1 Jan 2026: due Jan 15, Jan 29, Feb 12; resume Feb 10 -> 2 missed.
  const rule = { start_date: "2026-01-01", occurrences_created: 0, recurrence_type: "weekly", recurrence_interval: 2 };
  assert.equal(skipMissedOccurrences(rule, new Date("2026-02-10T12:00:00Z")), 2);
});
