-- Add risk_level to users (SMALLINT, default 0)
-- Safe to run multiple times (IF NOT EXISTS not supported for columns in older PG; use DO block)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'risk_level'
  ) THEN
    ALTER TABLE users ADD COLUMN risk_level SMALLINT DEFAULT 0;
    RAISE NOTICE 'Added users.risk_level';
  END IF;
END $$;
