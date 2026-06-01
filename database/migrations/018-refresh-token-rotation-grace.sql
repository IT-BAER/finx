-- Migration 018: Refresh-token rotation grace window
--
-- Adds a one-step history of the previous refresh token so the server can
-- tolerate benign rotation races (a client that retried a refresh after the
-- response was lost, or two near-simultaneous refreshes) WITHOUT treating the
-- just-rotated-away token as a reuse attack and revoking the whole family
-- (which force-logs-out the user).
--
-- When a presented token matches `previous_token_hash` and the rotation happened
-- within the grace window, the server re-issues a valid token instead of revoking.

ALTER TABLE refresh_tokens ADD COLUMN IF NOT EXISTS previous_token_hash TEXT;
ALTER TABLE refresh_tokens ADD COLUMN IF NOT EXISTS previous_rotated_at TIMESTAMP WITH TIME ZONE;

COMMENT ON COLUMN refresh_tokens.previous_token_hash IS 'Bcrypt hash of the token rotated away on the last refresh (for rotation-race grace)';
COMMENT ON COLUMN refresh_tokens.previous_rotated_at IS 'When the previous token was rotated away; grace window is measured from here';
