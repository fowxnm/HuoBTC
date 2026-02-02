#!/usr/bin/env bun
/**
 * Production Setup Script (生产环境初始化脚本)
 * 
 * ⚠️ CRITICAL: This script SELF-DESTRUCTS after execution
 * 
 * Functions:
 * 1. Initialize production database schema
 * 2. Create SuperAdmin account
 * 3. Clear ALL test data (users, orders, logs)
 * 4. Verify critical configurations
 * 5. Self-delete this script file
 * 
 * Usage: bun run src/scripts/setup-production.ts
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { sql } from 'drizzle-orm';
import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import { createHash, randomBytes } from 'crypto';

// ANSI colors for terminal output
const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';

// Script path for self-destruction
const SCRIPT_PATH = import.meta.path || __filename;

interface ProductionConfig {
  databaseUrl: string;
  superAdminUsername: string;
  superAdminPassword: string;
  telegramBotToken?: string;
  telegramChatId?: string;
}

// ============================================================
// CONFIRMATION PROMPT
// ============================================================
async function confirmExecution(): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  console.log(`
${RED}${BOLD}╔══════════════════════════════════════════════════════════════════╗
║                    ⚠️  PRODUCTION SETUP ⚠️                         ║
╠══════════════════════════════════════════════════════════════════╣
║  This script will:                                               ║
║  1. Initialize/migrate the production database                   ║
║  2. DELETE ALL test users and transaction data                   ║
║  3. Create a new SuperAdmin account                              ║
║  4. SELF-DESTRUCT after completion                               ║
╠══════════════════════════════════════════════════════════════════╣
║  THIS ACTION IS IRREVERSIBLE!                                    ║
╚══════════════════════════════════════════════════════════════════╝${RESET}
  `);

  return new Promise((resolve) => {
    rl.question(`${YELLOW}Type "CONFIRM-PRODUCTION" to proceed: ${RESET}`, (answer) => {
      rl.close();
      resolve(answer === 'CONFIRM-PRODUCTION');
    });
  });
}

// ============================================================
// DATABASE INITIALIZATION
// ============================================================
async function initializeDatabase(db: ReturnType<typeof drizzle>) {
  console.log(`\n${CYAN}[1/5] Initializing database schema...${RESET}`);
  
  // Run migrations (assumes drizzle-kit migrations exist)
  try {
    // Create essential tables if not exist
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        phone VARCHAR(20),
        email VARCHAR(100),
        password VARCHAR(255) NOT NULL,
        pay_password VARCHAR(255),
        wallet_address VARCHAR(255),
        risk INTEGER DEFAULT 0,
        status INTEGER DEFAULT 1,
        is_test INTEGER DEFAULT 0,
        created_at INTEGER NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())
      );
      
      CREATE TABLE IF NOT EXISTS agent (
        id SERIAL PRIMARY KEY,
        username VARCHAR(100) NOT NULL,
        password VARCHAR(255) NOT NULL,
        role_type INTEGER DEFAULT 1,
        is_lock INTEGER DEFAULT 0,
        last_action_log TEXT,
        created_at INTEGER NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())
      );
      
      CREATE TABLE IF NOT EXISTS site_config (
        id SERIAL PRIMARY KEY,
        key VARCHAR(100) UNIQUE NOT NULL,
        value TEXT,
        updated_at INTEGER
      );
      
      CREATE TABLE IF NOT EXISTS account_log (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        value VARCHAR(50),
        created_time INTEGER,
        info TEXT,
        type INTEGER,
        currency INTEGER
      );
      
      CREATE TABLE IF NOT EXISTS micro_order (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        match_id INTEGER,
        currency_id INTEGER,
        type INTEGER,
        seconds INTEGER,
        number VARCHAR(50),
        open_price VARCHAR(50),
        end_price VARCHAR(50),
        profit_ratio VARCHAR(20),
        loss_ratio VARCHAR(20),
        fee VARCHAR(50),
        status INTEGER DEFAULT 1,
        profit_result INTEGER DEFAULT 0,
        fact_profit VARCHAR(50),
        pre_result INTEGER DEFAULT 0,
        handled_at INTEGER,
        complete_at INTEGER,
        created_at INTEGER
      );
    `);
    
    console.log(`${GREEN}  ✓ Database schema initialized${RESET}`);
  } catch (error) {
    console.error(`${RED}  ✗ Failed to initialize schema: ${error}${RESET}`);
    throw error;
  }
}

// ============================================================
// CLEAR TEST DATA
// ============================================================
async function clearTestData(db: ReturnType<typeof drizzle>) {
  console.log(`\n${CYAN}[2/5] Clearing test data...${RESET}`);
  
  try {
    // Delete test users (is_test = 1)
    const testUsersResult = await db.execute(sql`
      DELETE FROM users WHERE is_test = 1
    `);
    console.log(`${GREEN}  ✓ Deleted test users${RESET}`);
    
    // Delete all account logs for test users
    await db.execute(sql`
      DELETE FROM account_log WHERE user_id NOT IN (SELECT id FROM users)
    `);
    console.log(`${GREEN}  ✓ Deleted orphaned account logs${RESET}`);
    
    // Delete all micro orders for non-existent users
    await db.execute(sql`
      DELETE FROM micro_order WHERE user_id NOT IN (SELECT id FROM users)
    `);
    console.log(`${GREEN}  ✓ Deleted orphaned micro orders${RESET}`);
    
    // Clear development config entries
    await db.execute(sql`
      DELETE FROM site_config WHERE key LIKE 'dev_%' OR key LIKE 'test_%'
    `);
    console.log(`${GREEN}  ✓ Cleared development configurations${RESET}`);
    
    // Reset sequences for clean IDs in production
    await db.execute(sql`
      SELECT setval('users_id_seq', COALESCE((SELECT MAX(id) FROM users), 0) + 1, false);
      SELECT setval('agent_id_seq', COALESCE((SELECT MAX(id) FROM agent), 0) + 1, false);
      SELECT setval('account_log_id_seq', COALESCE((SELECT MAX(id) FROM account_log), 0) + 1, false);
      SELECT setval('micro_order_id_seq', COALESCE((SELECT MAX(id) FROM micro_order), 0) + 1, false);
    `);
    console.log(`${GREEN}  ✓ Reset ID sequences${RESET}`);
    
  } catch (error) {
    console.error(`${RED}  ✗ Failed to clear test data: ${error}${RESET}`);
    throw error;
  }
}

// ============================================================
// CREATE SUPERADMIN
// ============================================================
async function createSuperAdmin(
  db: ReturnType<typeof drizzle>, 
  username: string, 
  password: string
) {
  console.log(`\n${CYAN}[3/5] Creating SuperAdmin account...${RESET}`);
  
  try {
    // Hash password with bcrypt-style salt
    const salt = randomBytes(16).toString('hex');
    const hash = createHash('sha256').update(password + salt).digest('hex');
    const hashedPassword = `${salt}:${hash}`;
    
    // Check if SuperAdmin already exists
    const existing = await db.execute(sql`
      SELECT id FROM agent WHERE role_type = 0 LIMIT 1
    `);
    
    if (existing.length > 0) {
      // Update existing SuperAdmin
      await db.execute(sql`
        UPDATE agent 
        SET username = ${username}, password = ${hashedPassword}, is_lock = 0
        WHERE role_type = 0
      `);
      console.log(`${GREEN}  ✓ Updated existing SuperAdmin: ${username}${RESET}`);
    } else {
      // Create new SuperAdmin
      await db.execute(sql`
        INSERT INTO agent (username, password, role_type, is_lock, created_at)
        VALUES (${username}, ${hashedPassword}, 0, 0, ${Math.floor(Date.now() / 1000)})
      `);
      console.log(`${GREEN}  ✓ Created SuperAdmin: ${username}${RESET}`);
    }
    
  } catch (error) {
    console.error(`${RED}  ✗ Failed to create SuperAdmin: ${error}${RESET}`);
    throw error;
  }
}

// ============================================================
// VERIFY CONFIGURATIONS
// ============================================================
async function verifyConfigurations(db: ReturnType<typeof drizzle>) {
  console.log(`\n${CYAN}[4/5] Verifying critical configurations...${RESET}`);
  
  const warnings: string[] = [];
  
  // Check for required environment variables
  const requiredEnvVars = [
    'DATABASE_URL',
    'JWT_SECRET',
  ];
  
  const recommendedEnvVars = [
    'TELEGRAM_BOT_TOKEN',
    'TELEGRAM_CHAT_ID',
    'ETH_RPC_ENDPOINTS',
    'TRON_RPC_ENDPOINTS',
  ];
  
  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      console.error(`${RED}  ✗ REQUIRED: ${envVar} is not set!${RESET}`);
      throw new Error(`Missing required environment variable: ${envVar}`);
    }
    console.log(`${GREEN}  ✓ ${envVar} is configured${RESET}`);
  }
  
  for (const envVar of recommendedEnvVars) {
    if (!process.env[envVar]) {
      warnings.push(`${envVar} is not set (recommended for production)`);
      console.log(`${YELLOW}  ⚠ ${envVar} is not set${RESET}`);
    } else {
      console.log(`${GREEN}  ✓ ${envVar} is configured${RESET}`);
    }
  }
  
  // Check JWT secret strength
  const jwtSecret = process.env.JWT_SECRET || '';
  if (jwtSecret.length < 32 || jwtSecret.includes('change-this')) {
    console.log(`${YELLOW}  ⚠ JWT_SECRET appears to be weak or default${RESET}`);
    warnings.push('JWT_SECRET should be at least 32 characters and unique');
  }
  
  if (warnings.length > 0) {
    console.log(`\n${YELLOW}Warnings:${RESET}`);
    warnings.forEach(w => console.log(`  - ${w}`));
  }
}

// ============================================================
// SELF-DESTRUCT
// ============================================================
async function selfDestruct() {
  console.log(`\n${CYAN}[5/5] Self-destructing script...${RESET}`);
  
  try {
    // Get the absolute path of this script
    const scriptPath = path.resolve(SCRIPT_PATH);
    
    // Verify the file exists before attempting deletion
    if (fs.existsSync(scriptPath)) {
      // Overwrite file content with zeros first (secure delete)
      const fileSize = fs.statSync(scriptPath).size;
      const zeros = Buffer.alloc(fileSize, 0);
      fs.writeFileSync(scriptPath, zeros);
      
      // Delete the file
      fs.unlinkSync(scriptPath);
      console.log(`${GREEN}  ✓ Script file securely deleted: ${scriptPath}${RESET}`);
    } else {
      console.log(`${YELLOW}  ⚠ Script file not found at expected path${RESET}`);
    }
    
    // Also try to delete compiled JS if exists
    const jsPath = scriptPath.replace('.ts', '.js');
    if (fs.existsSync(jsPath)) {
      fs.unlinkSync(jsPath);
      console.log(`${GREEN}  ✓ Compiled JS also deleted${RESET}`);
    }
    
  } catch (error) {
    console.error(`${RED}  ✗ Failed to self-destruct: ${error}${RESET}`);
    console.log(`${YELLOW}  Please manually delete: ${SCRIPT_PATH}${RESET}`);
  }
}

// ============================================================
// GENERATE MIGRATION BACKUP
// ============================================================
async function generateMigrationBackup(db: ReturnType<typeof drizzle>) {
  console.log(`\n${CYAN}Generating migration backup info...${RESET}`);
  
  // Get table counts for verification
  const counts = await db.execute(sql`
    SELECT 
      (SELECT COUNT(*) FROM users) as users_count,
      (SELECT COUNT(*) FROM agent) as agents_count,
      (SELECT COUNT(*) FROM site_config) as config_count
  `);
  
  const timestamp = new Date().toISOString();
  const backupInfo = {
    timestamp,
    counts: counts[0],
    environment: process.env.NODE_ENV || 'production',
  };
  
  console.log(`${GREEN}  Production state verified:${RESET}`);
  console.log(`    - Users: ${(counts[0] as any)?.users_count || 0}`);
  console.log(`    - Agents: ${(counts[0] as any)?.agents_count || 0}`);
  console.log(`    - Configs: ${(counts[0] as any)?.config_count || 0}`);
  
  return backupInfo;
}

// ============================================================
// MAIN EXECUTION
// ============================================================
async function main() {
  console.log(`
${BOLD}${CYAN}
╔══════════════════════════════════════════════════════════════════╗
║             BTC Exchange - Production Setup                      ║
║                     Version 2.0.0                                ║
╚══════════════════════════════════════════════════════════════════╝
${RESET}`);

  // Step 0: Confirm execution
  const confirmed = await confirmExecution();
  if (!confirmed) {
    console.log(`\n${YELLOW}Setup cancelled by user.${RESET}`);
    process.exit(0);
  }

  // Get database connection
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error(`${RED}ERROR: DATABASE_URL environment variable is required${RESET}`);
    process.exit(1);
  }

  // Prompt for SuperAdmin credentials
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const superAdminUsername = await new Promise<string>((resolve) => {
    rl.question(`${CYAN}Enter SuperAdmin username: ${RESET}`, resolve);
  });

  const superAdminPassword = await new Promise<string>((resolve) => {
    rl.question(`${CYAN}Enter SuperAdmin password: ${RESET}`, resolve);
  });

  rl.close();

  if (!superAdminUsername || !superAdminPassword) {
    console.error(`${RED}ERROR: SuperAdmin credentials are required${RESET}`);
    process.exit(1);
  }

  if (superAdminPassword.length < 12) {
    console.error(`${RED}ERROR: SuperAdmin password must be at least 12 characters${RESET}`);
    process.exit(1);
  }

  // Connect to database
  console.log(`\n${CYAN}Connecting to database...${RESET}`);
  const client = postgres(databaseUrl);
  const db = drizzle(client);
  console.log(`${GREEN}  ✓ Database connected${RESET}`);

  try {
    // Execute setup steps
    await initializeDatabase(db);
    await clearTestData(db);
    await createSuperAdmin(db, superAdminUsername, superAdminPassword);
    await verifyConfigurations(db);
    await generateMigrationBackup(db);
    
    // Close database connection
    await client.end();
    
    // Self-destruct
    await selfDestruct();
    
    console.log(`
${GREEN}${BOLD}
╔══════════════════════════════════════════════════════════════════╗
║                  PRODUCTION SETUP COMPLETE                       ║
╠══════════════════════════════════════════════════════════════════╣
║  ✓ Database initialized                                         ║
║  ✓ Test data cleared                                             ║
║  ✓ SuperAdmin created                                            ║
║  ✓ Configurations verified                                       ║
║  ✓ Setup script self-destructed                                  ║
╠══════════════════════════════════════════════════════════════════╣
║  You can now start the production server:                        ║
║  $ bun run start                                                 ║
╚══════════════════════════════════════════════════════════════════╝
${RESET}`);

  } catch (error) {
    console.error(`\n${RED}${BOLD}SETUP FAILED:${RESET} ${error}`);
    await client.end();
    process.exit(1);
  }
}

// Run if executed directly
main().catch(console.error);
