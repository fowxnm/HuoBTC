/**
 * 选币抽屉：从左侧平滑弹出，支持搜索 + 虚拟列表，选币后收起并联动 K 线/订单簿
 */

import { Component, createSignal, createMemo, onMount, onCleanup, For } from 'solid-js';
import { useI18n } from '../contexts/I18nContext';
import { formatFiatPrice } from '../utils/priceLocale';

export interface MarketRow {
  currency_id: number;
  currency_name: string;
  legal_id: number;
  legal_name: string;
  now_price: number;
  change: number;
  high?: number;
  low?: number;
  volume?: number;
  logo?: string;
}

interface MarketDrawerProps {
  open: boolean;
  onClose: () => void;
  markets: MarketRow[];
  quoteTab: string;
  onSelectPair: (row: MarketRow) => void;
  t: (key: string) => string;
  coinIconUrl: (row: MarketRow) => string;
  onIconError: (e: Event, symbol?: string) => void;
  formatPrice: (n: number) => string;
  formatNumber: (n: number, frac?: number) => string;
  formatPercent: (n: number) => string;
}

const ROW_HEIGHT = 48;
const OVERSCAN = 5;

const MarketDrawer: Component<MarketDrawerProps> = (props) => {
  const { locale } = useI18n();
  const [search, setSearch] = createSignal('');
  const [scrollTop, setScrollTop] = createSignal(0);
  let listEl: HTMLDivElement | undefined;

  const filtered = createMemo(() => {
    const list = props.markets;
    const q = search().toLowerCase().trim();
    if (!q) return list;
    return list.filter((m) => m.currency_name.toLowerCase().includes(q));
  });

  const totalHeight = () => filtered().length * ROW_HEIGHT;

  const visibleRange = createMemo(() => {
    const list = filtered();
    const len = list.length;
    if (len === 0) return { start: 0, end: 0 };
    const st = scrollTop();
    const start = Math.max(0, Math.floor(st / ROW_HEIGHT) - OVERSCAN);
    const visibleCount = 30 + OVERSCAN * 2;
    const end = Math.min(len - 1, start + visibleCount);
    return { start, end };
  });

  const visibleRows = createMemo(() => {
    const list = filtered();
    const { start, end } = visibleRange();
    return list.slice(start, end + 1).map((row, i) => ({ row, index: start + i }));
  });

  const onScroll = (e: Event) => {
    const el = e.target as HTMLDivElement;
    setScrollTop(el.scrollTop);
  };

  onMount(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && props.open) props.onClose();
    };
    window.addEventListener('keydown', handleEscape);
    onCleanup(() => window.removeEventListener('keydown', handleEscape));
  });

  if (!props.open) return null;

  return (
    <>
      <div
        class="fixed inset-0 bg-black/50 z-40 transition-opacity"
        onClick={props.onClose}
        role="presentation"
      />
      <div
        class="fixed left-0 top-0 bottom-0 w-[320px] max-w-[90vw] bg-[#1e2329] border-r border-[#2c2c3e] z-50 flex flex-col shadow-xl transition-transform duration-300 ease-out"
        style={{ transform: props.open ? 'translateX(0)' : 'translateX(-100%)' }}
      >
        <div class="flex items-center justify-between p-3 border-b border-[#2c2c3e]">
          <h3 class="text-sm font-medium text-white">{props.t('market.viewMore')}</h3>
          <button
            type="button"
            class="p-1.5 rounded hover:bg-[#252628] text-gray-400 hover:text-white"
            onClick={props.onClose}
            aria-label="Close"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <input
          type="text"
          class="mx-3 mt-2 px-3 py-2 rounded bg-[#0b0e11] border border-[#2c2c3e] text-white text-sm placeholder-gray-500 w-[calc(100%-24px)]"
          placeholder={props.t('market.searchPlaceholderSymbol')}
          value={search()}
          onInput={(e) => setSearch((e.target as HTMLInputElement).value)}
        />
        <div
          ref={listEl}
          class="flex-1 overflow-y-auto trade-market-list mt-2"
          onScroll={onScroll}
          style={{ 'min-height': '200px' }}
        >
          <div style={{ height: `${totalHeight()}px`, position: 'relative' }}>
            <For each={visibleRows()}>
              {({ row, index }) => (
                <div
                  style={{
                    position: 'absolute',
                    left: 0,
                    right: 0,
                    top: `${index * ROW_HEIGHT}px`,
                    height: `${ROW_HEIGHT}px`,
                  }}
                  class="flex items-center gap-2 px-3 border-b border-[#252628] hover:bg-[#252628] cursor-pointer transition"
                  onClick={() => {
                    props.onSelectPair(row);
                    props.onClose();
                  }}
                >
                  <img
                    src={props.coinIconUrl(row)}
                    alt=""
                    class="w-8 h-8 rounded-full flex-shrink-0"
                    data-symbol={row.currency_name}
                    referrerPolicy="no-referrer"
                    onError={(e) => props.onIconError(e, row.currency_name)}
                  />
                  <div class="flex-1 min-w-0">
                    <div class="text-white text-sm truncate">{row.currency_name}/{row.legal_name}</div>
                    <div class="text-[10px] text-gray-500 mono">{props.formatNumber(row.volume ?? 0, 4)}</div>
                  </div>
                  <div class="flex flex-col items-end text-right mono text-xs">
                    <span class="text-white">{props.formatPrice(row.now_price ?? 0)}</span>
                    <span class="text-gray-400 text-[10px]">{formatFiatPrice(locale(), row.now_price ?? 0)}</span>
                    <span class={(row.change ?? 0) >= 0 ? 'text-green-500' : 'text-red-500'}>
                      {((row.change ?? 0) >= 0 ? '+' : '')}{props.formatPercent((row.change ?? 0) / 100)}
                    </span>
                  </div>
                </div>
              )}
            </For>
          </div>
        </div>
      </div>
    </>
  );
};

export default MarketDrawer;
