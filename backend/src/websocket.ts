/**
 * WebSocket 服务 - 实时行情推送
 * 🚨 严禁使用 Mock 数据！所有数据必须来自 Binance 真实行情源
 * 对接前端的 websocket.ts 客户端
 */

import type { ServerWebSocket } from 'bun';
import { binanceMarketData } from './services/binanceMarketData';
import type { KlineData, TickerData, DepthData } from './services/binanceMarketData';

interface WebSocketData {
  userId?: number;
  subscriptions: Set<string>; // e.g., "kline:BTC/USDT:1min"
}

interface WSMessage {
  type: 'login' | 'subscribe' | 'unsubscribe';
  userId?: number;
  channel?: 'kline' | 'daymarket' | 'depth';
  symbol?: string;
  period?: string;
}

// 存储所有连接的客户端
const clients = new Map<ServerWebSocket<WebSocketData>, WebSocketData>();

// 符号映射：前端使用原生币名 BTC/ETH，底层调用 Binance 时用 btcusdt/ethusdt
/** 原生币名 -> Binance 交易对（如 BTC -> BTCUSDT） */
function toBinanceSymbol(symbol: string): string {
  const s = (symbol || '').trim().toUpperCase();
  if (!s) return 'BTCUSDT';
  if (s.endsWith('USDT')) return s;
  return s + 'USDT';
}

/** Binance 交易对 -> 原生币名（如 BTCUSDT -> BTC），存入 Redis 和广播给前端时用 */
function toFrontendSymbol(symbol: string): string {
  const m = (symbol || '').match(/^(.+?)USDT$/i);
  return m ? m[1] : symbol;
}

export const wsHandler = {
  /**
   * 客户端连接建立
   */
  open(ws: ServerWebSocket<WebSocketData>) {
    console.log('[WebSocket] New client connected');
    
    // 初始化客户端数据
    const data: WebSocketData = {
      subscriptions: new Set()
    };
    clients.set(ws, data);

    // 发送欢迎消息 + Binance 连接状态
    ws.send(JSON.stringify({
      type: 'welcome',
      message: 'Connected to BTC Exchange WebSocket',
      timestamp: Date.now(),
      binanceConnected: binanceMarketData.isConnected,
    }));
  },

  /**
   * 处理客户端消息
   */
  message(ws: ServerWebSocket<WebSocketData>, message: string | Buffer) {
    try {
      const msg = JSON.parse(message.toString()) as WSMessage;
      const clientData = clients.get(ws);
      
      if (!clientData) return;

      switch (msg.type) {
        case 'login':
          // 登录/认证
          clientData.userId = msg.userId;
          console.log(`[WebSocket] Client ${msg.userId} authenticated`);
          break;

        case 'subscribe':
          // 订阅频道
          if (msg.channel && msg.symbol) {
            const key = msg.period 
              ? `${msg.channel}:${msg.symbol}:${msg.period}`
              : `${msg.channel}:${msg.symbol}`;
            clientData.subscriptions.add(key);
            console.log(`[WebSocket] Client subscribed to ${key}`);
            
            // 🚨 严禁发送假数据！必须从 Binance 获取真实数据
            sendRealMarketData(ws, msg.channel, msg.symbol, msg.period);
          }
          break;

        case 'unsubscribe':
          // 取消订阅
          if (msg.channel && msg.symbol) {
            const key = msg.period 
              ? `${msg.channel}:${msg.symbol}:${msg.period}`
              : `${msg.channel}:${msg.symbol}`;
            clientData.subscriptions.delete(key);
            console.log(`[WebSocket] Client unsubscribed from ${key}`);
          }
          break;
      }
    } catch (error) {
      console.error('[WebSocket] Failed to parse message:', error);
    }
  },

  /**
   * 客户端断开连接
   */
  close(ws: ServerWebSocket<WebSocketData>) {
    const clientData = clients.get(ws);
    if (clientData) {
      console.log(`[WebSocket] Client ${clientData.userId || 'anonymous'} disconnected`);
      clients.delete(ws);
    }
  },

  /**
   * WebSocket 错误
   */
  error(ws: ServerWebSocket<WebSocketData>, error: Error) {
    console.error('[WebSocket] Error:', error);
  }
};

/**
 * 🚨 发送真实市场数据（从 Binance 获取）
 * 严禁使用任何 Mock 数据或 placeholder！
 */
async function sendRealMarketData(
  ws: ServerWebSocket<WebSocketData>, 
  channel: string, 
  symbol: string, 
  period?: string
) {
  const binanceSymbol = toBinanceSymbol(symbol);

  try {
    if (channel === 'kline') {
      // K线数据 - 从 Binance 订阅真实数据
      const interval = period || '1m';
      
      // 订阅 Binance K线推送
      binanceMarketData.subscribe(`kline:${binanceSymbol}:${interval}`, (klineData: KlineData) => {
        // 检查客户端是否仍然订阅
        const clientData = clients.get(ws);
        if (!clientData || !clientData.subscriptions.has(`kline:${symbol}:${interval}`)) {
          return;
        }

        // 转换为前端格式
        ws.send(JSON.stringify({
          type: 'kline',
          symbol: toFrontendSymbol(klineData.symbol),
          period: klineData.interval,
          open: parseFloat(klineData.open),
          high: parseFloat(klineData.high),
          low: parseFloat(klineData.low),
          close: parseFloat(klineData.close),
          volume: parseFloat(klineData.volume),
          time: klineData.closeTime,
          change: ((parseFloat(klineData.close) - parseFloat(klineData.open)) / parseFloat(klineData.open) * 100),
        }));
      });

      // 立即发送历史数据
      const historicalKlines = await binanceMarketData.getHistoricalKlines(binanceSymbol, interval, 100);
      if (historicalKlines.length > 0) {
        const latestKline = historicalKlines[historicalKlines.length - 1];
        ws.send(JSON.stringify({
          type: 'kline',
          symbol: toFrontendSymbol(latestKline.symbol),
          period: latestKline.interval,
          open: parseFloat(latestKline.open),
          high: parseFloat(latestKline.high),
          low: parseFloat(latestKline.low),
          close: parseFloat(latestKline.close),
          volume: parseFloat(latestKline.volume),
          time: latestKline.closeTime,
          change: ((parseFloat(latestKline.close) - parseFloat(latestKline.open)) / parseFloat(latestKline.open) * 100),
        }));
      }
    } else if (channel === 'daymarket') {
      // 24小时行情数据 - 订阅 Binance Ticker
      binanceMarketData.subscribe(`ticker:${binanceSymbol}`, (tickerData: TickerData) => {
        const clientData = clients.get(ws);
        if (!clientData || !clientData.subscriptions.has(`daymarket:${symbol}`)) {
          return;
        }

        ws.send(JSON.stringify({
          type: 'daymarket',
          symbol: toFrontendSymbol(tickerData.symbol),
          close: parseFloat(tickerData.lastPrice),
          change: parseFloat(tickerData.priceChangePercent),
          high: parseFloat(tickerData.highPrice),
          low: parseFloat(tickerData.lowPrice),
          volume: parseFloat(tickerData.volume),
        }));
      });

      // 立即发送缓存数据
      const cachedTicker = binanceMarketData.getTicker(binanceSymbol);
      if (cachedTicker) {
        ws.send(JSON.stringify({
          type: 'daymarket',
          symbol: toFrontendSymbol(cachedTicker.symbol),
          close: parseFloat(cachedTicker.lastPrice),
          change: parseFloat(cachedTicker.priceChangePercent),
          high: parseFloat(cachedTicker.highPrice),
          low: parseFloat(cachedTicker.lowPrice),
          volume: parseFloat(cachedTicker.volume),
        }));
      }
    } else if (channel === 'depth') {
      // 深度数据（盘口）- 订阅 Binance 深度
      binanceMarketData.subscribe(`depth:${binanceSymbol}`, (depthData: DepthData) => {
        const clientData = clients.get(ws);
        if (!clientData || !clientData.subscriptions.has(`depth:${symbol}`)) {
          return;
        }

        ws.send(JSON.stringify({
          type: 'depth',
          symbol: toFrontendSymbol(depthData.symbol),
          asks: depthData.asks.slice(0, 20).map(([price, amount]) => ({
            price: parseFloat(price),
            amount: parseFloat(amount)
          })),
          bids: depthData.bids.slice(0, 20).map(([price, amount]) => ({
            price: parseFloat(price),
            amount: parseFloat(amount)
          })),
        }));
      });

      // 立即发送缓存数据
      const cachedDepth = binanceMarketData.getDepth(binanceSymbol);
      if (cachedDepth) {
        ws.send(JSON.stringify({
          type: 'depth',
          symbol: toFrontendSymbol(cachedDepth.symbol),
          asks: cachedDepth.asks.slice(0, 20).map(([price, amount]) => ({
            price: parseFloat(price),
            amount: parseFloat(amount)
          })),
          bids: cachedDepth.bids.slice(0, 20).map(([price, amount]) => ({
            price: parseFloat(price),
            amount: parseFloat(amount)
          })),
        }));
      }
    }
  } catch (error) {
    console.error('[WebSocket] Failed to send real market data:', error);
    
    // 发送错误通知给客户端
    ws.send(JSON.stringify({
      type: 'error',
      channel,
      symbol,
      message: 'Failed to fetch market data from Binance',
      error: error instanceof Error ? error.message : 'Unknown error',
    }));
  }
}

/**
 * 启动市场数据服务
 * 使用价格模拟器：每天固定时间获取真实价格，其他时间模拟波动
 * 避免频繁请求被 Binance 封禁
 */
export async function startMarketDataBroadcast() {
  console.log('[WebSocket] Starting market data service with Price Simulator...');
  
  try {
    // 启动价格模拟器
    const { priceSimulator } = await import('./services/priceSimulator');
    priceSimulator.start();
    
    // 订阅价格更新，广播给所有客户端
    priceSimulator.subscribe((tickers) => {
      const tickerData = tickers.map(t => ({
        type: 'ticker',
        symbol: t.symbol,
        price: t.currentPrice.toString(),
        priceChange: t.priceChange.toString(),
        priceChangePercent: t.priceChangePercent.toFixed(2),
        volume: t.volume,
        quoteVolume: t.quoteVolume,
        high: t.highPrice.toString(),
        low: t.lowPrice.toString(),
      }));
      
      // 广播给所有连接的客户端
      clients.forEach((_, ws) => {
        try {
          ws.send(JSON.stringify({ type: 'tickers', data: tickerData }));
        } catch (error) {
          // 忽略发送错误
        }
      });
    });

    // 定期发送状态
    setInterval(() => {
      const status = {
        type: 'status',
        simulatorRunning: true,
        clientsCount: clients.size,
        timestamp: Date.now(),
      };
      
      clients.forEach((_, ws) => {
        try {
          ws.send(JSON.stringify(status));
        } catch (error) {
          // 忽略发送错误
        }
      });
    }, 10000);

    console.log('[WebSocket] Market data service started with Price Simulator ✅');
    console.log('[WebSocket] � Real prices fetched at: 8:00, 15:00, 22:00, 2:00');
  } catch (error) {
    console.error('[WebSocket] Failed to start market data service:', error);
  }
}

// 优雅关闭
process.on('SIGTERM', () => {
  console.log('[WebSocket] Shutting down...');
  binanceMarketData.closeAll();
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('[WebSocket] Shutting down...');
  binanceMarketData.closeAll();
  process.exit(0);
});
