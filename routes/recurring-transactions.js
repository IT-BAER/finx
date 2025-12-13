const express = require("express");
const router = express.Router();
const {
  createRecurringTransaction,
  getAllRecurringTransactions,
  getRecurringTransactionById,
  updateRecurringTransaction,
  deleteRecurringTransaction,
} = require("../controllers/recurringTransactionController");
const auth = require("../middleware/auth");

router.post("/", auth, createRecurringTransaction);
router.get("/", auth, getAllRecurringTransactions);
router.get("/:id", auth, getRecurringTransactionById);
router.put("/:id", auth, updateRecurringTransaction);
router.delete("/:id", auth, deleteRecurringTransaction);

module.exports = router;
