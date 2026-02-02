/**
 * Binance 可交易 USDT 币种列表：用于过滤资产列表，仅显示有数据的币种
 */

import { createSignal, onMount } from 'solid-js';
import { fetchBinanceUsdtSymbols } from '../utils/binanceApi';

let cached: Set<string> | null = null;

export function useBinanceSymbols() {
  const [symbols, setSymbols] = createSignal<Set<string>>(new Set());

  onMount(() => {
    if (cached) {
      setSymbols(cached);
      return;
    }
    fetchBinanceUsdtSymbols()
      .then((set) => {
        cached = set;
        setSymbols(set);
      })
      .catch(() => {});
  });

  return { symbols };
}

/** 过滤：仅保留在 Binance 存在的 base 币种；未加载完时返回原列表 */
export function filterByBinance<T extends { currency_name?: string; baseAsset?: string }>(
  list: T[],
  binanceSet: Set<string>
): T[] {
  if (!binanceSet || binanceSet.size === 0) return list;
  return list.filter((row) => {
    const base = (row.currency_name || row.baseAsset || '').toUpperCase();
    return base && binanceSet.has(base);
  });
}
