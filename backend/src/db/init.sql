-- ============================================================
-- BTC Exchange - Database Initialization Script
-- Runs when PostgreSQL container starts.
-- Tables are created by Drizzle (bunx drizzle-kit push) on backend startup.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

SET timezone = 'UTC';

GRANT ALL PRIVILEGES ON DATABASE btc_exchange TO postgres;

DO $$
BEGIN
    RAISE NOTICE 'BTC Exchange database initialized at %', NOW();
END $$;
