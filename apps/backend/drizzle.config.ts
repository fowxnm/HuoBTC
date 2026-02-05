/**
 * Drizzle Kit config - uses DATABASE_URL from environment (Docker / .env)
 */
import { defineConfig } from 'drizzle-kit';

const connectionString = process.env.DATABASE_URL || 'postgres://localhost:5432/btc_exchange';

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: { connectionString },
});
