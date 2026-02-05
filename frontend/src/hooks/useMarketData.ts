/**
 * Real-time Market Data Hook
 * 
 * Connects to WebSocket server for live market data.
 * Provides ticker, kline, orderbook, and trade streams.
 */

import { createSignal, onCleanup, onMount, createEffect } from 'solid-js';

/** Docker 下与页面同源，由 nginx 代理 /ws → backend:8000；本地开发可设 VITE_WS_URL 或用 8000 */
function getWsUrl(): string {
  if (import.meta.env.VITE_WS_URL) return import.meta.env.VITE_WS_URL;
  if (typeof window !== 'undefined') {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${window.location.host}/ws`;
  }
  return 'ws://localhost:8000/ws';
}
const WS_URL = getWsUrl();

// Types
export interface Ticker {
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

export interface Kline {
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

export interface OrderBookLevel {
  price: string;
  quantity: string;
}

export interface OrderBook {
  symbol: string;
  bids: OrderBookLevel[];
  asks: OrderBookLevel[];
  lastUpdateId: number;
  timestamp: number;
}

export interface Trade {
  symbol: string;
  id: number;
  price: string;
  quantity: string;
  side: 'buy' | 'sell';
  timestamp: number;
}

type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

// Singleton WebSocket connection
let ws: WebSocket | null = null;
let reconnectAttempts = 0;
const HEARTBEAT_INTERVAL = 15000; // 15s 心跳
const INITIAL_RECONNECT_DELAY = 500;
const MAX_RECONNECT_DELAY = 10000; // 最大 10s 重连间隔

// Track last message time
let lastMessageTime = Date.now();
let heartbeatInterval: number | null = null;
let reconnectTimeout: number | null = null;
let isIntentionallyClosed = false;

function setupHeartbeat() {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
  }
  
  heartbeatInterval = setInterval(() => {
    const now = Date.now();
    // 心跳超时：45s 无消息则重连
    if (now - lastMessageTime > HEARTBEAT_INTERVAL * 3) {
      console.log('[WS] Heartbeat timeout - reconnecting');
      forceReconnect();
    } else if (ws?.readyState === WebSocket.OPEN) {
      try {
        ws.send(JSON.stringify({ action: 'ping' }));
      } catch (e) {
        console.log('[WS] Ping failed - reconnecting');
        forceReconnect();
      }
    }
  }, HEARTBEAT_INTERVAL) as unknown as number;
}

function forceReconnect() {
  if (ws) {
    try { ws.close(); } catch (_) {}
    ws = null;
  }
  reconnectAttempts = 0;
  scheduleReconnect();
}

function scheduleReconnect() {
  if (reconnectTimeout) {
    clearTimeout(reconnectTimeout);
  }
  
  // 指数退避，但永不放弃
  reconnectAttempts++;
  const delay = Math.min(
    INITIAL_RECONNECT_DELAY * Math.pow(1.5, Math.min(reconnectAttempts - 1, 10)),
    MAX_RECONNECT_DELAY
  );
  
  console.log(`[WS] Reconnecting in ${Math.round(delay)}ms... Attempt ${reconnectAttempts}`);
  reconnectTimeout = setTimeout(connect, delay) as unknown as number;
}

// Global state
const subscribers = new Map<string, Set<(data: any) => void>>();
const [connectionStatus, setConnectionStatus] = createSignal<ConnectionStatus>('disconnected');

function connect() {
  if (ws?.readyState === WebSocket.OPEN) return;
  
  setConnectionStatus('connecting');
  
  try {
    ws = new WebSocket(WS_URL);
    
    ws.onopen = () => {
      console.log('[WS] Connected to market data server');
      setConnectionStatus('connected');
      reconnectAttempts = 0;
      lastMessageTime = Date.now();
      setupHeartbeat();
      
      // Resubscribe only when OPEN (avoid "Still in CONNECTING state")
      const doResubscribe = () => {
        if (!ws || ws.readyState !== WebSocket.OPEN) return;
        subscribers.forEach((_, channel) => {
          ws!.send(JSON.stringify({ action: 'subscribe', channel }));
        });
      };
      if (ws?.readyState === WebSocket.OPEN) doResubscribe();
      else setTimeout(doResubscribe, 100);
    };
    
    ws.onmessage = (event) => {
      lastMessageTime = Date.now();
      
      // Skip heartbeat responses
      if (event.data === 'pong') return;
      
      try {
        const message = JSON.parse(event.data);
        
        if (message.channel) {
          const channelSubs = subscribers.get(message.channel);
          if (channelSubs) {
            channelSubs.forEach(callback => callback(message.data));
          }
        }
      } catch (e) {
        console.error('[WS] Parse error:', e);
      }
    };
    
    ws.onclose = () => {
      console.log('[WS] Disconnected');
      setConnectionStatus('disconnected');
      
      if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
        heartbeatInterval = null;
      }
      
      // 永不放弃：始终尝试重连
      scheduleReconnect();
    };
    
    ws.onerror = (error) => {
      console.error('[WS] Error:', error);
      setConnectionStatus('error');
    };
  } catch (e) {
    console.error('[WS] Connection failed:', e);
    setConnectionStatus('error');
  }
}

function subscribe(channel: string, callback: (data: any) => void) {
  if (!subscribers.has(channel)) {
    subscribers.set(channel, new Set());
    
    // Send subscribe message if connected
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ action: 'subscribe', channel }));
    }
  }
  
  subscribers.get(channel)!.add(callback);
  
  // Ensure connection
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    connect();
  }
}

function unsubscribe(channel: string, callback: (data: any) => void) {
  const channelSubs = subscribers.get(channel);
  if (channelSubs) {
    channelSubs.delete(callback);
    
    if (channelSubs.size === 0) {
      subscribers.delete(channel);
      
      // Send unsubscribe message
      if (ws?.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ action: 'unsubscribe', channel }));
      }
    }
  }
}

/**
 * Hook for real-time ticker data
 */
export function useTicker(symbol: string) {
  const [ticker, setTicker] = createSignal<Ticker | null>(null);
  const [error, setError] = createSignal<string | null>(null);
  
  onMount(() => {
    const channel = `ticker@${symbol}`;
    
    const handleData = (data: Ticker) => {
      setTicker(data);
      setError(null);
    };
    
    subscribe(channel, handleData);
    
    onCleanup(() => {
      unsubscribe(channel, handleData);
    });
  });
  
  return { ticker, error, status: connectionStatus };
}

/**
 * Hook for real-time K-line data
 */
export function useKline(symbol: string, interval: string = '1m') {
  const [kline, setKline] = createSignal<Kline | null>(null);
  const [klines, setKlines] = createSignal<Kline[]>([]);
  
  onMount(() => {
    const channel = `kline@${symbol}_${interval}`;
    
    const handleData = (data: Kline) => {
      setKline(data);
      
      // Keep last 100 klines
      setKlines(prev => {
        const updated = [...prev];
        const existingIndex = updated.findIndex(k => k.openTime === data.openTime);
        
        if (existingIndex >= 0) {
          updated[existingIndex] = data;
        } else {
          updated.push(data);
          if (updated.length > 100) updated.shift();
        }
        
        return updated;
      });
    };
    
    subscribe(channel, handleData);
    
    onCleanup(() => {
      unsubscribe(channel, handleData);
    });
  });
  
  return { kline, klines, status: connectionStatus };
}

/**
 * Hook for real-time order book
 */
export function useOrderBook(symbol: string) {
  const [orderBook, setOrderBook] = createSignal<OrderBook | null>(null);
  
  onMount(() => {
    const channel = `depth@${symbol}`;
    
    const handleData = (data: OrderBook) => {
      setOrderBook(data);
    };
    
    subscribe(channel, handleData);
    
    onCleanup(() => {
      unsubscribe(channel, handleData);
    });
  });
  
  return { orderBook, status: connectionStatus };
}

/**
 * Hook for real-time trades
 */
export function useTrades(symbol: string) {
  const [lastTrade, setLastTrade] = createSignal<Trade | null>(null);
  const [trades, setTrades] = createSignal<Trade[]>([]);
  
  onMount(() => {
    const channel = `trade@${symbol}`;
    
    const handleData = (data: Trade) => {
      setLastTrade(data);
      
      // Keep last 50 trades
      setTrades(prev => {
        const updated = [data, ...prev];
        if (updated.length > 50) updated.pop();
        return updated;
      });
    };
    
    subscribe(channel, handleData);
    
    onCleanup(() => {
      unsubscribe(channel, handleData);
    });
  });
  
  return { lastTrade, trades, status: connectionStatus };
}

/**
 * Hook for multiple tickers (market overview)
 */
export function useMultipleTickers(symbols: string[]) {
  const [tickers, setTickers] = createSignal<Map<string, Ticker>>(new Map());
  
  onMount(() => {
    const callbacks = new Map<string, (data: Ticker) => void>();
    
    symbols.forEach(symbol => {
      const channel = `ticker@${symbol}`;
      
      const handleData = (data: Ticker) => {
        setTickers(prev => {
          const updated = new Map(prev);
          updated.set(symbol, data);
          return updated;
        });
      };
      
      callbacks.set(channel, handleData);
      subscribe(channel, handleData);
    });
    
    onCleanup(() => {
      callbacks.forEach((callback, channel) => {
        unsubscribe(channel, callback);
      });
    });
  });
  
  return { tickers, status: connectionStatus };
}

/**
 * Get connection status
 */
export function useConnectionStatus() {
  return connectionStatus;
}

/**
 * Manually reconnect
 */
export function reconnect() {
  reconnectAttempts = 0;
  if (ws) {
    try { ws.close(); } catch (_) {}
    ws = null;
  }
  connect();
}

// Auto-connect on first import + 页面可见性和网络状态检测
if (typeof window !== 'undefined') {
  connect();
  
  // 页面切换回来时检查连接
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      const now = Date.now();
      // 如果超过 30s 没有消息，立即重连
      if (now - lastMessageTime > 30000 || !ws || ws.readyState !== WebSocket.OPEN) {
        console.log('[WS] Page visible - checking connection');
        forceReconnect();
      }
    }
  });
  
  // 网络恢复时重连
  window.addEventListener('online', () => {
    console.log('[WS] Network online - reconnecting');
    forceReconnect();
  });
  
  // 定期检查连接状态（每 60s）
  setInterval(() => {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      console.log('[WS] Periodic check - not connected, reconnecting');
      forceReconnect();
    }
  }, 60000);
}
