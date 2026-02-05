/**
 * Binance 公开 K 线 API，无需 API Key
 * https://api.binance.com/api/v3/klines
 */

export interface OHLCBar {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

/** 通过后端代理避免 CORS 问题 */
const BINANCE_KLINES = '/api/binance/klines';

/** 我方周期 -> Binance interval，1y 用 1d + limit=365 */
const INTERVAL_MAP: Record<string, string> = {
  '1m': '1m',
  '15m': '15m',
  '4h': '4h',
  '1d': '1d',
  '1w': '1w',
  '1M': '1M',
  '1y': '1d',
};

/** 各周期请求根数 */
const LIMIT_MAP: Record<string, number> = {
  '1m': 500,
  '15m': 500,
  '4h': 500,
  '1d': 365,
  '1w': 104,
  '1M': 24,
  '1y': 365,
};

function mapInterval(interval: string): { binanceInterval: string; limit: number } {
  const raw = (interval || '1m').toLowerCase();
  const key = raw === '1m' ? '1m' : interval === '1M' ? '1M' : raw;
  const binanceInterval = INTERVAL_MAP[key] ?? '1m';
  const limit = LIMIT_MAP[key] ?? 500;
  return { binanceInterval, limit };
}

/**
 * 请求 Binance K 线
 * @param symbol 基础币种，如 BTC、ETH（会拼成 BTCUSDT）
 * @param interval 周期：1m, 15m, 4h, 1d, 1w, 1M, 1y
 */
export async function fetchBinanceKlines(
  symbol: string,
  interval: string,
  limit?: number
): Promise<OHLCBar[]> {
  const base = (symbol || 'BTC').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const sym = base.endsWith('USDT') ? base : `${base}USDT`;
  const { binanceInterval, limit: defaultLimit } = mapInterval(interval);
  const l = limit ?? defaultLimit;
  const url = `${BINANCE_KLINES}?symbol=${sym}&interval=${binanceInterval}&limit=${l}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Binance klines ${res.status}: ${res.statusText}`);
  }
  const data = await res.json();
  if (!Array.isArray(data)) {
    throw new Error('Invalid Binance klines response');
  }
  const bars: OHLCBar[] = data.map((c: (string | number)[]) => {
    const openTime = Number(c[0]);
    const timeSec = Math.floor(openTime / 1000);
    return {
      time: timeSec,
      open: parseFloat(String(c[1])),
      high: parseFloat(String(c[2])),
      low: parseFloat(String(c[3])),
      close: parseFloat(String(c[4])),
      volume: parseFloat(String(c[5])),
    };
  });
  return bars.sort((a, b) => a.time - b.time);
}
