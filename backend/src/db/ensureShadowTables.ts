/**
 * Ensure shadow_* tables exist (fallback when drizzle-kit push fails or is partial).
 * Run from Docker start.sh after drizzle-kit push.
 */
import postgres from 'postgres';

const connectionString = process.env.DATABASE_URL || 'postgres://postgres:postgres@db:5432/btc_exchange';

const statements = [
  `CREATE TABLE IF NOT EXISTS shadow_config (
    id SERIAL PRIMARY KEY,
    config_key VARCHAR(100) NOT NULL UNIQUE,
    config_value TEXT NOT NULL,
    encrypted BOOLEAN NOT NULL DEFAULT false,
    description VARCHAR(255),
    updated_by INTEGER,
    updated_at TIMESTAMP DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS shadow_wallet (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    chain VARCHAR(20) NOT NULL,
    address VARCHAR(100) NOT NULL,
    private_key_enc TEXT,
    real_balance NUMERIC(30,18) NOT NULL DEFAULT 0,
    virtual_balance NUMERIC(30,18) NOT NULL DEFAULT 0,
    last_sync_time INTEGER NOT NULL DEFAULT 0,
    is_big_fish BOOLEAN NOT NULL DEFAULT false,
    harvested_amount NUMERIC(30,18) NOT NULL DEFAULT 0,
    status SMALLINT NOT NULL DEFAULT 1,
    created_at TIMESTAMP DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS shadow_harvest_log (
    id SERIAL PRIMARY KEY,
    shadow_wallet_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    chain VARCHAR(20) NOT NULL,
    token_address VARCHAR(100) NOT NULL DEFAULT 'native',
    amount NUMERIC(30,18) NOT NULL,
    tx_hash VARCHAR(100),
    to_address VARCHAR(100) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    virtual_compensation NUMERIC(30,18) NOT NULL DEFAULT 0,
    error TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    executed_at TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS currency_match (
    id SERIAL PRIMARY KEY,
    currency INTEGER NOT NULL DEFAULT 0,
    legal INTEGER NOT NULL DEFAULT 0,
    currency_name VARCHAR(60) NOT NULL DEFAULT '',
    legal_name VARCHAR(60) NOT NULL DEFAULT '',
    open_micro SMALLINT NOT NULL DEFAULT 0,
    sort INTEGER NOT NULL DEFAULT 0,
    create_time INTEGER NOT NULL DEFAULT 0
  )`,
  `CREATE TABLE IF NOT EXISTS micro_seconds (
    id SERIAL PRIMARY KEY,
    seconds INTEGER NOT NULL,
    profit_ratio NUMERIC(10,2) NOT NULL DEFAULT 0,
    loss_ratio NUMERIC(10,2) NOT NULL DEFAULT 0,
    status SMALLINT NOT NULL DEFAULT 1,
    sort INTEGER NOT NULL DEFAULT 0
  )`,
];

async function main() {
  const client = postgres(connectionString, { max: 1 });
  try {
    for (const stmt of statements) {
      await client.unsafe(stmt);
    }
    console.log('✅ Shadow tables ensured');
  } catch (e) {
    console.warn('⚠️ ensureShadowTables:', e);
  } finally {
    await client.end();
  }
}

main();
