/**
 * Binance 公开 REST API：深度、成交、交易所信息（CORS 使用 data-api 域名）
 */

const BASE = 'https://data-api.binance.vision/api/v3';

function symbolToBinance(symbol: string): string {
  const s = (symbol || 'BTC').toUpperCase().replace(/[^A-Z0-9]/g, '');
  return s.endsWith('USDT') ? s : `${s}USDT`;
}

export interface DepthLevel {
  price: number;
  amount: number;
}

export interface DepthSnapshot {
  bids: DepthLevel[];
  asks: DepthLevel[];
}

/** GET /depth?symbol=xxx&limit=100 */
export async function fetchBinanceDepth(symbol: string, limit: number = 100): Promise<DepthSnapshot> {
  const sym = symbolToBinance(symbol);
  const res = await fetch(`${BASE}/depth?symbol=${sym}&limit=${limit}`);
  if (!res.ok) throw new Error(`Binance depth ${res.status}`);
  const data = await res.json();
  const bids = (data.bids || []).slice(0, limit).map((b: [string, string]) => ({
    price: parseFloat(b[0]),
    amount: parseFloat(b[1]),
  }));
  const asks = (data.asks || []).slice(0, limit).map((a: [string, string]) => ({
    price: parseFloat(a[0]),
    amount: parseFloat(a[1]),
  }));
  return { bids, asks };
}

export interface TradeItem {
  id: number;
  price: number;
  amount: number;
  side: 'buy' | 'sell';
  timestamp: number;
}

/** GET /trades?symbol=xxx&limit=500 */
export async function fetchBinanceTrades(symbol: string, limit: number = 100): Promise<TradeItem[]> {
  const sym = symbolToBinance(symbol);
  const res = await fetch(`${BASE}/trades?symbol=${sym}&limit=${limit}`);
  if (!res.ok) throw new Error(`Binance trades ${res.status}`);
  const data = await res.json();
  if (!Array.isArray(data)) return [];
  return data.map((t: any) => ({
    id: t.id,
    price: parseFloat(t.price),
    amount: parseFloat(t.qty),
    side: t.maker ? (t.maker ? 'sell' : 'buy') : (t.isBuyerMaker ? 'sell' : 'buy'),
    timestamp: t.time,
  }));
}

/** 交易所信息：获取所有 USDT 交易对，用于过滤资产列表 */
export interface BinanceSymbolInfo {
  symbol: string;
  baseAsset: string;
  quoteAsset: string;
  status: string;
}

let cachedSymbols: Set<string> | null = null;

export async function fetchBinanceUsdtSymbols(): Promise<Set<string>> {
  if (cachedSymbols) return cachedSymbols;
  const res = await fetch(`${BASE}/exchangeInfo`);
  if (!res.ok) throw new Error(`Binance exchangeInfo ${res.status}`);
  const data = await res.json();
  const symbols = data.symbols || [];
  const set = new Set<string>();
  for (const s of symbols) {
    if (s.quoteAsset === 'USDT' && s.status === 'TRADING') {
      set.add(s.baseAsset.toUpperCase());
    }
  }
  cachedSymbols = set;
  return set;
}
