-- Migration 012: Multi-device refresh token support
-- Creates a separate refresh_tokens table to support concurrent sessions on multiple devices
-- This replaces the single-token-per-user approach with device-specific tokens

-- Create refresh_tokens table
CREATE TABLE IF NOT EXISTS refresh_tokens (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL,
    token_family VARCHAR(36) NOT NULL UNIQUE,
    device_id VARCHAR(128) NOT NULL,
    device_name VARCHAR(255),
    device_type VARCHAR(50), -- 'mobile', 'web', 'desktop'
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_used_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    revoked_at TIMESTAMP WITH TIME ZONE,
    ip_address INET,
    user_agent TEXT
);

-- Indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id) WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_device_id ON refresh_tokens(user_id, device_id) WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires ON refresh_tokens(expires_at) WHERE revoked_at IS NULL;

-- Migrate existing refresh tokens from users table to the new table
-- Only migrate if there's a valid token (hash is not null)
INSERT INTO refresh_tokens (user_id, token_hash, token_family, device_id, device_name, device_type, expires_at, created_at)
SELECT 
    id,
    refresh_token_hash,
    refresh_token_family,
    'legacy-' || id::text, -- Temporary device_id for migrated tokens
    'Migrated Session',
    'unknown',
    COALESCE(refresh_token_expires, CURRENT_TIMESTAMP + INTERVAL '90 days'),
    CURRENT_TIMESTAMP
FROM users
WHERE refresh_token_hash IS NOT NULL
  AND refresh_token_family IS NOT NULL
  AND (refresh_token_expires IS NULL OR refresh_token_expires > CURRENT_TIMESTAMP)
ON CONFLICT (token_family) DO NOTHING;

-- Note: We keep the columns in users table for backward compatibility during rollout
-- They will be deprecated in a future migration after confirming the new table works

-- Add comments
COMMENT ON TABLE refresh_tokens IS 'Stores refresh tokens for multi-device session management';
COMMENT ON COLUMN refresh_tokens.token_hash IS 'Bcrypt hashed refresh token';
COMMENT ON COLUMN refresh_tokens.token_family IS 'UUID for detecting token reuse attacks';
COMMENT ON COLUMN refresh_tokens.device_id IS 'Unique identifier for the device/browser';
COMMENT ON COLUMN refresh_tokens.device_name IS 'Human-readable device name (e.g., iPhone 14, Chrome on Windows)';
COMMENT ON COLUMN refresh_tokens.device_type IS 'Type of device: mobile, web, desktop';
COMMENT ON COLUMN refresh_tokens.last_used_at IS 'Last time this token was used for refresh';
COMMENT ON COLUMN refresh_tokens.revoked_at IS 'When the token was revoked (soft delete)';
