/**
 * Binance 国际 API 行情服务（香港/台湾可用）
 * 使用 api.binance.com 获取真实市场数据，严禁 Mock
 */

import { WebSocket } from 'ws';

interface KlineData {
  symbol: string;
  interval: string;
  openTime: number;
  closeTime: number;
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
  isFinal: boolean;
}

interface TickerData {
  symbol: string;
  priceChange: string;
  priceChangePercent: string;
  lastPrice: string;
  volume: string;
  quoteVolume: string;
  openPrice: string;
  highPrice: string;
  lowPrice: string;
}

interface DepthData {
  symbol: string;
  bids: [string, string][]; // [price, quantity]
  asks: [string, string][];
  lastUpdateId: number;
}

type MarketDataCallback = (data: any) => void;

class BinanceMarketDataService {
  private wsConnections: Map<string, WebSocket> = new Map();
  private tickerCache: Map<string, TickerData> = new Map();
  private depthCache: Map<string, DepthData> = new Map();
  private klineCache: Map<string, KlineData[]> = new Map();
  private subscribers: Map<string, Set<MarketDataCallback>> = new Map();
  
  // 连接状态
  public isConnected = false;
  private reconnectAttempts = 0;
  private readonly MAX_RECONNECT_ATTEMPTS = 10;
  private readonly RECONNECT_DELAY = 5000;

  constructor() {
    console.log('[BinanceMarketData] Service initialized');
  }

  /**
   * 订阅 Ticker 行情（24小时价格变动）
   */
  public subscribeTicker(symbols: string[]) {
    const streams = symbols.map(s => `${s.toLowerCase()}@ticker`).join('/');
    const wsUrl = `wss://stream.binance.com:9443/stream?streams=${streams}`;
    
    this.connectWebSocket('ticker', wsUrl, (data) => {
      if (data.data && data.data.e === '24hrTicker') {
        const ticker: TickerData = {
          symbol: data.data.s,
          priceChange: data.data.p,
          priceChangePercent: data.data.P,
          lastPrice: data.data.c,
          volume: data.data.v,
          quoteVolume: data.data.q,
          openPrice: data.data.o,
          highPrice: data.data.h,
          lowPrice: data.data.l,
        };
        this.tickerCache.set(ticker.symbol, ticker);
        this.notifySubscribers(`ticker:${ticker.symbol}`, ticker);
      }
    });
  }

  /**
   * 订阅 K线数据
   */
  public subscribeKline(symbol: string, interval: string = '1m') {
    const stream = `${symbol.toLowerCase()}@kline_${interval}`;
    const wsUrl = `wss://stream.binance.com:9443/ws/${stream}`;
    
    this.connectWebSocket(`kline:${symbol}:${interval}`, wsUrl, (data) => {
      if (data.e === 'kline') {
        const k = data.k;
        const kline: KlineData = {
          symbol: k.s,
          interval: k.i,
          openTime: k.t,
          closeTime: k.T,
          open: k.o,
          high: k.h,
          low: k.l,
          close: k.c,
          volume: k.v,
          isFinal: k.x,
        };
        
        // 更新缓存
        const key = `${symbol}:${interval}`;
        if (!this.klineCache.has(key)) {
          this.klineCache.set(key, []);
        }
        const cache = this.klineCache.get(key)!;
        
        if (kline.isFinal) {
          cache.push(kline);
          if (cache.length > 1000) cache.shift(); // 保持最多1000根K线
        } else {
          // 更新最后一根K线
          if (cache.length > 0 && cache[cache.length - 1].openTime === kline.openTime) {
            cache[cache.length - 1] = kline;
          } else {
            cache.push(kline);
          }
        }
        
        this.notifySubscribers(`kline:${symbol}:${interval}`, kline);
      }
    });
  }

  /**
   * 订阅深度数据（盘口）
   */
  public subscribeDepth(symbol: string, levels: number = 20) {
    const stream = `${symbol.toLowerCase()}@depth${levels}@100ms`;
    const wsUrl = `wss://stream.binance.com:9443/ws/${stream}`;
    
    this.connectWebSocket(`depth:${symbol}`, wsUrl, (data) => {
      if (data.lastUpdateId) {
        const depth: DepthData = {
          symbol: symbol,
          bids: data.bids,
          asks: data.asks,
          lastUpdateId: data.lastUpdateId,
        };
        this.depthCache.set(symbol, depth);
        this.notifySubscribers(`depth:${symbol}`, depth);
      }
    });
  }

  /**
   * 通过 REST API 获取历史 K线数据
   */
  public async getHistoricalKlines(
    symbol: string,
    interval: string = '1m',
    limit: number = 500
  ): Promise<KlineData[]> {
    try {
      const url = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`Binance API error: ${response.status}`);
      }
      
      const data = await response.json();
      
      return data.map((k: any) => ({
        symbol,
        interval,
        openTime: k[0],
        closeTime: k[6],
        open: k[1],
        high: k[2],
        low: k[3],
        close: k[4],
        volume: k[5],
        isFinal: true,
      }));
    } catch (error) {
      console.error('[BinanceMarketData] Failed to fetch historical klines:', error);
      throw error;
    }
  }

  /**
   * 获取所有交易对的24小时行情（带重试，便于 Docker/网络不稳定时仍能拿到数据）
   */
  public async getAllTickers(): Promise<TickerData[]> {
    const url = 'https://api.binance.com/api/v3/ticker/24hr';
    const maxAttempts = 3;
    let lastError: unknown;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);
        const response = await fetch(url, {
          signal: controller.signal,
          headers: { 'Accept': 'application/json' }
        });
        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`Binance API error: ${response.status}`);
        }

        const data = await response.json();
        return data.map((t: any) => ({
          symbol: t.symbol,
          priceChange: t.priceChange,
          priceChangePercent: t.priceChangePercent,
          lastPrice: t.lastPrice,
          volume: t.volume,
          quoteVolume: t.quoteVolume,
          openPrice: t.openPrice,
          highPrice: t.highPrice,
          lowPrice: t.lowPrice,
        }));
      } catch (error) {
        lastError = error;
        if (attempt < maxAttempts) {
          console.warn(`[BinanceMarketData] getAllTickers attempt ${attempt} failed, retrying...`, (error as Error)?.message);
          await new Promise(r => setTimeout(r, 1000 * attempt));
        }
      }
    }
    console.error('[BinanceMarketData] Failed to fetch all tickers after retries:', lastError);
    throw lastError;
  }

  /**
   * 建立 WebSocket 连接
   */
  private connectWebSocket(id: string, url: string, onMessage: (data: any) => void) {
    if (this.wsConnections.has(id)) {
      console.log(`[BinanceMarketData] Connection ${id} already exists`);
      return;
    }

    console.log(`[BinanceMarketData] Connecting to ${url}`);
    const ws = new WebSocket(url);

    ws.on('open', () => {
      console.log(`[BinanceMarketData] ${id} connected`);
      this.isConnected = true;
      this.reconnectAttempts = 0;
    });

    ws.on('message', (raw: Buffer) => {
      try {
        const data = JSON.parse(raw.toString());
        onMessage(data);
      } catch (error) {
        console.error(`[BinanceMarketData] Failed to parse message:`, error);
      }
    });

    ws.on('error', (error) => {
      console.error(`[BinanceMarketData] ${id} error:`, error);
    });

    ws.on('close', () => {
      console.log(`[BinanceMarketData] ${id} disconnected`);
      this.isConnected = false;
      this.wsConnections.delete(id);
      
      // 自动重连
      if (this.reconnectAttempts < this.MAX_RECONNECT_ATTEMPTS) {
        this.reconnectAttempts++;
        console.log(`[BinanceMarketData] Reconnecting ${id} (attempt ${this.reconnectAttempts}/${this.MAX_RECONNECT_ATTEMPTS})`);
        setTimeout(() => {
          this.connectWebSocket(id, url, onMessage);
        }, this.RECONNECT_DELAY);
      } else {
        console.error(`[BinanceMarketData] ${id} max reconnect attempts reached`);
      }
    });

    this.wsConnections.set(id, ws);
  }

  /**
   * 注册数据订阅者
   */
  public subscribe(channel: string, callback: MarketDataCallback) {
    if (!this.subscribers.has(channel)) {
      this.subscribers.set(channel, new Set());
    }
    this.subscribers.get(channel)!.add(callback);
  }

  /**
   * 取消订阅
   */
  public unsubscribe(channel: string, callback: MarketDataCallback) {
    if (this.subscribers.has(channel)) {
      this.subscribers.get(channel)!.delete(callback);
    }
  }

  /**
   * 通知所有订阅者
   */
  private notifySubscribers(channel: string, data: any) {
    if (this.subscribers.has(channel)) {
      this.subscribers.get(channel)!.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`[BinanceMarketData] Subscriber callback error:`, error);
        }
      });
    }
  }

  /**
   * 获取缓存的行情数据
   */
  public getTicker(symbol: string): TickerData | undefined {
    return this.tickerCache.get(symbol);
  }

  public getDepth(symbol: string): DepthData | undefined {
    return this.depthCache.get(symbol);
  }

  public getKlines(symbol: string, interval: string): KlineData[] {
    return this.klineCache.get(`${symbol}:${interval}`) || [];
  }

  /**
   * 关闭所有连接
   */
  public closeAll() {
    this.wsConnections.forEach((ws, id) => {
      console.log(`[BinanceMarketData] Closing ${id}`);
      ws.close();
    });
    this.wsConnections.clear();
    this.isConnected = false;
  }
}

// 导出单例
export const binanceMarketData = new BinanceMarketDataService();
export type { KlineData, TickerData, DepthData };
