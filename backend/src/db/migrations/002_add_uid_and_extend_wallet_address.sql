-- Extend wallet_address to 50 characters and add uid column
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'wallet_address') THEN
    ALTER TABLE users ALTER COLUMN wallet_address TYPE varchar(50);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'uid') THEN
    ALTER TABLE users ADD COLUMN uid varchar(8) UNIQUE;
  END IF;
END $$;
