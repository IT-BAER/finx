-- Migration 006: Clean up incorrectly created sources from income transactions
-- 
-- Before the income transaction fix, when users added income transactions like
-- "Amazon refund -> Bank account", the frontend would incorrectly create "Amazon"
-- as a source entry. This migration identifies and fixes such entries by:
-- 1. Converting misplaced sources to targets
-- 2. Updating income transactions to use target_id instead of source_id
-- 3. Removing the incorrectly created sources

BEGIN;

-- Step 1: Find sources that are ONLY used in income transactions (never in expenses)
-- These were likely created incorrectly and should be targets instead
CREATE TEMP TABLE income_only_sources AS
SELECT DISTINCT s.id, s.user_id, s.name, s.is_sample
FROM sources s
WHERE s.id IN (
    SELECT DISTINCT t.source_id
    FROM transactions t
    WHERE t.source_id IS NOT NULL
      AND t.type = 'income'
) 
AND s.id NOT IN (
    -- Exclude sources that are also used in expense transactions
    SELECT DISTINCT t2.source_id
    FROM transactions t2
    WHERE t2.source_id IS NOT NULL
      AND t2.type = 'expense'
);

-- Step 2: For sources that have matching targets, update transactions to use the target
UPDATE transactions 
SET 
    target_id = (
        SELECT tgt.id 
        FROM targets tgt
        WHERE tgt.user_id = transactions.user_id 
          AND LOWER(TRIM(tgt.name)) = LOWER(TRIM((
            SELECT s.name FROM sources s WHERE s.id = transactions.source_id
          )))
        LIMIT 1
    ),
    source_id = NULL
WHERE transactions.type = 'income'
  AND transactions.source_id IN (SELECT id FROM income_only_sources)
  AND EXISTS (
      SELECT 1 FROM targets tgt
      WHERE tgt.user_id = transactions.user_id 
        AND LOWER(TRIM(tgt.name)) = LOWER(TRIM((
          SELECT s.name FROM sources s WHERE s.id = transactions.source_id
        )))
  );

-- Step 3: For remaining income-only sources without matching targets, create new targets
INSERT INTO targets (user_id, name, is_sample)
SELECT ios.user_id, ios.name, ios.is_sample
FROM income_only_sources ios
WHERE NOT EXISTS (
    SELECT 1 FROM targets t
    WHERE t.user_id = ios.user_id 
      AND LOWER(TRIM(t.name)) = LOWER(TRIM(ios.name))
);

-- Step 4: Update remaining income transactions to use the newly created targets
UPDATE transactions 
SET 
    target_id = (
        SELECT tgt.id 
        FROM targets tgt
        WHERE tgt.user_id = transactions.user_id 
          AND LOWER(TRIM(tgt.name)) = LOWER(TRIM((
            SELECT s.name FROM sources s WHERE s.id = transactions.source_id
          )))
        LIMIT 1
    ),
    source_id = NULL
WHERE transactions.type = 'income'
  AND transactions.source_id IN (SELECT id FROM income_only_sources)
  AND transactions.source_id IS NOT NULL;

-- Step 5: Delete the orphaned income-only sources
DELETE FROM sources 
WHERE id IN (SELECT id FROM income_only_sources);

-- Step 6: Log the cleanup results
DO $$
DECLARE
    cleanup_count INTEGER;
    affected_transactions INTEGER;
BEGIN
    -- Count how many sources were cleaned up
    SELECT COUNT(*) INTO cleanup_count FROM income_only_sources;
    
    -- Count affected transactions (approximation since temp table may be gone)
    SELECT COUNT(*) INTO affected_transactions
    FROM transactions t
    WHERE t.type = 'income' AND t.source_id IS NULL AND t.target_id IS NOT NULL;
    
    IF cleanup_count > 0 THEN
        RAISE NOTICE 'Income source cleanup completed: % incorrectly created sources removed, approximately % income transactions corrected.', cleanup_count, affected_transactions;
    ELSE
        RAISE NOTICE 'Income source cleanup: No incorrectly created sources found. Database is already clean.';
    END IF;
END $$;

COMMIT;
