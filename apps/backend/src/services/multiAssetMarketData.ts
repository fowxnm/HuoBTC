/**
 * 多资产行情：外汇、股票、贵金属等非 Binance 标的
 * 使用模拟价格（基于时间+符号的确定性波动），便于无外部 API 时全品类可交易
 * 生产环境可替换为 Twelve Data / ExchangeRate-API / GoldAPI 等
 */

export type AssetType = 'crypto' | 'forex' | 'stock' | 'metal' | 'futures' | 'etf';

export interface SimulatedTicker {
  symbol: string;
  lastPrice: string;
  priceChangePercent: string;
  highPrice: string;
  lowPrice: string;
  volume: string;
  openPrice: string;
}

// 基准价与波动幅度（用于模拟）
const SYMBOL_BASE: Record<string, { base: number; range: number; seed: number }> = {
  // 外汇
  EUR: { base: 1.08, range: 0.02, seed: 1 },
  GBP: { base: 1.27, range: 0.02, seed: 2 },
  JPY: { base: 0.0067, range: 0.0002, seed: 3 },
  AUD: { base: 0.65, range: 0.015, seed: 4 },
  CHF: { base: 1.12, range: 0.02, seed: 5 },
  CAD: { base: 0.74, range: 0.015, seed: 6 },
  NZD: { base: 0.61, range: 0.015, seed: 7 },
  HKD: { base: 0.128, range: 0.005, seed: 8 },
  SGD: { base: 0.74, range: 0.01, seed: 9 },
  // 股票（美股等，价格/美元）
  AAPL: { base: 228, range: 8, seed: 10 },
  TSLA: { base: 248, range: 15, seed: 11 },
  GOOGL: { base: 172, range: 6, seed: 12 },
  AMZN: { base: 198, range: 8, seed: 13 },
  MSFT: { base: 420, range: 12, seed: 14 },
  META: { base: 525, range: 18, seed: 15 },
  NVDA: { base: 138, range: 10, seed: 16 },
  NFLX: { base: 485, range: 20, seed: 17 },
  // 贵金属（美元/盎司 等）
  XAU: { base: 2650, range: 80, seed: 20 },
  XAG: { base: 30.5, range: 1.2, seed: 21 },
  XPT: { base: 980, range: 30, seed: 22 },
  XPD: { base: 920, range: 35, seed: 23 },
  // 期货/指数
  US30: { base: 39500, range: 400, seed: 30 },
  US500: { base: 5850, range: 80, seed: 31 },
  NAS100: { base: 21500, range: 300, seed: 32 },
  // ETF
  SPY: { base: 585, range: 10, seed: 40 },
  QQQ: { base: 525, range: 12, seed: 41 },
  GLD: { base: 245, range: 5, seed: 42 },
};

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return h;
}

/**
 * 确定性模拟价格：同一秒内相同 symbol 返回相同价格，随时间平滑变化
 */
function simulatedPrice(symbol: string, nowMs: number): { price: number; openPrice: number; changePercent: number } {
  const config = SYMBOL_BASE[symbol] || { base: 100, range: 5, seed: hash(symbol) % 1000 };
  const t = Math.floor(nowMs / 60000); // 每分钟变一次
  const wave = Math.sin(config.seed * 0.1 + t * 0.02) * 0.5 + Math.sin(config.seed * 0.07 + t * 0.01) * 0.5;
  const price = config.base + wave * config.range;
  const openT = Math.max(0, t - 24 * 60); // 24h 前
  const openWave = Math.sin(config.seed * 0.1 + openT * 0.02) * 0.5 + Math.sin(config.seed * 0.07 + openT * 0.01) * 0.5;
  const openPrice = config.base + openWave * config.range;
  const changePercent = openPrice ? ((price - openPrice) / openPrice) * 100 : 0;
  return { price, openPrice, changePercent };
}

/**
 * 获取单个标的的模拟 Ticker（用于与 Binance 格式统一）
 */
export function getSimulatedTicker(symbol: string): SimulatedTicker {
  const now = Date.now();
  const { price, openPrice, changePercent } = simulatedPrice(symbol, now);
  const config = SYMBOL_BASE[symbol] || { base: 100, range: 5, seed: 0 };
  const high = price + config.range * 0.3;
  const low = price - config.range * 0.3;
  const vol = (1000000 + (hash(symbol + 'v') % 5000000)).toString();
  return {
    symbol: symbol + 'USDT',
    lastPrice: price.toFixed(8),
    priceChangePercent: changePercent.toFixed(2),
    openPrice: openPrice.toFixed(8),
    highPrice: high.toFixed(8),
    lowPrice: low.toFixed(8),
    volume: vol
  };
}

/**
 * 批量获取模拟 Ticker（外汇、股票、贵金属等）
 */
export function getSimulatedTickers(symbols: string[]): SimulatedTicker[] {
  return symbols.map(s => getSimulatedTicker(s));
}

/** 模拟 K 线单根格式（与 Binance 一致供前端使用） */
export interface SimulatedKline {
  openTime: number;
  closeTime: number;
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
}

/**
 * 生成模拟 K 线（用于外汇/股票/贵金属等无 Binance 的标的）
 */
export function getSimulatedKlines(
  symbol: string,
  intervalMinutes: number,
  limit: number
): SimulatedKline[] {
  const config = SYMBOL_BASE[symbol] || { base: 100, range: 5, seed: hash(symbol) % 1000 };
  const now = Date.now();
  const msPerCandle = intervalMinutes * 60 * 1000;
  const klines: SimulatedKline[] = [];
  for (let i = limit - 1; i >= 0; i--) {
    const closeTime = now - i * msPerCandle;
    const openTime = closeTime - msPerCandle;
    const t = Math.floor(openTime / 60000);
    const wave = Math.sin(config.seed * 0.1 + t * 0.02) * 0.5 + Math.sin(config.seed * 0.07 + t * 0.01) * 0.5;
    const open = config.base + wave * config.range;
    const nextWave = Math.sin(config.seed * 0.1 + (t + intervalMinutes) * 0.02) * 0.5 + Math.sin(config.seed * 0.07 + (t + intervalMinutes) * 0.01) * 0.5;
    const close = config.base + nextWave * config.range;
    const high = Math.max(open, close) + config.range * 0.1;
    const low = Math.min(open, close) - config.range * 0.1;
    const vol = (1000 + (hash(symbol + t) % 5000)).toString();
    klines.push({
      openTime,
      closeTime: closeTime + msPerCandle,
      open: open.toFixed(8),
      high: high.toFixed(8),
      low: low.toFixed(8),
      close: close.toFixed(8),
      volume: vol
    });
  }
  return klines;
}
