const logger = require("../utils/logger");
const MerchantRule = require("../models/MerchantRule");

// Get all merchant rules for the current user
const getMerchantRules = async (req, res) => {
  try {
    const rules = await MerchantRule.findAllForUser(req.user.id);
    res.json({ success: true, rules });
  } catch (err) {
    logger.error("Get merchant rules error:", err.message);
    res.status(500).json({ message: "Server error" });
  }
};

// Upsert a rule by key (idempotent -> safe for offline queue replay)
const upsertMerchantRule = async (req, res) => {
  try {
    const { key } = req.params;
    const { category_id, source_name, target_name, type } = req.body;

    if (category_id != null) {
      const exists = await MerchantRule.categoryExists(category_id);
      if (!exists) {
        return res.status(400).json({ message: "Category not found" });
      }
    }

    const rule = await MerchantRule.upsertForUser(req.user.id, key, {
      category_id: category_id ?? null,
      source_name: source_name ?? null,
      target_name: target_name ?? null,
      type: type ?? null,
    });

    res.json({ success: true, rule });
  } catch (err) {
    logger.error("Upsert merchant rule error:", err.message);
    res.status(500).json({ message: "Server error" });
  }
};

// Delete a rule by key. 200 also when no row existed (idempotent).
const deleteMerchantRule = async (req, res) => {
  try {
    const { key } = req.params;
    await MerchantRule.deleteForUser(req.user.id, key);
    res.json({ success: true });
  } catch (err) {
    logger.error("Delete merchant rule error:", err.message);
    res.status(500).json({ message: "Server error" });
  }
};

// Legacy bulk import. Unknown category ids are dropped (set null) rather than failing the row.
const importMerchantRules = async (req, res) => {
  try {
    const { rules } = req.body;

    const categoryIds = [...new Set(rules.map((r) => r.category_id).filter((id) => id != null))];
    const validIds = new Set();
    for (const id of categoryIds) {
      if (await MerchantRule.categoryExists(id)) validIds.add(id);
    }

    const sanitized = rules.map((r) => ({
      merchant_normalized: r.merchant_normalized,
      category_id: r.category_id != null && validIds.has(r.category_id) ? r.category_id : null,
      source_name: r.source_name ?? null,
      target_name: r.target_name ?? null,
      type: r.type ?? null,
    }));

    const imported = await MerchantRule.importForUser(req.user.id, sanitized);
    res.json({ success: true, imported });
  } catch (err) {
    logger.error("Import merchant rules error:", err.message);
    res.status(500).json({ message: "Server error" });
  }
};

module.exports = {
  getMerchantRules,
  upsertMerchantRule,
  deleteMerchantRule,
  importMerchantRules,
};
