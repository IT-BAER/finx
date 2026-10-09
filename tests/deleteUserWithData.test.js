const { test } = require("node:test");
const assert = require("node:assert/strict");
const { deleteUserWithData } = require("../utils/deleteUserWithData");

function fakePool({ failOn } = {}) {
  const calls = [];
  let released = false;
  const client = {
    query: async (sql, params) => {
      calls.push({ sql: sql.replace(/\s+/g, " ").trim(), params });
      if (failOn && sql.includes(failOn)) throw Object.assign(new Error("boom"), { code: "23503" });
      if (sql.startsWith("DELETE FROM users")) return { rows: [{ id: params[0] }] };
      return { rows: [] };
    },
    release: () => { released = true; },
  };
  return { pool: { connect: async () => client }, calls, isReleased: () => released };
}

test("deleteUserWithData detaches other users' links, then deletes the user in one transaction", async () => {
  const f = fakePool();
  const out = await deleteUserWithData(28, f.pool);
  assert.deepEqual(out, { id: 28 });
  const sqls = f.calls.map((c) => c.sql);
  assert.equal(sqls[0], "BEGIN");
  assert.equal(sqls.at(-1), "COMMIT");
  const del = sqls.findIndex((s) => s.startsWith("DELETE FROM users WHERE id = $1"));
  assert.equal(del, sqls.length - 2);
  assert.ok(!sqls.some((s) => s.includes("category_id")), "global categories are never detached");
  for (const col of ["source_id", "target_id"]) {
    const i = sqls.findIndex((s) => s.startsWith(`UPDATE transactions SET ${col} = NULL`));
    assert.ok(i > 0 && i < del, `transactions.${col} detached before the delete`);
    assert.match(sqls[i], /user_id IS DISTINCT FROM \$1/);
  }
  assert.ok(f.calls.every((c) => c.sql === "BEGIN" || c.sql === "COMMIT" || c.params?.[0] === 28));
  assert.equal(f.isReleased(), true);
});

test("deleteUserWithData rolls back and rethrows when the delete fails", async () => {
  const f = fakePool({ failOn: "DELETE FROM users" });
  await assert.rejects(() => deleteUserWithData(28, f.pool), /boom/);
  const sqls = f.calls.map((c) => c.sql);
  assert.equal(sqls.at(-1), "ROLLBACK");
  assert.ok(!sqls.includes("COMMIT"));
  assert.equal(f.isReleased(), true);
});
