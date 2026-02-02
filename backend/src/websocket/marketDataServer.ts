/**
 * Real-time Market Data WebSocket Server
 * 
 * Provides live market data streams using Bun's native WebSocket support.
 * Simulates data feed from major exchanges (Binance-style API).
 * 
 * Channels:
 * - ticker@{symbol}      : Real-time price ticker
 * - kline@{symbol}_{interval} : K-line/candlestick data
 * - depth@{symbol}       : Order book depth
 * - trade@{symbol}       : Recent trades
 * 
 * Protocol:
 * - Subscribe: { "action": "subscribe", "channel": "ticker@BTCUSDT" }
 * - Unsubscribe: { "action": "unsubscribe", "channel": "ticker@BTCUSDT" }
 */

import { ServerWebSocket } from 'bun';

// Types
interface MarketTicker {
  symbol: string;
  price: string;
  priceChange: string;
  priceChangePercent: string;
  high24h: string;
  low24h: string;
  volume24h: string;
  quoteVolume24h: string;
  timestamp: number;
}

interface Kline {
  symbol: string;
  interval: string;
  openTime: number;
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
  closeTime: number;
  trades: number;
}

interface OrderBookLevel {
  price: string;
  quantity: string;
}

interface OrderBook {
  symbol: string;
  bids: OrderBookLevel[];
  asks: OrderBookLevel[];
  lastUpdateId: number;
  timestamp: number;
}

interface Trade {
  symbol: string;
  id: number;
  price: string;
  quantity: string;
  side: 'buy' | 'sell';
  timestamp: number;
}

interface WSMessage {
  action: 'subscribe' | 'unsubscribe' | 'ping';
  channel?: string;
  channels?: string[];
}

interface ClientData {
  subscriptions: Set<string>;
  lastPing: number;
}

// Market simulation state
const marketState: Map<string, {
  basePrice: number;
  volatility: number;
  trend: number;
  lastPrice: number;
  high24h: number;
  low24h: number;
  volume24h: number;
  tradeId: number;
}> = new Map();

// Initialize market pairs
const TRADING_PAIRS = [
  { symbol: 'BTCUSDT', basePrice: 42850, volatility: 0.002 },
  { symbol: 'ETHUSDT', basePrice: 2280, volatility: 0.003 },
  { symbol: 'BNBUSDT', basePrice: 312, volatility: 0.004 },
  { symbol: 'SOLUSDT', basePrice: 98, volatility: 0.005 },
  { symbol: 'XRPUSDT', basePrice: 0.62, volatility: 0.004 },
  { symbol: 'DOGEUSDT', basePrice: 0.082, volatility: 0.006 },
  { symbol: 'ADAUSDT', basePrice: 0.52, volatility: 0.004 },
  { symbol: 'TRXUSDT', basePrice: 0.108, volatility: 0.003 },
];

// Initialize market state for each pair
TRADING_PAIRS.forEach(pair => {
  marketState.set(pair.symbol, {
    basePrice: pair.basePrice,
    volatility: pair.volatility,
    trend: (Math.random() - 0.5) * 0.001,
    lastPrice: pair.basePrice,
    high24h: pair.basePrice * 1.02,
    low24h: pair.basePrice * 0.98,
    volume24h: Math.random() * 1000000000,
    tradeId: Math.floor(Math.random() * 1000000),
  });
});

// Connected clients
const clients: Map<ServerWebSocket<ClientData>, ClientData> = new Map();

// Channel subscribers
const channelSubscribers: Map<string, Set<ServerWebSocket<ClientData>>> = new Map();

/**
 * Generate realistic price movement
 */
function updatePrice(symbol: string): number {
  const state = marketState.get(symbol);
  if (!state) return 0;

  // Random walk with trend
  const randomChange = (Math.random() - 0.5) * 2 * state.volatility;
  state.trend += (Math.random() - 0.5) * 0.0002;
  state.trend = Math.max(-0.001, Math.min(0.001, state.trend));

  const priceChange = state.lastPrice * (randomChange + state.trend);
  state.lastPrice = Math.max(state.basePrice * 0.5, state.lastPrice + priceChange);

  // Update 24h high/low
  if (state.lastPrice > state.high24h) state.high24h = state.lastPrice;
  if (state.lastPrice < state.low24h) state.low24h = state.lastPrice;

  return state.lastPrice;
}

/**
 * Generate ticker data
 */
function generateTicker(symbol: string): MarketTicker | null {
  const state = marketState.get(symbol);
  if (!state) return null;

  const price = updatePrice(symbol);
  const priceChange = price - state.basePrice;
  const priceChangePercent = (priceChange / state.basePrice) * 100;

  return {
    symbol,
    price: price.toFixed(symbol.includes('DOGE') || symbol.includes('XRP') || symbol.includes('TRX') ? 5 : 2),
    priceChange: priceChange.toFixed(2),
    priceChangePercent: priceChangePercent.toFixed(2),
    high24h: state.high24h.toFixed(2),
    low24h: state.low24h.toFixed(2),
    volume24h: state.volume24h.toFixed(0),
    quoteVolume24h: (state.volume24h * price).toFixed(0),
    timestamp: Date.now(),
  };
}

/**
 * Generate K-line data
 */
function generateKline(symbol: string, interval: string): Kline | null {
  const state = marketState.get(symbol);
  if (!state) return null;

  const now = Date.now();
  const intervalMs = getIntervalMs(interval);
  const openTime = Math.floor(now / intervalMs) * intervalMs;

  // Simulate OHLC
  const open = state.lastPrice * (1 + (Math.random() - 0.5) * 0.001);
  const close = state.lastPrice;
  const high = Math.max(open, close) * (1 + Math.random() * 0.002);
  const low = Math.min(open, close) * (1 - Math.random() * 0.002);

  return {
    symbol,
    interval,
    openTime,
    open: open.toFixed(2),
    high: high.toFixed(2),
    low: low.toFixed(2),
    close: close.toFixed(2),
    volume: (Math.random() * 1000).toFixed(4),
    closeTime: openTime + intervalMs - 1,
    trades: Math.floor(Math.random() * 500),
  };
}

/**
 * Generate order book
 */
function generateOrderBook(symbol: string): OrderBook | null {
  const state = marketState.get(symbol);
  if (!state) return null;

  const midPrice = state.lastPrice;
  const spread = midPrice * 0.0001;
  const levels = 20;

  const bids: OrderBookLevel[] = [];
  const asks: OrderBookLevel[] = [];

  for (let i = 0; i < levels; i++) {
    const bidPrice = midPrice - spread * (i + 1) - Math.random() * spread;
    const askPrice = midPrice + spread * (i + 1) + Math.random() * spread;
    
    bids.push({
      price: bidPrice.toFixed(2),
      quantity: (Math.random() * 10 + 0.1).toFixed(4),
    });
    
    asks.push({
      price: askPrice.toFixed(2),
      quantity: (Math.random() * 10 + 0.1).toFixed(4),
    });
  }

  return {
    symbol,
    bids,
    asks,
    lastUpdateId: Date.now(),
    timestamp: Date.now(),
  };
}

/**
 * Generate trade
 */
function generateTrade(symbol: string): Trade | null {
  const state = marketState.get(symbol);
  if (!state) return null;

  state.tradeId++;

  return {
    symbol,
    id: state.tradeId,
    price: state.lastPrice.toFixed(2),
    quantity: (Math.random() * 2 + 0.01).toFixed(4),
    side: Math.random() > 0.5 ? 'buy' : 'sell',
    timestamp: Date.now(),
  };
}

function getIntervalMs(interval: string): number {
  const map: Record<string, number> = {
    '1m': 60000,
    '5m': 300000,
    '15m': 900000,
    '30m': 1800000,
    '1h': 3600000,
    '4h': 14400000,
    '1d': 86400000,
  };
  return map[interval] || 60000;
}

/**
 * Broadcast to channel subscribers
 */
function broadcast(channel: string, data: any) {
  const subscribers = channelSubscribers.get(channel);
  if (!subscribers) return;

  const message = JSON.stringify({
    channel,
    data,
    timestamp: Date.now(),
  });

  subscribers.forEach(ws => {
    try {
      ws.send(message);
    } catch (e) {
      // Client disconnected
      handleDisconnect(ws);
    }
  });
}

/**
 * Handle client disconnect
 */
function handleDisconnect(ws: ServerWebSocket<ClientData>) {
  const clientData = clients.get(ws);
  if (clientData) {
    clientData.subscriptions.forEach(channel => {
      const subs = channelSubscribers.get(channel);
      if (subs) {
        subs.delete(ws);
        if (subs.size === 0) {
          channelSubscribers.delete(channel);
        }
      }
    });
  }
  clients.delete(ws);
}

/**
 * Subscribe client to channel
 */
function subscribe(ws: ServerWebSocket<ClientData>, channel: string) {
  const clientData = clients.get(ws);
  if (!clientData) return;

  clientData.subscriptions.add(channel);

  if (!channelSubscribers.has(channel)) {
    channelSubscribers.set(channel, new Set());
  }
  channelSubscribers.get(channel)!.add(ws);

  // Send immediate snapshot
  const [type, params] = channel.split('@');
  if (type === 'ticker' && params) {
    const ticker = generateTicker(params);
    if (ticker) {
      ws.send(JSON.stringify({ channel, data: ticker, type: 'snapshot' }));
    }
  } else if (type === 'depth' && params) {
    const orderbook = generateOrderBook(params);
    if (orderbook) {
      ws.send(JSON.stringify({ channel, data: orderbook, type: 'snapshot' }));
    }
  }
}

/**
 * Unsubscribe client from channel
 */
function unsubscribe(ws: ServerWebSocket<ClientData>, channel: string) {
  const clientData = clients.get(ws);
  if (!clientData) return;

  clientData.subscriptions.delete(channel);

  const subs = channelSubscribers.get(channel);
  if (subs) {
    subs.delete(ws);
    if (subs.size === 0) {
      channelSubscribers.delete(channel);
    }
  }
}

// Market data update intervals
let tickerInterval: Timer;
let klineInterval: Timer;
let depthInterval: Timer;
let tradeInterval: Timer;

function startMarketDataStreams() {
  // Ticker updates every 100ms
  tickerInterval = setInterval(() => {
    TRADING_PAIRS.forEach(pair => {
      const channel = `ticker@${pair.symbol}`;
      if (channelSubscribers.has(channel)) {
        const ticker = generateTicker(pair.symbol);
        if (ticker) broadcast(channel, ticker);
      }
    });
  }, 100);

  // K-line updates every second
  klineInterval = setInterval(() => {
    TRADING_PAIRS.forEach(pair => {
      ['1m', '5m', '15m', '1h'].forEach(interval => {
        const channel = `kline@${pair.symbol}_${interval}`;
        if (channelSubscribers.has(channel)) {
          const kline = generateKline(pair.symbol, interval);
          if (kline) broadcast(channel, kline);
        }
      });
    });
  }, 1000);

  // Order book updates every 200ms
  depthInterval = setInterval(() => {
    TRADING_PAIRS.forEach(pair => {
      const channel = `depth@${pair.symbol}`;
      if (channelSubscribers.has(channel)) {
        const orderbook = generateOrderBook(pair.symbol);
        if (orderbook) broadcast(channel, orderbook);
      }
    });
  }, 200);

  // Trade updates randomly (50-500ms)
  const scheduleNextTrade = () => {
    const delay = 50 + Math.random() * 450;
    tradeInterval = setTimeout(() => {
      // Random pair
      const pair = TRADING_PAIRS[Math.floor(Math.random() * TRADING_PAIRS.length)];
      const channel = `trade@${pair.symbol}`;
      if (channelSubscribers.has(channel)) {
        const trade = generateTrade(pair.symbol);
        if (trade) broadcast(channel, trade);
      }
      scheduleNextTrade();
    }, delay);
  };
  scheduleNextTrade();

  console.log('[WebSocket] Market data streams started');
}

function stopMarketDataStreams() {
  clearInterval(tickerInterval);
  clearInterval(klineInterval);
  clearInterval(depthInterval);
  clearTimeout(tradeInterval);
  console.log('[WebSocket] Market data streams stopped');
}

// Export WebSocket server configuration for Bun
export const wsServer = {
  port: parseInt(process.env.WS_PORT || '8001'),
  
  fetch(req: Request, server: any) {
    const url = new URL(req.url);
    
    // Health check endpoint
    if (url.pathname === '/health') {
      return new Response(JSON.stringify({
        status: 'ok',
        clients: clients.size,
        channels: channelSubscribers.size,
        timestamp: Date.now(),
      }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // WebSocket upgrade
    if (url.pathname === '/ws' || url.pathname === '/stream') {
      const upgraded = server.upgrade(req, {
        data: {
          subscriptions: new Set<string>(),
          lastPing: Date.now(),
        },
      });
      return upgraded ? undefined : new Response('WebSocket upgrade failed', { status: 400 });
    }

    return new Response('Not Found', { status: 404 });
  },

  websocket: {
    open(ws: ServerWebSocket<ClientData>) {
      clients.set(ws, ws.data);
      console.log(`[WebSocket] Client connected. Total: ${clients.size}`);
      
      // Send welcome message
      ws.send(JSON.stringify({
        type: 'welcome',
        message: 'Connected to market data stream',
        availableChannels: [
          'ticker@{SYMBOL}',
          'kline@{SYMBOL}_{INTERVAL}',
          'depth@{SYMBOL}',
          'trade@{SYMBOL}',
        ],
        symbols: TRADING_PAIRS.map(p => p.symbol),
        intervals: ['1m', '5m', '15m', '30m', '1h', '4h', '1d'],
      }));
    },

    message(ws: ServerWebSocket<ClientData>, message: string | Buffer) {
      try {
        const data: WSMessage = JSON.parse(message.toString());
        
        switch (data.action) {
          case 'subscribe':
            if (data.channel) {
              subscribe(ws, data.channel);
              ws.send(JSON.stringify({ type: 'subscribed', channel: data.channel }));
            }
            if (data.channels) {
              data.channels.forEach(ch => {
                subscribe(ws, ch);
              });
              ws.send(JSON.stringify({ type: 'subscribed', channels: data.channels }));
            }
            break;

          case 'unsubscribe':
            if (data.channel) {
              unsubscribe(ws, data.channel);
              ws.send(JSON.stringify({ type: 'unsubscribed', channel: data.channel }));
            }
            break;

          case 'ping':
            ws.data.lastPing = Date.now();
            ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
            break;
        }
      } catch (e) {
        ws.send(JSON.stringify({ type: 'error', message: 'Invalid message format' }));
      }
    },

    close(ws: ServerWebSocket<ClientData>) {
      handleDisconnect(ws);
      console.log(`[WebSocket] Client disconnected. Total: ${clients.size}`);
    },

    drain(ws: ServerWebSocket<ClientData>) {
      // Handle backpressure
    },
  },
};

// Start the WebSocket server
export function startWebSocketServer() {
  const server = Bun.serve(wsServer);
  startMarketDataStreams();
  
  console.log(`
╔════════════════════════════════════════════════════════════╗
║          WebSocket Market Data Server                      ║
╠════════════════════════════════════════════════════════════╣
║  WebSocket: ws://localhost:${wsServer.port}/ws                      ║
║  Health:    http://localhost:${wsServer.port}/health                ║
╠════════════════════════════════════════════════════════════╣
║  Channels:                                                 ║
║  - ticker@BTCUSDT     : Price ticker                       ║
║  - kline@BTCUSDT_1m   : K-line data                        ║
║  - depth@BTCUSDT      : Order book                         ║
║  - trade@BTCUSDT      : Recent trades                      ║
╚════════════════════════════════════════════════════════════╝
  `);

  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('[WebSocket] Shutting down...');
    stopMarketDataStreams();
    server.stop();
    process.exit(0);
  });

  return server;
}

// Auto-start if run directly
if (import.meta.main) {
  startWebSocketServer();
}
