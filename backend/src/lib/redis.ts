/**
 * Redis 客户端单例 - 用于行情缓存与 market-worker / ws/market
 */
import Redis from 'ioredis';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

let client: Redis | null = null;

export function getRedis(): Redis | null {
  if (client) return client;
  try {
    client = new Redis(REDIS_URL, {
      maxRetriesPerRequest: 3,
      retryStrategy: (times) => (times > 3 ? null : Math.min(times * 200, 2000)),
      lazyConnect: true,
    });
    client.on('error', (err) => console.warn('[Redis]', err.message));
    return client;
  } catch (e) {
    console.warn('[Redis] Failed to create client:', (e as Error).message);
    return null;
  }
}

export async function redisGet<T = string>(key: string): Promise<T | null> {
  const r = getRedis();
  if (!r) return null;
  try {
    const raw = await r.get(key);
    if (raw == null) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return raw as T;
    }
  } catch (e) {
    console.warn('[Redis] get failed:', key, (e as Error).message);
    return null;
  }
}

export async function redisSet(key: string, value: string | object, ttlSeconds?: number): Promise<void> {
  const r = getRedis();
  if (!r) return;
  try {
    const str = typeof value === 'string' ? value : JSON.stringify(value);
    if (ttlSeconds != null && ttlSeconds > 0) {
      await r.setex(key, ttlSeconds, str);
    } else {
      await r.set(key, str);
    }
  } catch (e) {
    console.warn('[Redis] set failed:', key, (e as Error).message);
  }
}

/** Redis key 前缀；加密货币用原生币名（BTC、ETH），便于前端直接使用 */
export const REDIS_KEYS = {
  FOREX: 'market:forex',
  STOCK: (symbol: string) => `market:stock:${symbol}`,
  COMMODITY: (symbol: string) => `market:commodity:${symbol}`,
  /** 加密货币 24h 行情，key 为原生币名 BTC/ETH，非 BTCUSDT */
  CRYPTO: (symbol: string) => `market:crypto:${symbol}`,
  QUOTATION_SNAPSHOT: 'market:quotation_snapshot',
} as const;
