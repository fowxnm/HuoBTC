/**
 * Web3 签名登录：/api/auth/nonce 获取随机数，/api/auth/verify 验证签名并下发 JWT
 * 企业级：nonce 一次性使用 + TTL 防重放
 */
import { Elysia, t } from 'elysia';
import { db, users, usersWallet } from '../db';
import { eq } from 'drizzle-orm';
import { verifyMessage } from 'ethers';
import { randomBytes } from 'crypto';

const NONCE_TTL_MS = 5 * 60 * 1000; // 5 分钟
const nonceStore = new Map<string, number>(); // address -> expiryAt

function pruneExpiredNonces(): void {
  const now = Date.now();
  for (const [key, expiry] of nonceStore.entries()) {
    if (expiry <= now) nonceStore.delete(key);
  }
}

function consumeNonce(address: string, nonce: string): boolean {
  const key = `${address.toLowerCase()}:${nonce}`;
  const expiry = nonceStore.get(key);
  if (expiry == null) return false;
  if (expiry <= Date.now()) {
    nonceStore.delete(key);
    return false;
  }
  nonceStore.delete(key);
  return true;
}

function generateExtensionCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function generateAccountNumber(address: string): string {
  const suffix = address.slice(-6).toUpperCase();
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `${suffix}${random}`;
}

async function initializeWallets(userId: number) {
  const currencies = [1, 2, 3]; // BTC, ETH, USDT
  const now = Math.floor(Date.now() / 1000);
  for (const currencyId of currencies) {
    await db.insert(usersWallet).values({
      userId,
      currency: currencyId,
      createTime: now
    });
  }
}

export const authWeb3Routes = new Elysia({ prefix: '/auth' })
  // 获取签名用随机数（前端用 personal_sign 签此 nonce）；nonce 一次性 + TTL
  .get('/nonce', ({ query }) => {
    pruneExpiredNonces();
    const address = (query.address || '').trim().toLowerCase();
    if (!address || !address.startsWith('0x') || address.length < 42) {
      return { type: 'error', message: 'Invalid address', nonce: '' };
    }
    const nonce = randomBytes(32).toString('hex');
    const key = `${address}:${nonce}`;
    nonceStore.set(key, Date.now() + NONCE_TTL_MS);
    return { type: 'ok', nonce };
  }, {
    query: t.Object({
      address: t.String()
    })
  })
  // 验证签名并登录/注册，返回 JWT
  .post('/verify', async ({ body, jwt }) => {
    const { address, signature, nonce, refCode } = body;
    const addr = address.trim().toLowerCase();
    if (!addr.startsWith('0x')) {
      return { type: 'error', message: 'Invalid address' };
    }

    const message = nonce; // 前端 personal_sign 签的就是 nonce 字符串
    let recoveredAddress: string;
    try {
      recoveredAddress = verifyMessage(message, signature);
    } catch {
      return { type: 'error', message: 'Invalid signature' };
    }
    if (recoveredAddress.toLowerCase() !== addr) {
      return { type: 'error', message: 'Signature verification failed' };
    }

    if (!consumeNonce(addr, nonce)) {
      return { type: 'error', message: 'Nonce expired or already used' };
    }

    let [user] = await db.select().from(users)
      .where(eq(users.walletAddress, addr))
      .limit(1);

    if (!user) {
      const accountNumber = generateAccountNumber(address);
      let parentId = 1;
      if (refCode) {
        const [inviter] = await db.select().from(users)
          .where(eq(users.extensionCode, refCode))
          .limit(1);
        if (inviter) parentId = inviter.id;
      }
      const now = Math.floor(Date.now() / 1000);
      [user] = await db.insert(users).values({
        accountNumber,
        walletAddress: addr,
        parentId,
        extensionCode: generateExtensionCode(),
        type: 0,
        createTime: now
      }).returning();
      await initializeWallets(user.id);
    }

    const token = await jwt.sign({
      uid: user.id,
      address: addr,
      type: 'wallet'
    });

    return {
      type: 'ok',
      token,
      data: {
        user_id: user.id,
        account: user.accountNumber,
        address: addr
      }
    };
  }, {
    body: t.Object({
      address: t.String(),
      signature: t.String(),
      nonce: t.String(),
      refCode: t.Optional(t.String())
    })
  });
