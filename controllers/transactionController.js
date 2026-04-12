const Transaction = require("../models/Transaction");
const RecurringTransaction = require("../models/RecurringTransaction");
const Category = require("../models/Category");
const User = require("../models/User");
const Goal = require("../models/Goal");
const db = require("../config/db");
const cache = require("../services/cache");
const { getAccessibleUserIds, validateAsUserId, getSharingPermissionMeta, getUsersSharedWithOwner } = require("../utils/access");

// Create transaction
const createTransaction = async (req, res) => {
  try {
    const {
      category,
      source,
      target,
      amount,
      type,
      description,
      date,
      _tempId,
      ...rest
    } = req.body;

    // Validate required fields
    if (!amount || !type) {
      return res.status(400).json({ message: "Amount and type are required" });
    }

    // Normalize incoming strings
    const norm = (s) => (s == null ? null : String(s).trim());
    const normLower = (s) => (s == null ? null : String(s).trim().toLowerCase());

    const inCategory = norm(category);
    const inSource = norm(source);
    const inTarget = norm(target);

    // Handle category (global by name)
    let categoryId = null;
    if (inCategory) {
      try {
        // Try to find any category with the same name regardless of owner
        const categoryResult = await db.query(
          "SELECT id FROM categories WHERE LOWER(TRIM(name)) = LOWER(TRIM($1)) ORDER BY id ASC LIMIT 1",
          [inCategory],
        );
        if (categoryResult.rows.length > 0) {
          categoryId = categoryResult.rows[0].id;
        } else {
          // Create a new category owned by the current user but globally discoverable by name
          const newCategory = await db.query(
            "INSERT INTO categories (user_id, name) VALUES ($1, $2) RETURNING id",
            [req.user.id, inCategory],
          );
          categoryId = newCategory.rows[0].id;
        }
      } catch (err) {
        console.error("Category handling error:", err);
        return res.status(500).json({ message: "Failed to process category" });
      }
    }

    // Handle source and target normally - let frontend manage the semantic mapping
    let source_id = null;
    let target_id = null;

    if (inSource) {
      // Try to find existing source
      const sourceResult = await db.query(
        "SELECT id FROM sources WHERE user_id = $1 AND LOWER(TRIM(name)) = LOWER(TRIM($2)) LIMIT 1",
        [req.user.id, inSource],
      );

      if (sourceResult.rows.length > 0) {
        source_id = sourceResult.rows[0].id;
      } else {
        // Create new source
        const newSource = await db.query(
          "INSERT INTO sources (user_id, name) VALUES ($1, $2) RETURNING id",
          [req.user.id, inSource],
        );
        source_id = newSource.rows[0].id;
      }
    }

    if (inTarget) {
      // Try to find existing target
      const targetResult = await db.query(
        "SELECT id FROM targets WHERE user_id = $1 AND LOWER(TRIM(name)) = LOWER(TRIM($2)) LIMIT 1",
        [req.user.id, inTarget],
      );

      if (targetResult.rows.length > 0) {
        target_id = targetResult.rows[0].id;
      } else {
        // Create new target
        const newTarget = await db.query(
          "INSERT INTO targets (user_id, name) VALUES ($1, $2) RETURNING id",
          [req.user.id, inTarget],
        );
        target_id = newTarget.rows[0].id;
      }
    }

    const transactionType = type === "Withdrawal" ? "expense" : type;

    // Duplicate detection: same user, date, amount, type, description (case-insensitive), category name, source name, target name
    const dupQuery = `
      SELECT t.*
      FROM transactions t
      LEFT JOIN categories c ON t.category_id = c.id
      LEFT JOIN sources s ON t.source_id = s.id
      LEFT JOIN targets tg ON t.target_id = tg.id
      WHERE t.user_id = $1
        AND t.date = $2
        AND t.amount = $3
        AND t.type = $4
        AND COALESCE(TRIM(LOWER(COALESCE(t.description, ''))),'') = COALESCE(TRIM(LOWER($5)),'')
        AND COALESCE(TRIM(LOWER(COALESCE(c.name, ''))),'') = COALESCE(TRIM(LOWER(COALESCE($6, ''))),'')
        AND COALESCE(TRIM(LOWER(COALESCE(s.name, ''))),'') = COALESCE(TRIM(LOWER(COALESCE($7, ''))),'')
        AND COALESCE(TRIM(LOWER(COALESCE(tg.name, ''))),'') = COALESCE(TRIM(LOWER(COALESCE($8, ''))),'')
      LIMIT 1
    `;

    const dupRes = await db.query(dupQuery, [
      req.user.id,
      date || new Date(),
      amount,
      transactionType,
      description || "",
      inCategory || null,
      inSource || null,
      inTarget || null,
    ]);

    if (dupRes.rows.length > 0) {
      // Found duplicate - return skipped response so import can record it
      return res.json({
        success: true,
        skipped: true,
        transaction: dupRes.rows[0],
      });
    }

    const transaction = await Transaction.create(
      req.user.id,
      categoryId,
      source_id,
      target_id,
      amount,
      transactionType,
      description,
      date || new Date(),
    );

    res.status(201).json({
      success: true,
      transaction,
    });

    // Invalidate dashboard cache for affected users
    try {
      await cache.invalidateDashboard(req.user.id);
    } catch (cacheErr) {
      console.warn("Cache invalidation failed:", cacheErr?.message);
    }

    let sharedWith = [];
    try {
      sharedWith = await getUsersSharedWithOwner(req.user.id);
    } catch (e) {
      console.warn("Failed to resolve shared users:", e && e.message ? e.message : e);
    }

    // Emit SSE event to owner and any viewers
    try {
      const sse = req.app.get("sse");
      if (sse) {
        const payload = { type: "transaction:create", transactionId: transaction.id, ownerId: req.user.id, at: Date.now() };
        sse.broadcastToUser(req.user.id, payload);
        if (sharedWith && sharedWith.length) sse.broadcastToUsers(sharedWith, payload);
      }
    } catch (e) {
      // Log SSE broadcast errors but don't fail the request
      console.warn("SSE broadcast failed:", e && e.message ? e.message : e);
    }
  } catch (err) {
    console.error("Create transaction error:", err.message);
    res.status(500).json({ message: "Server error" });
  }
};

// Get all transactions for user (mine + shared to me by default)
const getTransactions = async (req, res) => {
  try {
    // Optional filter to view as a specific accessible user
    const { asUserId, limit, offset, q } = req.query;
    const validAsUserId = await validateAsUserId(req.user.id, asUserId, "all");

    // Parse limit and offset with defaults
    const limitNum = limit ? Math.min(parseInt(limit), 100) : 20; // Max 100, default 20
    const offsetNum = offset ? parseInt(offset) : 0;

    // Normalize search query for case-insensitive, accent-insensitive search
    const searchQuery = q ? q.trim() : null;

    if (validAsUserId) {
      // If a specific accessible user is requested, respect sharing permissions at row level
      // Note: This path doesn't currently support pagination or search
      const transactions = await Transaction.findByUserIdWithSharing(
        validAsUserId,
        req.user.id,
      );
      return res.json({ success: true, transactions });
    }

    // Otherwise, return all accessible data (mine + any shared to me) with pagination
    let accessibleUserIds = await getAccessibleUserIds(req.user.id, "all");
    // Safety guard: always include requester to avoid empty IN ()
    if (!Array.isArray(accessibleUserIds) || accessibleUserIds.length === 0) {
      accessibleUserIds = [req.user.id];
    }

    // Build a single query to fetch transactions for all accessible users
    const placeholders = accessibleUserIds
      .map((_, i) => `$${i + 1}`)
      .join(", ");

    // Build search condition if search query is provided
    let searchCondition = "";
    let queryParams = [...accessibleUserIds];
    let paramIndex = accessibleUserIds.length + 1;

    if (searchQuery) {
      // Search across description, category name, source name, target name, and amount
      searchCondition = `
        AND (
          LOWER(t.description) LIKE LOWER($${paramIndex})
          OR LOWER(c.name) LIKE LOWER($${paramIndex})
          OR LOWER(s.name) LIKE LOWER($${paramIndex})
          OR LOWER(tg.name) LIKE LOWER($${paramIndex})
          OR CAST(t.amount AS TEXT) LIKE $${paramIndex}
        )
      `;
      queryParams.push(`%${searchQuery}%`);
      paramIndex++;
    }

    const query = `
      SELECT t.*, c.name as category_name, s.name as source_name, tg.name as target_name,
             t.recurring_transaction_id as recurring_id, rt.recurrence_type as recurring_recurrence_type
      FROM transactions t
      LEFT JOIN categories c ON t.category_id = c.id
      LEFT JOIN sources s ON t.source_id = s.id
      LEFT JOIN targets tg ON t.target_id = tg.id
      LEFT JOIN recurring_transactions rt ON t.recurring_transaction_id = rt.id
      WHERE t.user_id IN (${placeholders})
      ${searchCondition}
      ORDER BY t.date DESC, t.id DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1};
    `;
    queryParams.push(limitNum, offsetNum);

    // Debug logging
    console.log('[getTransactions] searchQuery:', searchQuery);
    console.log('[getTransactions] searchCondition:', searchCondition);
    console.log('[getTransactions] Full SQL:', query);
    console.log('[getTransactions] Params:', queryParams);

    const result = await db.query(query, queryParams);
    const rows = result.rows;

    // Compute per-owner edit capability for requester based on sharing_permissions
    const distinctOwnerIds = [...new Set(rows.map((r) => r.user_id))];
    const otherOwners = distinctOwnerIds.filter(
      (uid) => Number(uid) !== Number(req.user.id),
    );

    let permsByOwner = {};
    if (otherOwners.length > 0) {
      // Parameter $1 is the requester (shared_with_user_id), owners start at $2..$N
      const ownersPlaceholders = otherOwners
        .map((_, i) => `$${i + 2}`)
        .join(", ");
      const permQuery = `
        SELECT owner_user_id, permission_level, source_filter
        FROM sharing_permissions
        WHERE shared_with_user_id = $1 AND owner_user_id IN (${ownersPlaceholders})
      `;
      const permRes = await db.query(permQuery, [req.user.id, ...otherOwners]);
      // Use for..of to allow awaiting name enrichment
      permsByOwner = {};
      for (const r of permRes.rows) {
        const level = String(r.permission_level || "").trim().toLowerCase();
        const writableLevels = new Set([
          "write",
          "edit",
          "read_write",
          "read-write",
          "rw",
          "readwrite",
          "full",
          "owner",
        ]);
        const writable = writableLevels.has(level);

        let allowedSourceIdsNum = null;
        let allowedSourceIdsStr = null;
        let allowedSourceNamesLower = null;
        if (r.source_filter) {
          try {
            const parsed = JSON.parse(r.source_filter);
            if (Array.isArray(parsed) && parsed.length > 0) {
              const nums = [];
              const strs = [];
              for (const x of parsed) {
                const n = Number(x);
                if (!Number.isNaN(n)) nums.push(n);
                strs.push(String(x));
              }
              allowedSourceIdsNum = nums.length > 0 ? nums : null;
              allowedSourceIdsStr = strs.length > 0 ? strs : null;
              if (nums.length > 0) {
                // Enrich with names of the allowed source ids for name-based fallback (income -> target name matches source name)
                try {
                  const namesRes = await db.query(
                    `SELECT name FROM sources WHERE user_id = $1 AND id = ANY($2)`,
                    [r.owner_user_id, nums],
                  );
                  allowedSourceNamesLower = namesRes.rows
                    .map((row) => String(row.name || "").trim().toLowerCase())
                    .filter((s) => s.length > 0);
                } catch (e) {
                  // ignore name enrichment errors
                }
              }
            }
          } catch (e) {
            // ignore parse errors; treat as no additional source scoping
          }
        }

        permsByOwner[r.owner_user_id] = {
          writable,
          allowedSourceIdsNum,
          allowedSourceIdsStr,
          allowedSourceNamesLower,
        };
      }
    }

    const transactions = rows.reduce((acc, row) => {
      const ownerId = row.user_id;
      // Owner can always view and edit their own
      if (Number(ownerId) === Number(req.user.id)) {
        acc.push({ ...row, owner_user_id: ownerId, can_edit: true });
        return acc;
      }
      const meta = permsByOwner[ownerId];
      if (!meta) {
        return acc; // no visibility without a sharing record
      }
      // Visibility: if a source filter is defined, only include when row matches allowed sources
      const hasNumList = Array.isArray(meta.allowedSourceIdsNum) && meta.allowedSourceIdsNum.length > 0;
      const hasStrList = Array.isArray(meta.allowedSourceIdsStr) && meta.allowedSourceIdsStr.length > 0;
      let visible = true;
      if (hasNumList || hasStrList) {
        const sidNum = row.source_id != null ? Number(row.source_id) : null;
        const tidNum = row.target_id != null ? Number(row.target_id) : null;
        const sidStr = row.source_id != null ? String(row.source_id) : null;
        const tidStr = row.target_id != null ? String(row.target_id) : null;
        const numMatch = (sidNum != null && meta.allowedSourceIdsNum?.includes(sidNum)) || (tidNum != null && meta.allowedSourceIdsNum?.includes(tidNum));
        const strMatch = (sidStr != null && meta.allowedSourceIdsStr?.includes(sidStr)) || (tidStr != null && meta.allowedSourceIdsStr?.includes(tidStr));
        visible = !!(numMatch || strMatch);
        if (!visible && String(row.type).toLowerCase() === "income") {
          // Name-based fallback: income target name equals allowed source name
          const tname = String(row.target_name || "").trim().toLowerCase();
          if (tname && Array.isArray(meta.allowedSourceNamesLower) && meta.allowedSourceNamesLower.includes(tname)) {
            visible = true;
          }
        }
      }
      if (!visible) {
        return acc;
      }
      // Compute can_edit (writable + within allowed list if present)
      let can_edit = false;
      if (meta.writable) {
        if (hasNumList || hasStrList) {
          const sidNum = row.source_id != null ? Number(row.source_id) : null;
          const tidNum = row.target_id != null ? Number(row.target_id) : null;
          const sidStr = row.source_id != null ? String(row.source_id) : null;
          const tidStr = row.target_id != null ? String(row.target_id) : null;
          const numMatch = (sidNum != null && meta.allowedSourceIdsNum?.includes(sidNum)) || (tidNum != null && meta.allowedSourceIdsNum?.includes(tidNum));
          const strMatch = (sidStr != null && meta.allowedSourceIdsStr?.includes(sidStr)) || (tidStr != null && meta.allowedSourceIdsStr?.includes(tidStr));
          can_edit = !!(numMatch || strMatch);
          if (!can_edit && String(row.type).toLowerCase() === "income") {
            const tname = String(row.target_name || "").trim().toLowerCase();
            if (tname && Array.isArray(meta.allowedSourceNamesLower) && meta.allowedSourceNamesLower.includes(tname)) {
              can_edit = true;
            }
          }
        } else {
          can_edit = true;
        }
      }
      acc.push({ ...row, owner_user_id: ownerId, can_edit });
      return acc;
    }, []);

    res.json({ success: true, transactions });
  } catch (err) {
    console.error("Get transactions error:", err.message);
    res.status(500).json({ message: "Server error" });
  }
};

// Get transaction by ID (ensure it is owned by requester or shared to requester)
const getTransactionById = async (req, res) => {
  try {
    const { id } = req.params;
    const transaction = await Transaction.findById(id);

    if (!transaction) {
      return res.status(404).json({ message: "Transaction not found" });
    }

    // Check if transaction belongs to user or is shared to user
    if (transaction.user_id !== req.user.id) {
      // Verify sharing permission row-level for this owner->requester
      // Viewing is solely controlled by source-based sharing now; use 'all' to determine access
      const accessibleUserIds = await getAccessibleUserIds(req.user.id, "all");
      if (!accessibleUserIds.includes(transaction.user_id)) {
        return res.status(404).json({ message: "Transaction not found" });
      }
    }

    // Check for associated recurring transaction
    // Two cases: 
    // 1. This transaction belongs to a recurring rule (has recurring_transaction_id set)
    // 2. This is the initial transaction that created a recurring rule (recurring_transactions.transaction_id = this transaction)
    let recurringTransaction = null;

    if (transaction.recurring_transaction_id) {
      // Priority: If this transaction has recurring_transaction_id, use that specific rule
      recurringTransaction = await RecurringTransaction.findById(
        transaction.recurring_transaction_id
      );
    } else {
      // Otherwise, check if this is the initial transaction that created a recurring rule
      recurringTransaction = await RecurringTransaction.findByTransactionId(id);
    }

    res.json({
      success: true,
      transaction: {
        ...transaction,
        recurring: recurringTransaction || null,
      },
    });
  } catch (err) {
    console.error("Get transaction error:", err.message);
    res.status(500).json({ message: "Server error" });
  }
};

// Update transaction
const updateTransaction = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      category,
      category_id,
      source,
      target,
      amount,
      type,
      description,
      date,
    } = req.body;

    // Normalize incoming strings
    const norm = (s) => (s == null ? null : String(s).trim());
    const normLower = (s) => (s == null ? null : String(s).trim().toLowerCase());

    const inCategory = norm(category);
    const inSource = norm(source);
    const inTarget = norm(target);

    // Debug logs to help diagnose 404s when updating income transactions
    if (process.env.DEBUG === "true") {
      console.log(
        `updateTransaction called for id=${id} by user=${req.user?.id}. Body keys: ${Object.keys(req.body).join(",")}`,
      );
    }

    // Load transaction regardless of owner; we’ll enforce permissions below
    const transaction = await Transaction.findById(id);
    if (!transaction) {
      return res.status(404).json({ message: "Transaction not found" });
    }
    const ownerId = transaction.user_id;
    const isOwner = Number(ownerId) === Number(req.user.id);
    if (!isOwner) {
      const meta = await getSharingPermissionMeta(ownerId, req.user.id);
      if (!meta.exists) return res.status(404).json({ message: "Transaction not found" });
      if (!meta.writable) return res.status(403).json({ message: "Forbidden" });
      const hasNum = Array.isArray(meta.allowedSourceIdsNum) && meta.allowedSourceIdsNum.length > 0;
      const hasStr = Array.isArray(meta.allowedSourceIdsStr) && meta.allowedSourceIdsStr.length > 0;
      if (hasNum || hasStr) {
        const sidNum = transaction.source_id != null ? Number(transaction.source_id) : null;
        const tidNum = transaction.target_id != null ? Number(transaction.target_id) : null;
        const sidStr = transaction.source_id != null ? String(transaction.source_id) : null;
        const tidStr = transaction.target_id != null ? String(transaction.target_id) : null;
        const numMatch = (sidNum != null && meta.allowedSourceIdsNum?.includes(sidNum)) || (tidNum != null && meta.allowedSourceIdsNum?.includes(tidNum));
        const strMatch = (sidStr != null && meta.allowedSourceIdsStr?.includes(sidStr)) || (tidStr != null && meta.allowedSourceIdsStr?.includes(tidStr));
        if (!(numMatch || strMatch)) {
          // Fallback for income: target name equals an allowed source name
          if (String(transaction.type).toLowerCase() === "income") {
            const tname = String(transaction.target_name || "").trim().toLowerCase();
            if (!(tname && Array.isArray(meta.allowedSourceNamesLower) && meta.allowedSourceNamesLower.includes(tname))) {
              return res.status(403).json({ message: "Forbidden" });
            }
          } else {
            return res.status(403).json({ message: "Forbidden" });
          }
        }
      }
    }

    // Handle category
    // Use explicit undefined check so a client can clear category by sending `category_id: null`
    let categoryId = transaction.category_id;
    if (category_id !== undefined) {
      categoryId = category_id;
    }
    if (inCategory) {
      // Try to find existing category globally by name (shared across users)
      const categoryResult = await db.query(
        "SELECT id FROM categories WHERE LOWER(TRIM(name)) = LOWER(TRIM($1)) ORDER BY id ASC LIMIT 1",
        [inCategory],
      );

      if (categoryResult.rows.length > 0) {
        categoryId = categoryResult.rows[0].id;
      } else {
        // Create new category under the owner for consistency
        const newCategory = await db.query(
          "INSERT INTO categories (user_id, name) VALUES ($1, $2) RETURNING id",
          [ownerId, inCategory],
        );
        categoryId = newCategory.rows[0].id;
      }
    }

    // Check if category belongs to user (if provided and not newly created)
    if (categoryId && !category) {
      // Use findByIdForUser to enforce ownership check at the model level
      const categoryRecord = await Category.findByIdForUser(categoryId, ownerId);
      if (process.env.DEBUG === "true") {
        console.log(
          "Checking category ownership via findByIdForUser: categoryId=%s, categoryRecord=",
          categoryId,
          categoryRecord,
        );
      }
      if (!categoryRecord) {
        if (process.env.DEBUG === "true") {
          console.log(
            `Category ownership failed for categoryId=${categoryId}, user=${req.user?.id}`,
          );
        }
        return res.status(404).json({ message: "Category not found" });
      }
    }

    // Handle source
    let source_id = transaction.source_id;
    if (source !== undefined) {
      if (inSource) {
        // Try to find existing source
        const sourceResult = await db.query(
          "SELECT id FROM sources WHERE user_id = $1 AND LOWER(TRIM(name)) = LOWER(TRIM($2)) LIMIT 1",
          [ownerId, inSource],
        );

        if (sourceResult.rows.length > 0) {
          source_id = sourceResult.rows[0].id;
        } else {
          // Create new source
          const newSource = await db.query(
            "INSERT INTO sources (user_id, name) VALUES ($1, $2) RETURNING id",
            [ownerId, inSource],
          );
          source_id = newSource.rows[0].id;
        }
      } else {
        source_id = null;
      }
    }

    // Handle target
    let target_id = transaction.target_id;
    if (target !== undefined) {
      if (inTarget) {
        // Try to find existing target
        const targetResult = await db.query(
          "SELECT id FROM targets WHERE user_id = $1 AND LOWER(TRIM(name)) = LOWER(TRIM($2)) LIMIT 1",
          [ownerId, inTarget],
        );

        if (targetResult.rows.length > 0) {
          target_id = targetResult.rows[0].id;
        } else {
          // Create new target
          const newTarget = await db.query(
            "INSERT INTO targets (user_id, name) VALUES ($1, $2) RETURNING id",
            [ownerId, inTarget],
          );
          target_id = newTarget.rows[0].id;
        }
      } else {
        target_id = null;
      }
    }

    // If shared and source_filter exists, ensure the final new linkage is allowed (match either source_id or target_id)
    if (!isOwner) {
      const meta = await getSharingPermissionMeta(ownerId, req.user.id);
      if (!meta.writable) return res.status(403).json({ message: "Forbidden" });
      const hasNum = Array.isArray(meta.allowedSourceIdsNum) && meta.allowedSourceIdsNum.length > 0;
      const hasStr = Array.isArray(meta.allowedSourceIdsStr) && meta.allowedSourceIdsStr.length > 0;
      if (hasNum || hasStr) {
        const sidNumNew = source_id != null ? Number(source_id) : null;
        const tidNumNew = target_id != null ? Number(target_id) : null;
        const sidStrNew = source_id != null ? String(source_id) : null;
        const tidStrNew = target_id != null ? String(target_id) : null;
        const numMatch = (sidNumNew != null && meta.allowedSourceIdsNum?.includes(sidNumNew)) || (tidNumNew != null && meta.allowedSourceIdsNum?.includes(tidNumNew));
        const strMatch = (sidStrNew != null && meta.allowedSourceIdsStr?.includes(sidStrNew)) || (tidStrNew != null && meta.allowedSourceIdsStr?.includes(tidStrNew));
        if (!(numMatch || strMatch)) {
          // Fallback for income: new target name equals an allowed source name
          if (String(type || transaction.type).toLowerCase() === "income") {
            const tnameNew = String(target || transaction.target_name || "").trim().toLowerCase();
            if (!(tnameNew && Array.isArray(meta.allowedSourceNamesLower) && meta.allowedSourceNamesLower.includes(tnameNew))) {
              return res.status(403).json({ message: "Forbidden" });
            }
          } else {
            return res.status(403).json({ message: "Forbidden" });
          }
        }
      }
    }

    const updatedTransaction = await Transaction.update(
      id,
      categoryId,
      source_id,
      target_id,
      amount || transaction.amount,
      type || transaction.type,
      description || transaction.description,
      date || transaction.date,
    );

    if (process.env.DEBUG === "true") {
      console.log("updateByUser result:", updatedTransaction);
    }
    if (!updatedTransaction) {
      if (process.env.DEBUG === "true") {
        console.log(`updateByUser returned no rows for id=${id} user=${req.user?.id}`);
      }
      return res.status(404).json({ message: "Transaction not found" });
    }

    res.json({
      success: true,
      transaction: updatedTransaction,
    });

    // Invalidate dashboard cache for affected users
    try {
      await cache.invalidateDashboard(Number(ownerId));
    } catch (cacheErr) {
      console.warn("Cache invalidation failed:", cacheErr?.message);
    }

    let sharedWith = [];
    try {
      sharedWith = await getUsersSharedWithOwner(Number(ownerId));
    } catch (e) {
      console.warn("Failed to resolve shared users:", e && e.message ? e.message : e);
    }

    // Emit update event
    try {
      const sse = req.app.get("sse");
      if (sse) {
        const payload = { type: "transaction:update", transactionId: updatedTransaction.id, ownerId: Number(ownerId), at: Date.now() };
        sse.broadcastToUser(Number(ownerId), payload);
        if (sharedWith && sharedWith.length) sse.broadcastToUsers(sharedWith, payload);
      }
    } catch (e) { }
  } catch (err) {
    console.error("Update transaction error:", err.message);
    res.status(500).json({ message: "Server error" });
  }
};

// Delete transaction
const deleteTransaction = async (req, res) => {
  try {
    const { id } = req.params;

    // Fetch transaction to evaluate permissions
    const transaction = await Transaction.findById(id);
    if (!transaction) {
      return res.status(404).json({ message: "Transaction not found" });
    }

    const ownerId = transaction.user_id;
    const isOwner = Number(ownerId) === Number(req.user.id);
    if (!isOwner) {
      const meta = await getSharingPermissionMeta(ownerId, req.user.id);
      if (!meta.exists) return res.status(404).json({ message: "Transaction not found" });
      if (!meta.writable) return res.status(403).json({ message: "Forbidden" });

      const hasNum = Array.isArray(meta.allowedSourceIdsNum) && meta.allowedSourceIdsNum.length > 0;
      const hasStr = Array.isArray(meta.allowedSourceIdsStr) && meta.allowedSourceIdsStr.length > 0;
      if (hasNum || hasStr) {
        const sidNum = transaction.source_id != null ? Number(transaction.source_id) : null;
        const tidNum = transaction.target_id != null ? Number(transaction.target_id) : null;
        const sidStr = transaction.source_id != null ? String(transaction.source_id) : null;
        const tidStr = transaction.target_id != null ? String(transaction.target_id) : null;
        const numMatch = (sidNum != null && meta.allowedSourceIdsNum?.includes(sidNum)) || (tidNum != null && meta.allowedSourceIdsNum?.includes(tidNum));
        const strMatch = (sidStr != null && meta.allowedSourceIdsStr?.includes(sidStr)) || (tidStr != null && meta.allowedSourceIdsStr?.includes(tidStr));
        if (!(numMatch || strMatch)) {
          // Fallback for income: match by target name = allowed source name
          if (String(transaction.type).toLowerCase() === "income") {
            const tname = String(transaction.target_name || "").trim().toLowerCase();
            if (!(tname && Array.isArray(meta.allowedSourceNamesLower) && meta.allowedSourceNamesLower.includes(tname))) {
              return res.status(403).json({ message: "Forbidden" });
            }
          } else {
            return res.status(403).json({ message: "Forbidden" });
          }
        }
      }
    }

    // Authorized; delete regardless of requester id
    const deletedTransaction = await Transaction.delete(id);
    res.json({
      success: true,
      transaction: deletedTransaction,
    });

    // Invalidate dashboard cache for affected users
    if (deletedTransaction) {
      try {
        await cache.invalidateDashboard(Number(ownerId));
      } catch (cacheErr) {
        console.warn("Cache invalidation failed:", cacheErr?.message);
      }
    }

    let sharedWith = [];
    try {
      sharedWith = await getUsersSharedWithOwner(Number(ownerId));
    } catch (e) {
      console.warn("Failed to resolve shared users:", e && e.message ? e.message : e);
    }

    // Emit delete event
    try {
      const sse = req.app.get("sse");
      if (sse && deletedTransaction) {
        const payload = { type: "transaction:delete", transactionId: Number(id), ownerId: Number(ownerId), at: Date.now() };
        sse.broadcastToUser(Number(ownerId), payload);
        if (sharedWith && sharedWith.length) sse.broadcastToUsers(sharedWith, payload);
      }
    } catch (e) { }
  } catch (err) {
    console.error("Delete transaction error:", err.message);
    res.status(500).json({ message: "Server error" });
  }
};

// Get dashboard data (aggregate over mine + shared to me by default, optional asUserId)
const getDashboardData = async (req, res) => {
  try {
    const { timeRange, startDate, endDate, asUserId } = req.query;

    // Optional single-user view if accessible
    const singleUserId = await validateAsUserId(req.user.id, asUserId, "all");
    const userIds = singleUserId
      ? [singleUserId]
      : await getAccessibleUserIds(req.user.id, "all");

    // Calculate date ranges
    let start, end;
    const now = new Date();
    if (startDate && endDate) {
      start = new Date(startDate + "T00:00:00");
      end = new Date(endDate + "T23:59:59");
    } else {
      if (timeRange === "weekly") {
        end = now;
        start = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000);
      } else if (timeRange === "monthly") {
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        end = now;
      } else if (timeRange === "yearly") {
        start = new Date(now.getFullYear(), 0, 1);
        end = now;
      } else {
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      }
    }
    const startDateStr = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}-${String(start.getDate()).padStart(2, "0")}`;
    const endDateStr = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, "0")}-${String(end.getDate()).padStart(2, "0")}`;

    // Cache key based on user, date range, and view mode
    const viewMode = timeRange || "monthly";
    const cacheKey = cache.dashboardKey(req.user.id, startDateStr, endDateStr, viewMode);

    // Try cache first
    const cachedData = await cache.get(cacheKey);
    if (cachedData) {
      return res.json({
        success: true,
        data: cachedData,
        cached: true,
      });
    }

    // For income tracking disabled we need per-user flags. In aggregated (multi-user) view,
    // always include income to avoid hiding items inconsistently vs the transactions list.
    // Only honor the flag when explicitly viewing a single user (asUserId).

    // Helper to get per-user income tracking flag
    async function isIncomeDisabled(uid) {
      const u = await User.findById(uid);
      return u?.income_tracking_disabled || false;
    }

    // Aggregate across all userIds
    let summary = { total_income: 0, total_expenses: 0, balance: 0 };
    let recentTransactions = [];
    let expenseByCategoryMap = new Map();
    let dailyAverageExpenses = []; // we will compute per-user and then average across users by date
    let weeklyExpensesTotals = { total_expenses: 0, days_with_expenses: 0 };
    let dailyExpensesMap = new Map(); // date -> total
    let incomeByDateMap = new Map(); // date -> total

    const aggregatedView = !singleUserId || userIds.length > 1;
    for (const uid of userIds) {
      // In aggregated view we include incomes regardless of owner preference
      const incomeDisabled = aggregatedView ? false : await isIncomeDisabled(uid);
      const s = await Transaction.getSummary(
        uid,
        startDateStr,
        endDateStr,
        incomeDisabled,
      );
      summary.total_income += Number(s.total_income || 0);
      summary.total_expenses += Number(s.total_expenses || 0);
      summary.balance += Number(s.balance || 0);

      const rec = await Transaction.getRecent(
        uid,
        startDateStr,
        endDateStr,
        5,
        incomeDisabled,
      );
      recentTransactions = recentTransactions.concat(rec);

      const ebc = await Transaction.getExpensesByCategory(
        uid,
        startDateStr,
        endDateStr,
      );
      for (const row of ebc) {
        const key = row.category_name;
        const prev = Number(expenseByCategoryMap.get(key) || 0);
        expenseByCategoryMap.set(key, prev + Number(row.total || 0));
      }

      const dwe = await Transaction.getWeeklyExpenses(
        uid,
        startDateStr,
        endDateStr,
      );
      weeklyExpensesTotals.total_expenses += Number(dwe.total_expenses || 0);
      // days_with_expenses across users isn't straightforward; we keep max to avoid inflation
      weeklyExpensesTotals.days_with_expenses = Math.max(
        weeklyExpensesTotals.days_with_expenses,
        Number(dwe.days_with_expenses || 0),
      );

      const de = await Transaction.getDailyExpenses(
        uid,
        startDateStr,
        endDateStr,
      );
      for (const row of de) {
        const key = String(row.date);
        const prev = Number(dailyExpensesMap.get(key) || 0);
        dailyExpensesMap.set(key, prev + Number(row.total || 0));
      }

      if (!incomeDisabled) {
        const ibd = await Transaction.getIncomeByDate(
          uid,
          startDateStr,
          endDateStr,
        );
        for (const row of ibd) {
          const key = String(row.date);
          const prev = Number(incomeByDateMap.get(key) || 0);
          incomeByDateMap.set(key, prev + Number(row.total || 0));
        }
      }
    }

    // Sort and limit recent transactions globally
    recentTransactions.sort(
      (a, b) => new Date(b.date) - new Date(a.date) || b.id - a.id,
    );
    recentTransactions = recentTransactions.slice(0, 5);

    const expenseByCategory = Array.from(expenseByCategoryMap.entries())
      .map(([category_name, total]) => ({ category_name, total }))
      .sort((a, b) => Number(b.total) - Number(a.total));

    const dailyExpenses = Array.from(dailyExpensesMap.entries())
      .map(([date, total]) => ({ date, total }))
      .sort((a, b) => new Date(a.date) - new Date(b.date));

    const incomeByDate = Array.from(incomeByDateMap.entries())
      .map(([date, total]) => ({ date, total }))
      .sort((a, b) => new Date(a.date) - new Date(b.date));

    // For dailyAverageExpenses, reuse dailyExpenses totals divided by number of days with any expense across users
    // To keep semantics close to previous single-user average, compute simple average per date across users:
    // Here, we approximate by dividing by userIds.length when date had any expenses.
    const dailyAverageMap = new Map();
    for (const row of dailyExpenses) {
      dailyAverageMap.set(
        row.date,
        Number(row.total) / Math.max(1, userIds.length),
      );
    }
    dailyAverageExpenses = Array.from(dailyAverageMap.entries())
      .map(([date, average_amount]) => ({ date, average_amount }))
      .sort((a, b) => new Date(a.date) - new Date(b.date));

    // Build response data
    const dashboardData = {
      summary,
      recentTransactions,
      expenseByCategory,
      dailyAverageExpenses,
      weeklyExpenses: weeklyExpensesTotals,
      dailyExpenses,
      incomeByDate,
    };

    // Cache the computed data (60 second TTL)
    try {
      await cache.set(cacheKey, dashboardData, 60);
    } catch (cacheErr) {
      console.warn("Cache set failed:", cacheErr?.message);
    }

    res.json({
      success: true,
      data: dashboardData,
    });
  } catch (err) {
    console.error("Get dashboard data error:", err.message);
    res.status(500).json({ message: "Server error" });
  }
};

/**
 * Get net worth data (all-time income - expenses with monthly trend)
 * Used for the Net Worth dashboard card
 */
const getNetWorth = async (req, res) => {
  try {
    const { asUserId } = req.query;

    // Optional single-user view if accessible
    const singleUserId = await validateAsUserId(req.user.id, asUserId, "all");
    const userIds = singleUserId
      ? [singleUserId]
      : await getAccessibleUserIds(req.user.id, "all");

    // Get all-time totals
    const allTimeTotals = await db.query(
      `SELECT 
        COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) as total_income,
        COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) as total_expenses
      FROM transactions 
      WHERE user_id = ANY($1::int[])`,
      [userIds]
    );

    const totalIncome = parseFloat(allTimeTotals.rows[0]?.total_income || 0);
    const totalExpenses = parseFloat(allTimeTotals.rows[0]?.total_expenses || 0);
    const netWorth = totalIncome - totalExpenses;

    // Get monthly trend for last 6 months
    const now = new Date();
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);
    const sixMonthsAgoStr = `${sixMonthsAgo.getFullYear()}-${String(sixMonthsAgo.getMonth() + 1).padStart(2, "0")}-01`;

    const monthlyTrend = await db.query(
      `SELECT 
        TO_CHAR(date, 'YYYY-MM') as month,
        COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) as income,
        COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) as expenses
      FROM transactions 
      WHERE user_id = ANY($1::int[])
        AND date >= $2::date
      GROUP BY TO_CHAR(date, 'YYYY-MM')
      ORDER BY month ASC`,
      [userIds, sixMonthsAgoStr]
    );

    // Calculate cumulative net worth per month
    let cumulativeNetWorth = 0;
    
    // First get all transactions before the 6-month window to establish baseline
    const baselineTotals = await db.query(
      `SELECT 
        COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) as total_income,
        COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) as total_expenses
      FROM transactions 
      WHERE user_id = ANY($1::int[])
        AND date < $2::date`,
      [userIds, sixMonthsAgoStr]
    );
    
    cumulativeNetWorth = parseFloat(baselineTotals.rows[0]?.total_income || 0) - 
                         parseFloat(baselineTotals.rows[0]?.total_expenses || 0);

    // Build trend array with cumulative values
    const trend = monthlyTrend.rows.map(row => {
      const monthIncome = parseFloat(row.income || 0);
      const monthExpenses = parseFloat(row.expenses || 0);
      cumulativeNetWorth += (monthIncome - monthExpenses);
      
      return {
        month: row.month,
        income: monthIncome,
        expenses: monthExpenses,
        netWorth: cumulativeNetWorth
      };
    });

    // Calculate change vs previous month
    const currentMonth = trend.length > 0 ? trend[trend.length - 1] : null;
    const previousMonth = trend.length > 1 ? trend[trend.length - 2] : null;
    
    let changeAmount = 0;
    let changePercent = 0;
    
    if (currentMonth && previousMonth && previousMonth.netWorth !== 0) {
      changeAmount = currentMonth.netWorth - previousMonth.netWorth;
      changePercent = (changeAmount / Math.abs(previousMonth.netWorth)) * 100;
    } else if (currentMonth) {
      changeAmount = currentMonth.income - currentMonth.expenses;
    }

    res.json({
      success: true,
      data: {
        totalIncome,
        totalExpenses,
        netWorth,
        trend,
        change: {
          amount: changeAmount,
          percent: changePercent
        }
      }
    });
  } catch (err) {
    console.error("Get net worth error:", err.message);
    res.status(500).json({ message: "Server error" });
  }
};

/**
 * Calculate next occurrence of a recurring transaction after fromDate
 */
function calcNextOccurrence(rt, fromDate) {
  const startDate = new Date(rt.start_date);
  const endDate = rt.end_date ? new Date(rt.end_date) : null;
  const interval = rt.recurrence_interval || 1;
  const type = rt.recurrence_type?.toLowerCase();

  if (startDate > fromDate) {
    if (endDate && startDate > endDate) return null;
    return startDate;
  }

  let nextDate = new Date(startDate);
  while (nextDate <= fromDate) {
    switch (type) {
      case 'daily': nextDate.setDate(nextDate.getDate() + interval); break;
      case 'weekly': nextDate.setDate(nextDate.getDate() + (7 * interval)); break;
      case 'monthly': nextDate.setMonth(nextDate.getMonth() + interval); break;
      case 'yearly': nextDate.setFullYear(nextDate.getFullYear() + interval); break;
      default: nextDate.setMonth(nextDate.getMonth() + interval);
    }
  }

  if (endDate && nextDate > endDate) return null;
  if (rt.max_occurrences && rt.occurrences_created >= rt.max_occurrences) return null;
  return nextDate;
}

/**
 * Safe to Spend - How much is "safe" to spend the rest of this month
 * = Monthly Income - Monthly Expenses So Far - Upcoming Recurring Expenses (rest of month)
 * Also shows daily budget (safe to spend / remaining days)
 */
const getSafeToSpend = async (req, res) => {
  try {
    const userId = req.user.id;
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    const monthStartStr = `${monthStart.getFullYear()}-${String(monthStart.getMonth() + 1).padStart(2, "0")}-01`;
    const monthEndStr = `${monthEnd.getFullYear()}-${String(monthEnd.getMonth() + 1).padStart(2, "0")}-${String(monthEnd.getDate()).padStart(2, "0")}`;

    // 1. Get current month income and expenses
    const summaryResult = await db.query(
      `SELECT
        COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) AS monthly_income,
        COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) AS monthly_expenses
      FROM transactions
      WHERE user_id = $1 AND date >= $2 AND date <= $3`,
      [userId, monthStartStr, monthEndStr]
    );
    const monthlyIncome = parseFloat(summaryResult.rows[0].monthly_income);
    const monthlyExpenses = parseFloat(summaryResult.rows[0].monthly_expenses);

    // 2. Get upcoming recurring expenses for the rest of the month
    const recurringTransactions = await RecurringTransaction.findAllByUserId(userId);
    let upcomingRecurringExpenses = 0;
    let upcomingRecurringIncome = 0;
    const upcomingItems = [];
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    yesterday.setHours(0, 0, 0, 0);

    for (const rt of recurringTransactions) {
      // Find all occurrences between now and end of month
      let checkDate = new Date(yesterday);
      while (true) {
        const nextOcc = calcNextOccurrence(rt, checkDate);
        if (!nextOcc || nextOcc > monthEnd) break;
        if (nextOcc >= now) {
          const amount = parseFloat(rt.amount);
          if (rt.type === 'expense') {
            upcomingRecurringExpenses += amount;
          } else {
            upcomingRecurringIncome += amount;
          }
          upcomingItems.push({
            title: rt.title,
            amount,
            type: rt.type,
            due_date: `${nextOcc.getFullYear()}-${String(nextOcc.getMonth() + 1).padStart(2, "0")}-${String(nextOcc.getDate()).padStart(2, "0")}`,
          });
        }
        // Move past this occurrence to find the next one
        checkDate = new Date(nextOcc);
      }
    }

    // 3. Calculate safe to spend
    const safeToSpend = monthlyIncome - monthlyExpenses - upcomingRecurringExpenses;

    // 4. Calculate daily budget
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const daysRemainingInMonth = Math.max(1, Math.ceil((monthEnd - today) / (24 * 60 * 60 * 1000)));
    const dailyBudget = safeToSpend / daysRemainingInMonth;

    // 5. Determine health status
    let status = 'healthy'; // green
    if (safeToSpend < 0) {
      status = 'overspent'; // red
    } else if (dailyBudget < (monthlyIncome / 30) * 0.2) {
      status = 'caution'; // yellow - less than 20% of average daily income
    }

    res.json({
      success: true,
      data: {
        safeToSpend: Math.round(safeToSpend * 100) / 100,
        dailyBudget: Math.round(dailyBudget * 100) / 100,
        daysRemaining: daysRemainingInMonth,
        monthlyIncome,
        monthlyExpenses,
        upcomingRecurringExpenses,
        upcomingRecurringIncome,
        status,
        month: monthStartStr.substring(0, 7),
      }
    });
  } catch (err) {
    console.error("Get safe to spend error:", err.message);
    res.status(500).json({ message: "Server error" });
  }
};

// GET /api/transactions/spending-pace
const getSpendingPace = async (req, res) => {
  try {
    const userId = req.user.id;
    const now = new Date();
    const dayOfMonth = now.getDate();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

    // Current month start
    const currentMonthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(dayOfMonth).padStart(2, "0")}`;

    // Previous month range
    const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevMonthStart = `${prevMonth.getFullYear()}-${String(prevMonth.getMonth() + 1).padStart(2, "0")}-01`;
    const prevMonthEnd = new Date(prevMonth.getFullYear(), prevMonth.getMonth() + 1, 0);
    const prevMonthEndStr = `${prevMonthEnd.getFullYear()}-${String(prevMonthEnd.getMonth() + 1).padStart(2, "0")}-${String(prevMonthEnd.getDate()).padStart(2, "0")}`;

    const result = await db.query(
      `SELECT
        COALESCE(SUM(CASE WHEN date >= $2 AND date <= $3 AND type = 'expense' THEN amount ELSE 0 END), 0) AS current_spent,
        COALESCE(SUM(CASE WHEN date >= $4 AND date <= $5 AND type = 'expense' THEN amount ELSE 0 END), 0) AS prev_spent
      FROM transactions WHERE user_id = $1`,
      [userId, currentMonthStart, today, prevMonthStart, prevMonthEndStr]
    );

    const currentSpent = parseFloat(result.rows[0].current_spent);
    const prevSpent = parseFloat(result.rows[0].prev_spent);
    const prevDaysInMonth = prevMonthEnd.getDate();

    // Daily averages
    const currentDailyAvg = dayOfMonth > 0 ? currentSpent / dayOfMonth : 0;
    const prevDailyAvg = prevDaysInMonth > 0 ? prevSpent / prevDaysInMonth : 0;

    // Pace comparison
    const expectedPace = daysInMonth > 0 ? (dayOfMonth / daysInMonth) * 100 : 0;
    const projectedTotal = currentDailyAvg * daysInMonth;
    const pacePercent = prevDailyAvg > 0 ? Math.round(((currentDailyAvg - prevDailyAvg) / prevDailyAvg) * 100) : 0;

    let status = "normal";
    if (pacePercent > 15) status = "fast";
    else if (pacePercent > 5) status = "slightly_fast";
    else if (pacePercent < -15) status = "slow";
    else if (pacePercent < -5) status = "slightly_slow";

    res.json({
      success: true,
      data: {
        currentSpent,
        prevMonthTotal: prevSpent,
        currentDailyAvg,
        prevDailyAvg,
        projectedTotal,
        pacePercent,
        dayOfMonth,
        daysInMonth,
        daysRemaining: daysInMonth - dayOfMonth,
        expectedPace: Math.round(expectedPace),
        status,
      }
    });
  } catch (err) {
    console.error("Get spending pace error:", err.message);
    res.status(500).json({ message: "Server error" });
  }
};

module.exports = {
  createTransaction,
  getTransactions,
  getTransactionById,
  updateTransaction,
  deleteTransaction,
  getDashboardData,
  getNetWorth,
  getSafeToSpend,
  getSpendingPace,
};
