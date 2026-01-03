-- Migration 011: Add composite indexes for performance optimization
-- This migration adds indexes to improve performance for common query patterns:
-- 1. Transaction queries with user_id, date, type filters
-- 2. Text search across description, category, source, target
-- 3. Dashboard aggregations by user, type, and date
-- 4. Reporting queries with category and source grouping

-- Composite index for transactions by user, type, and date (for dashboard and reports)
-- Covers: getSummary, getExpensesByCategory, getIncomeBySource, filtered transaction lists
CREATE INDEX IF NOT EXISTS idx_transactions_user_type_date ON transactions(user_id, type, date DESC);

-- Composite index for transactions ordered by date with user filter
-- Covers: getRecent, paginated transaction lists with date sorting
-- Note: This is a partial covering index - includes id for proper ordering
CREATE INDEX IF NOT EXISTS idx_transactions_user_date_id ON transactions(user_id, date DESC, id DESC);

-- Text search index for transaction descriptions (case-insensitive search)
-- Note: Using lower() function index for efficient LOWER(description) LIKE queries
CREATE INDEX IF NOT EXISTS idx_transactions_description_lower ON transactions (LOWER(description));

-- Composite index for category lookups with user context
-- Covers: queries that filter by category_id and user_id together
CREATE INDEX IF NOT EXISTS idx_transactions_user_category ON transactions(user_id, category_id);

-- Composite index for source lookups with user context  
-- Covers: getIncomeBySource, filtered queries by source
CREATE INDEX IF NOT EXISTS idx_transactions_user_source ON transactions(user_id, source_id);

-- Composite index for target lookups with user context
-- Covers: filtered queries by target
CREATE INDEX IF NOT EXISTS idx_transactions_user_target ON transactions(user_id, target_id);

-- Text search indexes for lookup tables (enable fast LOWER(name) LIKE searches)
CREATE INDEX IF NOT EXISTS idx_categories_name_lower ON categories (LOWER(name));
CREATE INDEX IF NOT EXISTS idx_sources_name_lower ON sources (LOWER(name));
CREATE INDEX IF NOT EXISTS idx_targets_name_lower ON targets (LOWER(name));

-- Index for goals by user (for dashboard and reports)
CREATE INDEX IF NOT EXISTS idx_goals_user ON goals(user_id);

-- Composite index for goals with status filter (for filtering completed/active goals)
CREATE INDEX IF NOT EXISTS idx_goals_user_deadline ON goals(user_id, deadline);

-- Index for recurring transactions by user
CREATE INDEX IF NOT EXISTS idx_recurring_user ON recurring_transactions(user_id);

-- Composite index for recurring transactions processing (next run date)
CREATE INDEX IF NOT EXISTS idx_recurring_user_next_run ON recurring_transactions(user_id, start_date, end_date);

-- Analyze tables to update statistics after creating indexes
ANALYZE transactions;
ANALYZE categories;
ANALYZE sources;
ANALYZE targets;
ANALYZE goals;
ANALYZE recurring_transactions;
