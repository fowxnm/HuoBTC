/**
 * WebSocket /ws/market - 每秒从 Redis 读取行情并广播
 * 微幅波动：±0.005% 随机跳动，保持 K 线实时活跃感
 */
import type { ServerWebSocket } from 'bun';
import { redisGet, REDIS_KEYS } from './lib/redis';

const DRIFT_PERCENT = 0.005; // ±0.005%
const BROADCAST_INTERVAL_MS = 1000;

interface WSMarketClient {
  subscriptions: Set<string>;
}

const marketClients = new Map<ServerWebSocket<WSMarketClient>, WSMarketClient>();

function applyDrift(price: number): number {
  if (price <= 0) return price;
  const pct = (Math.random() * 2 - 1) * DRIFT_PERCENT;
  return price * (1 + pct / 100);
}

export const wsMarketHandler = {
  open(ws: ServerWebSocket<WSMarketClient>) {
    marketClients.set(ws, { subscriptions: new Set(['all']) });
    ws.send(JSON.stringify({ type: 'welcome', channel: 'market', ts: Date.now() }));
  },

  message(ws: ServerWebSocket<WSMarketClient>, message: string | Buffer) {
    try {
      const msg = JSON.parse(message.toString()) as { type: string; subscribe?: string[] };
      const data = marketClients.get(ws);
      if (!data) return;
      if (msg.type === 'subscribe' && Array.isArray(msg.subscribe)) {
        msg.subscribe.forEach((s) => data.subscriptions.add(s));
      }
    } catch (_) {}
  },

  close(ws: ServerWebSocket<WSMarketClient>) {
    marketClients.delete(ws);
  },

  error(ws: ServerWebSocket<WSMarketClient>, err: Error) {
    marketClients.delete(ws);
  },
};

/** 每秒从 Redis 读取并广播（带 ±0.005% 漂移） */
export function startMarketBroadcastLoop() {
  setInterval(async () => {
    if (marketClients.size === 0) return;

    const [forex, aapl, tsla, xau] = await Promise.all([
      redisGet<Record<string, number>>(REDIS_KEYS.FOREX),
      redisGet<{ price: number; change: number; high: number; low: number; volume: number }>(REDIS_KEYS.STOCK('AAPL')),
      redisGet<{ price: number; change: number; high: number; low: number; volume: number }>(REDIS_KEYS.STOCK('TSLA')),
      redisGet<{ price: number; change: number; high: number; low: number; volume: number }>(REDIS_KEYS.COMMODITY('XAU')),
    ]);

    const payload: Record<string, unknown> = {
      type: 'market_snapshot',
      ts: Date.now(),
      forex: forex ? { rates: forex, _drift: true } : null,
      stocks: {
        AAPL: aapl ? { ...aapl, price: applyDrift(aapl.price) } : null,
        TSLA: tsla ? { ...tsla, price: applyDrift(tsla.price) } : null,
      },
      commodities: {
        XAU: xau ? { ...xau, price: applyDrift(xau.price) } : null,
      },
    };

    const msg = JSON.stringify(payload);
    marketClients.forEach((_, ws) => {
      try {
        if (ws.readyState === 1) ws.send(msg);
      } catch (_) {}
    });
  }, BROADCAST_INTERVAL_MS);

  console.log('[WS/market] Broadcast loop started, interval', BROADCAST_INTERVAL_MS, 'ms, drift ±' + DRIFT_PERCENT + '%');
}
