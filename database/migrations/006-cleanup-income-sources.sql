-- Migration 006: Clean up incorrectly created sources from income transactions
-- 
-- Before the income transaction fix, when users added income transactions like
-- "Amazon refund -> Bank account", the frontend would incorrectly create "Amazon"
-- as a source entry. This migration identifies and fixes such entries by:
-- 1. Creating proper target entries for misplaced sources
-- 2. Correcting the transaction field references
-- 3. Removing the incorrectly created sources

BEGIN;

-- Step 1: Create a temporary table to track sources that should be moved to targets
CREATE TEMP TABLE sources_to_migrate AS
SELECT DISTINCT s.id, s.user_id, s.name, s.is_sample
FROM sources s
WHERE s.id IN (
    -- Find sources that are ONLY used in income transactions (never in expense transactions)
    SELECT DISTINCT t.source_id
    FROM transactions t
    WHERE t.source_id IS NOT NULL
      AND t.type = 'income'
      AND t.source_id NOT IN (
          -- Exclude sources that are also used in expense transactions
          SELECT DISTINCT t2.source_id
          FROM transactions t2
          WHERE t2.source_id IS NOT NULL
            AND t2.type = 'expense'
      )
);

-- Step 2: Create corresponding target entries for these misplaced sources
INSERT INTO targets (user_id, name, is_sample)
SELECT stm.user_id, stm.name, stm.is_sample
FROM sources_to_migrate stm
WHERE NOT EXISTS (
    SELECT 1 FROM targets t
    WHERE t.user_id = stm.user_id AND t.name = stm.name
);

-- Step 3: Create a mapping between old source IDs and new target IDs
CREATE TEMP TABLE id_mapping AS
SELECT 
    stm.id as old_source_id,
    t.id as new_target_id,
    stm.user_id
FROM sources_to_migrate stm
JOIN targets t ON t.user_id = stm.user_id AND t.name = stm.name;

-- Step 4: Fix income transactions by swapping the field references
-- Income should flow FROM source TO target (e.g., "Amazon" -> "Bank Account")
-- But our old incorrect data had it backwards
-- We need to ensure the target_id exists as a source before swapping

-- First, create sources for any targets that don't exist as sources yet
INSERT INTO sources (user_id, name, is_sample)
SELECT DISTINCT tgt.user_id, tgt.name, tgt.is_sample
FROM transactions t
JOIN id_mapping im ON t.source_id = im.old_source_id
JOIN targets tgt ON t.target_id = tgt.id
WHERE t.type = 'income'
  AND NOT EXISTS (
    SELECT 1 FROM sources s 
    WHERE s.user_id = tgt.user_id AND s.name = tgt.name
  );

-- Now update transactions, ensuring both source_id and target_id are valid
UPDATE transactions 
SET 
    source_id = (
        SELECT s.id 
        FROM targets tgt 
        JOIN sources s ON s.user_id = tgt.user_id AND s.name = tgt.name
        WHERE tgt.id = transactions.target_id
    ),
    target_id = im.new_target_id
FROM id_mapping im
WHERE transactions.type = 'income'
  AND transactions.source_id = im.old_source_id
  AND transactions.target_id IS NOT NULL;

-- Step 5: Remove the incorrectly created sources (now safe to delete)
DELETE FROM sources 
WHERE id IN (SELECT old_source_id FROM id_mapping);

-- Step 6: Log the cleanup results
DO $$
DECLARE
    cleanup_count INTEGER;
BEGIN
    -- Count how many sources were cleaned up
    SELECT COUNT(*) INTO cleanup_count FROM id_mapping;
    
    IF cleanup_count > 0 THEN
        RAISE NOTICE 'Income source cleanup completed: % incorrectly created sources moved to targets and income transactions corrected.', cleanup_count;
    ELSE
        RAISE NOTICE 'Income source cleanup: No incorrectly created sources found. Database is already clean.';
    END IF;
END $$;

COMMIT;
