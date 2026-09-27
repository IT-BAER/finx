-- Migration 021: server-synced vendor/merchant category rules (mobile "always use category X for vendor Y").
-- category_id nullable: a rule created from notification automation may hold only source/target/type.
CREATE TABLE IF NOT EXISTS merchant_rules (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  merchant_normalized VARCHAR(100) NOT NULL,
  category_id INTEGER REFERENCES categories(id) ON DELETE CASCADE,
  source_name VARCHAR(100), target_name VARCHAR(100),
  type VARCHAR(10) CHECK (type IN ('expense','income')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, merchant_normalized)
);
CREATE INDEX IF NOT EXISTS idx_merchant_rules_user ON merchant_rules(user_id);
