const express = require("express");
const router = express.Router();
const {
  createRecurringTransaction,
  getRecurringTransactionById,
  updateRecurringTransaction,
  deleteRecurringTransaction,
} = require("../controllers/recurringTransactionController");
const auth = require("../middleware/auth");

router.post("/", auth, createRecurringTransaction);
router.get("/:id", auth, getRecurringTransactionById);
router.put("/:id", auth, updateRecurringTransaction);
router.delete("/:id", auth, deleteRecurringTransaction);

module.exports = router;
