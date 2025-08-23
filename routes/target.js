const express = require("express");
const router = express.Router();
const db = require("../config/db");
const auth = require("../middleware/auth");

// All routes require authentication
router.use(auth);

/**
 * Targets are GLOBAL now (no user_id). Provide simple global CRUD endpoints.
 * If you want to restrict create/update/delete to admins, enforce in middleware.
 */

// Create global target
router.post("/", async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || !String(name).trim()) {
      return res.status(400).json({ message: "Name is required" });
    }
    const trimmed = String(name).trim();
    const insert = await db.query(
      `INSERT INTO targets (name) VALUES ($1)
       ON CONFLICT ON CONSTRAINT uq_targets_name_norm DO NOTHING
       RETURNING id, name`,
      [trimmed],
    );
    if (insert.rows.length > 0) {
      return res.status(201).json({ success: true, target: insert.rows[0] });
    }
    // Already exists -> fetch by normalized name
    const existing = await db.query(
      `SELECT id, name FROM targets WHERE name_norm = LOWER(TRIM($1)) LIMIT 1`,
      [trimmed],
    );
    return res.status(200).json({ success: true, target: existing.rows[0] });
  } catch (err) {
    if (err.code === "23505") {
      return res.status(409).json({ message: "Target name already exists" });
    }
    console.error("Create target error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

// Get all targets (global) with optional q filter
router.get("/", async (req, res) => {
  try {
    const { q } = req.query;
    const params = [];
    let where = "";
    if (q && String(q).trim()) {
      params.push(`%${String(q).trim()}%`);
      where = `WHERE name_norm LIKE LOWER(TRIM($${params.length}))`;
    }
    const result = await db.query(
      `SELECT id, name FROM targets ${where} ORDER BY name ASC`,
      params,
    );
    return res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error("Get targets error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

// Update target (global)
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;
    if (!name || !String(name).trim()) {
      return res.status(400).json({ message: "Name is required" });
    }
    const trimmed = String(name).trim();
    const cur = await db.query(`SELECT id FROM targets WHERE id = $1`, [id]);
    if (cur.rows.length === 0) {
      return res.status(404).json({ message: "Target not found" });
    }
    const upd = await db.query(
      `UPDATE targets SET name = $1 WHERE id = $2 RETURNING id, name`,
      [trimmed, id],
    );
    return res.json({ success: true, target: upd.rows[0] });
  } catch (err) {
    if (err.code === "23505") {
      return res.status(409).json({ message: "Target name already exists" });
    }
    console.error("Update target error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

// Delete target (global). If referenced by transactions, require reassign_to query param.
router.delete("/:id", async (req, res) => {
  const { id } = req.params;
  const reassignTo = req.query.reassign_to
    ? Number(req.query.reassign_to)
    : null;

  try {
    await db.query("BEGIN");

    const cur = await db.query(`SELECT id FROM targets WHERE id = $1`, [id]);
    if (cur.rows.length === 0) {
      await db.query("ROLLBACK");
      return res.status(404).json({ message: "Target not found" });
    }

    if (reassignTo != null) {
      const tgt = await db.query(`SELECT id FROM targets WHERE id = $1`, [
        reassignTo,
      ]);
      if (tgt.rows.length === 0) {
        await db.query("ROLLBACK");
        return res.status(404).json({ message: "Reassign target not found" });
      }
      await db.query(
        `UPDATE transactions SET target_id = $1 WHERE target_id = $2`,
        [reassignTo, id],
      );
    } else {
      const ref = await db.query(
        `SELECT 1 FROM transactions WHERE target_id = $1 LIMIT 1`,
        [id],
      );
      if (ref.rows.length > 0) {
        await db.query("ROLLBACK");
        return res.status(400).json({
          message: "Target is referenced by transactions; provide reassign_to",
        });
      }
    }

    await db.query(`DELETE FROM targets WHERE id = $1`, [id]);
    await db.query("COMMIT");
    return res.json({ success: true });
  } catch (err) {
    await db.query("ROLLBACK");
    console.error("Delete target error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
