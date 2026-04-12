-- Migration 014: Add budget_limit to categories
-- Allows users to set monthly spending limits per category

ALTER TABLE categories 
ADD COLUMN IF NOT EXISTS budget_limit DECIMAL(12,2) DEFAULT NULL;

COMMENT ON COLUMN categories.budget_limit IS 'Monthly spending limit for this category. NULL means no limit.';
