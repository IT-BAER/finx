/**
 * Pure helpers for the transaction "source filter" — filtering the overview / list by a set
 * of account source ids.
 *
 * An account lives in two unlinked tables: `sources` (used on the source side of EXPENSES)
 * and `targets` (used on the target side of INCOMES). They are joined only by name within a
 * single user (no id link). So filtering by a set of source ids must match BOTH:
 *   - expenses whose `source_id` is one of the selected ids, AND
 *   - incomes whose target is the same-named account, resolved per owner
 *     (the selected source's name == the income's target name, for the same user).
 *
 * Selecting only `source_id` (the old behaviour) silently dropped every income on the
 * filtered account, which is what made a shared account show expenses but not incomes.
 */

/**
 * Parse a CSV string like "42,7" (or an array) into a de-duped list of positive ints.
 * Anything non-numeric / <= 0 is ignored. Returns [] for null/empty/garbage.
 * @param {string|string[]|null|undefined} raw
 * @returns {number[]}
 */
function parseSourceIds(raw) {
  if (raw == null) return [];
  const parts = Array.isArray(raw) ? raw : String(raw).split(",");
  const ids = [];
  for (const part of parts) {
    const n = Number.parseInt(String(part).trim(), 10);
    if (Number.isInteger(n) && n > 0 && !ids.includes(n)) ids.push(n);
  }
  return ids;
}

/**
 * Build a SQL boolean clause matching transactions that touch any of `sourceIds`, on either
 * the source (expense) or target (income) side. The income branch resolves the selected
 * source ids to their owner+name, then to the matching `targets.id` of the same owner, so it
 * is precise (id-based after a name resolution) and owner-scoped — no cross-user collisions.
 *
 * The clause is self-contained: it only references the transactions row, so it works whether
 * or not the outer query joins `targets` (e.g. the unaliased `getSummary` query).
 *
 * @param {number[]} sourceIds  already run through parseSourceIds
 * @param {number} paramIndex   1-based positional index for the single array bind param ($N)
 * @param {string} [alias="t"]  alias of the transactions row ("" for an unaliased table)
 * @returns {{clause:string, values:any[], nextIndex:number}}
 *          When sourceIds is empty: clause "" / values [] / nextIndex unchanged (append nothing).
 */
function buildSourceFilterClause(sourceIds, paramIndex, alias = "t") {
  if (!Array.isArray(sourceIds) || sourceIds.length === 0) {
    return { clause: "", values: [], nextIndex: paramIndex };
  }
  const a = alias ? `${alias}.` : "";
  const p = `$${paramIndex}`;
  const clause = `(
    ${a}source_id = ANY(${p}::int[])
    OR (
      LOWER(${a}type) = 'income'
      AND ${a}target_id IN (
        SELECT tg2.id FROM targets tg2
        JOIN sources s2 ON s2.user_id = tg2.user_id
                        AND LOWER(TRIM(s2.name)) = LOWER(TRIM(tg2.name))
        WHERE s2.id = ANY(${p}::int[])
      )
    )
  )`;
  return { clause, values: [sourceIds], nextIndex: paramIndex + 1 };
}

module.exports = { parseSourceIds, buildSourceFilterClause };
