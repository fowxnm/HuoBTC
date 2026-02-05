#!/usr/bin/env bun
/**
 * 清空所有管理员后，仅添加指定两名管理员：
 * 超级管理员 fowcnm / Aa337376，谷歌动态验证码 JBSWY3DPEBLW64TMMF2G64TFMFYA
 * 普通管理员 baby123 / 1234567
 * 运行: bun run src/scripts/seed-admins.ts
 */

import { db } from '../db';
import { agent } from '../db/schema';
import { sql } from 'drizzle-orm';
import { hash } from 'bcryptjs';

const SUPER_ADMIN = {
  username: 'fowcnm',
  password: 'Aa337376',
  roleType: 0 as const,
  googleSecret: 'JBSWY3DPEBLW64TMMF2G64TFMFYA',
};

const NORMAL_ADMIN = {
  username: 'baby123',
  password: '1234567',
  roleType: 1 as const,
};

async function main() {
  const now = Math.floor(Date.now() / 1000);

  // 1. 删除所有管理员
  await db.delete(agent).where(sql`1 = 1`);
  console.log('[seed-admins] 已清空 agent 表内所有管理员');

  // 2. 仅添加这两名管理员
  for (const { username, password, roleType, googleSecret } of [SUPER_ADMIN, NORMAL_ADMIN]) {
    const hashedPassword = await hash(password, 10);
    await db.insert(agent).values({
      username,
      password: hashedPassword,
      roleType,
      level: roleType === 0 ? 0 : 1,
      isLock: 0,
      createTime: now,
      ...(googleSecret !== undefined && { googleSecret }),
    });
    console.log(`[seed-admins] 已创建: ${username} (${roleType === 0 ? '超级管理员' : '普通管理员'})`);
  }

  console.log('[seed-admins] 完成。超级管理员: fowcnm / Aa337376，谷歌动态验证码密钥: JBSWY3DPEBLW64TMMF2G64TFMFYA');
  console.log('[seed-admins] 普通管理员: baby123 / 1234567');
  process.exit(0);
}

main().catch((e) => {
  console.error('[seed-admins] 失败:', e);
  process.exit(1);
});
