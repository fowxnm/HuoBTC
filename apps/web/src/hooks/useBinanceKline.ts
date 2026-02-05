/**
 * 拉取 Binance 真实 K 线，供 K 线图使用；失败时由调用方回退 mock
 */

import { createSignal, createEffect } from 'solid-js';
import { fetchBinanceKlines, type OHLCBar } from '../utils/binanceKline';
import type { Accessor } from 'solid-js';

export function useBinanceKline(symbol: Accessor<string>, interval: Accessor<string>) {
  const [bars, setBars] = createSignal<OHLCBar[]>([]);
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);

  createEffect((prev: { sym?: string; int?: string } | undefined) => {
    const sym = symbol();
    const int = interval();
    const changed = !prev || prev.sym !== sym || prev.int !== int;
    if (!sym) {
      if (changed) setBars([]);
      setLoading(false);
      return { sym, int };
    }
    if (changed) setBars([]);
    setLoading(true);
    setError(null);
    fetchBinanceKlines(sym, int)
      .then((data) => {
        setBars(data);
        setError(null);
      })
      .catch((e) => {
        setError(e?.message || 'Failed to load klines');
        // 不清空 bars，保留上次数据，避免刷新后图表空白
      })
      .finally(() => setLoading(false));
    return { sym, int };
  });

  return { bars, loading, error };
}
