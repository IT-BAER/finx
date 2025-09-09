const Transaction = require("../models/Transaction");
const RecurringTransaction = require("../models/RecurringTransaction");
const Category = require("../models/Category");
const User = require("../models/User");
const db = require("../config/db");
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

  // Emit SSE event to owner and any viewers
    try {
      const sse = req.app.get("sse");
      if (sse) {
    const sharedWith = await getUsersSharedWithOwner(req.user.id);
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
    const { asUserId, limit, offset } = req.query;
    const validAsUserId = await validateAsUserId(req.user.id, asUserId, "all");

    // Parse limit and offset with defaults
    const limitNum = limit ? Math.min(parseInt(limit), 100) : 20; // Max 100, default 20
    const offsetNum = offset ? parseInt(offset) : 0;

    if (validAsUserId) {
      // If a specific accessible user is requested, respect sharing permissions at row level
      // Note: This path doesn't currently support pagination
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
    const query = `
      SELECT t.*, c.name as category_name, s.name as source_name, tg.name as target_name,
             rt.id as recurring_id, rt.recurrence_type as recurring_recurrence_type
      FROM transactions t
      LEFT JOIN categories c ON t.category_id = c.id
      LEFT JOIN sources s ON t.source_id = s.id
      LEFT JOIN targets tg ON t.target_id = tg.id
      LEFT JOIN recurring_transactions rt ON t.id = rt.transaction_id
      WHERE t.user_id IN (${placeholders})
      ORDER BY t.date DESC, t.id DESC
      LIMIT $${accessibleUserIds.length + 1} OFFSET $${accessibleUserIds.length + 2};
    `;
    const result = await db.query(query, [
      ...accessibleUserIds,
      limitNum,
      offsetNum,
    ]);
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
    const recurringTransaction =
      await RecurringTransaction.findByTransactionId(id);

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
  // Emit update event
    try {
      const sse = req.app.get("sse");
      if (sse) {
        const ownerId = Number(updatedTransaction.user_id);
    const sharedWith = await getUsersSharedWithOwner(ownerId);
    const payload = { type: "transaction:update", transactionId: updatedTransaction.id, ownerId, at: Date.now() };
    sse.broadcastToUser(ownerId, payload);
    if (sharedWith && sharedWith.length) sse.broadcastToUsers(sharedWith, payload);
      }
    } catch (e) {}
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
  // Emit delete event
    try {
      const sse = req.app.get("sse");
      if (sse && deletedTransaction) {
        const ownerId = Number(deletedTransaction.user_id);
    const sharedWith = await getUsersSharedWithOwner(ownerId);
    const payload = { type: "transaction:delete", transactionId: Number(id), ownerId, at: Date.now() };
    sse.broadcastToUser(ownerId, payload);
    if (sharedWith && sharedWith.length) sse.broadcastToUsers(sharedWith, payload);
      }
    } catch (e) {}
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

  // For income tracking disabled we need per-user flags. In aggregated (multi-user) view,
  // always include income to avoid hiding items inconsistently vs the transactions list.
  // Only honor the flag when explicitly viewing a single user (asUserId).

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

    res.json({
      success: true,
      data: {
        summary,
        recentTransactions,
        expenseByCategory,
        dailyAverageExpenses,
        weeklyExpenses: weeklyExpensesTotals,
        dailyExpenses,
        incomeByDate,
      },
    });
  } catch (err) {
    console.error("Get dashboard data error:", err.message);
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
};
