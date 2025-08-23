const db = require("../config/db");

/**
 * Returns a deduplicated array of user_ids whose data the requester can access.
 * Always includes the requesterId itself, plus any owners who shared with them.
 * Optionally filters by dataType ('income' | 'expenses' | 'all').
 */
async function getAccessibleUserIds(requesterId, dataType = "all") {
  // Fetch all owners who shared with requester
  const query = `
    SELECT owner_user_id, source_filter
    FROM sharing_permissions
    WHERE shared_with_user_id = $1
  `;
  const result = await db.query(query, [requesterId]);

  const owners = [];
  // With source-based sharing, any permission row grants viewing access.
  // If you later scope viewing by source ids, enforce it where you join data.
  for (const row of result.rows) {
    owners.push(row.owner_user_id);
  }

  // Always include the requester themself
  const all = [requesterId, ...owners];
  // Deduplicate
  return Array.from(new Set(all));
}

/**
 * Validates if a requested asUserId is within the accessible user ids for this requester.
 * Returns a single userId (number) to filter on if valid, otherwise null.
 */
async function validateAsUserId(requesterId, asUserId, dataType = "all") {
  if (!asUserId) return null;
  const accessible = await getAccessibleUserIds(requesterId, dataType);
  return accessible.includes(Number(asUserId)) ? Number(asUserId) : null;
}

module.exports = {
  getAccessibleUserIds,
  validateAsUserId,
};
