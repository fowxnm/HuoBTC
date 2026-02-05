/**
 * 美股 / 大宗商品 - Financial Modeling Prep (FMP)
 * 环境变量: STOCK_API_KEY
 * 每 5 分钟由 market-worker 拉取 XAU(黄金)、AAPL、TSLA 等并写入 Redis
 */
const BASE = 'https://financialmodelingprep.com/api/v3';

export interface FMPQuoteItem {
  symbol: string;
  price: number;
  changesPercentage?: number;
  change?: number;
  dayHigh?: number;
  dayLow?: number;
  volume?: number;
  name?: string;
}

export interface FMPQuotePayload {
  symbol: string;
  price: number;
  changesPercentage: number;
  change: number;
  dayHigh: number;
  dayLow: number;
  volume: number;
  name?: string;
}

/** 股票 quote：AAPL, TSLA 等 */
export async function fetchFMPStockQuotes(symbols: string[]): Promise<FMPQuoteItem[]> {
  const key = process.env.STOCK_API_KEY?.trim();
  if (!key) {
    console.warn('[FMP] STOCK_API_KEY not set');
    return [];
  }
  if (symbols.length === 0) return [];
  const list = symbols.join(',');
  try {
    const url = `${BASE}/quote/${list}?apikey=${key}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) {
      console.warn('[FMP] HTTP', res.status);
      return [];
    }
    const data = (await res.json()) as FMPQuotePayload[];
    if (!Array.isArray(data)) return [];
    return data.map((q) => ({
      symbol: q.symbol,
      price: Number(q.price) || 0,
      changesPercentage: Number(q.changesPercentage) ?? 0,
      change: Number(q.change) ?? 0,
      dayHigh: Number(q.dayHigh) ?? q.price,
      dayLow: Number(q.dayLow) ?? q.price,
      volume: Number(q.volume) ?? 0,
      name: q.name,
    }));
  } catch (e) {
    console.warn('[FMP]', (e as Error).message);
    return [];
  }
}

/** 大宗商品 quote：黄金等，FMP 使用 symbol 如 GC=F (黄金期货) 或 XAUUSD */
const COMMODITY_SYMBOLS = ['GC=F', 'XAUUSD']; // GC=F = Comex 黄金

export async function fetchFMPCommodityQuotes(): Promise<FMPQuoteItem[]> {
  const key = process.env.STOCK_API_KEY?.trim();
  if (!key) return [];
  try {
    const list = COMMODITY_SYMBOLS.join(',');
    const url = `${BASE}/quote/${list}?apikey=${key}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) return [];
    const data = (await res.json()) as FMPQuotePayload[];
    if (!Array.isArray(data)) return [];
    return data.map((q) => ({
      symbol: q.symbol === 'GC=F' ? 'XAU' : q.symbol,
      price: Number(q.price) || 0,
      changesPercentage: Number(q.changesPercentage) ?? 0,
      change: Number(q.change) ?? 0,
      dayHigh: Number(q.dayHigh) ?? q.price,
      dayLow: Number(q.dayLow) ?? q.price,
      volume: Number(q.volume) ?? 0,
      name: q.name,
    }));
  } catch (e) {
    console.warn('[FMP] Commodity', (e as Error).message);
    return [];
  }
}
