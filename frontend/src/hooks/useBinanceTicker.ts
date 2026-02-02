/**
 * Binance WebSocket 24hr Ticker：实时价格、涨跌幅、高低量
 */

import { createSignal, createEffect, onCleanup } from 'solid-js';
import { getBinanceWS } from '../utils/binanceWebSocket';
import type { Accessor } from 'solid-js';

export function useBinanceTicker(symbol: Accessor<string>) {
  const [price, setPrice] = createSignal(0);
  const [changePercent, setChangePercent] = createSignal(0);
  const [high24h, setHigh24h] = createSignal(0);
  const [low24h, setLow24h] = createSignal(0);
  const [volume24h, setVolume24h] = createSignal(0);

  createEffect(() => {
    const sym = symbol();
    if (!sym) return;
    const ws = getBinanceWS();
    const unsub = ws.subscribeTicker(sym, (data) => {
      const p = parseFloat(data.c || data.p || '0');
      const P = parseFloat(data.P || '0');
      const h = parseFloat(data.h || '0');
      const l = parseFloat(data.l || '0');
      const v = parseFloat(data.v || '0');
      setPrice(p);
      setChangePercent(P);
      setHigh24h(h);
      setLow24h(l);
      setVolume24h(v);
    });
    onCleanup(unsub);
  });

  return { price, changePercent, high24h, low24h, volume24h };
}
