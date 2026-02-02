/**
 * 外汇实时汇率 - Frankfurter 免费开源 API（无 key、无限制）
 * 数据来源：欧洲央行等机构，每日约 16:00 CET 更新
 * https://www.frankfurter.app/
 */

const FRANKFURTER_URL = 'https://api.frankfurter.dev/v1/latest';

export interface ForexRates {
  date: string;
  base: string;
  rates: Record<string, number>;
}

let cache: { data: ForexRates; ts: number } | null = null;
const CACHE_MS = 60 * 60 * 1000; // 1 小时

/**
 * 获取 USD 对多币种汇率（base=USD，rates 为「1 USD = X 该币」）
 * 用于展示 XXX/USDT 时：1 EUR = 1/rates.EUR USD
 */
export async function fetchForexRates(symbols: string[]): Promise<ForexRates | null> {
  if (cache && Date.now() - cache.ts < CACHE_MS) return cache.data;
  const to = symbols.filter(s => s !== 'USD').join(',');
  if (!to) return null;
  try {
    const url = `${FRANKFURTER_URL}?from=USD&to=${to}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) return null;
    const data = (await res.json()) as ForexRates;
    cache = { data, ts: Date.now() };
    return data;
  } catch (e) {
    console.warn('[Frankfurter] fetch failed:', (e as Error).message);
    if (cache) return cache.data;
    return null;
  }
}

/**
 * 将 Frankfurter 汇率转为 XXX/USD 价格（即 1 XXX = ? USD）
 * base=USD 时 rates.EUR = 欧元 per 1 USD，故 EUR/USD = 1/rates.EUR
 */
export function forexRateToUsdPrice(rates: ForexRates | null, currency: string): number | null {
  if (!rates?.rates) return null;
  if (currency === 'USD') return 1;
  const r = rates.rates[currency];
  if (r == null || r === 0) return null;
  return 1 / r;
}
