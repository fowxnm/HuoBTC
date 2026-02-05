/**
 * 外汇/汇率 - Exchangerate-API (v6)
 * 环境变量: FX_API_KEY
 * 每 30 分钟由 market-worker 更新并写入 Redis
 */
const BASE = 'https://v6.exchangerate-api.com/v6';

export interface ForexRatesPayload {
  result: string;
  base_code: string;
  conversion_rates: Record<string, number>;
  time_last_update_unix?: number;
}

/** 1 USD = X 该币种；前端展示 XXX/USDT 时用 1/rate 得到「1 该币 = ? USD」 */
export async function fetchExchangerateRates(): Promise<Record<string, number> | null> {
  const key = process.env.FX_API_KEY?.trim();
  if (!key) {
    console.warn('[ExchangerateAPI] FX_API_KEY not set');
    return null;
  }
  try {
    const url = `${BASE}/${key}/latest/USD`;
    const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) {
      console.warn('[ExchangerateAPI] HTTP', res.status);
      return null;
    }
    const data = (await res.json()) as ForexRatesPayload;
    if (data.result !== 'success' || !data.conversion_rates) {
      console.warn('[ExchangerateAPI] Invalid response');
      return null;
    }
    return data.conversion_rates;
  } catch (e) {
    console.warn('[ExchangerateAPI]', (e as Error).message);
    return null;
  }
}

/** 将 API 的「1 USD = X 该币」转为「1 该币 = ? USD」供行情展示 */
export function rateToUsdPrice(rates: Record<string, number> | null, currency: string): number | null {
  if (!rates || typeof rates[currency] !== 'number') return null;
  if (currency === 'USD') return 1;
  const r = rates[currency];
  if (r === 0) return null;
  return 1 / r;
}
