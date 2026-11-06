-- Migration 023: recurring rules can be paused. The processor skips rules with is_active = FALSE.
ALTER TABLE recurring_transactions
ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;
