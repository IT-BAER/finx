/**
 * Pure helpers for per-account balances.
 *
 * An account lives in two unlinked tables: `sources` (the source side of EXPENSES) and
 * `targets` (the target side of INCOMES), joined only by name within a single owner — see
 * utils/sourceFilter.js. A balance that only summed `source_id` would therefore miss every
 * income paid into the account.
 *
 * Displayed balance = synced_balance when SimpleFIN reported one, else
 * opening_balance + all-time net. The opening balance is the user-correctable number.
 * This repo (self-hosted) has no SimpleFIN, so callers pass withSynced:false and the synced
 * columns come back NULL. The file is kept byte-identical to finx-server otherwise.
 */

/** Matches the same-named targets rows of a source's owner. Used twice per row on purpose. */
const MATCHING_TARGET_IDS = `
        SELECT tg.id FROM targets tg
        WHERE tg.user_id = s.user_id
          AND LOWER(TRIM(tg.name)) = LOWER(TRIM(s.name))`;

/**
 * Build the per-source balance query.
 *
 * Sign convention, by which side of the flow the account sits on:
 *   - the account is the transaction's source  -> money left it   -> -amount
 *   - an income landed on its same-named target -> money entered it -> +amount
 *   - both at once (paying yourself)            -> a wash          ->  0
 *
 * @param {number[]} userIds accessible owner ids (requester + anyone sharing with them)
 * @param {{withSynced?: boolean}} [opts] withSynced=false omits the SimpleFIN columns,
 *        for the self-hosted schema that has no such columns.
 * @returns {{text: string, values: any[]}}
 */
function buildBalancesQuery(userIds, opts = {}) {
  const withSynced = opts.withSynced !== false;
  const syncedCols = withSynced
    ? "s.synced_balance,\n      s.synced_balance_at,"
    : "NULL::numeric AS synced_balance,\n      NULL::timestamptz AS synced_balance_at,";
  const text = `
    SELECT
      s.id,
      s.name,
      s.user_id,
      s.opening_balance,
      ${syncedCols}
      COALESCE((
        SELECT SUM(
          CASE
            WHEN t.source_id = s.id AND t.target_id IN (${MATCHING_TARGET_IDS}
            ) THEN 0
            WHEN t.source_id = s.id THEN -t.amount
            ELSE t.amount
          END
        )
        FROM transactions t
        WHERE t.user_id = ANY($1::int[])
          AND (
            t.source_id = s.id
            OR (
              LOWER(t.type) = 'income'
              AND t.target_id IN (${MATCHING_TARGET_IDS}
              )
            )
          )
      ), 0) AS net
    FROM sources s
    WHERE s.user_id = ANY($1::int[])
    ORDER BY LOWER(s.name) ASC`;
  return { text, values: [userIds] };
}

/**
 * Map one query row to the API shape. Numerics arrive from pg as strings.
 * @param {object} row
 */
function rowToBalance(row) {
  const opening = Number.parseFloat(row.opening_balance ?? 0) || 0;
  const net = Number.parseFloat(row.net ?? 0) || 0;
  const hasSynced = row.synced_balance !== null && row.synced_balance !== undefined;
  const synced = hasSynced ? Number.parseFloat(row.synced_balance) : null;
  const isSynced = hasSynced && Number.isFinite(synced);
  return {
    sourceId: row.id,
    name: row.name,
    ownerUserId: row.user_id,
    openingBalance: opening,
    net,
    balance: isSynced ? synced : opening + net,
    isSynced,
    syncedAt: isSynced ? row.synced_balance_at : null,
  };
}

/**
 * Sum of every account's balance. Currency-blind: `sources` carries no currency, so a user
 * holding accounts in more than one currency gets a meaningless total. Documented limit.
 * @param {Array<{balance: number}>} balances
 */
function sumTotal(balances) {
  if (!Array.isArray(balances)) return 0;
  return balances.reduce((acc, b) => acc + (Number.isFinite(b.balance) ? b.balance : 0), 0);
}

module.exports = { buildBalancesQuery, rowToBalance, sumTotal };
