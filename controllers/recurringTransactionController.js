const RecurringTransaction = require("../models/RecurringTransaction");
const { getSharingPermissionMeta } = require("../utils/access");

// Helpers
function toYMD(date) {
  const d = new Date(date);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function normalizeDateInput(v) {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  if (!s) return null;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return toYMD(d);
}

// Create recurring transaction
const createRecurringTransaction = async (req, res) => {
  try {
    const {
      title,
      amount,
      type,
      category_id,
      category, // may be provided from the UI as a name; used only for fallback title
      source,
      target,
      description,
      recurrence_type,
      recurrence_interval,
      start_date,
      date, // UI sends base transaction date; treat as start_date if start_date not provided
      end_date,
      max_occurrences,
      transaction_id,
    } = req.body;

    // Minimal validation + normalization to avoid DB errors
    const nowYMD = toYMD(new Date());
    const startDateYMD = normalizeDateInput(start_date ?? date) || nowYMD;
    const endDateYMD = normalizeDateInput(end_date); // may be null
    const intervalInt = parseInt(recurrence_interval, 10);
    const safeInterval = Number.isFinite(intervalInt) && intervalInt > 0 ? intervalInt : 1;
    const safeType = String(type || "").toLowerCase().trim(); // expect 'income' | 'expense'

    // Normalize amount that may come localized (e.g., 1.199,97)
    const amountStr = String(amount ?? "").trim();
    const normalizedAmountNum = (() => {
      if (!amountStr) return NaN;
      // If it contains a comma, treat it as decimal separator and strip thousands dots
      if (amountStr.includes(",")) {
        const cleaned = amountStr.replace(/\./g, "").replace(",", ".");
        return Number(cleaned);
      }
      // Otherwise strip currency symbols/spaces
      const cleaned = amountStr.replace(/[^0-9+\-\.]/g, "");
      return Number(cleaned);
    })();

    if (!Number.isFinite(normalizedAmountNum)) {
      return res.status(400).json({ message: "Amount is required" });
    }
    if (safeType !== "income" && safeType !== "expense") {
      return res.status(400).json({ message: "Type must be 'income' or 'expense'" });
    }

    // Title is optional in the UI; synthesize a reasonable fallback
    let titleFinal = String(title || "").trim();
    if (!titleFinal) {
      const desc = String(description || "").trim();
      const catName = String(category || "").trim();
      if (desc) titleFinal = desc;
      else if (catName) titleFinal = catName;
      else titleFinal = `${safeType === "income" ? "Recurring income" : "Recurring expense"}`;
    }

    // Optional ID fields
    const catId = category_id != null && category_id !== ""
      ? parseInt(category_id, 10)
      : null;
    const maxOccInt = parseInt(max_occurrences, 10);
    const maxOcc = Number.isFinite(maxOccInt) && maxOccInt > 0 ? maxOccInt : null;
    const txnId = transaction_id != null && transaction_id !== ""
      ? parseInt(transaction_id, 10)
      : null;

    const recurringTransaction = await RecurringTransaction.create(
      req.user.id,
      titleFinal,
      normalizedAmountNum,
      safeType,
      catId,
      source || null,
      target || null,
      description,
      String(recurrence_type || "monthly").toLowerCase(),
      safeInterval,
      startDateYMD,
      endDateYMD,
      maxOcc,
      txnId,
    );

    res.status(201).json({
      success: true,
      recurringTransaction,
    });
  } catch (err) {
    console.error("Create recurring transaction error:", err.message);
    res.status(500).json({ message: "Server error" });
  }
};

// Get recurring transaction by ID (owner or shared visibility via source-based rules)
const getRecurringTransactionById = async (req, res) => {
  try {
    const { id } = req.params;
    // Load regardless of owner; enforce permissions below
    const recurringTransaction = await RecurringTransaction.findById(id);
    if (!recurringTransaction) {
      return res
        .status(404)
        .json({ message: "Recurring transaction not found" });
    }

    const ownerId = recurringTransaction.user_id;
    const isOwner = Number(ownerId) === Number(req.user.id);
    if (!isOwner) {
      const meta = await getSharingPermissionMeta(ownerId, req.user.id);
      if (!meta.exists) {
        return res
          .status(404)
          .json({ message: "Recurring transaction not found" });
      }
      // Visibility scoped by allowed source names when provided
      const hasNames = Array.isArray(meta.allowedSourceNamesLower) && meta.allowedSourceNamesLower.length > 0;
      if (hasNames) {
        const type = String(recurringTransaction.type || "").toLowerCase();
        const sourceName = String(recurringTransaction.source || "").trim().toLowerCase();
        const targetName = String(recurringTransaction.target || "").trim().toLowerCase();
        // expense: source must match; income: target must match (maps to source names domain)
        const keyName = type === "income" ? targetName : sourceName;
        if (!keyName || !meta.allowedSourceNamesLower.includes(keyName)) {
          return res
            .status(404)
            .json({ message: "Recurring transaction not found" });
        }
      }
    }

    res.json({
      success: true,
      recurringTransaction,
    });
  } catch (err) {
    console.error("Get recurring transaction error:", err.message);
    res.status(500).json({ message: "Server error" });
  }
};

// Update recurring transaction (owner or shared with write permission; scoped by source names)
const updateRecurringTransaction = async (req, res) => {
  try {
    const { id } = req.params;
    const updatesRaw = req.body || {};

    // Load regardless of owner; enforce permissions
    const recurringTransaction = await RecurringTransaction.findById(id);
    if (!recurringTransaction) {
      return res
        .status(404)
        .json({ message: "Recurring transaction not found" });
    }

    const ownerId = recurringTransaction.user_id;
    const isOwner = Number(ownerId) === Number(req.user.id);
    if (!isOwner) {
      const meta = await getSharingPermissionMeta(ownerId, req.user.id);
      if (!meta.exists) {
        return res
          .status(404)
          .json({ message: "Recurring transaction not found" });
      }
      if (!meta.writable) {
        return res.status(403).json({ message: "Forbidden" });
      }
      // If names are scoped, ensure the final values (after update) remain within scope
      const hasNames = Array.isArray(meta.allowedSourceNamesLower) && meta.allowedSourceNamesLower.length > 0;
      if (hasNames) {
        const nextType = (Object.prototype.hasOwnProperty.call(updatesRaw, "type") && typeof updatesRaw.type === "string")
          ? String(updatesRaw.type).toLowerCase().trim()
          : String(recurringTransaction.type || "").toLowerCase();
        const nextSource = (Object.prototype.hasOwnProperty.call(updatesRaw, "source"))
          ? String(updatesRaw.source || "").trim().toLowerCase()
          : String(recurringTransaction.source || "").trim().toLowerCase();
        const nextTarget = (Object.prototype.hasOwnProperty.call(updatesRaw, "target"))
          ? String(updatesRaw.target || "").trim().toLowerCase()
          : String(recurringTransaction.target || "").trim().toLowerCase();
        const keyName = nextType === "income" ? nextTarget : nextSource;
        if (!keyName || !meta.allowedSourceNamesLower.includes(keyName)) {
          return res.status(403).json({ message: "Forbidden" });
        }
      }
    }

    // Normalize updates to avoid passing empty strings to DATE columns
    const normalized = { ...updatesRaw };
    if (Object.prototype.hasOwnProperty.call(updatesRaw, "start_date")) {
      const nd = normalizeDateInput(updatesRaw.start_date);
      if (nd) normalized.start_date = nd;
      else delete normalized.start_date; // ignore empty/invalid to keep current value
    }
    if (Object.prototype.hasOwnProperty.call(updatesRaw, "end_date")) {
      const nd = normalizeDateInput(updatesRaw.end_date);
      normalized.end_date = nd; // allow null to clear end_date
    }
    if (Object.prototype.hasOwnProperty.call(updatesRaw, "recurrence_interval")) {
      const intervalInt = parseInt(updatesRaw.recurrence_interval, 10);
      if (Number.isFinite(intervalInt) && intervalInt > 0) {
        normalized.recurrence_interval = intervalInt;
      } else {
        delete normalized.recurrence_interval;
      }
    }
    if (Object.prototype.hasOwnProperty.call(updatesRaw, "amount")) {
      const n = Number(updatesRaw.amount);
      if (Number.isFinite(n)) normalized.amount = n;
      else delete normalized.amount;
    }
    if (Object.prototype.hasOwnProperty.call(updatesRaw, "type")) {
      const t = String(updatesRaw.type || "").toLowerCase().trim();
      if (t === "income" || t === "expense") normalized.type = t;
      else delete normalized.type;
    }

    // Authorized: perform unscoped update by id (owner remains unchanged)
    const updatedRecurringTransaction = await RecurringTransaction.update(
      id,
      normalized,
    );

    res.json({
      success: true,
      recurringTransaction: updatedRecurringTransaction,
    });
  } catch (err) {
    console.error("Update recurring transaction error:", err.message);
    res.status(500).json({ message: "Server error" });
  }
};

// Delete recurring transaction (owner or shared with write permission; scoped by source names)
const deleteRecurringTransaction = async (req, res) => {
  try {
    const { id } = req.params;
    // Load regardless of owner; enforce permissions
    const recurringTransaction = await RecurringTransaction.findById(id);
    if (!recurringTransaction) {
      return res
        .status(404)
        .json({ message: "Recurring transaction not found" });
    }

    const ownerId = recurringTransaction.user_id;
    const isOwner = Number(ownerId) === Number(req.user.id);
    if (!isOwner) {
      const meta = await getSharingPermissionMeta(ownerId, req.user.id);
      if (!meta.exists) {
        return res
          .status(404)
          .json({ message: "Recurring transaction not found" });
      }
      if (!meta.writable) {
        return res.status(403).json({ message: "Forbidden" });
      }
      const hasNames = Array.isArray(meta.allowedSourceNamesLower) && meta.allowedSourceNamesLower.length > 0;
      if (hasNames) {
        const type = String(recurringTransaction.type || "").toLowerCase();
        const sourceName = String(recurringTransaction.source || "").trim().toLowerCase();
        const targetName = String(recurringTransaction.target || "").trim().toLowerCase();
        const keyName = type === "income" ? targetName : sourceName;
        if (!keyName || !meta.allowedSourceNamesLower.includes(keyName)) {
          return res.status(403).json({ message: "Forbidden" });
        }
      }
    }

    await RecurringTransaction.delete(id);

    res.json({
      success: true,
      message: "Recurring transaction deleted successfully",
    });
  } catch (err) {
    console.error("Delete recurring transaction error:", err.message);
    res.status(500).json({ message: "Server error" });
  }
};

module.exports = {
  createRecurringTransaction,
  getRecurringTransactionById,
  updateRecurringTransaction,
  deleteRecurringTransaction,
};
