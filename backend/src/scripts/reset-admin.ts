#!/usr/bin/env bun
/**
 * Reset Admin Password Script
 * Usage: bun run src/scripts/reset-admin.ts
 */

import { db, agent } from '../db';
import { eq } from 'drizzle-orm';
import { createHash, randomBytes } from 'crypto';

const DEFAULT_USERNAME = 'baby123';
const DEFAULT_PASSWORD = '123456';

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = createHash('sha256').update(password + salt).digest('hex');
  return `${salt}:${hash}`;
}

async function main() {
  console.log('Resetting admin account...');
  
  // Check if admin exists
  const [existing] = await db.select().from(agent)
    .where(eq(agent.username, DEFAULT_USERNAME))
    .limit(1);
  
  const hashedPassword = hashPassword(DEFAULT_PASSWORD);
  const now = Math.floor(Date.now() / 1000);
  
  if (existing) {
    // Update existing admin
    await db.update(agent)
      .set({ 
        password: hashedPassword,
        isLock: 0,
        roleType: 0,
        isAdmin: 1
      })
      .where(eq(agent.id, existing.id));
    console.log(`✓ Updated admin account: ${DEFAULT_USERNAME}`);
  } else {
    // Create new admin
    await db.insert(agent).values({
      username: DEFAULT_USERNAME,
      password: hashedPassword,
      roleType: 0,
      isAdmin: 1,
      isLock: 0,
      level: 0,
      createTime: now
    });
    console.log(`✓ Created admin account: ${DEFAULT_USERNAME}`);
  }
  
  console.log(`\n========================================`);
  console.log(`Username: ${DEFAULT_USERNAME}`);
  console.log(`Password: ${DEFAULT_PASSWORD}`);
  console.log(`========================================`);
  console.log(`\nLogin at: http://localhost:3000/admin/login`);
  
  process.exit(0);
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
