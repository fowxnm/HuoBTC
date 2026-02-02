/**
 * WebSocket 市场数据推送管理
 * 对接 Bun 后端的实时行情系统
 */

type MessageType = 'kline' | 'daymarket' | 'depth' | 'trade' | 'status' | 'welcome';

interface KlineMessage {
  type: 'kline';
  symbol: string;
  period: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  time: number;
  change: number;
}

interface DayMarketMessage {
  type: 'daymarket';
  symbol: string;
  close: number;
  change: number;
  high: number;
  low: number;
  volume: number;
}

interface DepthMessage {
  type: 'depth';
  symbol: string;
  asks: Array<{ price: string; amount: string }>;
  bids: Array<{ price: string; amount: string }>;
}

type MarketMessage = KlineMessage | DayMarketMessage | DepthMessage;

type SubscriberCallback = (data: MarketMessage) => void;

class MarketWebSocket {
  private ws: WebSocket | null = null;
  private subscribers: Map<string, Set<SubscriberCallback>> = new Map();
  private url: string;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectInterval = 3000;
  private reconnectTimeoutId: NodeJS.Timeout | null = null;
  private isConnecting = false;
  private isManualClose = false;

  constructor(url: string = 'ws://localhost:3000/ws') {
    this.url = url;
  }

  /**
   * 连接 WebSocket
   */
  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.isConnecting) {
        reject(new Error('Connection already in progress'));
        return;
      }

      if (this.ws?.readyState === WebSocket.OPEN) {
        resolve();
        return;
      }

      this.isConnecting = true;
      this.isManualClose = false;

      try {
        this.ws = new WebSocket(this.url);

        this.ws.onopen = () => {
          console.log('[WebSocket] Connected to market data feed');
          this.reconnectAttempts = 0;
          this.isConnecting = false;
          // 仅在 OPEN 时发送，避免 "Still in CONNECTING state"
          if (this.ws?.readyState === WebSocket.OPEN) {
            const userId = localStorage.getItem('user_id');
            if (userId) this.send({ type: 'login', userId });
          } else {
            setTimeout(() => {
              const userId = localStorage.getItem('user_id');
              if (userId) this.send({ type: 'login', userId });
            }, 0);
          }
          resolve();
        };

        this.ws.onclose = (event) => {
          console.log('[WebSocket] Connection closed', event.code, event.reason);
          this.isConnecting = false;
          
          if (!this.isManualClose) {
            this.handleReconnect();
          }
        };

        this.ws.onerror = (error) => {
          console.error('[WebSocket] Error:', error);
          this.isConnecting = false;
          reject(error);
        };

        this.ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data) as MarketMessage;
            this.notifySubscribers(message.type, message);
          } catch (error) {
            console.error('[WebSocket] Failed to parse message:', error);
          }
        };
      } catch (error) {
        this.isConnecting = false;
        reject(error);
      }
    });
  }

  /**
   * 断开连接
   */
  disconnect() {
    this.isManualClose = true;
    if (this.reconnectTimeoutId) {
      clearTimeout(this.reconnectTimeoutId);
      this.reconnectTimeoutId = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  /**
   * 处理自动重连
   */
  private handleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('[WebSocket] Max reconnect attempts reached');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectInterval * Math.pow(2, this.reconnectAttempts - 1);
    
    console.log(`[WebSocket] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
    
    this.reconnectTimeoutId = setTimeout(() => {
      this.connect().catch((error) => {
        console.error('[WebSocket] Reconnection failed:', error);
      });
    }, delay);
  }

  /**
   * 订阅特定类型的市场数据
   */
  subscribe(type: MessageType, callback: SubscriberCallback): () => void {
    if (!this.subscribers.has(type)) {
      this.subscribers.set(type, new Set());
    }
    this.subscribers.get(type)!.add(callback);

    // 返回取消订阅函数
    return () => {
      const subscribers = this.subscribers.get(type);
      if (subscribers) {
        subscribers.delete(callback);
        if (subscribers.size === 0) {
          this.subscribers.delete(type);
        }
      }
    };
  }

  /**
   * 订阅特定交易对的 K 线数据
   */
  subscribeKline(symbol: string, period: string, callback: (data: KlineMessage) => void): () => void {
    const unsubscribe = this.subscribe('kline', (data) => {
      if (data.type === 'kline' && data.symbol === symbol && data.period === period) {
        callback(data as KlineMessage);
      }
    });

    // 发送订阅请求
    this.send({
      type: 'subscribe',
      channel: 'kline',
      symbol,
      period
    });

    return () => {
      unsubscribe();
      // 发送取消订阅请求
      this.send({
        type: 'unsubscribe',
        channel: 'kline',
        symbol,
        period
      });
    };
  }

  /**
   * 订阅特定交易对的行情数据
   */
  subscribeDayMarket(symbol: string, callback: (data: DayMarketMessage) => void): () => void {
    const unsubscribe = this.subscribe('daymarket', (data) => {
      if (data.type === 'daymarket' && data.symbol === symbol) {
        callback(data as DayMarketMessage);
      }
    });

    this.send({
      type: 'subscribe',
      channel: 'daymarket',
      symbol
    });

    return () => {
      unsubscribe();
      this.send({
        type: 'unsubscribe',
        channel: 'daymarket',
        symbol
      });
    };
  }

  /**
   * 订阅深度数据
   */
  subscribeDepth(symbol: string, callback: (data: DepthMessage) => void): () => void {
    const unsubscribe = this.subscribe('depth', (data) => {
      if (data.type === 'depth' && data.symbol === symbol) {
        callback(data as DepthMessage);
      }
    });

    this.send({
      type: 'subscribe',
      channel: 'depth',
      symbol
    });

    return () => {
      unsubscribe();
      this.send({
        type: 'unsubscribe',
        channel: 'depth',
        symbol
      });
    };
  }

  /**
   * 通知订阅者
   */
  private notifySubscribers(type: string, data: MarketMessage) {
    const subscribers = this.subscribers.get(type);
    if (subscribers) {
      subscribers.forEach(callback => callback(data));
    }
  }

  /**
   * 发送消息到服务器
   */
  private send(data: any) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    } else {
      console.warn('[WebSocket] Cannot send message, connection not open');
    }
  }

  /**
   * 获取连接状态
   */
  get readyState(): number {
    return this.ws?.readyState ?? WebSocket.CLOSED;
  }

  /**
   * 是否已连接
   */
  get isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}

// 单例模式 - 全局共享 WebSocket 连接
let marketWSInstance: MarketWebSocket | null = null;

function getWsUrl(): string {
  if (import.meta.env.VITE_WS_URL) return import.meta.env.VITE_WS_URL;
  if (typeof window !== 'undefined') {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${window.location.host}/ws`;
  }
  return 'ws://localhost:8000/ws';
}

export const getMarketWebSocket = (): MarketWebSocket => {
  if (!marketWSInstance) {
    marketWSInstance = new MarketWebSocket(getWsUrl());
  }
  return marketWSInstance;
};

// 导出全局实例供组件使用
export const marketWs = getMarketWebSocket();

export default MarketWebSocket;
