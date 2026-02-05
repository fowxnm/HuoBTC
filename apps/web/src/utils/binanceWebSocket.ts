/**
 * Binance WebSocket 实时行情：wss://stream.binance.com:9443/ws
 * 订阅：ticker（价格）、depth@100ms（盘口）、trade（成交）
 */

const WS_BASE = 'wss://stream.binance.com:9443/ws';

type Unsub = () => void;

class BinanceWebSocket {
  private ws: WebSocket | null = null;
  private url = WS_BASE;
  private subs: Map<string, Set<(data: any) => void>> = new Map();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private manualClose = false;

  private connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        resolve();
        return;
      }
      try {
        this.ws = new WebSocket(this.url);
        this.ws.onopen = () => resolve();
        this.ws.onerror = (e) => reject(e);
        this.ws.onmessage = (ev) => {
          try {
            const raw = JSON.parse(ev.data as string);
            const data = raw.stream ? raw.data : raw;
            if (!data) return;
            const e = data.e;
            const s = (data.s || '').toLowerCase();
            if (e === '24hrTicker') {
              this.subs.get(`ticker_${s}`)?.forEach((cb) => cb(data));
            } else if (e === 'depthUpdate') {
              this.subs.get(`depth_${s}`)?.forEach((cb) => cb(data));
            } else if (e === 'trade') {
              this.subs.get(`trade_${s}`)?.forEach((cb) => cb(data));
            }
          } catch (_) {}
        };
        this.ws.onclose = () => {
          if (!this.manualClose && this.subs.size > 0) {
            this.reconnectTimer = setTimeout(() => this.connect().catch(() => {}), 3000);
          }
        };
      } catch (e) {
        reject(e);
      }
    });
  }

  private ensureConnected(): Promise<void> {
    if (this.ws?.readyState === WebSocket.OPEN) return Promise.resolve();
    return this.connect();
  }

  /** 订阅 24hr Ticker：价格、涨跌幅等 */
  subscribeTicker(symbol: string, callback: (data: { price: string; P: string; h: string; l: string; v: string }) => void): Unsub {
    const sym = (symbol || 'btc').toLowerCase().replace(/[^a-z0-9]/g, '') + 'usdt';
    const stream = `${sym}@ticker`;
    const key = `ticker_${sym}`;
    if (!this.subs.has(key)) this.subs.set(key, new Set());
    this.subs.get(key)!.add(callback);
    this.ensureConnected().then(() => {
      if (this.ws?.readyState === WebSocket.OPEN)
        this.ws.send(JSON.stringify({ method: 'SUBSCRIBE', params: [stream], id: Date.now() }));
    });
    return () => {
      this.subs.get(key)?.delete(callback);
      if (this.ws?.readyState === WebSocket.OPEN)
        this.ws.send(JSON.stringify({ method: 'UNSUBSCRIBE', params: [stream], id: Date.now() }));
    };
  }

  /** 订阅深度 100ms */
  subscribeDepth(symbol: string, callback: (data: { b: [string, string][]; a: [string, string][] }) => void): Unsub {
    const sym = (symbol || 'btc').toLowerCase().replace(/[^a-z0-9]/g, '') + 'usdt';
    const stream = `${sym}@depth@100ms`;
    const key = `depth_${sym}`;
    if (!this.subs.has(key)) this.subs.set(key, new Set());
    this.subs.get(key)!.add(callback);
    this.ensureConnected().then(() => {
      if (this.ws?.readyState === WebSocket.OPEN)
        this.ws.send(JSON.stringify({ method: 'SUBSCRIBE', params: [stream], id: Date.now() }));
    });
    return () => {
      this.subs.get(key)?.delete(callback);
      if (this.ws?.readyState === WebSocket.OPEN)
        this.ws.send(JSON.stringify({ method: 'UNSUBSCRIBE', params: [stream], id: Date.now() }));
    };
  }

  /** 订阅实时成交 */
  subscribeTrade(symbol: string, callback: (data: { p: string; q: string; m: boolean; T: number; t: number }) => void): Unsub {
    const sym = (symbol || 'btc').toLowerCase().replace(/[^a-z0-9]/g, '') + 'usdt';
    const stream = `${sym}@trade`;
    const key = `trade_${sym}`;
    if (!this.subs.has(key)) this.subs.set(key, new Set());
    this.subs.get(key)!.add(callback);
    this.ensureConnected().then(() => {
      if (this.ws?.readyState === WebSocket.OPEN)
        this.ws.send(JSON.stringify({ method: 'SUBSCRIBE', params: [stream], id: Date.now() }));
    });
    return () => {
      this.subs.get(key)?.delete(callback);
      if (this.ws?.readyState === WebSocket.OPEN)
        this.ws.send(JSON.stringify({ method: 'UNSUBSCRIBE', params: [stream], id: Date.now() }));
    };
  }

  disconnect() {
    this.manualClose = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    this.ws?.close();
    this.ws = null;
  }
}

let instance: BinanceWebSocket | null = null;

export function getBinanceWS(): BinanceWebSocket {
  if (!instance) instance = new BinanceWebSocket();
  return instance;
}
