/**
 * Pure helper for the transaction ledger's sortable columns.
 *
 * The list endpoint sorts server-side (so a sort spans the whole dataset, not just the
 * page currently loaded by the client). The sort key comes from the client, so it must be
 * whitelisted before it touches SQL — never interpolate the raw value.
 */

// Client sort key -> the SQL expression it may sort by. `c` is the categories join alias
// used by the list query; `t` is the transactions row.
const SORT_COLUMNS = {
  date: "t.date",
  amount: "t.amount",
  description: "t.description",
  category: "c.name",
};

/**
 * Build a safe ORDER BY clause from a whitelisted sort key + direction. Unknown keys fall
 * back to `date`; any direction other than `asc` becomes `DESC`. NULLS sort last in both
 * directions (blank descriptions/categories never lead), and `t.id` is always the final
 * tiebreak so pagination is stable.
 *
 * @param {string} sort  one of SORT_COLUMNS keys (case-insensitive)
 * @param {string} order "asc" | "desc" (case-insensitive)
 * @returns {string} e.g. "ORDER BY t.amount ASC NULLS LAST, t.id DESC"
 */
function buildTransactionOrderBy(sort, order) {
  const col = SORT_COLUMNS[String(sort).toLowerCase()] || SORT_COLUMNS.date;
  const dir = String(order).toLowerCase() === "asc" ? "ASC" : "DESC";
  return `ORDER BY ${col} ${dir} NULLS LAST, t.id DESC`;
}

module.exports = { buildTransactionOrderBy, SORT_COLUMNS };
