-- Account balances: a user-correctable opening balance per source.
--
-- Displayed balance = opening_balance + all-time net. "All-time net" must match BOTH sides of
-- an account: expenses reference it via transactions.source_id, incomes via a same-named
-- targets row (see utils/sourceFilter.js).
--
-- No synced_balance here: SimpleFIN is a managed-hosting feature and does not exist in this repo.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sources' AND column_name = 'opening_balance'
  ) THEN
    ALTER TABLE sources ADD COLUMN opening_balance NUMERIC(14,2) NOT NULL DEFAULT 0;
  END IF;
END $$;
