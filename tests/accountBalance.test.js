const test = require("node:test");
const assert = require("node:assert");
const {
  buildBalancesQuery,
  rowToBalance,
  sumTotal,
} = require("../utils/accountBalance");

test("query binds the accessible user ids once and scopes both sides", () => {
  const { text, values } = buildBalancesQuery([7, 9]);
  assert.deepStrictEqual(values, [[7, 9]]);
  // One bind param reused for the sources scope, the net subquery, and both membership tests.
  assert.strictEqual((text.match(/\$1::int\[\]/g) || []).length, 4);
  // Incomes are matched through the same-named targets row, not source_id.
  assert.ok(text.includes("LOWER(TRIM(tg.name)) = LOWER(TRIM(s.name))"));
  assert.ok(text.includes("LOWER(t.type) = 'income'"));
});

test("synced columns are selected as NULL when the schema lacks them", () => {
  const withSynced = buildBalancesQuery([1]).text;
  assert.ok(withSynced.includes("s.synced_balance,"));

  const without = buildBalancesQuery([1], { withSynced: false }).text;
  assert.ok(!without.includes("s.synced_balance,"));
  assert.ok(without.includes("NULL::numeric AS synced_balance"));
  assert.ok(without.includes("NULL::timestamptz AS synced_balance_at"));
});

test("balance is opening plus net when nothing is synced", () => {
  const b = rowToBalance({
    id: 3,
    name: "Bank",
    user_id: 7,
    opening_balance: "1000.00",
    synced_balance: null,
    synced_balance_at: null,
    net: "-250.50",
  });
  assert.strictEqual(b.balance, 749.5);
  assert.strictEqual(b.openingBalance, 1000);
  assert.strictEqual(b.net, -250.5);
  assert.strictEqual(b.isSynced, false);
  assert.strictEqual(b.syncedAt, null);
});

test("a synced balance overrides opening plus net", () => {
  const at = "2026-08-21T10:00:00.000Z";
  const b = rowToBalance({
    id: 3,
    name: "Bank",
    user_id: 7,
    opening_balance: "1000.00",
    synced_balance: "42.13",
    synced_balance_at: at,
    net: "-250.50",
  });
  assert.strictEqual(b.balance, 42.13);
  assert.strictEqual(b.isSynced, true);
  assert.strictEqual(b.syncedAt, at);
  // The computed parts are still reported so the UI can explain the difference.
  assert.strictEqual(b.openingBalance, 1000);
  assert.strictEqual(b.net, -250.5);
});

test("a synced balance of zero is authoritative, not treated as missing", () => {
  const b = rowToBalance({
    id: 1,
    name: "Cash",
    user_id: 7,
    opening_balance: "500.00",
    synced_balance: "0.00",
    synced_balance_at: "2026-08-21T10:00:00.000Z",
    net: "10.00",
  });
  assert.strictEqual(b.balance, 0);
  assert.strictEqual(b.isSynced, true);
});

test("missing numerics degrade to zero rather than NaN", () => {
  const b = rowToBalance({ id: 1, name: "Cash", user_id: 7 });
  assert.strictEqual(b.openingBalance, 0);
  assert.strictEqual(b.net, 0);
  assert.strictEqual(b.balance, 0);
  assert.strictEqual(b.isSynced, false);
});

test("total sums every account balance", () => {
  assert.strictEqual(sumTotal([{ balance: 10.5 }, { balance: -3.25 }, { balance: 0 }]), 7.25);
  assert.strictEqual(sumTotal([]), 0);
  assert.strictEqual(sumTotal(null), 0);
  assert.strictEqual(sumTotal([{ balance: Number.NaN }, { balance: 5 }]), 5);
});

test("payers are excluded: a source only counts as an account if it is used like one", () => {
  const { text } = buildBalancesQuery([7]);
  // Spent from, receives income through its same-named target, or has an opening balance.
  assert.ok(text.includes("s.opening_balance <> 0"));
  assert.ok(text.includes("LOWER(te.type) = 'expense'"));
  assert.ok(text.includes("LOWER(ti.type) = 'income'"));
  // The income test goes through targets, so an income's payer row does not qualify.
  assert.ok(text.includes("ti.target_id IN ("));
});

test("a SimpleFIN-synced account counts as an account, and only where that column exists", () => {
  assert.ok(buildBalancesQuery([7]).text.includes("OR s.synced_balance IS NOT NULL"));
  const without = buildBalancesQuery([7], { withSynced: false }).text;
  assert.ok(!without.includes("s.synced_balance IS NOT NULL"));
});
