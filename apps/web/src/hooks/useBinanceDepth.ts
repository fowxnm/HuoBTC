/**
 * Binance 深度：REST /depth 轮询间隔与 K 线观感一致（1 秒），减少订单簿跳动
 */

import { createSignal, createEffect, onCleanup } from 'solid-js';
import { fetchBinanceDepth, type DepthLevel } from '../utils/binanceApi';
import type { Accessor } from 'solid-js';

const POLL_MS = 1000;

export function useBinanceDepth(symbol: Accessor<string>, limit: number = 20) {
  const [bids, setBids] = createSignal<DepthLevel[]>([]);
  const [asks, setAsks] = createSignal<DepthLevel[]>([]);

  createEffect(() => {
    const sym = symbol();
    if (!sym) {
      setBids([]);
      setAsks([]);
      return;
    }
    let cancelled = false;
    const poll = () => {
      fetchBinanceDepth(sym, limit)
        .then((d) => {
          if (!cancelled) {
            setBids(d.bids.slice(0, limit));
            setAsks(d.asks.slice(0, limit));
          }
        })
        .catch(() => {});
    };
    poll();
    const id = setInterval(poll, POLL_MS);
    onCleanup(() => {
      cancelled = true;
      clearInterval(id);
    });
  });

  return { bids, asks };
}
