-- Migration 015: Add composite index for server-side transaction pagination
-- Matches ORDER BY t.date DESC, t.id DESC used in getTransactions
CREATE INDEX IF NOT EXISTS idx_transactions_user_date_id
  ON transactions (user_id, date DESC, id DESC);
