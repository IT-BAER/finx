-- Migration 020: per-user monthly AI-chat token/cost ledger.
-- Backs the CHAT_MONTHLY_COST_CAP_USD hard cap in services/aiChat.js (disabled by default here
-- since this is self-hosted, own OpenRouter key — set the env var to enable). One row per
-- (user, UTC calendar month), additively UPSERTed after every chat turn.
CREATE TABLE IF NOT EXISTS ai_chat_usage (
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    month CHAR(7) NOT NULL,
    input_tokens BIGINT NOT NULL DEFAULT 0,
    output_tokens BIGINT NOT NULL DEFAULT 0,
    cost_usd NUMERIC(8,4) NOT NULL DEFAULT 0,
    PRIMARY KEY (user_id, month)
);
