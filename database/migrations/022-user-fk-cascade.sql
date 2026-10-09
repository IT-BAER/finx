-- Migration 022: deleting a user deletes their sources, targets and transactions; their categories stay (owner NULL).
-- The original user_id FKs were NO ACTION, so DELETE FROM users failed for any user with data.
-- Drops every single-column FK on these user_id columns by catalog lookup (name-independent).
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT c.conname, c.conrelid::regclass AS tbl
    FROM pg_constraint c
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
    WHERE c.contype = 'f'
      AND array_length(c.conkey, 1) = 1
      AND c.confrelid = 'users'::regclass
      AND a.attname = 'user_id'
      AND c.conrelid IN ('categories'::regclass, 'sources'::regclass, 'targets'::regclass, 'transactions'::regclass)
  LOOP
    EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', r.tbl, r.conname);
  END LOOP;
END $$;

-- Categories are a global, name-deduped list used by every user: keep them, drop the owner.
ALTER TABLE categories ADD CONSTRAINT categories_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE sources ADD CONSTRAINT sources_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE targets ADD CONSTRAINT targets_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE transactions ADD CONSTRAINT transactions_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
