-- Migration 009: Add savings goals table
-- This migration adds support for user savings goals

-- Goals table for tracking user savings objectives
CREATE TABLE IF NOT EXISTS goals (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    target_amount NUMERIC(12, 2) NOT NULL,
    current_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
    deadline DATE,
    icon VARCHAR(50) DEFAULT 'savings',
    color VARCHAR(20) DEFAULT '#06b6d4',
    is_completed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Goal contributions table to track individual savings toward a goal
CREATE TABLE IF NOT EXISTS goal_contributions (
    id SERIAL PRIMARY KEY,
    goal_id INTEGER NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
    amount NUMERIC(12, 2) NOT NULL,
    note TEXT,
    contributed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_goals_user ON goals(user_id);
CREATE INDEX IF NOT EXISTS idx_goals_completed ON goals(user_id, is_completed);
CREATE INDEX IF NOT EXISTS idx_goals_deadline ON goals(user_id, deadline);
CREATE INDEX IF NOT EXISTS idx_goal_contributions_goal ON goal_contributions(goal_id);
CREATE INDEX IF NOT EXISTS idx_goal_contributions_date ON goal_contributions(contributed_at);

-- Trigger to update goals.updated_at on modification
CREATE OR REPLACE FUNCTION update_goal_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_goals_updated_at ON goals;

CREATE TRIGGER trg_goals_updated_at
BEFORE UPDATE ON goals
FOR EACH ROW
EXECUTE FUNCTION update_goal_updated_at();

-- Trigger to update goal's current_amount when contributions change
CREATE OR REPLACE FUNCTION update_goal_current_amount()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE goals 
        SET current_amount = current_amount + NEW.amount,
            is_completed = (current_amount + NEW.amount) >= target_amount
        WHERE id = NEW.goal_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE goals 
        SET current_amount = GREATEST(0, current_amount - OLD.amount),
            is_completed = GREATEST(0, current_amount - OLD.amount) >= target_amount
        WHERE id = OLD.goal_id;
    ELSIF TG_OP = 'UPDATE' THEN
        UPDATE goals 
        SET current_amount = current_amount - OLD.amount + NEW.amount,
            is_completed = (current_amount - OLD.amount + NEW.amount) >= target_amount
        WHERE id = NEW.goal_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_goal_contribution_amount ON goal_contributions;

CREATE TRIGGER trg_goal_contribution_amount
AFTER INSERT OR UPDATE OR DELETE ON goal_contributions
FOR EACH ROW
EXECUTE FUNCTION update_goal_current_amount();
