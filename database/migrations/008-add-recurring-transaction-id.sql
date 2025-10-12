-- Migration: Add recurring_transaction_id to transactions table
-- This links auto-created transactions back to their recurring transaction rule

-- Add the column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'transactions' AND column_name = 'recurring_transaction_id'
  ) THEN
    ALTER TABLE transactions
      ADD COLUMN recurring_transaction_id INTEGER REFERENCES recurring_transactions(id) ON DELETE SET NULL;
    
    -- Create index for performance
    CREATE INDEX IF NOT EXISTS idx_transactions_recurring_id ON transactions(recurring_transaction_id);
    
    RAISE NOTICE 'Added recurring_transaction_id column to transactions table';
  ELSE
    RAISE NOTICE 'recurring_transaction_id column already exists';
  END IF;
END $$;
