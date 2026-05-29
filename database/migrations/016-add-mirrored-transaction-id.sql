-- Cross-user transaction mirroring support.
-- When a user creates a transaction whose counterparty is a source another user
-- shared with them (write permission), a mirrored transaction is created on the
-- counterparty's account. This column links the mirror back to its origin so it
-- can be kept in sync (update/delete) and to prevent infinite mirroring loops.
ALTER TABLE transactions
    ADD COLUMN IF NOT EXISTS mirrored_from_transaction_id INTEGER
        REFERENCES transactions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_transactions_mirrored_from
    ON transactions(mirrored_from_transaction_id);
