-- Migration 010: Add refresh token support
-- Adds secure refresh token storage for JWT token rotation

-- Add refresh token columns to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS refresh_token_hash TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS refresh_token_expires TIMESTAMP WITH TIME ZONE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS refresh_token_family VARCHAR(36);

-- Index for faster refresh token lookups
CREATE INDEX IF NOT EXISTS idx_users_refresh_token_family ON users(refresh_token_family) WHERE refresh_token_family IS NOT NULL;

-- Comment
COMMENT ON COLUMN users.refresh_token_hash IS 'Hashed refresh token for secure storage';
COMMENT ON COLUMN users.refresh_token_expires IS 'Expiration timestamp for the refresh token';
COMMENT ON COLUMN users.refresh_token_family IS 'Token family UUID for detecting token reuse attacks';
