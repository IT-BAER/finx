-- Migration 013: Add share_code column for invite-code-based sharing
-- Both self-hosted (finx) and managed hosting (finx-server) use share codes
-- so that mobile clients have a single sharing API contract.

-- Add share_code column
ALTER TABLE users ADD COLUMN IF NOT EXISTS share_code VARCHAR(10) UNIQUE;

-- Generate share codes for all existing users that don't have one
-- Uses 8-char alphanumeric (excluding ambiguous chars: 0/O, 1/I/L)
DO $$
DECLARE
  r RECORD;
  new_code TEXT;
  charset TEXT := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  code_len INT := 8;
  collision BOOLEAN;
BEGIN
  FOR r IN SELECT id FROM users WHERE share_code IS NULL LOOP
    LOOP
      new_code := '';
      FOR i IN 1..code_len LOOP
        new_code := new_code || substr(charset, floor(random() * length(charset) + 1)::int, 1);
      END LOOP;
      -- Check for collision
      SELECT EXISTS(SELECT 1 FROM users WHERE share_code = new_code) INTO collision;
      EXIT WHEN NOT collision;
    END LOOP;
    UPDATE users SET share_code = new_code WHERE id = r.id;
  END LOOP;
END $$;
