/**
 * 动态模拟引擎：按 symbol 独立基准价与波动率，切换币种时 reset 保证数据一致
 * - 使用确定性随机种子（基于 symbol），同币种刷新后 K 线一致
 * - 实时约 1.5s 跳动；成交 1.5~3.5s 一笔
 */

import { createSignal } from 'solid-js';

const BAR_1M_SEC = 60;
const BAR_5M_SEC = 300;
const BAR_15M_SEC = 900;
const BAR_1H_SEC = 3600;
const BAR_4H_SEC = 14400;
const BAR_1D_SEC = 86400;
const BAR_1W_SEC = 604800;
/** 1m 预填根数：500 根 → 5m 聚合 100 根 → 15m 聚合 33 根，保证 15m/4h/1d 等有足够 K 线 */
const PREFILL_BARS = 500;
const ORDERBOOK_LEVELS = 12;
const SPREAD_MIN = 0.0001;
const SPREAD_MAX = 0.005;
const TICK_MS = 1500;
const TRADE_INTERVAL_MIN = 1500;
const TRADE_INTERVAL_MAX = 3500;

/** 各币种基准价与波动率：大饼稳、山寨波动大 */
export function getSymbolConfig(symbol: string): { basePrice: number; sigmaPerSec: number } {
  const upper = (symbol || 'BTC').toUpperCase();
  const configs: Record<string, { basePrice: number; sigmaPerSec: number }> = {
    BTC: { basePrice: 70000, sigmaPerSec: 0.0008 },
    ETH: { basePrice: 3500, sigmaPerSec: 0.001 },
    BNB: { basePrice: 580, sigmaPerSec: 0.0012 },
    SOL: { basePrice: 180, sigmaPerSec: 0.0015 },
    XRP: { basePrice: 0.55, sigmaPerSec: 0.0018 },
    DOGE: { basePrice: 0.38, sigmaPerSec: 0.002 },
    ADA: { basePrice: 0.52, sigmaPerSec: 0.0018 },
    AVAX: { basePrice: 38, sigmaPerSec: 0.0015 },
    DOT: { basePrice: 7.2, sigmaPerSec: 0.0015 },
    MATIC: { basePrice: 0.42, sigmaPerSec: 0.0018 },
    LINK: { basePrice: 14.5, sigmaPerSec: 0.0015 },
    UNI: { basePrice: 9.8, sigmaPerSec: 0.0016 },
    ATOM: { basePrice: 8.5, sigmaPerSec: 0.0015 },
    LTC: { basePrice: 95, sigmaPerSec: 0.0012 },
    BCH: { basePrice: 420, sigmaPerSec: 0.0014 },
    PEPE: { basePrice: 0.000012, sigmaPerSec: 0.0025 },
    WLD: { basePrice: 2.1, sigmaPerSec: 0.002 },
    NEAR: { basePrice: 5.2, sigmaPerSec: 0.0018 },
    FIL: { basePrice: 5.8, sigmaPerSec: 0.0016 },
    ARB: { basePrice: 0.95, sigmaPerSec: 0.0018 },
    OP: { basePrice: 2.1, sigmaPerSec: 0.0018 },
    INJ: { basePrice: 28, sigmaPerSec: 0.0016 },
    SUI: { basePrice: 3.2, sigmaPerSec: 0.0018 },
    SEI: { basePrice: 0.45, sigmaPerSec: 0.002 },
    TRX: { basePrice: 0.22, sigmaPerSec: 0.0018 },
    APT: { basePrice: 8.5, sigmaPerSec: 0.0016 },
    JUP: { basePrice: 0.95, sigmaPerSec: 0.002 },
    ORDI: { basePrice: 38, sigmaPerSec: 0.002 },
    TON: { basePrice: 5.2, sigmaPerSec: 0.0018 },
    STX: { basePrice: 2.1, sigmaPerSec: 0.0018 },
    RENDER: { basePrice: 7.2, sigmaPerSec: 0.0018 },
    FET: { basePrice: 1.8, sigmaPerSec: 0.002 },
    USDT: { basePrice: 1, sigmaPerSec: 0.0001 },
    USDC: { basePrice: 1, sigmaPerSec: 0.0001 },
  };
  return configs[upper] ?? { basePrice: 1, sigmaPerSec: 0.0015 };
}

/** 确定性随机种子：仅按 symbol，同币种刷新后 K 线/订单簿一致 */
export function seedFromSymbol(symbol: string): number {
  const s = (symbol || 'BTC').toUpperCase();
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return (h + 7919) >>> 0;
}

/** 确定性 PRNG（mulberry32），替代 Math.random */
function createSeededRandom(seed: number) {
  let s = seed >>> 0;
  return function next(): number {
    s = (s + 0x6d2b79f5) >>> 0; // 32-bit
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t >>> 0) / 4294967296);
  };
}

function normal(rand: () => number): number {
  let u = 0, v = 0;
  while (u === 0) u = rand();
  while (v === 0) v = rand();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function gaussianWeight(i: number, levels: number): number {
  const sigma = levels / 3;
  return Math.exp(-(i * i) / (2 * sigma * sigma));
}

export interface OHLCBar {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

export interface OrderLevel {
  price: number;
  amount: number;
}

export interface MockTrade {
  id: number;
  price: number;
  amount: number;
  side: 'buy' | 'sell';
  timestamp: number;
}

function buildBarsFromPath(prices: number[], startTime: number, barSec: number, rand: () => number): OHLCBar[] {
  const bars: OHLCBar[] = [];
  for (let i = 0; i < prices.length; i += barSec) {
    const chunk = prices.slice(i, i + barSec);
    if (chunk.length === 0) break;
    const open = chunk[0];
    const close = chunk[chunk.length - 1];
    const high = Math.max(...chunk);
    const low = Math.min(...chunk);
    const range = high - low || 0.0001;
    const vol = range * (50 + rand() * 150) * (barSec / 60);
    bars.push({ time: startTime + i, open, high, low, close, volume: vol });
  }
  return bars;
}

/** 将小周期 K 线聚合成大周期：每 group 根合并为 1 根，time 取第一根的开盘时间；返回按 time 排序、无重复 */
function aggregateBars(bars: OHLCBar[], group: number): OHLCBar[] {
  if (group <= 1 || bars.length === 0) return bars;
  const sorted = [...bars].sort((a, b) => a.time - b.time);
  const result: OHLCBar[] = [];
  const seen = new Set<number>();
  for (let i = 0; i < sorted.length; i += group) {
    const chunk = sorted.slice(i, i + group);
    if (chunk.length === 0) break;
    const t = chunk[0].time;
    if (seen.has(t)) continue;
    seen.add(t);
    const open = chunk[0].open;
    const close = chunk[chunk.length - 1].close;
    const high = Math.max(...chunk.map((b) => b.high));
    const low = Math.min(...chunk.map((b) => b.low));
    const volume = chunk.reduce((s, b) => s + (b.volume ?? 0), 0);
    result.push({ time: t, open, high, low, close, volume });
  }
  return result.sort((a, b) => a.time - b.time);
}

export function createMockPriceEngine(options: {
  basePrice: number;
  sigmaPerSec?: number;
  tickMs?: number;
  tradeIntervalMin?: number;
  tradeIntervalMax?: number;
  /** 确定性种子：同币种刷新后 K 线一致，不传则使用真随机 */
  seed?: number;
}) {
  let basePrice = options.basePrice;
  let sigmaPerSec = options.sigmaPerSec ?? 0.001;
  const tickMs = options.tickMs ?? TICK_MS;
  const tradeIntervalMin = options.tradeIntervalMin ?? TRADE_INTERVAL_MIN;
  const tradeIntervalMax = options.tradeIntervalMax ?? TRADE_INTERVAL_MAX;
  let rand = options.seed != null ? createSeededRandom(options.seed) : () => Math.random();

  const [lastPrice, setLastPrice] = createSignal(basePrice);
  const [change24h, setChange24h] = createSignal(0);
  const [high24h, setHigh24h] = createSignal(basePrice);
  const [low24h, setLow24h] = createSignal(basePrice);
  const [volume24h, setVolume24h] = createSignal(0);
  const [ohlc1m, setOhlc1m] = createSignal<OHLCBar[]>([]);
  const [ohlc5m, setOhlc5m] = createSignal<OHLCBar[]>([]);
  const [ohlc1h, setOhlc1h] = createSignal<OHLCBar[]>([]);
  const [currentBar, setCurrentBar] = createSignal<{ open: number; high: number; low: number }>({ open: basePrice, high: basePrice, low: basePrice });
  const [bids, setBids] = createSignal<OrderLevel[]>([]);
  const [asks, setAsks] = createSignal<OrderLevel[]>([]);
  const [trades, setTrades] = createSignal<MockTrade[]>([]);

  let price = basePrice;
  const priceHistory: number[] = [basePrice];
  let lastBar1m = Math.floor(Date.now() / 1000 / BAR_1M_SEC) * BAR_1M_SEC;
  let lastBar5m = Math.floor(Date.now() / 1000 / BAR_5M_SEC) * BAR_5M_SEC;
  let lastBar1h = Math.floor(Date.now() / 1000 / BAR_1H_SEC) * BAR_1H_SEC;
  let current1m: { open: number; high: number; low: number } = { open: price, high: price, low: price };
  let current5m = { open: price, high: price, low: price };
  let current1h = { open: price, high: price, low: price };
  const bars1m: OHLCBar[] = [];
  const bars5m: OHLCBar[] = [];
  const bars1h: OHLCBar[] = [];
  let high24 = price;
  let low24 = price;
  let open24 = price;
  let volume24 = 0;
  let tradeTimer: ReturnType<typeof setTimeout> | null = null;
  let nextTradeAt = Date.now() + tradeIntervalMin + rand() * (tradeIntervalMax - tradeIntervalMin);
  let tickInterval: ReturnType<typeof setInterval> | null = null;

  function stepPrice() {
    const sigma = sigmaPerSec * Math.sqrt(tickMs / 1000);
    price *= 1 + sigma * normal(rand);
    price = Math.max(price * 0.99, Math.min(price * 1.01, price));
    priceHistory.push(price);
    if (priceHistory.length > BAR_1H_SEC * 2) priceHistory.shift();

    current1m.high = Math.max(current1m.high, price);
    current1m.low = Math.min(current1m.low, price);
    current5m.high = Math.max(current5m.high, price);
    current5m.low = Math.min(current5m.low, price);
    current1h.high = Math.max(current1h.high, price);
    current1h.low = Math.min(current1h.low, price);
    high24 = Math.max(high24, price);
    low24 = Math.min(low24, price);
    volume24 += rand() * 2 + 0.1;

    const now = Math.floor(Date.now() / 1000);
    const bar1m = Math.floor(now / BAR_1M_SEC) * BAR_1M_SEC;
    const bar5m = Math.floor(now / BAR_5M_SEC) * BAR_5M_SEC;
    const bar1h = Math.floor(now / BAR_1H_SEC) * BAR_1H_SEC;

    if (bar1m > lastBar1m) {
      const vol1m = (current1m.high - current1m.low || 0.0001) * (30 + rand() * 80);
      bars1m.push({ time: lastBar1m, open: current1m.open, high: current1m.high, low: current1m.low, close: price, volume: vol1m });
      if (bars1m.length > 500) bars1m.shift();
      current1m = { open: price, high: price, low: price };
      lastBar1m = bar1m;
    }
    if (bar5m > lastBar5m) {
      const vol5m = (current5m.high - current5m.low || 0.0001) * (80 + rand() * 200);
      bars5m.push({ time: lastBar5m, open: current5m.open, high: current5m.high, low: current5m.low, close: price, volume: vol5m });
      if (bars5m.length > 500) bars5m.shift();
      current5m = { open: price, high: price, low: price };
      lastBar5m = bar5m;
    }
    if (bar1h > lastBar1h) {
      const vol1h = (current1h.high - current1h.low || 0.0001) * (200 + rand() * 500);
      bars1h.push({ time: lastBar1h, open: current1h.open, high: current1h.high, low: current1h.low, close: price, volume: vol1h });
      if (bars1h.length > 200) bars1h.shift();
      current1h = { open: price, high: price, low: price };
      lastBar1h = bar1h;
    }

    setLastPrice(price);
    setChange24h(open24 ? ((price - open24) / open24) * 100 : 0);
    setHigh24h(high24);
    setLow24h(low24);
    setVolume24h(volume24);
    setCurrentBar({ open: current1m.open, high: current1m.high, low: current1m.low });
    setOhlc1m([...bars1m]);
    setOhlc5m([...bars5m]);
    setOhlc1h([...bars1h]);

    const mid = price;
    const newAsks: OrderLevel[] = [];
    const newBids: OrderLevel[] = [];
    for (let i = 0; i < ORDERBOOK_LEVELS; i++) {
      const spread = SPREAD_MIN + rand() * (SPREAD_MAX - SPREAD_MIN);
      newAsks.push({
        price: mid * (1 + spread * (i + 1) + (rand() - 0.5) * 0.0002),
        amount: Math.max(0.01, 3 * gaussianWeight(i, ORDERBOOK_LEVELS) + rand() * 0.5),
      });
      newBids.push({
        price: mid * (1 - spread * (i + 1) - (rand() - 0.5) * 0.0002),
        amount: Math.max(0.01, 3 * gaussianWeight(i, ORDERBOOK_LEVELS) + rand() * 0.5),
      });
    }
    newAsks.sort((a, b) => a.price - b.price);
    newBids.sort((a, b) => b.price - a.price);
    setAsks(newAsks);
    setBids(newBids);
  }

  function emitTrade() {
    const askList = asks();
    const bidList = bids();
    const bestAsk = askList[0]?.price ?? price * 1.001;
    const bestBid = bidList[0]?.price ?? price * 0.999;
    const tradePrice = bestBid + rand() * (bestAsk - bestBid);
    const side: 'buy' | 'sell' = rand() > 0.5 ? 'buy' : 'sell';
    const amount = Math.max(0.001, 0.5 * gaussianWeight(0, 5) + rand() * 1.5);
    setTrades((prev) => [
      { id: Date.now(), price: tradePrice, amount, side, timestamp: Date.now() },
      ...prev.slice(0, 49),
    ]);
    nextTradeAt = Date.now() + tradeIntervalMin + rand() * (tradeIntervalMax - tradeIntervalMin);
  }

  function recordUserTrade(price: number, amount: number, side: 'buy' | 'sell') {
    setTrades((prev) => [
      { id: Date.now(), price, amount, side, timestamp: Date.now() },
      ...prev.slice(0, 49),
    ]);
  }

  /** 1h 预填根数：8760 = 365 天，保证 4h/1d/1w/1M/1y 有足够 K 线 */
  const PREFILL_1H_BARS = 24 * 365;
  /** 预填 K 线：以「上一根完整分钟」为终点；5m 由 1m 聚合、15m 由 5m 聚合，1h 补足至 365 天 */
  function prefillBars() {
    const now = Math.floor(Date.now() / 1000);
    const endBar = Math.floor(now / BAR_1M_SEC) * BAR_1M_SEC - BAR_1M_SEC;
    const startTime = endBar - (PREFILL_BARS - 1) * BAR_1M_SEC;
    let p = basePrice;
    const path: number[] = [p];
    const sigma = sigmaPerSec / Math.sqrt(BAR_1M_SEC);
    for (let i = 1; i <= PREFILL_BARS * BAR_1M_SEC; i++) {
      p *= 1 + sigma * normal(rand);
      p = Math.max(basePrice * 0.9, Math.min(basePrice * 1.1, p));
      path.push(p);
    }
    bars1m.length = 0;
    bars5m.length = 0;
    bars1h.length = 0;
    const b1m = buildBarsFromPath(path, startTime, BAR_1M_SEC, rand);
    b1m.forEach((bar) => bars1m.push(bar));
    const b5m = aggregateBars(bars1m, 5);
    b5m.forEach((bar) => bars5m.push(bar));
    const b1hFromPath = buildBarsFromPath(path, startTime, BAR_1H_SEC, rand);
    b1hFromPath.forEach((bar) => bars1h.push(bar));
    let p1h = bars1h.length > 0 ? bars1h[bars1h.length - 1].close : basePrice;
    const nowHour = Math.floor(now / BAR_1H_SEC) * BAR_1H_SEC;
    const sigma1h = sigmaPerSec * Math.sqrt(BAR_1H_SEC);
    for (let i = bars1h.length; i < PREFILL_1H_BARS; i++) {
      const t = nowHour - (PREFILL_1H_BARS - i) * BAR_1H_SEC;
      const open = p1h;
      p1h *= 1 + sigma1h * normal(rand);
      p1h = Math.max(basePrice * 0.85, Math.min(basePrice * 1.15, p1h));
      const high = Math.max(open, p1h) + Math.abs(p1h * 0.001);
      const low = Math.min(open, p1h) - Math.abs(p1h * 0.001);
      bars1h.push({
        time: t,
        open,
        high,
        low,
        close: p1h,
        volume: (high - low) * (200 + rand() * 500),
      });
    }
    bars1h.sort((a, b) => a.time - b.time);
    const lastClose = bars1m.length > 0 ? bars1m[bars1m.length - 1].close : basePrice;
    lastBar1m = Math.floor(now / BAR_1M_SEC) * BAR_1M_SEC;
    lastBar5m = Math.floor(now / BAR_5M_SEC) * BAR_5M_SEC;
    lastBar1h = Math.floor(now / BAR_1H_SEC) * BAR_1H_SEC;
    current1m = { open: lastClose, high: lastClose, low: lastClose };
    current5m = { open: lastClose, high: lastClose, low: lastClose };
    current1h = { open: lastClose, high: lastClose, low: lastClose };
    price = lastClose;
    open24 = price;
    high24 = Math.max(...path);
    low24 = Math.min(...path);
    volume24 = 0;
    setTrades([]);
    setOhlc1m([...bars1m]);
    setOhlc5m([...bars5m]);
    setOhlc1h([...bars1h]);
    setLastPrice(price);
    setHigh24h(high24);
    setLow24h(low24);
    setChange24h(0);
    setVolume24h(0);
    setCurrentBar({ open: current1m.open, high: current1m.high, low: current1m.low });
    stepPrice();
  }

  function start() {
    if (tickInterval) {
      clearInterval(tickInterval);
      tickInterval = null;
    }
    if (tradeTimer) {
      clearTimeout(tradeTimer);
      tradeTimer = null;
    }
    prefillBars();
    stepPrice();
    nextTradeAt = Date.now() + tradeIntervalMin + rand() * (tradeIntervalMax - tradeIntervalMin);
    tickInterval = setInterval(stepPrice, tickMs);
    const tradeLoop = () => {
      if (Date.now() >= nextTradeAt) emitTrade();
      tradeTimer = setTimeout(tradeLoop, 500);
    };
    tradeTimer = setTimeout(tradeLoop, 500);
    return () => {
      if (tickInterval) clearInterval(tickInterval);
      tickInterval = null;
      if (tradeTimer) clearTimeout(tradeTimer);
      tradeTimer = null;
    };
  }

  function reset(newOptions: { basePrice: number; sigmaPerSec?: number; seed?: number }) {
    basePrice = newOptions.basePrice;
    sigmaPerSec = newOptions.sigmaPerSec ?? sigmaPerSec;
    if (newOptions.seed != null) rand = createSeededRandom(newOptions.seed);
    if (tickInterval) clearInterval(tickInterval);
    if (tradeTimer) clearTimeout(tradeTimer);
    tickInterval = null;
    tradeTimer = null;
    prefillBars();
    stepPrice();
    nextTradeAt = Date.now() + tradeIntervalMin + rand() * (tradeIntervalMax - tradeIntervalMin);
    tickInterval = setInterval(stepPrice, tickMs);
    const tradeLoop = () => {
      if (Date.now() >= nextTradeAt) emitTrade();
      tradeTimer = setTimeout(tradeLoop, 500);
    };
    tradeTimer = setTimeout(tradeLoop, 500);
  }

  /** 按周期返回对应 K 线：1m/15m/4h/1d/1w/1M/1y，时间戳为周期起点 UTC 秒，保证按 time 升序无重复 */
  function getBarsForInterval(interval: string): OHLCBar[] {
    const raw = (interval || '1m').toLowerCase();
    const h1 = ohlc1h();
    const m5 = ohlc5m();
    const m1 = ohlc1m();
    let out: OHLCBar[];
    if (raw === '1m') out = [...m1];
    else if (raw === '15m') out = aggregateBars(m5, 3);
    else if (raw === '4h') out = aggregateBars(h1, 4);
    else if (raw === '1d') out = aggregateBars(h1, 24);
    else if (raw === '1w') out = aggregateBars(h1, 168);
    else if (interval === '1M') out = aggregateBars(h1, 24 * 30);
    else if (raw === '1y') out = aggregateBars(h1, 24 * 365);
    else out = [...m1];
    return out.sort((a, b) => a.time - b.time);
  }

  /** 当前未完成 K 线（用于实时更新）：1m 用 1 分钟当前，15m 用 5 分钟当前，其余用 1 小时当前 */
  function getCurrentBarForInterval(interval: string): { open: number; high: number; low: number } {
    const raw = (interval || '1m').toLowerCase();
    if (raw === '1m') return currentBar();
    if (raw === '15m') return current5m;
    if (raw === '4h' || raw === '1d' || raw === '1w' || interval === '1M' || raw === '1y') return current1h;
    return currentBar();
  }

  /** 当前周期 K 线的起始时间（UTC 秒），用于实时更新时对齐时间轴 */
  function getCurrentBarStartTime(interval: string): number {
    const now = Math.floor(Date.now() / 1000);
    const raw = (interval || '1m').toLowerCase();
    if (raw === '1m') return Math.floor(now / BAR_1M_SEC) * BAR_1M_SEC;
    if (raw === '15m') return Math.floor(now / BAR_15M_SEC) * BAR_15M_SEC;
    if (raw === '4h') return Math.floor(now / BAR_4H_SEC) * BAR_4H_SEC;
    if (raw === '1d') return Math.floor(now / BAR_1D_SEC) * BAR_1D_SEC;
    if (raw === '1w') return Math.floor(now / BAR_1W_SEC) * BAR_1W_SEC;
    if (interval === '1M') return Math.floor(now / (BAR_1D_SEC * 30)) * (BAR_1D_SEC * 30);
    if (raw === '1y') return Math.floor(now / (BAR_1D_SEC * 365)) * (BAR_1D_SEC * 365);
    return Math.floor(now / BAR_1M_SEC) * BAR_1M_SEC;
  }

  return {
    lastPrice,
    change24h,
    high24h,
    low24h,
    volume24h,
    ohlc1m,
    ohlc5m,
    ohlc1h,
    currentBar,
    getBarsForInterval,
    getCurrentBarForInterval,
    getCurrentBarStartTime,
    bids,
    asks,
    trades,
    start,
    reset,
    recordUserTrade,
  };
}
