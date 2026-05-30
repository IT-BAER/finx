-- Add reminder fields to recurring_transactions
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'recurring_transactions' AND column_name = 'reminder_enabled'
  ) THEN
    ALTER TABLE recurring_transactions ADD COLUMN reminder_enabled BOOLEAN DEFAULT FALSE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'recurring_transactions' AND column_name = 'reminder_lead'
  ) THEN
    ALTER TABLE recurring_transactions ADD COLUMN reminder_lead VARCHAR(16) DEFAULT 'week';
  END IF;
END $$;
