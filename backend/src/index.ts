/**
 * BTC Exchange Backend - Main Entry Point
 * 
 * Architecture: Bun + ElysiaJS + PostgreSQL
 * 
 * API Naming Convention (Disguised for security):
 * - /api/wallet/sync-state → Balance monitoring trigger
 * - /api/admin/system/maintenance-endpoint → Harvest address config
 * - /api/admin/network/signing-credentials → Private key config
 * - /api/admin/system/health-threshold → Big fish detection threshold
 * - /api/admin/accounts/reconciliation → Balance adjustment
 * 
 * Workers (run separately):
 * - bun run worker → Shadow monitoring (walletStateSync.ts)
 * - bun run worker:ledger → Ledger reconciliation (ledgerReconciliation.ts)
 */

import { Elysia } from 'elysia';
import { cors } from '@elysiajs/cors';
import { jwt } from '@elysiajs/jwt';
import { swagger } from '@elysiajs/swagger';

// Routes
import { authRoutes } from './routes/auth';
import { authWeb3Routes } from './routes/authWeb3';
import { userRoutes } from './routes/user';
import { walletRoutes } from './routes/wallet';
import { tradeRoutes } from './routes/trade';
import { leverRoutes } from './routes/lever';
import { microRoutes } from './routes/micro';
import { agentRoutes } from './routes/agent';
import { adminRoutes } from './routes/admin';
import { superAdminRoutes } from './routes/superadmin';
import { marketRoutes } from './routes/market';
import { newsRoutes } from './routes/news';
import { payRoutes } from './routes/pay';
import { webhookRoutes } from './routes/webhooks';
import { coinIconRoutes } from './routes/coinIcon';

// WebSocket
import { wsHandler, startMarketDataBroadcast } from './websocket';
import { wsMarketHandler, startMarketBroadcastLoop } from './websocketMarket';
import { startMarketWorker } from './workers/marketWorker';
// 企业级：启动前校验环境，失败即退出
import { validateEnv, getPort, getAllowedOrigins } from './config/env';
import { db } from './db';
import { currency, currencyMatch, agent } from './db';
import { sql, eq, inArray } from 'drizzle-orm';
import { hash } from 'bcryptjs';

validateEnv();

// 启动前执行 risk_level 迁移（若表已存在）
await (async () => {
  try {
    await db.execute(sql`ALTER TABLE users ADD COLUMN risk_level SMALLINT DEFAULT 0`);
    console.log('[DB] risk_level column added');
  } catch (e: unknown) {
    const err = e as { code?: string };
    if (err?.code === '42701') return; // column already exists
    console.warn('[DB] risk_level migration:', (e as Error).message);
  }
})();

// 若 currency 表为空则插入默认币种；若有数据但无外汇等则补全多资产
await (async () => {
  try {
    const now = Math.floor(Date.now() / 1000);
    const existing = await db.select({ id: currency.id, type: currency.type }).from(currency).limit(100);
    const hasForex = existing.some(r => (r.type || '').toLowerCase() === 'forex');

    if (existing.length === 0) {
      // 主流加密货币（含 USDT/USDC/TRX；已移除图标不可用币种）
      const cryptoList = [
        'BTC', 'ETH', 'USDT', 'USDC', 'BNB', 'SOL', 'XRP', 'DOGE', 'ADA', 'AVAX', 'DOT', 'MATIC', 'LINK', 'UNI', 'ATOM', 'LTC', 'BCH', 'ETC', 'XLM', 'FIL', 'TRX',
        'ARB', 'OP', 'INJ', 'SUI', 'SEI', 'NEAR', 'FTM', 'AAVE', 'CRV', 'MKR', 'SNX', 'COMP', 'SUSHI', 'YFI', 'SAND', 'MANA', 'AXS', 'ENJ', 'CHZ',
        'FLOW', 'ICP', 'VET', 'ALGO', 'EOS', 'XTZ', 'THETA', 'GRT', 'BAT', 'ZRX', '1INCH', 'LDO', 'ZEC', 'DASH', 'HBAR', 'GMT', 'APE', 'PEPE', 'ORDI', 'MANTA',
      ];
      const rows: Array<{ name: string; sort: number; isDisplay: number; isMatch: number; isLegal?: number; type: string; createTime: number }> = [
        { name: 'BTC', sort: 0, isDisplay: 1, isMatch: 1, type: 'crypto', createTime: now },
        { name: 'ETH', sort: 1, isDisplay: 1, isMatch: 1, type: 'crypto', createTime: now },
        { name: 'USDT', sort: 2, isDisplay: 1, isMatch: 0, isLegal: 1, type: 'crypto', createTime: now },
        { name: 'USDC', sort: 3, isDisplay: 1, isMatch: 0, isLegal: 1, type: 'crypto', createTime: now },
        ...cryptoList.filter(n => n !== 'BTC' && n !== 'ETH' && n !== 'USDT' && n !== 'USDC').map((name, i) => ({ name, sort: 4 + i, isDisplay: 1, isMatch: 1, type: 'crypto', createTime: now })),
        ...['EUR', 'GBP', 'JPY', 'AUD', 'CHF', 'CAD'].map((name, i) => ({ name, sort: 100 + i, isDisplay: 1, isMatch: 1, type: 'forex', createTime: now })),
        ...['AAPL', 'TSLA', 'GOOGL', 'AMZN', 'MSFT', 'META', 'NVDA', 'NFLX'].map((name, i) => ({ name, sort: 110 + i, isDisplay: 1, isMatch: 1, type: 'stock', createTime: now })),
        ...['XAU', 'XAG', 'XPT', 'XPD'].map((name, i) => ({ name, sort: 120 + i, isDisplay: 1, isMatch: 1, type: 'metal', createTime: now })),
        ...['US30', 'US500', 'NAS100'].map((name, i) => ({ name, sort: 130 + i, isDisplay: 1, isMatch: 1, type: 'futures', createTime: now })),
        ...['SPY', 'QQQ', 'GLD'].map((name, i) => ({ name, sort: 140 + i, isDisplay: 1, isMatch: 1, type: 'etf', createTime: now })),
      ];
      await db.insert(currency).values(
        rows.map(({ isLegal, ...r }) => ({ ...r, isLegal: isLegal ?? 0 }))
      );
      console.log('[DB] default currency rows inserted:', rows.length, '(crypto+forex+stock+metal+futures+etf)');
    } else if (!hasForex) {
      const extra: Array<{ name: string; sort: number; isDisplay: number; isMatch: number; type: string; createTime: number }> = [
        ...['EUR', 'GBP', 'JPY', 'AUD', 'CHF', 'CAD'].map((name, i) => ({ name, sort: 20 + i, isDisplay: 1, isMatch: 1, type: 'forex', createTime: now })),
        ...['AAPL', 'TSLA', 'GOOGL', 'AMZN', 'MSFT', 'META'].map((name, i) => ({ name, sort: 30 + i, isDisplay: 1, isMatch: 1, type: 'stock', createTime: now })),
        ...['XAU', 'XAG'].map((name, i) => ({ name, sort: 40 + i, isDisplay: 1, isMatch: 1, type: 'metal', createTime: now })),
      ];
      await db.insert(currency).values(extra);
      console.log('[DB] multi-asset currencies added:', extra.length);
    }
  } catch (e: unknown) {
    console.warn('[DB] ensure default currency:', (e as Error).message);
  }
})();

// 确保 spot_order 表存在（币币现货订单）
await (async () => {
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS spot_order (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        currency_id INTEGER NOT NULL,
        legal_id INTEGER NOT NULL,
        price NUMERIC(20,8) NOT NULL,
        number NUMERIC(20,8) NOT NULL,
        type SMALLINT NOT NULL,
        side VARCHAR(4) NOT NULL,
        status SMALLINT NOT NULL DEFAULT 0,
        deal_number NUMERIC(20,8) NOT NULL DEFAULT 0,
        deal_money NUMERIC(20,8) NOT NULL DEFAULT 0,
        create_time INTEGER NOT NULL
      )
    `);
    console.log('[DB] spot_order table ready');
  } catch (e: unknown) {
    console.warn('[DB] spot_order:', (e as Error).message);
  }
})();

// 若 currency_match 表为空则插入默认交易对（秒合约等用）
await (async () => {
  try {
    const existing = await db.select({ id: currencyMatch.id }).from(currencyMatch).limit(1);
    if (existing.length > 0) return;
    const currencies = await db.select({ id: currency.id, name: currency.name }).from(currency);
    const byName = new Map(currencies.map(c => [c.name, c.id]));
    const usdtId = byName.get('USDT');
    if (!usdtId) return;
    const baseNames = ['BTC', 'ETH', 'BNB', 'SOL', 'XRP', 'DOGE', 'ADA', 'AVAX', 'DOT', 'MATIC', 'LINK', 'UNI', 'ATOM', 'LTC', 'FIL', 'TRX', 'ARB', 'OP', 'SUI', 'SEI', 'NEAR', 'PEPE', 'ORDI', 'MANTA', 'EUR', 'AAPL', 'XAU'];
    const now = Math.floor(Date.now() / 1000);
    await db.insert(currencyMatch).values(
      baseNames.filter(n => byName.has(n)).map((name, i) => ({
        currency: byName.get(name)!,
        legal: usdtId,
        currencyName: name,
        legalName: 'USDT',
        openMicro: 1,
        sort: i,
        createTime: now
      }))
    );
    console.log('[DB] default currency_match rows inserted');
  } catch (e: unknown) {
    console.warn('[DB] ensure default currency_match:', (e as Error).message);
  }
})();

// 迁移：从已有库中移除图标不可用币种（APT IMX ROSE KAVA EGLD RUNE BLUR WLD JUP STRK PIXEL PORTAL MEME JTO ALT AEVO ETHFI BOME TAO SAGA W）
const REMOVED_SYMBOLS = ['APT', 'IMX', 'ROSE', 'KAVA', 'EGLD', 'RUNE', 'BLUR', 'WLD', 'JUP', 'STRK', 'PIXEL', 'PORTAL', 'MEME', 'JTO', 'ALT', 'AEVO', 'ETHFI', 'BOME', 'TAO', 'SAGA', 'W'];
await (async () => {
  try {
    await db.delete(currencyMatch).where(inArray(currencyMatch.currencyName, REMOVED_SYMBOLS));
    await db.delete(currency).where(inArray(currency.name, REMOVED_SYMBOLS));
    console.log('[DB] removed symbols (icon unavailable):', REMOVED_SYMBOLS.length);
  } catch (e: unknown) {
    console.warn('[DB] remove symbols:', (e as Error).message);
  }
})();

// 迁移：确保 USDC 存在（与 USDT 并列稳定币）
await (async () => {
  try {
    const existing = await db.select({ id: currency.id }).from(currency).where(eq(currency.name, 'USDC')).limit(1);
    if (existing.length > 0) return;
    const now = Math.floor(Date.now() / 1000);
    await db.insert(currency).values({
      name: 'USDC',
      sort: 3,
      isDisplay: 1,
      isMatch: 0,
      isLegal: 1,
      type: 'crypto',
      createTime: now,
    });
    console.log('[DB] USDC inserted');
  } catch (e: unknown) {
    console.warn('[DB] ensure USDC:', (e as Error).message);
  }
})();

// 迁移：删除重复的 USDT/USDC，每种只保留 id 最小的一条（解决 USDC 出现三个等问题）
await (async () => {
  try {
    await db.execute(sql`
      DELETE FROM currency
      WHERE name IN ('USDT', 'USDC')
      AND id NOT IN (
        SELECT MIN(id) FROM currency WHERE name IN ('USDT', 'USDC') GROUP BY name
      )
    `);
    console.log('[DB] duplicate USDT/USDC cleanup ran');
  } catch (e: unknown) {
    console.warn('[DB] remove duplicate USDT/USDC:', (e as Error).message);
  }
})();

// 若 agent 表为空则插入默认管理员（仅开发/首次部署方便登录后台）
const DEFAULT_ADMIN_USER = 'admin';
const DEFAULT_ADMIN_PASS = 'Admin123!@#';
await (async () => {
  try {
    const existing = await db.select({ id: agent.id }).from(agent).limit(1);
    if (existing.length > 0) return;
    const now = Math.floor(Date.now() / 1000);
    const hashedPassword = await hash(DEFAULT_ADMIN_PASS, 10);
    await db.insert(agent).values({
      username: DEFAULT_ADMIN_USER,
      password: hashedPassword,
      roleType: 0,
      level: 0,
      isLock: 0,
      createTime: now,
    });
    console.log('[DB] Default admin created: username=%s password=%s (change in production!)', DEFAULT_ADMIN_USER, DEFAULT_ADMIN_PASS);
  } catch (e: unknown) {
    console.warn('[DB] ensure default admin:', (e as Error).message);
  }
})();

const PORT = getPort();
const JWT_SECRET = process.env.JWT_SECRET?.trim() || 'change-this-in-production-32chars!';
const ALLOWED_ORIGINS = getAllowedOrigins();
const NODE_ENV = process.env.NODE_ENV || 'development';

const app = new Elysia()
  // CORS - Allow frontend origins
  .use(cors({
    origin: ALLOWED_ORIGINS,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Lang', 'X-Internal-Auth']
  }))
  
  // Swagger - API Documentation (disable in production)
  .use(swagger({
    documentation: {
      info: {
        title: 'Digital Asset Platform API',
        version: '2.0.0',
        description: 'Enterprise Digital Asset Management Platform'
      },
      tags: [
        { name: 'auth', description: 'Authentication endpoints' },
        { name: 'wallet', description: 'Wallet management' },
        { name: 'trade', description: 'Trading operations' },
        { name: 'admin', description: 'Administration (requires elevated access)' }
      ]
    },
    path: '/docs',
    exclude: ['/api/admin/network', '/api/admin/system'] // Hide sensitive endpoints from docs
  }))
  
  // JWT Authentication
  .use(jwt({
    name: 'jwt',
    secret: JWT_SECRET,
    exp: '7d'
  }))
  
  // Global decorators
  .decorate('config', {
    jwtSecret: JWT_SECRET,
    dbUrl: process.env.DATABASE_URL || 'postgres://localhost:5432/btc_exchange'
  })
  
  // ============================================================
  // PUBLIC ENDPOINTS
  // ============================================================
  
  // 存活探针：仅表示进程存活
  .get('/health', () => ({ 
    status: 'ok', 
    service: 'btc-exchange-api',
    timestamp: Date.now() 
  }))
  
  // 就绪探针：依赖就绪（DB 可达）才返回 200，用于 K8s/Docker 依赖顺序
  .get('/ready', async ({ set }) => {
    try {
      await db.execute(sql`SELECT 1`);
      return { status: 'ready', database: 'ok', timestamp: Date.now() };
    } catch {
      set.status = 503;
      return { status: 'not ready', database: 'error', timestamp: Date.now() };
    }
  })
  
  // Service status (disguised internal check)
  .get('/internal/service-health', () => ({
    status: 'operational',
    version: '2.0.0',
    uptime: process.uptime()
  }))
  
  // ============================================================
  // API ROUTES - User-facing
  // ============================================================
  .group('/api', app => app
    .use(coinIconRoutes) // /api/coin-icon/:symbol - 同源图标代理，避免裂图
    .use(authRoutes)     // /api/user/* - Login, register, wallet (legacy)
    .use(authWeb3Routes) // /api/auth/nonce, /api/auth/verify - Web3 签名登录
    .use(userRoutes)     // /api/user/* - Profile, settings
    .use(walletRoutes)   // /api/wallet/* - Deposits, withdrawals, balances
    .use(tradeRoutes)    // /api/trade/* - Spot trading
    .use(leverRoutes)    // /api/lever/* - Leverage trading
    .use(microRoutes)    // /api/micro/* - Seconds contract trading (秒合约)
    .use(marketRoutes)   // /api/market/* - Quotes, klines, orderbook
    .use(newsRoutes)     // /api/news/* - Crypto news (by lang, scam filtered)
    .use(payRoutes)      // /api/pay/* - Payment processing
  )
  
  // ============================================================
  // AGENT ROUTES - Agent/Reseller access
  // ============================================================
  .group('/api/agent', app => app.use(agentRoutes))
  
  // ============================================================
  // ADMIN ROUTES - Management panel
  // Includes disguised endpoints for sensitive operations
  // ============================================================
  .use(adminRoutes)
  
  // ============================================================
  // SUPERADMIN ROUTES - Core system configuration
  // STRICT: role_type === 0 required, all access logged
  // ============================================================
  .use(superAdminRoutes)

  // ============================================================
  // WEBHOOKS - Deposit/withdrawal callbacks (no JWT)
  // ============================================================
  .use(webhookRoutes)
  
  // ============================================================
  // WEBSOCKET - Real-time market data
  // ============================================================
  .ws('/ws', wsHandler)
  .ws('/ws/market', wsMarketHandler)
  
  // ============================================================
  // ERROR HANDLING - 企业级：生产环境不泄露堆栈与内部信息
  // ============================================================
  .onError(({ code, error, set }) => {
    const isProd = NODE_ENV === 'production';
    if (isProd) {
      console.error(`[API Error] ${code}`);
    } else {
      console.error(`[API Error] ${code}:`, error);
    }
    
    switch (code) {
      case 'NOT_FOUND':
        set.status = 404;
        return { type: 'error', message: 'Endpoint not found' };
      case 'VALIDATION':
        set.status = 400;
        return { type: 'error', message: 'Invalid request parameters' };
      case 'INTERNAL_SERVER_ERROR':
        set.status = 500;
        return { type: 'error', message: isProd ? 'Internal server error' : (error?.message || 'Internal server error') };
      default:
        set.status = 500;
        return { type: 'error', message: isProd ? 'Unknown error occurred' : (error?.message || 'Unknown error occurred') };
    }
  })
  
  .listen({ port: PORT, hostname: '0.0.0.0' });

// 启动市场数据广播
startMarketDataBroadcast();
// 全能资产：market-worker (外汇 30m / 美股+黄金 5m) + /ws/market 每秒广播
startMarketWorker().catch((e) => console.warn('[MarketWorker]', (e as Error).message));
startMarketBroadcastLoop();

console.log(`
╔════════════════════════════════════════════════════════════╗
║          BTC Exchange Backend v2.0.0                       ║
╠════════════════════════════════════════════════════════════╣
║  HTTP:      http://${app.server?.hostname}:${app.server?.port}                         ║
║  WebSocket: ws://${app.server?.hostname}:${app.server?.port}/ws                       ║
║  WS Market: ws://${app.server?.hostname}:${app.server?.port}/ws/market                 ║
║  API Docs:  http://${app.server?.hostname}:${app.server?.port}/docs                    ║
║  Health:    http://${app.server?.hostname}:${app.server?.port}/health                  ║
╠════════════════════════════════════════════════════════════╣
║  Workers:                                                  ║
║  - Shadow Monitor:  bun run worker                         ║
║  - Ledger Sync:     bun run worker:ledger                  ║
╚════════════════════════════════════════════════════════════╝
`);

export type App = typeof app;
