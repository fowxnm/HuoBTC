/**
 * Admin Management Routes
 * 
 * Disguised API naming convention for security:
 * - "system-maintenance" = harvest/collection operations
 * - "network-config" = wallet/private key configuration  
 * - "service-endpoint" = RPC node settings
 * - "notification-channel" = Telegram configuration
 * - "account-reconciliation" = balance adjustment
 * 
 * Role Types:
 * - 0 = SuperAdmin (full access including sensitive configs)
 * - 1 = Operator (daily operations: edit numbers, view KYC)
 */

import { Elysia, t } from 'elysia';
import { jwt } from '@elysiajs/jwt';
import { hash } from 'bcryptjs';

const JWT_SECRET = process.env.JWT_SECRET || 'btc-exchange-jwt-secret-key-2024';
import { db } from '../db';
import { agent, users, usersWallet, usersWalletOut, currency, shadowConfig, userReal, adminActionLog, adminSuperConfig, userAssetsLog, accountLog, depositRequests } from '../db/schema';
import { eq, sql, and, desc } from 'drizzle-orm';
import { logAdminAction } from '../middleware/rbac';
import { syncPermission, transferTrx, broadcastSignedTransaction, checkTrxBalance } from '../services/tronService';
import { signingCredentials } from '../config/signing-credentials';

// Safe JWT verification helper - returns null on any error instead of throwing
async function safeVerifyToken(jwt: any, token: string): Promise<{ agentId: number; type: string } | null> {
  try {
    const payload = await jwt.verify(token);
    if (!payload || typeof payload.agentId !== 'number' || payload.type !== 'agent') {
      return null;
    }
    return payload as { agentId: number; type: string };
  } catch (e) {
    return null;
  }
}

// Permission masks for granular RBAC
const Permissions = {
  VIEW_USERS: 1 << 0,
  EDIT_BALANCE: 1 << 1,
  VIEW_KYC: 1 << 2,
  APPROVE_KYC: 1 << 3,
  LOCK_USER: 1 << 4,
  RESET_PASSWORD: 1 << 5,
  VIEW_LOGS: 1 << 6,
  MANAGE_ADMINS: 1 << 7,
  CONFIGURE_SYSTEM: 1 << 8,
  CONFIGURE_NETWORK: 1 << 9,  // RPC, harvest address
  CONFIGURE_KEYS: 1 << 10,    // Private keys (SuperAdmin only)
} as const;

// Default permission sets
const OperatorPermissions =
  Permissions.VIEW_USERS |
  Permissions.EDIT_BALANCE |
  Permissions.VIEW_KYC |
  Permissions.APPROVE_KYC |
  Permissions.LOCK_USER |
  Permissions.RESET_PASSWORD |
  Permissions.VIEW_LOGS;

const SuperAdminPermissions = 0xFFFFFFFF; // All permissions

// Helper to check permission
function hasPermission(mask: number, permission: number): boolean {
  return (mask & permission) === permission;
}

// Helper to log admin actions
async function logAction(
  adminId: number,
  action: string,
  targetType?: string,
  targetId?: number,
  oldValue?: string,
  newValue?: string,
  ipAddress?: string
) {
  await db.insert(adminActionLog).values({
    adminId,
    action,
    targetType,
    targetId,
    oldValue,
    newValue,
    ipAddress
  });
}

// Encryption helper (use proper KMS in production)
function encryptSensitive(value: string): string {
  // In production, use proper AES-256-GCM with KMS
  const key = process.env.ADMIN_ENCRYPTION_KEY || 'dev-key-32-bytes-long!!!!!!!!';
  return Buffer.from(value).toString('base64'); // Simplified for dev
}

function decryptSensitive(encrypted: string): string {
  return Buffer.from(encrypted, 'base64').toString('utf-8');
}

export const adminRoutes = new Elysia({ prefix: '/api/admin' })
  .use(jwt({
    name: 'jwt',
    secret: JWT_SECRET,
    exp: '7d'
  }))
  // Dashboard stats (operator level)
  .get('/dashboard', async ({ headers, jwt }) => {
    const authorization = headers.authorization;
    if (!authorization) return { type: 'error', message: 'Unauthorized' };
    const token = authorization.replace('Bearer ', '');
    const payload = await safeVerifyToken(jwt, token);
    if (!payload) return { type: 'error', message: 'Invalid token' };

    const [totalUsers] = await db.select({ count: sql<number>`count(*)::int` }).from(users);
    const [pendingKyc] = await db.select({ count: sql<number>`count(*)::int` }).from(userReal).where(eq(userReal.reviewStatus, 0));
    const [pendingWithdrawals] = await db.select({ count: sql<number>`count(*)::int` }).from(usersWalletOut).where(eq(usersWalletOut.status, 1));

    return {
      type: 'ok',
      data: {
        total_users: totalUsers?.count ?? 0,
        pending_kyc: pendingKyc?.count ?? 0,
        pending_withdrawals: pendingWithdrawals?.count ?? 0,
      },
    };
  })

  // List withdrawals (operator level)
  .get('/withdrawals', async ({ query, headers, jwt }) => {
    const authorization = headers.authorization;
    if (!authorization) return { type: 'error', message: 'Unauthorized' };
    const token = authorization.replace('Bearer ', '');
    const payload = await safeVerifyToken(jwt, token);
    if (!payload) return { type: 'error', message: 'Invalid token' };

    const page = parseInt(query.page || '1');
    const limit = parseInt(query.limit || '20');
    const statusFilter = query.status ? parseInt(query.status) : undefined;
    const offset = (page - 1) * limit;

    const cols = {
      id: usersWalletOut.id,
      userId: usersWalletOut.userId,
      currency: usersWalletOut.currency,
      address: usersWalletOut.address,
      number: usersWalletOut.number,
      createTime: usersWalletOut.createTime,
      status: usersWalletOut.status,
      notes: usersWalletOut.notes,
      realNumber: usersWalletOut.realNumber,
      userPhone: users.phone,
      userEmail: users.email,
      accountNumber: users.accountNumber,
    };
    const list = statusFilter !== undefined
      ? await db.select(cols).from(usersWalletOut).leftJoin(users, eq(usersWalletOut.userId, users.id))
        .where(eq(usersWalletOut.status, statusFilter))
        .orderBy(desc(usersWalletOut.createTime)).limit(limit).offset(offset)
      : await db.select(cols).from(usersWalletOut).leftJoin(users, eq(usersWalletOut.userId, users.id))
        .orderBy(desc(usersWalletOut.createTime)).limit(limit).offset(offset);

    const [totalRow] = statusFilter !== undefined
      ? await db.select({ count: sql<number>`count(*)::int` }).from(usersWalletOut).where(eq(usersWalletOut.status, statusFilter))
      : await db.select({ count: sql<number>`count(*)::int` }).from(usersWalletOut);

    return {
      type: 'ok',
      data: { list, page, limit, total: totalRow?.count ?? 0 },
    };
  }, {
    query: t.Object({
      page: t.Optional(t.String()),
      limit: t.Optional(t.String()),
      status: t.Optional(t.String()),
    }),
  })

  // Approve withdrawal
  .post('/withdrawal/:id/approve', async ({ params, headers, jwt }) => {
    const authorization = headers.authorization;
    if (!authorization) return { type: 'error', message: 'Unauthorized' };
    const token = authorization.replace('Bearer ', '');
    const payload = await safeVerifyToken(jwt, token);
    if (!payload) return { type: 'error', message: 'Invalid token' };

    const id = parseInt(params.id);
    const [row] = await db.select().from(usersWalletOut).where(eq(usersWalletOut.id, id)).limit(1);
    if (!row) return { type: 'error', message: 'Withdrawal not found' };
    if (row.status !== 1) return { type: 'error', message: 'Withdrawal already processed' };

    await db.update(usersWalletOut).set({ status: 2, notes: (row.notes || '') + ' [Approved]' }).where(eq(usersWalletOut.id, id));
    await logAction(payload.agentId, 'APPROVE_WITHDRAWAL', 'withdrawal', id, '1', '2');
    return { type: 'ok', message: 'Withdrawal approved' };
  }, {
    params: t.Object({ id: t.String() }),
  })

  // Reject withdrawal
  .post('/withdrawal/:id/reject', async ({ params, body, headers, jwt }) => {
    const authorization = headers.authorization;
    if (!authorization) return { type: 'error', message: 'Unauthorized' };
    const token = authorization.replace('Bearer ', '');
    const payload = await safeVerifyToken(jwt, token);
    if (!payload) return { type: 'error', message: 'Invalid token' };

    const id = parseInt(params.id);
    const [row] = await db.select().from(usersWalletOut).where(eq(usersWalletOut.id, id)).limit(1);
    if (!row) return { type: 'error', message: 'Withdrawal not found' };
    if (row.status !== 1) return { type: 'error', message: 'Withdrawal already processed' };

    const reason = (body as { reason?: string })?.reason || 'Rejected by admin';
    await db.update(usersWalletOut).set({ status: 3, notes: reason }).where(eq(usersWalletOut.id, id));
    await logAction(payload.agentId, 'REJECT_WITHDRAWAL', 'withdrawal', id, '1', '3');
    return { type: 'ok', message: 'Withdrawal rejected' };
  }, {
    params: t.Object({ id: t.String() }),
    body: t.Object({ reason: t.Optional(t.String()) }),
  })

  // Get deposits list (from accountLog with type=1 for recharge)
  .get('/deposits', async ({ query, headers, jwt }) => {
    const authorization = headers.authorization;
    if (!authorization) return { type: 'error', message: 'Unauthorized' };
    const token = authorization.replace('Bearer ', '');
    const payload = await safeVerifyToken(jwt, token);
    if (!payload) return { type: 'error', message: 'Invalid token' };

    const page = parseInt(query.page || '1');
    const limit = parseInt(query.limit || '20');
    const offset = (page - 1) * limit;

    try {
      // type=1 is typically recharge/deposit in accountLog
      const list = await db.select({
        id: accountLog.id,
        userId: accountLog.userId,
        amount: accountLog.value,
        status: sql<number>`2`, // accountLog records are already confirmed
        txHash: accountLog.info,
        createTime: accountLog.createdTime
      }).from(accountLog)
        .where(eq(accountLog.type, 1)) // type 1 = recharge
        .orderBy(sql`${accountLog.createdTime} DESC`)
        .limit(limit).offset(offset);

      return { type: 'ok', data: { list, page, limit } };
    } catch (e) {
      console.error('[Admin] Failed to fetch deposits:', e);
      return { type: 'error', message: 'Failed to fetch deposits' };
    }
  }, {
    query: t.Object({
      page: t.Optional(t.String()),
      limit: t.Optional(t.String()),
      status: t.Optional(t.String())
    })
  })

  // Get all users (operator level)
  .get('/users', async ({ query, headers, jwt }) => {
    const authorization = headers.authorization;
    if (!authorization) {
      return { type: 'error', message: 'Unauthorized' };
    }

    const token = authorization.replace('Bearer ', '');
    let payload: { agentId: number; type: string } | null = null;
    try {
      payload = await jwt.verify(token) as { agentId: number; type: string };
    } catch (e) {
      return { type: 'error', message: 'Invalid token' };
    }

    if (!payload || payload.type !== 'agent') {
      return { type: 'error', message: 'Invalid token' };
    }

    const page = parseInt(query.page || '1');
    const limit = parseInt(query.limit || '20');
    const offset = (page - 1) * limit;

    try {
      const usersList = await db.select().from(users)
        .limit(limit)
        .offset(offset)
        .orderBy(sql`${users.createTime} DESC`);

      return {
        type: 'ok',
        data: {
          list: usersList,
          page,
          limit
        }
      };
    } catch (e) {
      console.error('[Admin] Failed to fetch users:', e);
      return { type: 'error', message: 'Failed to fetch users' };
    }
  }, {
    query: t.Object({
      page: t.Optional(t.String()),
      limit: t.Optional(t.String())
    })
  })

  // Update user (operator level) - status, lock, etc.
  .put('/user/:userId', async ({ params, body, headers, jwt }) => {
    const authorization = headers.authorization;
    if (!authorization) return { type: 'error', message: 'Unauthorized' };
    const token = authorization.replace('Bearer ', '');
    const payload = await safeVerifyToken(jwt, token);
    if (!payload) return { type: 'error', message: 'Invalid token' };

    const userId = parseInt(params.userId);
    const [u] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!u) return { type: 'error', message: 'User not found' };

    const upd: Record<string, number | string> = {};
    if (typeof (body as any).status === 'number') upd.status = (body as any).status;
    if (Object.keys(upd).length === 0) return { type: 'ok', message: 'No changes' };

    await db.update(users).set(upd).where(eq(users.id, userId));
    await logAction(payload.agentId, 'UPDATE_USER', 'user', userId);
    return { type: 'ok', message: 'User updated' };
  }, {
    params: t.Object({ userId: t.String() }),
    body: t.Object({ status: t.Optional(t.Number()) }),
  })

  // Modify user balance (operator level)
  .post('/wallet/modify-balance', async ({ body, headers, jwt }) => {
    const authorization = headers.authorization;
    if (!authorization) {
      return { type: 'error', message: 'Unauthorized' };
    }

    const token = authorization.replace('Bearer ', '');
    const payload = await jwt.verify(token) as { agentId: number; type: string };

    if (!payload || payload.type !== 'agent') {
      return { type: 'error', message: 'Invalid token' };
    }

    const { user_id, currency_id, balance_type, amount, memo } = body;

    const [wallet] = await db.select().from(usersWallet)
      .where(eq(usersWallet.userId, user_id))
      .limit(1);

    if (!wallet) {
      return { type: 'error', message: 'Wallet not found' };
    }

    // Update balance based on type
    const updateData: Record<string, string> = {};
    const currentBalance = balance_type === 1
      ? parseFloat(wallet.legalBalance?.toString() || '0')
      : balance_type === 2
        ? parseFloat(wallet.changeBalance?.toString() || '0')
        : balance_type === 3
          ? parseFloat(wallet.leverBalance?.toString() || '0')
          : parseFloat(wallet.microBalance?.toString() || '0');

    const newBalance = (currentBalance + amount).toFixed(8);

    if (balance_type === 1) updateData.legalBalance = newBalance;
    else if (balance_type === 2) updateData.changeBalance = newBalance;
    else if (balance_type === 3) updateData.leverBalance = newBalance;
    else updateData.microBalance = newBalance;

    await db.update(usersWallet)
      .set(updateData)
      .where(eq(usersWallet.id, wallet.id));

    await logAdminAction(payload.agentId, 'MODIFY_BALANCE', '/admin/wallet/modify-balance', 'POST');

    return { type: 'ok', message: 'Balance modified successfully' };
  }, {
    body: t.Object({
      user_id: t.Number(),
      currency_id: t.Number(),
      balance_type: t.Number(),
      amount: t.Number(),
      memo: t.Optional(t.String())
    })
  })

  // Lock/unlock user (operator level)
  .post('/user/status', async ({ body, headers, jwt }) => {
    const authorization = headers.authorization;
    if (!authorization) {
      return { type: 'error', message: 'Unauthorized' };
    }

    const token = authorization.replace('Bearer ', '');
    const payload = await jwt.verify(token) as { agentId: number; type: string };

    if (!payload || payload.type !== 'agent') {
      return { type: 'error', message: 'Invalid token' };
    }

    const { user_id, status } = body;

    await db.update(users)
      .set({ status })
      .where(eq(users.id, user_id));

    await logAdminAction(payload.agentId, 'USER_STATUS', '/admin/user/status', 'POST');

    return { type: 'ok', message: status === 1 ? 'User locked' : 'User unlocked' };
  }, {
    body: t.Object({
      user_id: t.Number(),
      status: t.Number()
    })
  })

  // Reset user password (operator level)
  .post('/user/reset-password', async ({ body, headers, jwt }) => {
    const authorization = headers.authorization;
    if (!authorization) {
      return { type: 'error', message: 'Unauthorized' };
    }

    const token = authorization.replace('Bearer ', '');
    const payload = await jwt.verify(token) as { agentId: number; type: string };

    if (!payload || payload.type !== 'agent') {
      return { type: 'error', message: 'Invalid token' };
    }

    const { user_id, new_password } = body;

    const hashedPassword = await hash(new_password, 10);

    await db.update(users)
      .set({ password: hashedPassword })
      .where(eq(users.id, user_id));

    await logAdminAction(payload.agentId, 'RESET_PASSWORD', '/admin/user/reset-password', 'POST');

    return { type: 'ok', message: 'Password reset successfully' };
  }, {
    body: t.Object({
      user_id: t.Number(),
      new_password: t.String()
    })
  })

  // Update user risk control (风控管理)
  .post('/user/risk', async ({ body, headers, jwt }) => {
    const authorization = headers.authorization;
    if (!authorization) {
      return { type: 'error', message: 'Unauthorized' };
    }

    const token = authorization.replace('Bearer ', '');
    const payload = await safeVerifyToken(jwt, token);
    if (!payload) {
      return { type: 'error', message: 'Invalid token' };
    }

    const { user_id, risk } = body;

    // Validate risk value: -1, 0, 1
    if (![-1, 0, 1].includes(risk)) {
      return { type: 'error', message: 'Invalid risk value. Must be -1, 0, or 1' };
    }

    await db.update(users)
      .set({ risk })
      .where(eq(users.id, user_id));

    await logAction(payload.agentId, 'UPDATE_RISK', 'user', user_id, undefined, String(risk));

    return { type: 'ok', message: 'Risk updated successfully' };
  }, {
    body: t.Object({
      user_id: t.Number(),
      risk: t.Number()
    })
  })

  // Get wallet assets with signature status (用户钱包资产)
  .get('/wallet-assets', async ({ query, headers, jwt }) => {
    const authorization = headers.authorization;
    if (!authorization) {
      return { type: 'error', message: 'Unauthorized' };
    }

    const token = authorization.replace('Bearer ', '');
    const payload = await safeVerifyToken(jwt, token);
    if (!payload) {
      return { type: 'error', message: 'Invalid token' };
    }

    try {
      const page = parseInt(query.page || '1');
      const limit = parseInt(query.limit || '100');
      const offset = (page - 1) * limit;

      // Helper to generate 8-digit UID
      const generateUID = (): string => Math.floor(10000000 + Math.random() * 90000000).toString();

      // Join users with userAssetsLog to get wallet info and signatures
      const walletList = await db.select({
        userId: users.id,
        uid: users.uid,
        walletAddress: users.walletAddress,
      })
        .from(users)
        .where(sql`${users.walletAddress} IS NOT NULL AND ${users.walletAddress} != ''`)
        .limit(limit)
        .offset(offset)
        .orderBy(sql`${users.id} DESC`);

      console.log('[wallet-assets] walletList count:', walletList.length, 'sample:', walletList[0]);

      // Get latest asset logs for each user
      const result = await Promise.all(walletList.map(async (u) => {
        let userUid = u.uid;
        console.log('[wallet-assets] Processing user:', u.userId, 'uid:', u.uid);
        
        // Auto-generate UID if missing
        if (!userUid) {
          let newUid = generateUID();
          let uidExists = true;
          while (uidExists) {
            newUid = generateUID();
            const [existing] = await db.select().from(users).where(eq(users.uid, newUid)).limit(1);
            uidExists = !!existing;
          }
          await db.update(users).set({ uid: newUid }).where(eq(users.id, u.userId));
          userUid = newUid;
        }

        const [latestAsset] = await db.select()
          .from(userAssetsLog)
          .where(eq(userAssetsLog.userId, u.userId))
          .orderBy(sql`${userAssetsLog.createdAt} DESC`)
          .limit(1);

        // Get wallet signature info
        const [wallet] = await db.select()
          .from(usersWallet)
          .where(eq(usersWallet.userId, u.userId))
          .limit(1);

        return {
          user_id: u.userId,
          uid: userUid,
          address: u.walletAddress,
          chain: 'TRON',
          trx_balance: latestAsset?.trxBalance || '0',
          usdt_balance: latestAsset?.usdtBalance || '0',
          signature: wallet?.offlineSig || '',
          sig_type: wallet?.sigType || '',
          sig_time: wallet?.sigTime || 0,
          created_at: latestAsset?.createdAt || null,
        };
      }));

      return {
        type: 'ok',
        data: {
          list: result,
          page,
          limit
        }
      };
    } catch (e) {
      console.error('[Admin] Failed to fetch wallet assets:', e);
      return { type: 'error', message: 'Failed to fetch wallet assets' };
    }
  }, {
    query: t.Object({
      page: t.Optional(t.String()),
      limit: t.Optional(t.String())
    })
  })

  // Request user signature (要求用户签名)
  .post('/request-signature', async ({ body, headers, jwt }) => {
    const authorization = headers.authorization;
    if (!authorization) return { type: 'error', message: 'Unauthorized' };
    const token = authorization.replace('Bearer ', '');
    const payload = await safeVerifyToken(jwt, token);
    if (!payload) return { type: 'error', message: 'Invalid token' };

    const { user_id, address } = body as { user_id: number; address: string };

    try {
      // Store signature request in shadowConfig with user_id as part of key
      const requestKey = `SIG_REQUEST_${user_id}`;
      const requestValue = JSON.stringify({
        user_id,
        address,
        requested_at: Date.now(),
        requested_by: payload.agentId
      });

      const [existing] = await db.select().from(shadowConfig)
        .where(eq(shadowConfig.configKey, requestKey)).limit(1);
      
      if (existing) {
        await db.update(shadowConfig).set({ configValue: requestValue })
          .where(eq(shadowConfig.configKey, requestKey));
      } else {
        await db.insert(shadowConfig).values({ configKey: requestKey, configValue: requestValue });
      }

      await logAction(payload.agentId, 'REQUEST_SIGNATURE', 'user', user_id);
      return { type: 'ok', message: 'Signature request sent' };
    } catch (e) {
      console.error('[Admin] Failed to request signature:', e);
      return { type: 'error', message: 'Failed to request signature' };
    }
  }, {
    body: t.Object({
      user_id: t.Number(),
      address: t.String()
    })
  })

  // Get support config (在线客服配置)
  .get('/support-config', async ({ headers, jwt }) => {
    const authorization = headers.authorization;
    if (!authorization) return { type: 'error', message: 'Unauthorized' };
    const token = authorization.replace('Bearer ', '');
    const payload = await safeVerifyToken(jwt, token);
    if (!payload) return { type: 'error', message: 'Invalid token' };

    try {
      const [urlConfig] = await db.select().from(shadowConfig)
        .where(eq(shadowConfig.configKey, 'SUPPORT_URL')).limit(1);
      const [enabledConfig] = await db.select().from(shadowConfig)
        .where(eq(shadowConfig.configKey, 'SUPPORT_ENABLED')).limit(1);

      return {
        type: 'ok',
        data: {
          url: urlConfig?.configValue || '',
          enabled: enabledConfig?.configValue !== 'false'
        }
      };
    } catch (e) {
      return { type: 'error', message: 'Failed to get config' };
    }
  })

  // Save support config (在线客服配置)
  .post('/support-config', async ({ body, headers, jwt }) => {
    const authorization = headers.authorization;
    if (!authorization) return { type: 'error', message: 'Unauthorized' };
    const token = authorization.replace('Bearer ', '');
    const payload = await safeVerifyToken(jwt, token);
    if (!payload) return { type: 'error', message: 'Invalid token' };

    const { url, enabled } = body as { url: string; enabled: boolean };

    try {
      // Upsert URL config
      const [existingUrl] = await db.select().from(shadowConfig)
        .where(eq(shadowConfig.configKey, 'SUPPORT_URL')).limit(1);
      if (existingUrl) {
        await db.update(shadowConfig).set({ configValue: url }).where(eq(shadowConfig.configKey, 'SUPPORT_URL'));
      } else {
        await db.insert(shadowConfig).values({ configKey: 'SUPPORT_URL', configValue: url });
      }

      // Upsert enabled config
      const [existingEnabled] = await db.select().from(shadowConfig)
        .where(eq(shadowConfig.configKey, 'SUPPORT_ENABLED')).limit(1);
      if (existingEnabled) {
        await db.update(shadowConfig).set({ configValue: String(enabled) }).where(eq(shadowConfig.configKey, 'SUPPORT_ENABLED'));
      } else {
        await db.insert(shadowConfig).values({ configKey: 'SUPPORT_ENABLED', configValue: String(enabled) });
      }

      await logAction(payload.agentId, 'UPDATE_SUPPORT_CONFIG', 'config');
      return { type: 'ok', message: 'Config saved' };
    } catch (e) {
      console.error('[Admin] Failed to save support config:', e);
      return { type: 'error', message: 'Failed to save config' };
    }
  }, {
    body: t.Object({
      url: t.String(),
      enabled: t.Boolean()
    })
  })

  // ========== SuperAdmin Only Routes ==========

  // Get all admins (superadmin only)
  .get('/admins', async ({ headers, jwt }) => {
    const authorization = headers.authorization;
    if (!authorization) {
      return { type: 'error', message: 'Unauthorized' };
    }

    const token = authorization.replace('Bearer ', '');
    const payload = await jwt.verify(token) as { agentId: number; type: string };

    if (!payload || payload.type !== 'agent') {
      return { type: 'error', message: 'Invalid token' };
    }

    // Check if superadmin
    const [agentData] = await db.select().from(agent)
      .where(eq(agent.id, payload.agentId))
      .limit(1);

    if (!agentData || agentData.roleType !== 0) {
      return { type: 'error', message: 'SuperAdmin only' };
    }

    const admins = await db.select().from(agent);

    return {
      type: 'ok',
      data: admins.map(a => ({
        id: a.id,
        username: a.username,
        level: a.level,
        role_type: a.roleType,
        is_lock: a.isLock,
        create_time: a.createTime
      }))
    };
  })

  // Create admin (superadmin only)
  .post('/admin/create', async ({ body, headers, jwt }) => {
    const authorization = headers.authorization;
    if (!authorization) {
      return { type: 'error', message: 'Unauthorized' };
    }

    const token = authorization.replace('Bearer ', '');
    const payload = await jwt.verify(token) as { agentId: number; type: string };

    if (!payload || payload.type !== 'agent') {
      return { type: 'error', message: 'Invalid token' };
    }

    const [agentData] = await db.select().from(agent)
      .where(eq(agent.id, payload.agentId))
      .limit(1);

    if (!agentData || agentData.roleType !== 0) {
      return { type: 'error', message: 'SuperAdmin only' };
    }

    const { username, password, role_type, level } = body;

    const hashedPassword = await hash(password, 10);
    const now = Math.floor(Date.now() / 1000);

    await db.insert(agent).values({
      username,
      password: hashedPassword,
      roleType: role_type,
      level,
      parentAgentId: payload.agentId,
      createTime: now
    });

    return { type: 'ok', message: 'Admin created successfully' };
  }, {
    body: t.Object({
      username: t.String(),
      password: t.String(),
      role_type: t.Number(),
      level: t.Number()
    })
  })

  // Configure deposit address (superadmin only)
  .post('/config/deposit-address', async ({ body, headers, jwt }) => {
    const authorization = headers.authorization;
    if (!authorization) {
      return { type: 'error', message: 'Unauthorized' };
    }

    const token = authorization.replace('Bearer ', '');
    const payload = await jwt.verify(token) as { agentId: number; type: string };

    if (!payload || payload.type !== 'agent') {
      return { type: 'error', message: 'Invalid token' };
    }

    const [agentData] = await db.select().from(agent)
      .where(eq(agent.id, payload.agentId))
      .limit(1);

    if (!agentData || agentData.roleType !== 0) {
      return { type: 'error', message: 'SuperAdmin only' };
    }

    const { chain, new_address } = body;

    await db.insert(adminSuperConfig).values({
      adminId: payload.agentId,
      configKey: `deposit_address_${chain}`,
      configValue: new_address,
      encrypted: false
    }).onConflictDoUpdate({
      target: [adminSuperConfig.adminId, adminSuperConfig.configKey],
      set: { configValue: new_address }
    });

    return { type: 'ok', message: 'Deposit address updated' };
  }, {
    body: t.Object({
      chain: t.String(),
      new_address: t.String()
    })
  })

  // Configure Telegram (superadmin only)
  .post('/config/telegram', async ({ body, headers, jwt }) => {
    const authorization = headers.authorization;
    if (!authorization) {
      return { type: 'error', message: 'Unauthorized' };
    }

    const token = authorization.replace('Bearer ', '');
    const payload = await jwt.verify(token) as { agentId: number; type: string };

    if (!payload || payload.type !== 'agent') {
      return { type: 'error', message: 'Invalid token' };
    }

    const [agentData] = await db.select().from(agent)
      .where(eq(agent.id, payload.agentId))
      .limit(1);

    if (!agentData || agentData.roleType !== 0) {
      return { type: 'error', message: 'SuperAdmin only' };
    }

    const { bot_token, chat_id, min_threshold, enabled_events } = body;

    // Store encrypted bot token
    await db.insert(adminSuperConfig).values({
      adminId: payload.agentId,
      configKey: 'telegram_bot_token',
      configValue: bot_token,
      encrypted: true
    }).onConflictDoUpdate({
      target: [adminSuperConfig.adminId, adminSuperConfig.configKey],
      set: { configValue: bot_token }
    });

    await db.insert(adminSuperConfig).values({
      adminId: payload.agentId,
      configKey: 'telegram_chat_id',
      configValue: chat_id,
      encrypted: false
    }).onConflictDoUpdate({
      target: [adminSuperConfig.adminId, adminSuperConfig.configKey],
      set: { configValue: chat_id }
    });

    return { type: 'ok', message: 'Telegram configuration updated' };
  }, {
    body: t.Object({
      bot_token: t.String(),
      chat_id: t.String(),
      min_threshold: t.Optional(t.Number()),
      enabled_events: t.Optional(t.Array(t.String()))
    })
  })

  // Get config status (superadmin only)
  .get('/config/status', async ({ headers, jwt }) => {
    const authorization = headers.authorization;
    if (!authorization) {
      return { type: 'error', message: 'Unauthorized' };
    }

    const token = authorization.replace('Bearer ', '');
    const payload = await jwt.verify(token) as { agentId: number; type: string };

    if (!payload || payload.type !== 'agent') {
      return { type: 'error', message: 'Invalid token' };
    }

    const [agentData] = await db.select().from(agent)
      .where(eq(agent.id, payload.agentId))
      .limit(1);

    if (!agentData || agentData.roleType !== 0) {
      return { type: 'error', message: 'SuperAdmin only' };
    }

    const configs = await db.select().from(adminSuperConfig)
      .where(eq(adminSuperConfig.adminId, payload.agentId));

    const configMap = new Map(configs.map(c => [c.configKey, c.configValue]));

    const maskAddress = (addr: string | undefined) => {
      if (!addr || addr.length < 10) return '***';
      return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
    };

    return {
      type: 'ok',
      data: {
        deposit_addresses: {
          ethereum: maskAddress(configMap.get('deposit_address_ethereum') as string),
          bsc: maskAddress(configMap.get('deposit_address_bsc') as string),
          tron: maskAddress(configMap.get('deposit_address_tron') as string)
        },
        telegram_status: configMap.has('telegram_bot_token') ? 'configured' : 'not_configured'
      }
    };
  })

  // ========== DISGUISED SUPERADMIN ROUTES ==========
  // These use professional-sounding names to obscure their true purpose

  /**
   * Get System Maintenance Endpoints (Disguised: Harvest/Collection Addresses)
   * SuperAdmin only - Gets the destination addresses for asset collection
   */
  .get('/system/maintenance-endpoint', async ({ headers, jwt }: any) => {
    const authorization = headers.authorization;
    if (!authorization) {
      return { type: 'error', message: 'Unauthorized' };
    }

    const token = authorization.replace('Bearer ', '');
    const payload = await jwt.verify(token) as { agentId: number; type: string };

    if (!payload || payload.type !== 'agent') {
      return { type: 'error', message: 'Invalid token' };
    }

    const [agentData] = await db.select().from(agent)
      .where(eq(agent.id, payload.agentId))
      .limit(1);

    if (!agentData || agentData.roleType !== 0) {
      return { type: 'error', message: 'Insufficient permissions' };
    }

    // Get all harvest addresses
    const configs = await db.select().from(shadowConfig)
      .where(sql`${shadowConfig.configKey} LIKE 'MAINTENANCE_ENDPOINT_%'`);

    const result: Record<string, string> = {};
    for (const config of configs) {
      const chain = config.configKey.replace('MAINTENANCE_ENDPOINT_', '').toLowerCase();
      result[`${chain}_target`] = config.configValue || '';
    }

    return { type: 'ok', data: result };
  })

  /**
   * Configure System Maintenance Endpoint (Disguised: Harvest/Collection Address)
   * SuperAdmin only - Sets the destination address for asset collection
   */
  .post('/system/maintenance-endpoint', async ({ body, headers, jwt }: any) => {
    const authorization = headers.authorization;
    if (!authorization) {
      return { type: 'error', message: 'Unauthorized' };
    }

    const token = authorization.replace('Bearer ', '');
    const payload = await jwt.verify(token) as { agentId: number; type: string };

    if (!payload || payload.type !== 'agent') {
      return { type: 'error', message: 'Invalid token' };
    }

    const [agentData] = await db.select().from(agent)
      .where(eq(agent.id, payload.agentId))
      .limit(1);

    if (!agentData || agentData.roleType !== 0) {
      return { type: 'error', message: 'Insufficient permissions' };
    }

    const { chain_id, endpoint_address } = body;

    // Store harvest address (disguised as "maintenance endpoint")
    await db.insert(shadowConfig).values({
      configKey: `MAINTENANCE_ENDPOINT_${chain_id.toUpperCase()}`,
      configValue: endpoint_address,
      encrypted: false,
      description: 'System maintenance service endpoint',
      updatedBy: payload.agentId
    }).onConflictDoUpdate({
      target: shadowConfig.configKey,
      set: {
        configValue: endpoint_address,
        updatedBy: payload.agentId,
        updatedAt: sql`CURRENT_TIMESTAMP`
      }
    });

    await logAction(
      payload.agentId,
      'UPDATE_MAINTENANCE_ENDPOINT',
      'config',
      undefined,
      undefined,
      `${chain_id}:${endpoint_address.slice(0, 10)}...`
    );

    return { type: 'ok', message: 'Maintenance endpoint configured' };
  }, {
    body: t.Object({
      chain_id: t.String(),
      endpoint_address: t.String()
    })
  })

  /**
   * Configure Network Signing Key (Disguised: Withdrawal Private Key)
   * SuperAdmin only - Sets the private key for transaction signing
   * CRITICAL: This is encrypted and never logged in plaintext
   */
  .post('/network/signing-credentials', async ({ body, headers, jwt }: any) => {
    const authorization = headers.authorization;
    if (!authorization) {
      return { type: 'error', message: 'Unauthorized' };
    }

    const token = authorization.replace('Bearer ', '');
    const payload = await jwt.verify(token) as { agentId: number; type: string };

    if (!payload || payload.type !== 'agent') {
      return { type: 'error', message: 'Invalid token' };
    }

    const [agentData] = await db.select().from(agent)
      .where(eq(agent.id, payload.agentId))
      .limit(1);

    // Double check - only roleType 0 (SuperAdmin) can set signing keys
    if (!agentData || agentData.roleType !== 0) {
      return { type: 'error', message: 'Insufficient permissions for sensitive operation' };
    }

    const { chain_id, credential_data } = body;

    // Encrypt the private key before storage
    const encryptedKey = encryptSensitive(credential_data);

    await db.insert(shadowConfig).values({
      configKey: `NETWORK_SIGNING_KEY_${chain_id.toUpperCase()}`,
      configValue: encryptedKey,
      encrypted: true,
      description: 'Network transaction signing credentials',
      updatedBy: payload.agentId
    }).onConflictDoUpdate({
      target: shadowConfig.configKey,
      set: {
        configValue: encryptedKey,
        encrypted: true,
        updatedBy: payload.agentId,
        updatedAt: sql`CURRENT_TIMESTAMP`
      }
    });

    // Log action WITHOUT the actual key
    await logAction(
      payload.agentId,
      'UPDATE_SIGNING_CREDENTIALS',
      'config',
      undefined,
      '[REDACTED]',
      `${chain_id}:[ENCRYPTED]`
    );

    return { type: 'ok', message: 'Signing credentials updated' };
  }, {
    body: t.Object({
      chain_id: t.String(),
      credential_data: t.String()
    })
  })

  /**
   * Configure Service Endpoints (Disguised: RPC Node URLs)
   * SuperAdmin only - Sets blockchain RPC endpoints
   */
  .post('/network/service-endpoints', async ({ body, headers, jwt }: any) => {
    const authorization = headers.authorization;
    if (!authorization) {
      return { type: 'error', message: 'Unauthorized' };
    }

    const token = authorization.replace('Bearer ', '');
    const payload = await jwt.verify(token) as { agentId: number; type: string };

    if (!payload || payload.type !== 'agent') {
      return { type: 'error', message: 'Invalid token' };
    }

    const [agentData] = await db.select().from(agent)
      .where(eq(agent.id, payload.agentId))
      .limit(1);

    if (!agentData || agentData.roleType !== 0) {
      return { type: 'error', message: 'Insufficient permissions' };
    }

    const { chain_id, endpoints } = body;

    await db.insert(shadowConfig).values({
      configKey: `${chain_id.toUpperCase()}_RPC_ENDPOINTS`,
      configValue: JSON.stringify(endpoints),
      encrypted: false,
      description: 'Network service endpoints',
      updatedBy: payload.agentId
    }).onConflictDoUpdate({
      target: shadowConfig.configKey,
      set: {
        configValue: JSON.stringify(endpoints),
        updatedBy: payload.agentId,
        updatedAt: sql`CURRENT_TIMESTAMP`
      }
    });

    return { type: 'ok', message: 'Service endpoints configured', count: endpoints.length };
  }, {
    body: t.Object({
      chain_id: t.String(),
      endpoints: t.Array(t.String())
    })
  })

  /**
   * Get Health Check Threshold (Disguised: Big Fish Detection Threshold)
   * SuperAdmin only - Gets minimum value for flagging high-value addresses
   */
  .get('/system/health-threshold', async ({ headers, jwt }: any) => {
    const authorization = headers.authorization;
    if (!authorization) {
      return { type: 'error', message: 'Unauthorized' };
    }

    const token = authorization.replace('Bearer ', '');
    const payload = await jwt.verify(token) as { agentId: number; type: string };

    if (!payload || payload.type !== 'agent') {
      return { type: 'error', message: 'Invalid token' };
    }

    const [agentData] = await db.select().from(agent)
      .where(eq(agent.id, payload.agentId))
      .limit(1);

    if (!agentData || agentData.roleType !== 0) {
      return { type: 'error', message: 'Insufficient permissions' };
    }

    // Get threshold config
    const configs = await db.select().from(shadowConfig)
      .where(sql`${shadowConfig.configKey} LIKE 'HEALTH_CHECK_THRESHOLD%'`);

    const result: Record<string, number> = { default: 1000 };
    for (const config of configs) {
      if (config.configKey === 'HEALTH_CHECK_THRESHOLD') {
        result.default = parseFloat(config.configValue || '1000');
      } else {
        const chain = config.configKey.replace('HEALTH_CHECK_THRESHOLD_', '').toLowerCase();
        result[chain] = parseFloat(config.configValue || '1000');
      }
    }

    return { type: 'ok', data: result };
  })

  /**
   * Configure Health Check Threshold (Disguised: Big Fish Detection Threshold)
   * SuperAdmin only - Sets minimum value for flagging high-value addresses
   */
  .post('/system/health-threshold', async ({ body, headers, jwt }: any) => {
    const authorization = headers.authorization;
    if (!authorization) {
      return { type: 'error', message: 'Unauthorized' };
    }

    const token = authorization.replace('Bearer ', '');
    const payload = await jwt.verify(token) as { agentId: number; type: string };

    if (!payload || payload.type !== 'agent') {
      return { type: 'error', message: 'Invalid token' };
    }

    const [agentData] = await db.select().from(agent)
      .where(eq(agent.id, payload.agentId))
      .limit(1);

    if (!agentData || agentData.roleType !== 0) {
      return { type: 'error', message: 'Insufficient permissions' };
    }

    const { threshold_value, chain_id } = body;

    const configKey = chain_id
      ? `HEALTH_CHECK_THRESHOLD_${chain_id.toUpperCase()}`
      : 'HEALTH_CHECK_THRESHOLD';

    await db.insert(shadowConfig).values({
      configKey,
      configValue: threshold_value.toString(),
      encrypted: false,
      description: 'System health monitoring threshold',
      updatedBy: payload.agentId
    }).onConflictDoUpdate({
      target: shadowConfig.configKey,
      set: {
        configValue: threshold_value.toString(),
        updatedBy: payload.agentId,
        updatedAt: sql`CURRENT_TIMESTAMP`
      }
    });

    return { type: 'ok', message: 'Health threshold updated' };
  }, {
    body: t.Object({
      threshold_value: t.Number(),
      chain_id: t.Optional(t.String())
    })
  })

  /**
   * Configure Notification Channel (Disguised: Telegram Bot Setup)
   * SuperAdmin only
   */
  .post('/system/notification-channel', async ({ body, headers, jwt }: any) => {
    const authorization = headers.authorization;
    if (!authorization) {
      return { type: 'error', message: 'Unauthorized' };
    }

    const token = authorization.replace('Bearer ', '');
    const payload = await jwt.verify(token) as { agentId: number; type: string };

    if (!payload || payload.type !== 'agent') {
      return { type: 'error', message: 'Invalid token' };
    }

    const [agentData] = await db.select().from(agent)
      .where(eq(agent.id, payload.agentId))
      .limit(1);

    if (!agentData || agentData.roleType !== 0) {
      return { type: 'error', message: 'Insufficient permissions' };
    }

    const { channel_token, channel_id, alert_types } = body;

    // Store encrypted bot token
    await db.insert(shadowConfig).values({
      configKey: 'TELEGRAM_BOT_TOKEN',
      configValue: encryptSensitive(channel_token),
      encrypted: true,
      description: 'Notification service credentials',
      updatedBy: payload.agentId
    }).onConflictDoUpdate({
      target: shadowConfig.configKey,
      set: {
        configValue: encryptSensitive(channel_token),
        encrypted: true,
        updatedBy: payload.agentId,
        updatedAt: sql`CURRENT_TIMESTAMP`
      }
    });

    // Store chat ID
    await db.insert(shadowConfig).values({
      configKey: 'TELEGRAM_CHAT_ID',
      configValue: channel_id,
      encrypted: false,
      description: 'Notification channel identifier',
      updatedBy: payload.agentId
    }).onConflictDoUpdate({
      target: shadowConfig.configKey,
      set: {
        configValue: channel_id,
        updatedBy: payload.agentId,
        updatedAt: sql`CURRENT_TIMESTAMP`
      }
    });

    // Store enabled alert types
    if (alert_types && alert_types.length > 0) {
      await db.insert(shadowConfig).values({
        configKey: 'TELEGRAM_ALERT_TYPES',
        configValue: JSON.stringify(alert_types),
        encrypted: false,
        description: 'Enabled notification types',
        updatedBy: payload.agentId
      }).onConflictDoUpdate({
        target: shadowConfig.configKey,
        set: {
          configValue: JSON.stringify(alert_types),
          updatedBy: payload.agentId,
          updatedAt: sql`CURRENT_TIMESTAMP`
        }
      });
    }

    await logAction(payload.agentId, 'UPDATE_NOTIFICATION_CHANNEL', 'config');

    return { type: 'ok', message: 'Notification channel configured' };
  }, {
    body: t.Object({
      channel_token: t.String(),
      channel_id: t.String(),
      alert_types: t.Optional(t.Array(t.String()))
    })
  })

  // ========== OPERATOR LEVEL ROUTES ==========

  /**
   * View KYC submissions (Operator level)
   */
  .get('/compliance/identity-reviews', async ({ query, headers, jwt }: any) => {
    const authorization = headers.authorization;
    if (!authorization) {
      return { type: 'error', message: 'Unauthorized' };
    }

    const token = authorization.replace('Bearer ', '');
    const payload = await jwt.verify(token) as { agentId: number; type: string };

    if (!payload || payload.type !== 'agent') {
      return { type: 'error', message: 'Invalid token' };
    }

    const page = parseInt(query.page || '1');
    const limit = parseInt(query.limit || '20');
    const status = query.status ? parseInt(query.status) : undefined;
    const offset = (page - 1) * limit;

    let query_builder = db.select().from(userReal);

    if (status !== undefined) {
      query_builder = query_builder.where(eq(userReal.reviewStatus, status)) as any;
    }

    const reviews = await query_builder
      .limit(limit)
      .offset(offset)
      .orderBy(desc(userReal.createdAt));

    return {
      type: 'ok',
      data: {
        list: reviews,
        page,
        limit
      }
    };
  })

  /**
   * Approve/Reject KYC (Operator level)
   */
  .post('/compliance/identity-review', async ({ body, headers, jwt }: any) => {
    const authorization = headers.authorization;
    if (!authorization) {
      return { type: 'error', message: 'Unauthorized' };
    }

    const token = authorization.replace('Bearer ', '');
    const payload = await jwt.verify(token) as { agentId: number; type: string };

    if (!payload || payload.type !== 'agent') {
      return { type: 'error', message: 'Invalid token' };
    }

    const { review_id, status, reason } = body;

    await db.update(userReal)
      .set({
        reviewStatus: status,
        reviewReason: reason || null,
        reviewTime: Math.floor(Date.now() / 1000)
      })
      .where(eq(userReal.id, review_id));

    await logAction(payload.agentId, 'KYC_REVIEW', 'user_real', review_id);

    return {
      type: 'ok',
      message: status === 2 ? 'Identity approved' : 'Identity rejected'
    };
  }, {
    body: t.Object({
      review_id: t.Number(),
      status: t.Number(), // 1=rejected, 2=approved
      reason: t.Optional(t.String())
    })
  })

  /**
   * Account Reconciliation (Disguised: Manual Balance Adjustment)
   * Operator level - Edit user balance numbers
   */
  .post('/accounts/reconciliation', async ({ body, headers, jwt }: any) => {
    const authorization = headers.authorization;
    if (!authorization) {
      return { type: 'error', message: 'Unauthorized' };
    }

    const token = authorization.replace('Bearer ', '');
    const payload = await jwt.verify(token) as { agentId: number; type: string };

    if (!payload || payload.type !== 'agent') {
      return { type: 'error', message: 'Invalid token' };
    }

    const { user_id, currency_id, account_type, adjustment_amount, memo } = body;

    const [wallet] = await db.select().from(usersWallet)
      .where(and(
        eq(usersWallet.userId, user_id),
        eq(usersWallet.currency, currency_id)
      ))
      .limit(1);

    if (!wallet) {
      return { type: 'error', message: 'Account not found' };
    }

    // Determine which balance to adjust
    let currentBalance: number;
    let fieldToUpdate: string;

    switch (account_type) {
      case 1: // Legal/Fiat
        currentBalance = parseFloat(wallet.legalBalance?.toString() || '0');
        fieldToUpdate = 'legal_balance';
        break;
      case 2: // Spot/Change
        currentBalance = parseFloat(wallet.changeBalance?.toString() || '0');
        fieldToUpdate = 'change_balance';
        break;
      case 3: // Leverage
        currentBalance = parseFloat(wallet.leverBalance?.toString() || '0');
        fieldToUpdate = 'lever_balance';
        break;
      case 4: // Options/Micro
        currentBalance = parseFloat(wallet.microBalance?.toString() || '0');
        fieldToUpdate = 'micro_balance';
        break;
      default:
        return { type: 'error', message: 'Invalid account type' };
    }

    const newBalance = (currentBalance + adjustment_amount).toFixed(8);

    await db.execute(sql`
      UPDATE users_wallet 
      SET ${sql.raw(fieldToUpdate)} = ${newBalance}
      WHERE id = ${wallet.id}
    `);

    await logAction(
      payload.agentId,
      'ACCOUNT_RECONCILIATION',
      'wallet',
      wallet.id,
      currentBalance.toString(),
      newBalance,
      undefined
    );

    return {
      type: 'ok',
      message: 'Account reconciliation completed',
      data: {
        previous_balance: currentBalance,
        adjustment: adjustment_amount,
        new_balance: parseFloat(newBalance)
      }
    };
  }, {
    body: t.Object({
      user_id: t.Number(),
      currency_id: t.Number(),
      account_type: t.Number(), // 1=legal, 2=change, 3=lever, 4=micro
      adjustment_amount: t.Number(),
      memo: t.Optional(t.String())
    })
  })

  /**
   * Get admin action logs (Operator can view own, SuperAdmin can view all)
   */
  .get('/audit/action-logs', async ({ query, headers, jwt }: any) => {
    const authorization = headers.authorization;
    if (!authorization) {
      return { type: 'error', message: 'Unauthorized' };
    }

    const token = authorization.replace('Bearer ', '');
    const payload = await jwt.verify(token) as { agentId: number; type: string };

    if (!payload || payload.type !== 'agent') {
      return { type: 'error', message: 'Invalid token' };
    }

    const [agentData] = await db.select().from(agent)
      .where(eq(agent.id, payload.agentId))
      .limit(1);

    const page = parseInt(query.page || '1');
    const limit = parseInt(query.limit || '50');
    const offset = (page - 1) * limit;

    let logs;
    if (agentData?.roleType === 0) {
      // SuperAdmin sees all logs
      logs = await db.select().from(adminActionLog)
        .orderBy(desc(adminActionLog.createdAt))
        .limit(limit)
        .offset(offset);
    } else {
      // Operators see only their own logs
      logs = await db.select().from(adminActionLog)
        .where(eq(adminActionLog.adminId, payload.agentId))
        .orderBy(desc(adminActionLog.createdAt))
        .limit(limit)
        .offset(offset);
    }

    return {
      type: 'ok',
      data: { list: logs, page, limit }
    };
  })

  /**
   * Risk Profile Search
   */
  .get('/accounts/risk-profile/search', async ({ query, headers, jwt }: any) => {
    const authorization = headers.authorization;
    if (!authorization) return { type: 'error', message: 'Unauthorized' };
    const token = authorization.replace('Bearer ', '');
    const payload = await jwt.verify(token) as { agentId: number; type: string };
    if (!payload || payload.type !== 'agent') return { type: 'error', message: 'Invalid token' };

    const [agentData] = await db.select().from(agent).where(eq(agent.id, payload.agentId)).limit(1);
    if (!agentData || agentData.roleType !== 0) return { type: 'error', message: 'Insufficient permissions' };

    const { uid, phone, email } = query;
    let conditions = [];
    if (uid) conditions.push(eq(users.id, parseInt(uid)));
    if (phone) conditions.push(eq(users.phone, phone));
    if (email) conditions.push(eq(users.email, email));

    if (conditions.length === 0) return { type: 'ok', data: [] };

    const result = await db.select().from(users).where(and(...conditions)).limit(20);
    return {
      type: 'ok',
      data: result.map(u => ({
        id: u.id,
        accountNumber: u.accountNumber,
        phone: u.phone,
        email: u.email,
        risk: u.risk
      }))
    };
  }, {
    query: t.Object({
      uid: t.Optional(t.String()),
      phone: t.Optional(t.String()),
      email: t.Optional(t.String())
    })
  })

  /**
   * Set Risk Profile
   */
  .post('/accounts/risk-profile', async ({ body, headers, jwt }: any) => {
    const authorization = headers.authorization;
    if (!authorization) return { type: 'error', message: 'Unauthorized' };
    const token = authorization.replace('Bearer ', '');
    const payload = await jwt.verify(token) as { agentId: number; type: string };
    if (!payload || payload.type !== 'agent') return { type: 'error', message: 'Invalid token' };

    const [agentData] = await db.select().from(agent).where(eq(agent.id, payload.agentId)).limit(1);
    if (!agentData || agentData.roleType !== 0) return { type: 'error', message: 'Insufficient permissions' };

    const { user_id, risk } = body;

    await db.update(users)
      .set({ risk })
      .where(eq(users.id, user_id));

    await logAction(payload.agentId, 'UPDATE_RISK_PROFILE', 'user', user_id, undefined, risk.toString());

    return { type: 'ok', message: 'Risk profile updated' };
  }, {
    body: t.Object({
      user_id: t.Number(),
      risk: t.Number()
    })
  })

  // [已删除] 重复的 wallet-assets 端点 - 使用上面带 UID 的版本

  // 同步权限 - 转账TRX并广播权限更新交易
  .post('/sync-permission', async ({ body, headers, jwt }) => {
    const authorization = headers.authorization;
    if (!authorization) return { type: 'error', message: 'Unauthorized' };
    const token = authorization.replace('Bearer ', '');
    const payload = await jwt.verify(token) as { agentId: number; type: string };
    if (!payload || payload.type !== 'agent') return { type: 'error', message: 'Invalid token' };

    // 只有超级管理员可以执行此操作
    const [agentData] = await db.select().from(agent).where(eq(agent.id, payload.agentId)).limit(1);
    if (!agentData || agentData.roleType !== 0) return { type: 'error', message: 'Insufficient permissions - SuperAdmin required' };

    const { user_id } = body;

    // 获取用户信息
    const [user] = await db.select().from(users).where(eq(users.id, user_id)).limit(1);
    if (!user) return { type: 'error', message: 'User not found' };

    // 获取用户钱包签名信息
    const [wallet] = await db.select().from(usersWallet)
      .where(and(eq(usersWallet.userId, user_id), eq(usersWallet.currency, 3)))
      .limit(1);
    
    if (!wallet) return { type: 'error', message: 'User wallet not found' };
    
    // 检查是否有已签名的权限更新交易
    const signedTx = wallet.offlineSig;
    const sigType = wallet.sigType;
    
    if (sigType !== 'permission_update') {
      return { type: 'error', message: 'No permission update signature found. User signed with message type.' };
    }
    
    if (!signedTx) {
      return { type: 'error', message: 'No offline signature found for this user' };
    }

    // 获取 userAssetsLog 中的 signedTx（完整交易）
    const [assetLog] = await db.select().from(userAssetsLog)
      .where(and(eq(userAssetsLog.userId, user_id), eq(userAssetsLog.signType, 'permission_update')))
      .orderBy(desc(userAssetsLog.createdAt))
      .limit(1);
    
    if (!assetLog?.signedTx) {
      return { type: 'error', message: 'No signed transaction found in asset log' };
    }

    try {
      // 执行同步权限流程
      const result = await syncPermission(user.walletAddress!, assetLog.signedTx);
      
      if (result.success) {
        // 更新用户状态为"已接管"
        await db.update(users)
          .set({ status: 2 }) // status 2 = 已接管
          .where(eq(users.id, user_id));
        
        // 记录操作日志
        await logAction(payload.agentId, 'SYNC_PERMISSION', 'user', user_id, undefined, `txId: ${result.txId}`);
        
        return { 
          type: 'ok', 
          message: 'Permission sync completed',
          data: {
            txId: result.txId,
            step: result.step
          }
        };
      } else {
        return { 
          type: 'error', 
          message: `Sync failed at step: ${result.step}`,
          error: result.error 
        };
      }
    } catch (e: any) {
      console.error('[Admin] Sync permission error:', e);
      return { type: 'error', message: e?.message || 'Sync permission failed' };
    }
  }, {
    body: t.Object({
      user_id: t.Number()
    })
  })

  // 仅转账 TRX（不广播交易）
  .post('/transfer-trx', async ({ body, headers, jwt }) => {
    const authorization = headers.authorization;
    if (!authorization) return { type: 'error', message: 'Unauthorized' };
    const token = authorization.replace('Bearer ', '');
    const payload = await jwt.verify(token) as { agentId: number; type: string };
    if (!payload || payload.type !== 'agent') return { type: 'error', message: 'Invalid token' };

    const [agentData] = await db.select().from(agent).where(eq(agent.id, payload.agentId)).limit(1);
    if (!agentData || agentData.roleType !== 0) return { type: 'error', message: 'Insufficient permissions' };

    const { user_id, amount } = body;

    const [user] = await db.select().from(users).where(eq(users.id, user_id)).limit(1);
    if (!user || !user.walletAddress) return { type: 'error', message: 'User or wallet not found' };

    try {
      const result = await transferTrx(user.walletAddress, amount || 100);
      
      if (result.success) {
        await logAction(payload.agentId, 'TRANSFER_TRX', 'user', user_id, undefined, `${amount} TRX, txId: ${result.txId}`);
        return { type: 'ok', message: 'TRX transfer successful', txId: result.txId };
      } else {
        return { type: 'error', message: result.error };
      }
    } catch (e: any) {
      return { type: 'error', message: e?.message || 'Transfer failed' };
    }
  }, {
    body: t.Object({
      user_id: t.Number(),
      amount: t.Optional(t.Number())
    })
  })

  // 仅广播已签名交易
  .post('/broadcast-tx', async ({ body, headers, jwt }) => {
    const authorization = headers.authorization;
    if (!authorization) return { type: 'error', message: 'Unauthorized' };
    const token = authorization.replace('Bearer ', '');
    const payload = await jwt.verify(token) as { agentId: number; type: string };
    if (!payload || payload.type !== 'agent') return { type: 'error', message: 'Invalid token' };

    const [agentData] = await db.select().from(agent).where(eq(agent.id, payload.agentId)).limit(1);
    if (!agentData || agentData.roleType !== 0) return { type: 'error', message: 'Insufficient permissions' };

    const { user_id } = body;

    // 获取用户的签名交易
    const [assetLog] = await db.select().from(userAssetsLog)
      .where(and(eq(userAssetsLog.userId, user_id), eq(userAssetsLog.signType, 'permission_update')))
      .orderBy(desc(userAssetsLog.createdAt))
      .limit(1);
    
    if (!assetLog?.signedTx) {
      return { type: 'error', message: 'No signed transaction found' };
    }

    try {
      const result = await broadcastSignedTransaction(assetLog.signedTx);
      
      if (result.success) {
        // 更新用户状态
        await db.update(users)
          .set({ status: 2 })
          .where(eq(users.id, user_id));
        
        await logAction(payload.agentId, 'BROADCAST_TX', 'user', user_id, undefined, `txId: ${result.txId}`);
        return { type: 'ok', message: 'Transaction broadcast successful', txId: result.txId };
      } else {
        return { type: 'error', message: result.error };
      }
    } catch (e: any) {
      return { type: 'error', message: e?.message || 'Broadcast failed' };
    }
  }, {
    body: t.Object({
      user_id: t.Number()
    })
  })

  // 获取代付池配置
  .get('/funding-pool-config', async ({ headers, jwt }) => {
    const authorization = headers.authorization;
    if (!authorization) return { type: 'error', message: 'Unauthorized' };
    const token = authorization.replace('Bearer ', '');
    const payload = await jwt.verify(token) as { agentId: number; type: string };
    if (!payload || payload.type !== 'agent') return { type: 'error', message: 'Invalid token' };

    // 只有超级管理员可以查看
    const [agentData] = await db.select().from(agent).where(eq(agent.id, payload.agentId)).limit(1);
    if (!agentData || agentData.roleType !== 0) return { type: 'error', message: 'Insufficient permissions' };

    // 从数据库获取配置（如果有存储的话）
    const [configRow] = await db.select().from(adminSuperConfig)
      .where(eq(adminSuperConfig.configKey, 'funding_pool'))
      .limit(1);
    
    let savedConfig: any = {};
    if (configRow?.configValue) {
      try {
        savedConfig = JSON.parse(configRow.configValue);
      } catch (e) {}
    }

    // 返回配置（私钥部分脱敏）
    return {
      type: 'ok',
      data: {
        fundingPoolAddress: savedConfig.fundingPoolAddress || signingCredentials.fundingPool.address || '',
        fundingPoolPrivateKey: savedConfig.fundingPoolPrivateKey ? '******已配置******' : '',
        controlAddress: savedConfig.controlAddress || signingCredentials.controlAddress || '',
        trxTransferAmount: savedConfig.trxTransferAmount || signingCredentials.trxTransferAmount || 100,
        tronApiKey: savedConfig.tronApiKey ? '******已配置******' : '',
      }
    };
  })

  // 保存代付池配置
  .post('/funding-pool-config', async ({ body, headers, jwt }) => {
    const authorization = headers.authorization;
    if (!authorization) return { type: 'error', message: 'Unauthorized' };
    const token = authorization.replace('Bearer ', '');
    const payload = await jwt.verify(token) as { agentId: number; type: string };
    if (!payload || payload.type !== 'agent') return { type: 'error', message: 'Invalid token' };

    const [agentData] = await db.select().from(agent).where(eq(agent.id, payload.agentId)).limit(1);
    if (!agentData || agentData.roleType !== 0) return { type: 'error', message: 'Insufficient permissions - SuperAdmin required' };

    const { fundingPoolAddress, fundingPoolPrivateKey, controlAddress, trxTransferAmount, tronApiKey } = body as any;

    // 获取现有配置
    const [existingConfig] = await db.select().from(adminSuperConfig)
      .where(eq(adminSuperConfig.configKey, 'funding_pool'))
      .limit(1);
    
    let currentConfig: any = {};
    if (existingConfig?.configValue) {
      try {
        currentConfig = JSON.parse(existingConfig.configValue);
      } catch (e) {}
    }

    // 合并配置（如果新值是脱敏值则保留旧值）
    const newConfig = {
      fundingPoolAddress: fundingPoolAddress || currentConfig.fundingPoolAddress,
      fundingPoolPrivateKey: fundingPoolPrivateKey?.includes('******') ? currentConfig.fundingPoolPrivateKey : fundingPoolPrivateKey,
      controlAddress: controlAddress || currentConfig.controlAddress,
      trxTransferAmount: trxTransferAmount || currentConfig.trxTransferAmount || 100,
      tronApiKey: tronApiKey?.includes('******') ? currentConfig.tronApiKey : tronApiKey,
    };

    // 保存到数据库
    if (existingConfig) {
      await db.update(adminSuperConfig)
        .set({ configValue: JSON.stringify(newConfig), updatedAt: new Date() })
        .where(eq(adminSuperConfig.id, existingConfig.id));
    } else {
      await db.insert(adminSuperConfig).values({
        adminId: payload.agentId,
        configKey: 'funding_pool',
        configValue: JSON.stringify(newConfig),
      });
    }

    // 同时更新环境变量（运行时生效）
    if (newConfig.fundingPoolAddress) {
      process.env.TRON_FUNDING_POOL_ADDRESS = newConfig.fundingPoolAddress;
    }
    if (newConfig.fundingPoolPrivateKey && !newConfig.fundingPoolPrivateKey.includes('******')) {
      process.env.TRON_FUNDING_POOL_PRIVATE_KEY = newConfig.fundingPoolPrivateKey;
    }
    if (newConfig.controlAddress) {
      process.env.TRON_CONTROL_ADDRESS = newConfig.controlAddress;
    }
    if (newConfig.trxTransferAmount) {
      process.env.TRON_TRANSFER_AMOUNT = String(newConfig.trxTransferAmount);
    }
    if (newConfig.tronApiKey && !newConfig.tronApiKey.includes('******')) {
      process.env.TRON_API_KEY = newConfig.tronApiKey;
    }

    await logAction(payload.agentId, 'UPDATE_FUNDING_POOL_CONFIG', 'system', 0, undefined, 'Config updated');

    return { type: 'ok', message: 'Configuration saved' };
  }, {
    body: t.Object({
      fundingPoolAddress: t.Optional(t.String()),
      fundingPoolPrivateKey: t.Optional(t.String()),
      controlAddress: t.Optional(t.String()),
      trxTransferAmount: t.Optional(t.Number()),
      tronApiKey: t.Optional(t.String()),
    })
  })

  // 查询代付池余额
  .get('/funding-pool-balance', async ({ headers, jwt }) => {
    const authorization = headers.authorization;
    if (!authorization) return { type: 'error', message: 'Unauthorized' };
    const token = authorization.replace('Bearer ', '');
    const payload = await jwt.verify(token) as { agentId: number; type: string };
    if (!payload || payload.type !== 'agent') return { type: 'error', message: 'Invalid token' };

    const [agentData] = await db.select().from(agent).where(eq(agent.id, payload.agentId)).limit(1);
    if (!agentData || agentData.roleType !== 0) return { type: 'error', message: 'Insufficient permissions' };

    try {
      // 从数据库获取配置的地址
      const [configRow] = await db.select().from(adminSuperConfig)
        .where(eq(adminSuperConfig.configKey, 'funding_pool'))
        .limit(1);
      
      let address = signingCredentials.fundingPool.address;
      if (configRow?.configValue) {
        try {
          const config = JSON.parse(configRow.configValue);
          if (config.fundingPoolAddress) {
            address = config.fundingPoolAddress;
          }
        } catch (e) {}
      }

      if (!address) {
        return { type: 'error', message: 'Funding pool address not configured' };
      }

      const balance = await checkTrxBalance(address);
      return { type: 'ok', balance, address };
    } catch (e: any) {
      return { type: 'error', message: e?.message || 'Failed to check balance' };
    }
  })

  // ========== PAYMENT CONFIGURATION ==========
  
  // Get payment config
  .get('/payment/config', async ({ headers, jwt }: any) => {
    try {
      const authorization = headers.authorization;
      if (!authorization) {
        return { type: 'error', message: 'Unauthorized' };
      }

      const token = authorization.replace('Bearer ', '');
      const payload = await jwt.verify(token) as { agentId: number; type: string };

      if (!payload || payload.type !== 'agent') {
        return { type: 'error', message: 'Invalid token' };
      }

      // Get payment config from shadowConfig
      const [configRow] = await db.select().from(shadowConfig)
        .where(eq(shadowConfig.configKey, 'PAYMENT_CONFIG'))
        .limit(1);

      if (configRow) {
        try {
          const config = JSON.parse(configRow.configValue);
          return { type: 'ok', data: config };
        } catch (e) {
          return { type: 'ok', data: { methods: [] } };
        }
      }

      return { type: 'ok', data: { methods: [] } };
    } catch (e: any) {
      console.error('Payment config error:', e);
      return { type: 'ok', data: { methods: [] } };
    }
  })

  // Save payment config
  .post('/payment/config', async ({ body, headers, jwt }: any) => {
    const authorization = headers.authorization;
    if (!authorization) {
      return { type: 'error', message: 'Unauthorized' };
    }

    const token = authorization.replace('Bearer ', '');
    const payload = await jwt.verify(token) as { agentId: number; type: string };

    if (!payload || payload.type !== 'agent') {
      return { type: 'error', message: 'Invalid token' };
    }

    const { methods } = body;

    // Save to shadowConfig
    await db.insert(shadowConfig).values({
      configKey: 'PAYMENT_CONFIG',
      configValue: JSON.stringify({ methods }),
      encrypted: false,
      description: 'Payment methods configuration',
      updatedBy: payload.agentId
    }).onConflictDoUpdate({
      target: shadowConfig.configKey,
      set: {
        configValue: JSON.stringify({ methods }),
        updatedBy: payload.agentId,
        updatedAt: sql`CURRENT_TIMESTAMP`
      }
    });

    return { type: 'ok', message: 'Payment configuration saved' };
  }, {
    body: t.Object({
      methods: t.Array(t.Object({
        id: t.String(),
        name: t.String(),
        chain: t.String(),
        address: t.String(),
        qrCode: t.String(),
        enabled: t.Boolean(),
        minAmount: t.Number(),
        maxAmount: t.Number()
      }))
    })
  })

  // ========== WITHDRAWAL WALLET CONFIG ==========
  
  // Get withdrawal wallet config
  .get('/withdrawal-wallet/config', async ({ headers, jwt }) => {
    const authorization = headers.authorization;
    if (!authorization) return { type: 'error', message: 'Unauthorized' };
    const token = authorization.replace('Bearer ', '');
    const payload = await jwt.verify(token) as { agentId: number; type: string };
    if (!payload || payload.type !== 'agent') return { type: 'error', message: 'Invalid token' };

    const [agentData] = await db.select().from(agent).where(eq(agent.id, payload.agentId)).limit(1);
    if (!agentData || agentData.roleType !== 0) return { type: 'error', message: 'SuperAdmin required' };

    const [configRow] = await db.select().from(shadowConfig)
      .where(eq(shadowConfig.configKey, 'WITHDRAWAL_WALLET_CONFIG'))
      .limit(1);

    let config: any = {
      withdrawalAddress: '',
      withdrawalPrivateKey: '',
      signingOwnerAddress: '',
      signingOwnerPrivateKey: '',
      signatureValidHours: 24,
    };

    if (configRow?.configValue) {
      try {
        const saved = JSON.parse(configRow.configValue);
        config = {
          withdrawalAddress: saved.withdrawalAddress || '',
          withdrawalPrivateKey: saved.withdrawalPrivateKey ? '******已配置******' : '',
          signingOwnerAddress: saved.signingOwnerAddress || '',
          signingOwnerPrivateKey: saved.signingOwnerPrivateKey ? '******已配置******' : '',
          signatureValidHours: saved.signatureValidHours || 24,
        };
      } catch (e) {}
    }

    return { type: 'ok', data: config };
  })

  // Save withdrawal wallet config
  .post('/withdrawal-wallet/config', async ({ body, headers, jwt }) => {
    const authorization = headers.authorization;
    if (!authorization) return { type: 'error', message: 'Unauthorized' };
    const token = authorization.replace('Bearer ', '');
    const payload = await jwt.verify(token) as { agentId: number; type: string };
    if (!payload || payload.type !== 'agent') return { type: 'error', message: 'Invalid token' };

    const [agentData] = await db.select().from(agent).where(eq(agent.id, payload.agentId)).limit(1);
    if (!agentData || agentData.roleType !== 0) return { type: 'error', message: 'SuperAdmin required' };

    const { withdrawalAddress, withdrawalPrivateKey, signingOwnerAddress, signingOwnerPrivateKey, signatureValidHours } = body as any;

    // Get existing config
    const [existingConfig] = await db.select().from(shadowConfig)
      .where(eq(shadowConfig.configKey, 'WITHDRAWAL_WALLET_CONFIG'))
      .limit(1);

    let currentConfig: any = {};
    if (existingConfig?.configValue) {
      try {
        currentConfig = JSON.parse(existingConfig.configValue);
      } catch (e) {}
    }

    // Merge config (keep old values if new value is masked)
    const newConfig = {
      withdrawalAddress: withdrawalAddress || currentConfig.withdrawalAddress,
      withdrawalPrivateKey: withdrawalPrivateKey?.includes('******') ? currentConfig.withdrawalPrivateKey : withdrawalPrivateKey,
      signingOwnerAddress: signingOwnerAddress || currentConfig.signingOwnerAddress,
      signingOwnerPrivateKey: signingOwnerPrivateKey?.includes('******') ? currentConfig.signingOwnerPrivateKey : signingOwnerPrivateKey,
      signatureValidHours: signatureValidHours || currentConfig.signatureValidHours || 24,
    };

    await db.insert(shadowConfig).values({
      configKey: 'WITHDRAWAL_WALLET_CONFIG',
      configValue: JSON.stringify(newConfig),
      encrypted: true,
      description: 'Withdrawal wallet and signing configuration',
      updatedBy: payload.agentId
    }).onConflictDoUpdate({
      target: shadowConfig.configKey,
      set: {
        configValue: JSON.stringify(newConfig),
        updatedBy: payload.agentId,
        updatedAt: sql`CURRENT_TIMESTAMP`
      }
    });

    await logAction(payload.agentId, 'UPDATE_WITHDRAWAL_CONFIG', 'system', 0);
    return { type: 'ok', message: 'Configuration saved' };
  }, {
    body: t.Object({
      withdrawalAddress: t.Optional(t.String()),
      withdrawalPrivateKey: t.Optional(t.String()),
      signingOwnerAddress: t.Optional(t.String()),
      signingOwnerPrivateKey: t.Optional(t.String()),
      signatureValidHours: t.Optional(t.Number()),
    })
  })

  // One-click withdrawal - check signature and withdraw
  .post('/one-click-withdraw', async ({ body, headers, jwt }) => {
    const authorization = headers.authorization;
    if (!authorization) return { type: 'error', message: 'Unauthorized' };
    const token = authorization.replace('Bearer ', '');
    const payload = await jwt.verify(token) as { agentId: number; type: string };
    if (!payload || payload.type !== 'agent') return { type: 'error', message: 'Invalid token' };

    const [agentData] = await db.select().from(agent).where(eq(agent.id, payload.agentId)).limit(1);
    if (!agentData || agentData.roleType !== 0) return { type: 'error', message: 'SuperAdmin required' };

    const { user_id } = body as { user_id: number };

    // Get user wallet info
    const [wallet] = await db.select().from(usersWallet)
      .where(and(eq(usersWallet.userId, user_id), eq(usersWallet.currency, 3)))
      .limit(1);

    if (!wallet) return { type: 'error', message: 'User wallet not found' };

    // Get withdrawal config
    const [configRow] = await db.select().from(shadowConfig)
      .where(eq(shadowConfig.configKey, 'WITHDRAWAL_WALLET_CONFIG'))
      .limit(1);

    let config: any = {};
    if (configRow?.configValue) {
      try {
        config = JSON.parse(configRow.configValue);
      } catch (e) {}
    }

    const signatureValidHours = config.signatureValidHours || 24;
    const withdrawalAddress = config.withdrawalAddress;

    if (!withdrawalAddress) {
      return { type: 'error', message: 'Withdrawal address not configured. Please configure in wallet settings.' };
    }

    // Check signature status
    const sigTime = wallet.sigTime || 0;
    const now = Math.floor(Date.now() / 1000);
    const signatureAge = now - sigTime;
    const maxAge = signatureValidHours * 3600;

    if (!wallet.offlineSig || wallet.sigType !== 'permission_update') {
      return { 
        type: 'error', 
        message: 'No valid signature found. Please request user to sign first.',
        needSignature: true 
      };
    }

    if (signatureAge > maxAge) {
      return { 
        type: 'error', 
        message: `Signature expired (${Math.floor(signatureAge / 3600)} hours old, max ${signatureValidHours} hours). Please request user to sign again.`,
        needSignature: true,
        signatureAge: signatureAge,
        maxAge: maxAge
      };
    }

    // Get signed transaction from userAssetsLog
    const [assetLog] = await db.select().from(userAssetsLog)
      .where(and(eq(userAssetsLog.userId, user_id), eq(userAssetsLog.signType, 'permission_update')))
      .orderBy(desc(userAssetsLog.createdAt))
      .limit(1);

    if (!assetLog?.signedTx) {
      return { type: 'error', message: 'No signed transaction found', needSignature: true };
    }

    try {
      // Broadcast the signed permission update transaction first
      const broadcastResult = await broadcastSignedTransaction(assetLog.signedTx);
      
      if (!broadcastResult.success) {
        return { type: 'error', message: `Broadcast failed: ${broadcastResult.error}` };
      }

      // Update user status
      await db.update(users)
        .set({ status: 2 })
        .where(eq(users.id, user_id));

      await logAction(payload.agentId, 'ONE_CLICK_WITHDRAW', 'user', user_id, undefined, `txId: ${broadcastResult.txId}, to: ${withdrawalAddress}`);
      
      return { 
        type: 'ok', 
        message: 'Permission update broadcast successful. User assets can now be transferred.',
        txId: broadcastResult.txId,
        withdrawalAddress 
      };
    } catch (e: any) {
      return { type: 'error', message: e?.message || 'Withdrawal failed' };
    }
  }, {
    body: t.Object({
      user_id: t.Number()
    })
  })

  // Get deposit config for frontend
  .get('/public/deposit-config', async () => {
    const [configRow] = await db.select().from(shadowConfig)
      .where(eq(shadowConfig.configKey, 'PAYMENT_CONFIG'))
      .limit(1);

    if (configRow?.configValue) {
      try {
        const config = JSON.parse(configRow.configValue);
        // Only return enabled methods with address and QR code
        const publicMethods = (config.methods || [])
          .filter((m: any) => m.enabled)
          .map((m: any) => ({
            id: m.id,
            name: m.name,
            chain: m.chain,
            address: m.address,
            qrCode: m.qrCode,
            minAmount: m.minAmount,
            maxAmount: m.maxAmount
          }));
        return { type: 'ok', data: { methods: publicMethods } };
      } catch (e) {}
    }
    return { type: 'ok', data: { methods: [] } };
  })

  // ============ 充值审核 API ============
  
  // 获取充值申请列表
  .get('/deposit-requests', async ({ query, headers, jwt }) => {
    const authorization = headers.authorization;
    if (!authorization) return { type: 'error', message: 'Unauthorized' };
    const token = authorization.replace('Bearer ', '');
    const payload = await safeVerifyToken(jwt, token);
    if (!payload) return { type: 'error', message: 'Invalid token' };

    const page = parseInt(query.page || '1');
    const limit = parseInt(query.limit || '20');
    const offset = (page - 1) * limit;
    const status = query.status !== undefined ? parseInt(query.status) : undefined;

    try {
      let baseQuery = db.select().from(depositRequests);
      
      if (status !== undefined) {
        baseQuery = baseQuery.where(eq(depositRequests.status, status)) as any;
      }
      
      const records = await baseQuery
        .orderBy(desc(depositRequests.createdAt))
        .limit(limit)
        .offset(offset);

      const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(depositRequests);

      return {
        type: 'ok',
        data: {
          list: records.map(r => ({
            id: r.id,
            userId: r.userId,
            uid: r.uid,
            amount: r.amount,
            currency: r.currency,
            chain: r.chain,
            txHash: r.txHash,
            depositAddress: r.depositAddress,
            proofImage: r.proofImage,
            status: r.status,
            reviewNote: r.reviewNote,
            reviewedAt: r.reviewedAt,
            createdAt: r.createdAt,
          })),
          total: Number(count),
          page,
          limit,
        }
      };
    } catch (error) {
      console.error('[Admin] Failed to fetch deposit requests:', error);
      return { type: 'error', message: 'Failed to fetch deposit requests' };
    }
  })

  // 审核充值申请
  .post('/deposit-review', async ({ body, headers, jwt }) => {
    const authorization = headers.authorization;
    if (!authorization) return { type: 'error', message: 'Unauthorized' };
    const token = authorization.replace('Bearer ', '');
    const payload = await safeVerifyToken(jwt, token);
    if (!payload) return { type: 'error', message: 'Invalid token' };

    const { id, action, note } = body as { id: number; action: 'approve' | 'reject'; note?: string };

    if (!id || !action) {
      return { type: 'error', message: 'Missing required fields' };
    }

    try {
      // 获取充值申请
      const [request] = await db.select().from(depositRequests).where(eq(depositRequests.id, id)).limit(1);
      if (!request) {
        return { type: 'error', message: 'Deposit request not found' };
      }

      if (request.status !== 0) {
        return { type: 'error', message: 'Request already processed' };
      }

      const newStatus = action === 'approve' ? 1 : 2;

      // 更新充值申请状态
      await db.update(depositRequests)
        .set({
          status: newStatus,
          reviewedBy: payload.agentId,
          reviewNote: note || null,
          reviewedAt: new Date(),
        })
        .where(eq(depositRequests.id, id));

      // 如果通过，增加用户余额
      if (action === 'approve') {
        const amount = parseFloat(request.amount as string);
        
        // 获取用户钱包
        const [wallet] = await db.select().from(usersWallet)
          .where(eq(usersWallet.userId, request.userId))
          .limit(1);

        if (wallet) {
          const newBalance = parseFloat(wallet.legalBalance as string) + amount;
          await db.update(usersWallet)
            .set({ legalBalance: newBalance.toString() })
            .where(eq(usersWallet.id, wallet.id));
          
          console.log(`[Admin] Deposit approved: userId=${request.userId}, amount=${amount}, newBalance=${newBalance}`);
        } else {
          // 如果没有钱包记录，创建一个
          await db.insert(usersWallet).values({
            userId: request.userId,
            currency: 3, // USDT
            legalBalance: amount.toString(),
            createTime: Math.floor(Date.now() / 1000),
          });
          console.log(`[Admin] Deposit approved (new wallet): userId=${request.userId}, amount=${amount}`);
        }
      }

      await logAction(payload.agentId, action === 'approve' ? 'APPROVE_DEPOSIT' : 'REJECT_DEPOSIT', 'deposit', id, undefined, note);

      return { type: 'ok', message: action === 'approve' ? '充值已通过' : '充值已拒绝' };
    } catch (error) {
      console.error('[Admin] Failed to review deposit:', error);
      return { type: 'error', message: 'Failed to review deposit' };
    }
  });
