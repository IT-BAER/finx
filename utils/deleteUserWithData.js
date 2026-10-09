// Deletes a user and their data in one transaction. Own sources/targets/transactions go via
// ON DELETE CASCADE; categories are global and only lose their owner (SET NULL). Links from
// OTHER users' rows (shared accounts) to this user's sources/targets are cleared first (NO ACTION FKs).
const DETACH_SQL = [
  "UPDATE transactions SET source_id = NULL WHERE user_id IS DISTINCT FROM $1 AND source_id IN (SELECT id FROM sources WHERE user_id = $1)",
  "UPDATE transactions SET target_id = NULL WHERE user_id IS DISTINCT FROM $1 AND target_id IN (SELECT id FROM targets WHERE user_id = $1)",
];

async function deleteUserWithData(userId, pool = require("../config/db").pool) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const sql of DETACH_SQL) await client.query(sql, [userId]);
    const result = await client.query("DELETE FROM users WHERE id = $1 RETURNING *", [userId]);
    await client.query("COMMIT");
    return result.rows[0] || null;
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { deleteUserWithData };
