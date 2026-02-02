/**
 * Binance 成交：REST /trades 轮询 + WebSocket 节流追加，与订单簿/K 线节奏一致（1 秒）
 */

import { createSignal, createEffect, onCleanup } from 'solid-js';
import { fetchBinanceTrades, type TradeItem } from '../utils/binanceApi';
import { getBinanceWS } from '../utils/binanceWebSocket';
import type { Accessor } from 'solid-js';

const POLL_MS = 1000;
const FLUSH_MS = 1000;
const MAX_TRADES = 50;

export function useBinanceTrades(symbol: Accessor<string>, limit: number = 50) {
  const [trades, setTrades] = createSignal<TradeItem[]>([]);

  createEffect(() => {
    const sym = symbol();
    if (!sym) {
      setTrades([]);
      return;
    }
    let cancelled = false;
    const poll = () => {
      fetchBinanceTrades(sym, limit)
        .then((list) => {
          if (!cancelled) setTrades(list);
        })
        .catch(() => {});
    };
    poll();
    const id = setInterval(poll, POLL_MS);

    let wsBuffer: TradeItem[] = [];
    let flushTimeout: ReturnType<typeof setTimeout> | null = null;
    const flush = () => {
      flushTimeout = null;
      if (cancelled || wsBuffer.length === 0) return;
      const toPrepend = [...wsBuffer];
      wsBuffer = [];
      setTrades((prev) => [...toPrepend, ...prev].slice(0, MAX_TRADES));
    };

    const ws = getBinanceWS();
    const unsubWs = ws.subscribeTrade(sym, (data) => {
      if (cancelled) return;
      const side: 'buy' | 'sell' = data.m ? 'sell' : 'buy';
      wsBuffer.push({
        id: data.t,
        price: parseFloat(data.p),
        amount: parseFloat(data.q),
        side,
        timestamp: data.T,
      });
      if (flushTimeout == null) {
        flushTimeout = setTimeout(flush, FLUSH_MS);
      }
    });

    onCleanup(() => {
      cancelled = true;
      clearInterval(id);
      if (flushTimeout != null) clearTimeout(flushTimeout);
      unsubWs();
    });
  });

  return { trades };
}
