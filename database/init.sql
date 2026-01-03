
-- Note: Superuser role creation removed. The installer connects as an app user
-- without superuser privileges; attempting to create superusers would fail and
-- prevent the rest of the schema from being created on fresh installs.

-- Updated Database Schema for FinX (v3)
-- This version includes all required tables and columns

-- Users table (idempotent creation)
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    first_name VARCHAR(50),
    last_name VARCHAR(50),
    income_tracking_disabled BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Ensure is_admin column exists for fresh installs (aligns with migration 005 for upgrades)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'is_admin'
  ) THEN
    ALTER TABLE users ADD COLUMN is_admin BOOLEAN DEFAULT FALSE;
  END IF;
END $$;

-- Remove any existing admin user to allow init-db.js to recreate it
DELETE FROM users WHERE email = 'admin@finx.local';

-- Add last_login column to users table if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'last_login'
  ) THEN
    ALTER TABLE users ADD COLUMN last_login TIMESTAMP;
  END IF;
END $$;

-- Add theme preferences columns to users table if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'theme'
  ) THEN
    ALTER TABLE users ADD COLUMN theme VARCHAR(20) DEFAULT 'default';
  END IF;
  
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'dark_mode'
  ) THEN
    ALTER TABLE users ADD COLUMN dark_mode BOOLEAN DEFAULT NULL;
  END IF;
END $$;

-- Categories table (idempotent creation) with sample flag
CREATE TABLE IF NOT EXISTS categories (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    name VARCHAR(50) NOT NULL,
    is_sample BOOLEAN DEFAULT FALSE,
    UNIQUE(user_id, name)  -- Prevent duplicate categories per user
);

-- Sources table (idempotent creation) with sample flag
CREATE TABLE IF NOT EXISTS sources (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    name VARCHAR(100) NOT NULL,
    is_sample BOOLEAN DEFAULT FALSE,
    UNIQUE(user_id, name)
);

-- Targets table (idempotent creation) with sample flag
CREATE TABLE IF NOT EXISTS targets (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    name VARCHAR(100) NOT NULL,
    is_sample BOOLEAN DEFAULT FALSE,
    UNIQUE(user_id, name)
);

-- Transactions table (idempotent creation) with sample flag
CREATE TABLE IF NOT EXISTS transactions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    category_id INTEGER REFERENCES categories(id),
    source_id INTEGER REFERENCES sources(id),
    target_id INTEGER REFERENCES targets(id),
    amount NUMERIC(10, 2) NOT NULL,
    type VARCHAR(10) CHECK (type IN ('income', 'expense')) NOT NULL,
    description TEXT,
    date DATE DEFAULT CURRENT_DATE,
    is_sample BOOLEAN DEFAULT FALSE,
    recurring_transaction_id INTEGER
);

-- Sharing permissions table (consolidated latest schema: no can_view_* booleans)
CREATE TABLE IF NOT EXISTS sharing_permissions (
    id SERIAL PRIMARY KEY,
    owner_user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    shared_with_user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    permission_level VARCHAR(20) DEFAULT 'read' CHECK (LOWER(TRIM(permission_level)) IN ('read', 'read_write')),
    source_filter TEXT, -- JSON array of numeric source IDs (NULL means all)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(owner_user_id, shared_with_user_id)
);

-- Ensure JSON array constraint for source_filter
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'sharing_source_filter_json'
      AND conrelid = 'sharing_permissions'::regclass
  ) THEN
    ALTER TABLE sharing_permissions
      ADD CONSTRAINT sharing_source_filter_json
      CHECK (source_filter IS NULL OR jsonb_typeof(source_filter::jsonb) = 'array');
  END IF;
END $$;

-- Maintain updated_at automatically
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sharing_permissions_updated_at ON sharing_permissions;

CREATE TRIGGER trg_sharing_permissions_updated_at
BEFORE UPDATE ON sharing_permissions
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- Indexes to match latest optimizations
CREATE INDEX IF NOT EXISTS idx_sharing_permissions_owner ON sharing_permissions(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_sharing_permissions_shared_with ON sharing_permissions(shared_with_user_id);
CREATE INDEX IF NOT EXISTS idx_sharing_permissions_created_at ON sharing_permissions(created_at);
CREATE INDEX IF NOT EXISTS idx_sharing_permissions_shared_owner ON sharing_permissions(shared_with_user_id, owner_user_id);

-- Performance indexes for transactions and lookup tables
CREATE INDEX IF NOT EXISTS idx_transactions_user ON transactions(user_id);

-- Recurring Transactions table
CREATE TABLE IF NOT EXISTS recurring_transactions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  amount NUMERIC(10, 2) NOT NULL,
  type VARCHAR(50) NOT NULL,
  category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  source VARCHAR(255),
  target VARCHAR(255),
  description TEXT,
  recurrence_type VARCHAR(50) NOT NULL,
  recurrence_interval INTEGER NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE,
  max_occurrences INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE recurring_transactions
ADD COLUMN IF NOT EXISTS transaction_id INTEGER REFERENCES transactions(id) ON DELETE CASCADE;

-- Ensure supporting columns for processing exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'recurring_transactions' AND column_name = 'occurrences_created'
  ) THEN
    ALTER TABLE recurring_transactions
      ADD COLUMN occurrences_created INTEGER NOT NULL DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'recurring_transactions' AND column_name = 'last_run'
  ) THEN
    ALTER TABLE recurring_transactions
      ADD COLUMN last_run TIMESTAMP WITH TIME ZONE;
  END IF;
END $$;

-- Helpful indexes for recurring processing
CREATE INDEX IF NOT EXISTS idx_recurring_due ON recurring_transactions (start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_recurring_updated_at ON recurring_transactions (updated_at);

-- Add foreign key constraint for transactions -> recurring_transactions
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'fk_transactions_recurring'
      AND conrelid = 'transactions'::regclass
  ) THEN
    ALTER TABLE transactions
      ADD CONSTRAINT fk_transactions_recurring
      FOREIGN KEY (recurring_transaction_id)
      REFERENCES recurring_transactions(id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_transactions_recurring_id ON transactions(recurring_transaction_id);
CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions(category_id);
CREATE INDEX IF NOT EXISTS idx_transactions_source ON transactions(source_id);
CREATE INDEX IF NOT EXISTS idx_transactions_target ON transactions(target_id);
CREATE INDEX IF NOT EXISTS idx_transactions_date_user ON transactions(user_id, date DESC);

-- Unique constraints to prevent duplicate names per user on lookup tables
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'uq_sources_user_name'
      AND conrelid = 'sources'::regclass
  ) THEN
    ALTER TABLE sources
      ADD CONSTRAINT uq_sources_user_name UNIQUE (user_id, name);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'uq_targets_user_name'
      AND conrelid = 'targets'::regclass
  ) THEN
    ALTER TABLE targets
      ADD CONSTRAINT uq_targets_user_name UNIQUE (user_id, name);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'uq_categories_user_name'
      AND conrelid = 'categories'::regclass
  ) THEN
    ALTER TABLE categories
      ADD CONSTRAINT uq_categories_user_name UNIQUE (user_id, name);
  END IF;
END $$;

-- Helper indexes for joins on lookup tables
CREATE INDEX IF NOT EXISTS idx_sources_user ON sources(user_id, id);
CREATE INDEX IF NOT EXISTS idx_targets_user ON targets(user_id, id);
CREATE INDEX IF NOT EXISTS idx_categories_user ON categories(user_id, id);

-- Performance indexes for common query patterns (v0.8.0+)

-- Composite index for transactions by user, type, and date (for dashboard and reports)
CREATE INDEX IF NOT EXISTS idx_transactions_user_type_date ON transactions(user_id, type, date DESC);

-- Composite index for transactions ordered by date with user filter
CREATE INDEX IF NOT EXISTS idx_transactions_user_date_id ON transactions(user_id, date DESC, id DESC);

-- Text search index for transaction descriptions (case-insensitive search)
CREATE INDEX IF NOT EXISTS idx_transactions_description_lower ON transactions (LOWER(description));

-- Composite indexes for category, source, target lookups with user context
CREATE INDEX IF NOT EXISTS idx_transactions_user_category ON transactions(user_id, category_id);
CREATE INDEX IF NOT EXISTS idx_transactions_user_source ON transactions(user_id, source_id);
CREATE INDEX IF NOT EXISTS idx_transactions_user_target ON transactions(user_id, target_id);

-- Text search indexes for lookup tables (enable fast LOWER(name) LIKE searches)
CREATE INDEX IF NOT EXISTS idx_categories_name_lower ON categories (LOWER(name));
CREATE INDEX IF NOT EXISTS idx_sources_name_lower ON sources (LOWER(name));
CREATE INDEX IF NOT EXISTS idx_targets_name_lower ON targets (LOWER(name));

-- Index for goals by user
CREATE INDEX IF NOT EXISTS idx_goals_user ON goals(user_id);
CREATE INDEX IF NOT EXISTS idx_goals_user_deadline ON goals(user_id, deadline);

-- Indexes for recurring transactions
CREATE INDEX IF NOT EXISTS idx_recurring_user ON recurring_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_recurring_user_next_run ON recurring_transactions(user_id, start_date, end_date);

-- Sample data now handled exclusively by init-db.js
-- All data initialization moved to init-db.js
