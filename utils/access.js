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
 * Returns a list of user IDs who have been granted access by the given owner.
 * This is the inverse of getAccessibleUserIds and is used to broadcast updates
 * to all clients that can see the owner's data.
 */
async function getUsersSharedWithOwner(ownerUserId) {
  const query = `
    SELECT shared_with_user_id
    FROM sharing_permissions
    WHERE owner_user_id = $1
  `;
  const res = await db.query(query, [ownerUserId]);
  const ids = res.rows.map((r) => Number(r.shared_with_user_id)).filter((n) => !Number.isNaN(n));
  // Deduplicate and exclude self just in case
  return Array.from(new Set(ids)).filter((id) => Number(id) !== Number(ownerUserId));
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

/**
 * Returns sharing permission metadata for a specific owner -> requester pair.
 * Includes whether the level is writable and parsed source_filter ids (both numeric and string for robustness).
 */
async function getSharingPermissionMeta(ownerUserId, requesterId) {
  const query = `
    SELECT permission_level, source_filter
    FROM sharing_permissions
    WHERE owner_user_id = $1 AND shared_with_user_id = $2
    LIMIT 1
  `;
  const res = await db.query(query, [ownerUserId, requesterId]);
  if (res.rows.length === 0) {
    return { exists: false, writable: false, allowedSourceIdsNum: null, allowedSourceIdsStr: null, allowedSourceNamesLower: null };
  }
  const row = res.rows[0];
  const level = String(row.permission_level || "").trim().toLowerCase();
  const writableLevels = new Set(["write","edit","read_write","read-write","rw","readwrite","full","owner"]);
  let allowedSourceIdsNum = null;
  let allowedSourceIdsStr = null;
  let allowedSourceNamesLower = null;
  if (row.source_filter) {
    try {
      const parsed = JSON.parse(row.source_filter);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const nums = [];
        const strs = [];
        const nameCandidates = [];
        for (const x of parsed) {
          const sx = String(x).trim();
          const n = Number(sx);
          if (!Number.isNaN(n) && sx !== "") {
            nums.push(n);
            strs.push(sx);
          } else if (sx) {
            nameCandidates.push(sx.toLowerCase());
          }
        }
        allowedSourceIdsNum = nums.length > 0 ? nums : null;
        allowedSourceIdsStr = strs.length > 0 ? strs : null;
        allowedSourceNamesLower = nameCandidates.length > 0 ? nameCandidates : null;
        if (nums.length > 0) {
          try {
            const namesRes = await db.query(
              `SELECT name FROM sources WHERE user_id = $1 AND id = ANY($2)`,
              [ownerUserId, nums],
            );
            allowedSourceNamesLower = namesRes.rows
              .map((row) => String(row.name || "").trim().toLowerCase())
              .filter((s) => s.length > 0)
              .concat(allowedSourceNamesLower || [])
              .filter((v, i, a) => a.indexOf(v) === i);
          } catch (e) {
            // ignore
          }
        }
      }
    } catch (e) {
      // ignore parse errors
    }
  }
  return { exists: true, writable: writableLevels.has(level), allowedSourceIdsNum, allowedSourceIdsStr, allowedSourceNamesLower };
}

module.exports = {
  getAccessibleUserIds,
  validateAsUserId,
  getSharingPermissionMeta,
  getUsersSharedWithOwner,
};
