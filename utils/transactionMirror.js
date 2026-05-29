const db = require("../config/db");
const Transaction = require("../models/Transaction");

// Permission levels that grant write access (mirror creation only happens for
// counterparties who shared a source with write permission).
const WRITABLE_LEVELS = new Set([
  "write",
  "edit",
  "read_write",
  "read-write",
  "rw",
  "readwrite",
  "full",
  "owner",
]);

const normLower = (s) => (s == null ? "" : String(s).trim().toLowerCase());

// Resolve (or create) a category id under the given owner. Categories are shared
// globally by name, matching the behaviour of createTransaction.
async function resolveCategoryId(ownerId, name) {
  const n = name == null ? null : String(name).trim();
  if (!n) return null;
  const found = await db.query(
    "SELECT id FROM categories WHERE LOWER(TRIM(name)) = LOWER(TRIM($1)) ORDER BY id ASC LIMIT 1",
    [n],
  );
  if (found.rows.length > 0) return found.rows[0].id;
  const created = await db.query(
    "INSERT INTO categories (user_id, name) VALUES ($1, $2) RETURNING id",
    [ownerId, n],
  );
  return created.rows[0].id;
}

// Resolve (or create) a per-user source/target id under the given owner.
async function resolveNamedId(table, ownerId, name) {
  const n = name == null ? null : String(name).trim();
  if (!n) return null;
  const found = await db.query(
    `SELECT id FROM ${table} WHERE user_id = $1 AND LOWER(TRIM(name)) = LOWER(TRIM($2)) LIMIT 1`,
    [ownerId, n],
  );
  if (found.rows.length > 0) return found.rows[0].id;
  const created = await db.query(
    `INSERT INTO ${table} (user_id, name) VALUES ($1, $2) RETURNING id`,
    [ownerId, n],
  );
  return created.rows[0].id;
}

/**
 * Determine the counterparty (mirror owner) for a transaction.
 *
 * For an EXPENSE, the counterparty is the TARGET (money goes to them) -> they
 * receive INCOME. For an INCOME, the counterparty is the SOURCE (money comes
 * from them) -> they record an EXPENSE.
 *
 * A mirror is only created when that counterparty owns a SOURCE named after the
 * matched field AND has shared it with the creator using a write permission.
 *
 * @returns {Promise<{ownerUserId:number, mirrorType:string}|null>}
 */
async function findMirrorOwner(creatorUserId, { type, sourceName, targetName }) {
  const t = normLower(type);
  let matchName = null;
  let mirrorType = null;
  if (t === "expense") {
    matchName = targetName;
    mirrorType = "income";
  } else if (t === "income") {
    matchName = sourceName;
    mirrorType = "expense";
  } else {
    return null;
  }
  const nameLower = normLower(matchName);
  if (!nameLower) return null;

  const q = `
    SELECT sp.owner_user_id, sp.permission_level, sp.source_filter,
           s.id AS source_id, s.name AS source_name
    FROM sharing_permissions sp
    JOIN sources s
      ON s.user_id = sp.owner_user_id
     AND LOWER(TRIM(s.name)) = $2
    WHERE sp.shared_with_user_id = $1
  `;
  const res = await db.query(q, [creatorUserId, nameLower]);
  for (const row of res.rows) {
    const level = normLower(row.permission_level);
    if (!WRITABLE_LEVELS.has(level)) continue;
    if (Number(row.owner_user_id) === Number(creatorUserId)) continue;

    // If a source_filter is defined, the matched source must be within it
    // (by id or by name).
    if (row.source_filter) {
      try {
        const parsed = JSON.parse(row.source_filter);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const idStr = String(row.source_id);
          const ids = parsed.map((x) => String(x).trim());
          const names = parsed.map((x) => normLower(x));
          if (!ids.includes(idStr) && !names.includes(nameLower)) continue;
        }
      } catch (e) {
        // Unparseable filter -> treat as unrestricted
      }
    }
    return { ownerUserId: Number(row.owner_user_id), mirrorType };
  }
  return null;
}

/**
 * Create a mirrored transaction for a freshly created transaction, if a
 * matching write-shared counterparty exists. The mirror keeps the same source
 * and target names, amount, date, description and category; only the owner and
 * type differ. Returns { ownerUserId, mirror } or null.
 */
async function createMirror(originalTxn, { categoryName, sourceName, targetName }) {
  try {
    // Never mirror a mirror (loop prevention).
    if (originalTxn.mirrored_from_transaction_id) return null;

    const match = await findMirrorOwner(originalTxn.user_id, {
      type: originalTxn.type,
      sourceName,
      targetName,
    });
    if (!match) return null;

    const { ownerUserId, mirrorType } = match;

    // Guard against duplicate mirrors for the same origin.
    const existing = await db.query(
      "SELECT id FROM transactions WHERE mirrored_from_transaction_id = $1 LIMIT 1",
      [originalTxn.id],
    );
    if (existing.rows.length > 0) return null;

    const categoryId = await resolveCategoryId(ownerUserId, categoryName);
    const sourceId = await resolveNamedId("sources", ownerUserId, sourceName);
    const targetId = await resolveNamedId("targets", ownerUserId, targetName);

    const mirror = await Transaction.create(
      ownerUserId,
      categoryId,
      sourceId,
      targetId,
      originalTxn.amount,
      mirrorType,
      originalTxn.description,
      originalTxn.date,
      null, // recurring_transaction_id
      originalTxn.id, // mirrored_from_transaction_id
    );
    return { ownerUserId, mirror };
  } catch (err) {
    console.warn("createMirror failed:", err && err.message ? err.message : err);
    return null;
  }
}

/**
 * Keep the mirror in sync after the original is updated. Implemented as a
 * delete + recreate so a changed counterparty name re-targets correctly.
 * Returns the set of affected owner ids (old + new) for SSE/cache.
 */
async function syncMirrorOnUpdate(originalTxn, names) {
  const affected = new Set();
  try {
    const removed = await deleteMirror(originalTxn.id);
    removed.forEach((id) => affected.add(id));
    const created = await createMirror(originalTxn, names);
    if (created) affected.add(created.ownerUserId);
  } catch (err) {
    console.warn("syncMirrorOnUpdate failed:", err && err.message ? err.message : err);
  }
  return [...affected];
}

/**
 * Delete any mirror(s) created from the given origin transaction id.
 * Returns the affected owner ids for SSE/cache invalidation.
 */
async function deleteMirror(originalId) {
  try {
    const res = await db.query(
      "DELETE FROM transactions WHERE mirrored_from_transaction_id = $1 RETURNING user_id",
      [originalId],
    );
    return res.rows.map((r) => Number(r.user_id));
  } catch (err) {
    console.warn("deleteMirror failed:", err && err.message ? err.message : err);
    return [];
  }
}

module.exports = {
  findMirrorOwner,
  createMirror,
  syncMirrorOnUpdate,
  deleteMirror,
};
