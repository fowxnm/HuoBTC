import { Elysia, t } from 'elysia';
import { db, users, usersWallet } from '../db';
import { eq } from 'drizzle-orm';
import { verifyMessage } from 'ethers';
import { randomBytes } from 'crypto';
import TronWeb from 'tronweb';

// Initialize TronWeb (Validation only, no private key needed for verify)
const tronWeb = new TronWeb({
  fullHost: 'https://api.trongrid.io',
  headers: { 'TRON-PRO-API-KEY': process.env.TRON_API_KEY || '' }
});

const NONCE_TTL_MS = 5 * 60 * 1000;
const nonceStore = new Map<string, number>();

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
  .get('/nonce', ({ query }) => {
    pruneExpiredNonces();
    const address = (query.address || '').trim(); // Remove toLowerCase for Tron case sensitivity check
    if (!address || address.length < 10) {
      return { type: 'error', message: 'Invalid address', nonce: '' };
    }
    const nonce = randomBytes(32).toString('hex');
    const key = `${address.toLowerCase()}:${nonce}`; // Store lowercase for consistency
    nonceStore.set(key, Date.now() + NONCE_TTL_MS);
    return { type: 'ok', nonce };
  }, {
    query: t.Object({
      address: t.String()
    })
  })
  .post('/verify', async ({ body, jwt }) => {
    const { address, signature, nonce, refCode, type } = body as any;
    const addr = address.trim();

    // Validate Signature
    let recoveredAddress: string | boolean = '';

    try {
      if (addr.startsWith('T')) {
        // TRON Signature (Message)
        // If the signature is a transaction hex (Offline Broadcast), verification handles that differently 
        // But for login 'nonce', we assume signMessage. 
        // User asked for "Offline Sign" which usually means transaction.
        // If signature is very long, it might be a TX.
        // For simplicity in this step, we support standard message sign first.
        // To support "Backend Broadcast", we would need a separate flow usually.
        // But here we just verify ownership.

        // If signature is a transaction object/hex?
        // Let's assume standard personal sign for login unless specified.
        const verify = await tronWeb.trx.verifyMessage(nonce, signature, addr);
        if (verify) recoveredAddress = addr;
      } else {
        // ETH Signature
        recoveredAddress = verifyMessage(nonce, signature);
      }
    } catch (e) {
      console.error('Verify error:', e);
      return { type: 'error', message: 'Invalid signature format' };
    }

    if (typeof recoveredAddress === 'string' && recoveredAddress.toLowerCase() !== addr.toLowerCase()) {
      return { type: 'error', message: 'Signature verification failed' };
    }
    if (!recoveredAddress) {
      return { type: 'error', message: 'Signature verification failed' };
    }

    if (!consumeNonce(addr, nonce)) {
      return { type: 'error', message: 'Nonce expired or already used' };
    }

    let [user] = await db.select().from(users)
      .where(eq(users.walletAddress, addr))
      .limit(1);

    if (!user) {
      const accountNumber = generateAccountNumber(addr);
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
      refCode: t.Optional(t.String()),
      type: t.Optional(t.String())
    })
  });
