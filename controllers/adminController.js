const db = require("../config/db");

const VALID_TABLES = new Set(["categories", "sources", "targets"]);
const COL_MAP = {
  category_id: "category_id",
  source_id: "source_id",
  target_id: "target_id",
};

function assertValidTable(t) {
  if (!VALID_TABLES.has(t)) {
    throw new Error("Invalid table");
  }
}

function mapCol(c) {
  if (!COL_MAP[c]) {
    throw new Error("Invalid column");
  }
  return COL_MAP[c];
}

function parsePagination(q) {
  const page = Math.max(1, Number(q.page) || 1);
  const pageSizeRaw = Number(q.pageSize) || 20;
  const pageSize = Math.min(Math.max(1, pageSizeRaw), 100);
  const offset = (page - 1) * pageSize;
  return { page, pageSize, offset };
}

function buildSearchAndOwnerFilters({ table, q, user_id }) {
  const where = [];
  const params = [];
  let idx = 1;

  // Categories are global now (no user_id). Keep owner filter only for sources/targets.
  if (user_id && table !== "categories") {
    where.push(`${table}.user_id = $${idx++}`);
    params.push(Number(user_id));
  }
  if (q) {
    // Use normalized name when table is categories; otherwise plain name
    if (table === "categories") {
      where.push(`${table}.name_norm LIKE LOWER(TRIM($${idx++}))`);
      params.push(`%${q.trim()}%`);
    } else {
      where.push(`${table}.name ILIKE $${idx++}`);
      params.push(`%${q.trim()}%`);
    }
  }

  const whereClause = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";
  return { whereClause, params, nextIndex: idx };
}

/**
 * Generic list fetcher
 */
async function listEntities(table, req, res) {
  try {
    assertValidTable(table);
    const { q, user_id, sortBy, sortDir } = req.query;
    const { page, pageSize, offset } = parsePagination(req.query);

    const { whereClause, params } = buildSearchAndOwnerFilters({
      table,
      q,
      user_id,
    });

    // Sorting: default by name asc; allow owner/name for non-categories
    const safeSortBy = (() => {
      if (table === "categories") return "name";
      return sortBy === "owner_display" ? "owner" : "name";
    })();
    const safeSortDir =
      String(sortDir || "asc").toLowerCase() === "desc" ? "DESC" : "ASC";

    let listQuery;
    let countQuery;

    if (table === "categories") {
      listQuery = `
        SELECT 
          t.id,
          t.name
        FROM ${table} t
        ${whereClause.replaceAll(`${table}.`, "t.")}
        ORDER BY t.name ${safeSortDir}
        LIMIT $${params.length + 1}
        OFFSET $${params.length + 2};
      `;
      countQuery = `
        SELECT COUNT(*)::int AS total
        FROM ${table} t
        ${whereClause.replaceAll(`${table}.`, "t.")};
      `;
    } else {
      listQuery = `
        SELECT 
          t.id, 
          t.user_id, 
          t.name,
          u.first_name,
          u.last_name,
          u.email
        FROM ${table} t
        JOIN users u ON u.id = t.user_id
        ${whereClause.replaceAll(`${table}.`, "t.")}
        ORDER BY ${safeSortBy === "owner" ? "u.last_name NULLS LAST, u.first_name NULLS LAST, u.email" : "t.name"} ${safeSortDir}
        LIMIT $${params.length + 1}
        OFFSET $${params.length + 2};
      `;
      countQuery = `
        SELECT COUNT(*)::int AS total
        FROM ${table} t
        ${whereClause.replaceAll(`${table}.`, "t.")};
      `;
    }

    const [listRes, countRes] = await Promise.all([
      db.query(listQuery, [...params, pageSize, offset]),
      db.query(countQuery, params),
    ]);

    // Map response
    let data;
    if (table === "categories") {
      data = listRes.rows.map((r) => ({
        id: r.id,
        name: r.name,
        // Global owner label for categories
        owner_display: "Global",
      }));
    } else {
      data = listRes.rows.map((r) => {
        const fn = (r.first_name || "").trim();
        const ln = (r.last_name || "").trim();
        const name = [fn, ln].filter(Boolean).join(" ");
        const owner_display = name ? `${name} (${r.email})` : r.email;
        return {
          id: r.id,
          user_id: r.user_id,
          name: r.name,
          owner_display,
          first_name: r.first_name,
          last_name: r.last_name,
          email: r.email,
        };
      });
    }

    return res.json({
      success: true,
      data,
      pagination: {
        page,
        pageSize,
        total: countRes.rows[0]?.total || 0,
      },
    });
  } catch (err) {
    console.error(`Admin list ${table} error:`, err);
    return res.status(500).json({ message: "Server error" });
  }
}

/**
 * Rename entity with uniqueness enforcement
 */
async function renameEntity(table, req, res) {
  const { id } = req.params;
  const { name } = req.body;

  if (!name || !String(name).trim()) {
    return res.status(400).json({ message: "Name is required" });
  }

  try {
    // Fetch current row to get user_id
    const curRes = await db.query(
      `SELECT id, user_id FROM ${table} WHERE id = $1`,
      [id],
    );
    if (curRes.rows.length === 0) {
      return res.status(404).json({ message: "Not found" });
    }
    const ownerId = curRes.rows[0].user_id;

    // Attempt update; rely on UNIQUE(user_id, name) to guard duplicates
    const updRes = await db.query(
      `UPDATE ${table} SET name = $1 WHERE id = $2 RETURNING id, user_id, name`,
      [String(name).trim(), id],
    );
    return res.json({ success: true, data: updRes.rows[0] });
  } catch (err) {
    if (err.code === "23505") {
      return res.status(409).json({ message: "Duplicate name for this user" });
    }
    console.error(`Admin rename ${table} error:`, err);
    return res.status(500).json({ message: "Server error" });
  }
}

/**
 * Delete entity optionally reassigning references (same-owner only)
 */
async function deleteEntityWithReassign({ table, refColumn, req, res }) {
  const { id } = req.params;
  const reassignTo = req.query.reassign_to
    ? Number(req.query.reassign_to)
    : null;

  // Validate table is one of the allowed whitelist to avoid SQL injection on identifiers
  assertValidTable(table);

  try {
    await db.query("BEGIN");

    // Load current row
    const curRes = await db.query(
      `SELECT id${table !== "categories" ? ", user_id" : ""} FROM ${table} WHERE id = $1`,
      [id],
    );
    if (curRes.rows.length === 0) {
      await db.query("ROLLBACK");
      return res.status(404).json({ message: "Not found" });
    }

    // If reassignment requested, optionally validate same owner when applicable (not for categories)
    if (reassignTo != null) {
      if (Number(reassignTo) === Number(id)) {
        await db.query("ROLLBACK");
        return res
          .status(400)
          .json({ message: "Cannot reassign to the same entity" });
      }
      if (table !== "categories") {
        const ownerId = curRes.rows[0].user_id;
        const targetRes = await db.query(
          `SELECT id, user_id FROM ${table} WHERE id = $1`,
          [reassignTo],
        );
        if (targetRes.rows.length === 0) {
          await db.query("ROLLBACK");
          return res.status(404).json({ message: "Reassign target not found" });
        }
        if (Number(targetRes.rows[0].user_id) !== Number(ownerId)) {
          await db.query("ROLLBACK");
          return res
            .status(400)
            .json({ message: "Reassign target must belong to the same user" });
        }
      }

      // Reassign references in transactions
      const col = mapCol(refColumn); // 'category_id' | 'source_id' | 'target_id'
      await db.query(`UPDATE transactions SET ${col} = $1 WHERE ${col} = $2`, [
        reassignTo,
        id,
      ]);
    } else {
      // If no reassign, ensure there are no referencing transactions
      const refCountRes = await db.query(
        `SELECT COUNT(*)::int AS cnt FROM transactions WHERE ${refColumn} = $1`,
        [id],
      );
      const refCount = refCountRes.rows[0]?.cnt || 0;
      if (refCount > 0) {
        await db.query("ROLLBACK");
        return res.status(409).json({
          message:
            "Entity is referenced by transactions; provide reassign_to to consolidate",
          code: "REFERENCED",
          refCount,
          reassignRequired: true,
        });
      }
    }

    // Delete the entity
    await db.query(`DELETE FROM ${table} WHERE id = $1`, [id]);

    await db.query("COMMIT");
    return res.json({ success: true });
  } catch (err) {
    await db.query("ROLLBACK");
    console.error(`Admin delete ${table} error:`, err);
    return res.status(500).json({ message: "Server error" });
  }
}

/**
 * Merge categories: move all transactions from :id to into_category_id (same owner), then delete :id.
 */
async function mergeCategory(req, res) {
  const { id } = req.params;
  const { into_category_id } = req.body;

  if (!into_category_id) {
    return res.status(400).json({ message: "into_category_id is required" });
  }

  try {
    await db.query("BEGIN");

    const curRes = await db.query(`SELECT id FROM categories WHERE id = $1`, [
      id,
    ]);
    if (curRes.rows.length === 0) {
      await db.query("ROLLBACK");
      return res.status(404).json({ message: "Category not found" });
    }
    const tgtRes = await db.query(`SELECT id FROM categories WHERE id = $1`, [
      into_category_id,
    ]);
    if (tgtRes.rows.length === 0) {
      await db.query("ROLLBACK");
      return res.status(404).json({ message: "Target category not found" });
    }

    // Reassign and delete
    await db.query(
      `UPDATE transactions SET category_id = $1 WHERE category_id = $2`,
      [into_category_id, id],
    );
    await db.query(`DELETE FROM categories WHERE id = $1`, [id]);

    await db.query("COMMIT");
    return res.json({ success: true });
  } catch (err) {
    await db.query("ROLLBACK");
    console.error("Admin merge category error:", err);
    return res.status(500).json({ message: "Server error" });
  }
}

// Cleanup sample data
const cleanupSampleData = async (req, res) => {
  try {
    // Directly execute cleanup logic instead of spawning child process
    const cleanup = require("../scripts/cleanup-sample-data");
    await cleanup();
    res.json({ success: true, message: "Sample data cleaned up successfully" });
  } catch (err) {
    console.error("Cleanup sample data error:", err);
    res.status(500).json({ message: "Failed to clean up sample data" });
  }
};

// Get system statistics
const getSystemStats = async (req, res) => {
  try {
    const usersCount = await db.query("SELECT COUNT(*) FROM users");
    const transactionsCount = await db.query(
      "SELECT COUNT(*) FROM transactions",
    );
    const categoriesCount = await db.query("SELECT COUNT(*) FROM categories");
    const sourcesCount = await db.query("SELECT COUNT(*) FROM sources");
    const targetsCount = await db.query("SELECT COUNT(*) FROM targets");

    res.json({
      success: true,
      stats: {
        users: parseInt(usersCount.rows[0].count),
        transactions: parseInt(transactionsCount.rows[0].count),
        categories: parseInt(categoriesCount.rows[0].count),
        sources: parseInt(sourcesCount.rows[0].count),
        targets: parseInt(targetsCount.rows[0].count),
      },
    });
  } catch (err) {
    console.error("Get system stats error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// Handlers exposed
module.exports = {
  getSystemStats,
  cleanupSampleData,
  removeSampleData: cleanupSampleData,
  // Categories (global: no owner join/filter in listEntities)
  listCategories: (req, res) => listEntities("categories", req, res),
  // Global rename: no owner uniqueness, use normalized unique constraint
  renameCategory: async (req, res) => {
    const { id } = req.params;
    const { name } = req.body;

    if (!name || !String(name).trim()) {
      return res.status(400).json({ message: "Name is required" });
    }

    try {
      const curRes = await db.query(`SELECT id FROM categories WHERE id = $1`, [
        id,
      ]);
      if (curRes.rows.length === 0) {
        return res.status(404).json({ message: "Not found" });
      }
      const updRes = await db.query(
        `UPDATE categories SET name = $1 WHERE id = $2 RETURNING id, name`,
        [String(name).trim(), id],
      );
      return res.json({ success: true, data: updRes.rows[0] });
    } catch (err) {
      if (err.code === "23505") {
        return res
          .status(409)
          .json({ message: "Category name already exists" });
      }
      console.error("Admin rename categories error:", err);
      return res.status(500).json({ message: "Server error" });
    }
  },
  deleteCategory: (req, res) =>
    deleteEntityWithReassign({
      table: "categories",
      refColumn: "category_id",
      req,
      res,
    }),
  // mergeCategory remains but is largely unnecessary after global merge
  mergeCategory,

  // Sources
  listSources: (req, res) => listEntities("sources", req, res),
  renameSource: (req, res) => renameEntity("sources", req, res),
  deleteSource: (req, res) =>
    deleteEntityWithReassign({
      table: "sources",
      refColumn: "source_id",
      req,
      res,
    }),

  // Targets (global like categories)
  listTargets: async (req, res) => {
    try {
      const { q, sortDir } = req.query;
      const { page, pageSize, offset } = parsePagination(req.query);

      const where = [];
      const params = [];
      if (q && String(q).trim()) {
        params.push(`%${String(q).trim()}%`);
        where.push(`t.name_norm LIKE LOWER(TRIM($${params.length}))`);
      }
      const whereClause = where.length ? `WHERE ${where.join(" AND ")}` : "";
      const orderDir =
        String(sortDir || "asc").toLowerCase() === "desc" ? "DESC" : "ASC";

      const listQuery = `
        SELECT t.id, t.name
        FROM targets t
        ${whereClause}
        ORDER BY t.name ${orderDir}
        LIMIT $${params.length + 1}
        OFFSET $${params.length + 2};
      `;
      const countQuery = `
        SELECT COUNT(*)::int AS total
        FROM targets t
        ${whereClause};
      `;

      const [listRes, countRes] = await Promise.all([
        db.query(listQuery, [...params, pageSize, offset]),
        db.query(countQuery, params),
      ]);

      const data = listRes.rows.map((r) => ({
        id: r.id,
        name: r.name,
        owner_display: "Global",
      }));

      return res.json({
        success: true,
        data,
        pagination: { page, pageSize, total: countRes.rows[0]?.total || 0 },
      });
    } catch (err) {
      console.error("Admin list targets error:", err);
      return res.status(500).json({ message: "Server error" });
    }
  },
  // Global rename for targets
  renameTarget: async (req, res) => {
    const { id } = req.params;
    const { name } = req.body;

    if (!name || !String(name).trim()) {
      return res.status(400).json({ message: "Name is required" });
    }

    try {
      const curRes = await db.query(`SELECT id FROM targets WHERE id = $1`, [
        id,
      ]);
      if (curRes.rows.length === 0) {
        return res.status(404).json({ message: "Not found" });
      }
      const updRes = await db.query(
        `UPDATE targets SET name = $1 WHERE id = $2 RETURNING id, name`,
        [String(name).trim(), id],
      );
      return res.json({ success: true, data: updRes.rows[0] });
    } catch (err) {
      if (err.code === "23505") {
        return res.status(409).json({ message: "Target name already exists" });
      }
      console.error("Admin rename targets error:", err);
      return res.status(500).json({ message: "Server error" });
    }
  },
  // Global delete for targets with optional reassignment
  deleteTarget: (req, res) =>
    deleteEntityWithReassign({
      table: "targets",
      refColumn: "target_id",
      req,
      res,
    }),
};
