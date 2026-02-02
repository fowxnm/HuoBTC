/**
 * 行情页 - 与 lao Vue marketQuotaion 一致
 * 加密货币行情、涨幅排行/热门币种卡片、自选/外汇/美股/期货/数字货币/ETF 标签、表格、币种图标
 */
import { Component, createSignal, onMount, For, batch } from 'solid-js';
import { A, useNavigate } from '@solidjs/router';
import { useI18n } from '../contexts/I18nContext';
import { api, formatPrice, formatPercent, formatVolume } from '../utils/api';
import { getCoinIcon, onIconError, FALLBACK_PNG } from '../utils/coinIcon';
import { formatFiatPrice } from '../utils/priceLocale';

function coinIconUrl(item: { currency_name: string; logo?: string | null }): string {
  return getCoinIcon(item.currency_name, item.logo);
}

interface MarketItem {
  currency_id: number;
  currency_name: string;
  legal_name: string;
  logo?: string;
  asset_type?: string;
  now_price: number;
  change: number;
  volume: number;
  high: number;
  low: number;
}

const TABS = [
  { id: 100, key: 'tabFav' as const },
  { id: 1, key: 'tabForex' as const },
  { id: 2, key: 'tabUs' as const },
  { id: 3, key: 'tabFutures' as const },
  { id: 4, key: 'tabCrypto' as const },
  { id: 5, key: 'tabEtf' as const },
  { id: 6, key: 'tabCommodities' as const },
] as const;

/** 行情页不展示的币种（已从列表移除） */
const HIDDEN_CURRENCIES = new Set(['USDT', 'USDC', 'MANTA']);

const QUOTATION_CACHE_KEY = 'market_quotation_cache';
const FETCH_RETRY_COUNT = 3;
const FETCH_RETRY_DELAY_MS = 2000;

/** 接口失败或空数据时使用的兜底列表（已移除 USDT/USDC/MANTA） */
const DEFAULT_MARKET_LIST: MarketItem[] = [
  'BTC', 'ETH', 'BNB', 'SOL', 'XRP', 'DOGE', 'ADA', 'AVAX', 'DOT', 'MATIC', 'LINK', 'UNI', 'ATOM', 'LTC', 'BCH', 'ETC', 'XLM', 'FIL', 'TRX',
  'ARB', 'OP', 'INJ', 'SUI', 'SEI', 'NEAR', 'FTM', 'AAVE', 'CRV', 'MKR', 'SNX', 'COMP', 'SUSHI', 'YFI', 'SAND', 'MANA', 'AXS', 'ENJ', 'CHZ',
  'FLOW', 'ICP', 'VET', 'ALGO', 'EOS', 'XTZ', 'THETA', 'GRT', 'BAT', 'ZRX', '1INCH', 'LDO', 'ZEC', 'DASH', 'HBAR', 'GMT', 'APE', 'PEPE', 'ORDI',
].map((name, i) => ({
  currency_id: i + 1,
  currency_name: name,
  legal_name: 'USDT',
  asset_type: 'crypto',
  now_price: 0,
  change: 0,
  volume: 0,
  high: 0,
  low: 0,
}));

/** 同步读取缓存，首屏即有数据，避免货币/图标闪一下 */
function getInitialMarketData(): MarketItem[] {
  try {
    const raw = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem(QUOTATION_CACHE_KEY) : null;
    if (raw) {
      const parsed = JSON.parse(raw) as MarketItem[];
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (_) {}
  return [...DEFAULT_MARKET_LIST];
}

/** 合并新行情：原地更新价格等字段；已有 logo 不覆盖，避免图标重载闪烁 */
function mergeMarketDataInPlace(current: MarketItem[], incoming: MarketItem[]): void {
  const byName = new Map(incoming.map((i) => [i.currency_name, i]));
  for (const c of current) {
    const n = byName.get(c.currency_name);
    if (n) {
      c.now_price = n.now_price;
      c.change = n.change;
      c.volume = n.volume;
      c.high = n.high;
      c.low = n.low;
      if (!c.logo && n.logo != null) c.logo = n.logo;
      if (n.asset_type != null) c.asset_type = n.asset_type;
    }
  }
  const currentNames = new Set(current.map((i) => i.currency_name));
  for (const n of incoming) {
    if (!currentNames.has(n.currency_name)) {
      current.push(n);
      currentNames.add(n.currency_name);
    }
  }
}

const Market: Component = () => {
  const { t, locale } = useI18n();
  const navigate = useNavigate();
  const [marketData, setMarketData] = createSignal<MarketItem[]>(getInitialMarketData());
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  const [searchQuery, setSearchQuery] = createSignal('');
  const [tabCurrent, setTabCurrent] = createSignal(4); // 默认数字货币

  const fetchQuotation = async () => {
    setError(null);
    let lastError: string | null = null;
    let success = false;
    for (let attempt = 0; attempt <= FETCH_RETRY_COUNT; attempt++) {
      try {
        const response = await api.get('/api/market/quotation');
        if (response.type === 'ok' && Array.isArray(response.data)) {
          const list = response.data as MarketItem[];
          if (list.length > 0) {
            const current = marketData();
            if (current.length > 0) {
              mergeMarketDataInPlace(current, list);
              const next = [...current];
              batch(() => {
                setMarketData(next);
                try { sessionStorage.setItem(QUOTATION_CACHE_KEY, JSON.stringify(next)); } catch (_) {}
              });
            } else {
              setMarketData(list);
              try { sessionStorage.setItem(QUOTATION_CACHE_KEY, JSON.stringify(list)); } catch (_) {}
            }
            success = true;
            break;
          }
          setError(t('market.quotationFallback'));
          success = true;
          break;
        }
        lastError = (response as any).message || t('market.loadFailed');
      } catch (e) {
        console.error('Failed to fetch market data:', e);
        lastError = t('market.networkError');
      }
      if (attempt < FETCH_RETRY_COUNT) {
        await new Promise((r) => setTimeout(r, FETCH_RETRY_DELAY_MS));
      }
    }
    if (!success && lastError) {
      setError(lastError + t('market.keepLastData'));
    }
  };

  onMount(() => {
    fetchQuotation();
    const id = setInterval(fetchQuotation, 5000);
    return () => clearInterval(id);
  });

  const list = () => marketData().filter((i) => !HIDDEN_CURRENCIES.has(i.currency_name));
  const increase = () => [...list()].sort((a, b) => (b.change || 0) - (a.change || 0));
  const quotation = () => list().slice(0, 12);
  const tabToAssetType = (tabId: number): string | null => {
    if (tabId === 100) return null;
    const map: Record<number, string> = { 1: 'forex', 2: 'stock', 3: 'futures', 4: 'crypto', 5: 'etf', 6: 'metal' };
    return map[tabId] ?? null;
  };
  const filteredData = () => {
    const q = searchQuery().toLowerCase();
    const tab = tabCurrent();
    const assetType = tabToAssetType(tab);
    let data = list();
    if (assetType) data = data.filter((i) => (i.asset_type || 'crypto').toLowerCase() === assetType);
    if (!q) return data;
    return data.filter(
      (i) =>
        i.currency_name.toLowerCase().includes(q) ||
        i.legal_name.toLowerCase().includes(q)
    );
  };

  const goTrade = (item: MarketItem) => {
    navigate(`/trade/${item.currency_name}-${item.legal_name}`);
  };

  return (
    <div class="quotes-page max-w-7xl mx-auto px-4 py-6 md:py-8">
      <div class="cm-card-title flex items-center gap-2 mb-4">
        <img class="w-[18px] h-[18px]" src={FALLBACK_PNG} alt="" onError={(e) => { (e.target as HTMLImageElement).src = FALLBACK_PNG; }} />
        <span class="text-gray-400">{t('market.title')}</span>
      </div>
      <h1 class="text-2xl md:text-3xl font-bold mb-6">{t('market.cryptoTitle')}</h1>

      {error() && (
        <div class="mb-4 p-3 rounded-lg bg-yellow-500/10 text-yellow-500 text-sm flex items-center justify-between gap-2 flex-wrap">
          <span>{error().includes('Request failed') ? t('market.networkOrBackendHint') : error()}</span>
          <button type="button" onClick={fetchQuotation} class="px-3 py-1.5 rounded bg-yellow-500/20 hover:bg-yellow-500/30 font-medium whitespace-nowrap">{t('common.retry')}</button>
        </div>
      )}

      {/* 涨幅排行 & 热门币种 卡片 */}
      <div class="base grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div class="item card p-4">
          <div class="title text-gray-400 mb-3">{t('market.gainers')}</div>
          <div class="list space-y-2">
            <For each={increase().slice(0, 6)}>
              {(item) => (
                <div
                  class="list-item flex items-center justify-between py-2 px-3 rounded-lg hover:bg-dark-300 cursor-pointer"
                  onClick={() => goTrade(item)}
                >
                  <div class="coin flex items-center gap-2">
                    <span class="flex-shrink-0 w-8 h-8 rounded-full bg-[#1a1b1e] overflow-hidden">
                      <img
                        class="w-full h-full object-cover"
                        src={coinIconUrl(item)}
                        alt=""
                        referrerPolicy="no-referrer"
                        decoding="async"
                        onError={(e) => onIconError(e, item.currency_name)}
                      />
                    </span>
                    <span class="font-medium">{item.currency_name}</span>
                  </div>
                  <div class="price text-sm">{item.now_price ? formatPrice(item.now_price) : t('common.noData')}{item.now_price ? <span class="text-gray-400 text-xs ml-1">{formatFiatPrice(locale(), item.now_price)}</span> : null}</div>
                  <div class={`percent text-sm ${item.change >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {formatPercent(item.change)}
                  </div>
                </div>
              )}
            </For>
          </div>
        </div>
        <div class="item card p-4">
          <div class="title text-gray-400 mb-3">{t('market.popular')}</div>
          <div class="list space-y-2">
            <For each={quotation().slice(0, 6)}>
              {(item) => (
                <div
                  class="list-item flex items-center justify-between py-2 px-3 rounded-lg hover:bg-dark-300 cursor-pointer"
                  onClick={() => goTrade(item)}
                >
                  <div class="coin flex items-center gap-2">
                    <span class="flex-shrink-0 w-8 h-8 rounded-full bg-[#1a1b1e] overflow-hidden">
                      <img
                        class="w-full h-full object-cover"
                        src={coinIconUrl(item)}
                        alt=""
                        referrerPolicy="no-referrer"
                        decoding="async"
                        onError={(e) => onIconError(e, item.currency_name)}
                      />
                    </span>
                    <span class="font-medium">{item.currency_name}</span>
                  </div>
                  <div class="price text-sm">{item.now_price ? formatPrice(item.now_price) : t('common.noData')}{item.now_price ? <span class="text-gray-400 text-xs ml-1">{formatFiatPrice(locale(), item.now_price)}</span> : null}</div>
                  <div class={`percent text-sm ${item.change >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {formatPercent(item.change)}
                  </div>
                </div>
              )}
            </For>
          </div>
        </div>
      </div>

      {/* 标签 + 搜索 */}
      <div class="tab-base flex flex-wrap items-center justify-between gap-4 mb-4">
        <div class="cm-tabs-group flex flex-wrap gap-1">
          <span
            class={`cm-tab px-3 py-1.5 rounded cursor-pointer text-sm ${tabCurrent() === 100 ? 'bg-primary/20 text-primary' : 'text-gray-400 hover:text-white'}`}
            onClick={() => setTabCurrent(100)}
          >
            {t('market.tabFav')}
          </span>
          <For each={TABS.filter((x) => x.id !== 100)}>
            {(tab) => (
              <span
                class={`cm-tab px-3 py-1.5 rounded cursor-pointer text-sm ${tabCurrent() === tab.id ? 'bg-primary/20 text-primary' : 'text-gray-400 hover:text-white'}`}
                onClick={() => setTabCurrent(tab.id)}
              >
                {t(`market.${tab.key}`)}
              </span>
            )}
          </For>
        </div>
        <div class="search flex-1 min-w-[200px] max-w-xs">
          <div class="relative">
            <input
              type="text"
              placeholder={t('market.searchPlaceholder')}
              class="w-full bg-dark-300 border border-gray-700 rounded-lg pl-10 pr-4 py-2 text-sm"
              value={searchQuery()}
              onInput={(e) => setSearchQuery(e.target.value)}
            />
            <svg class="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </div>
      </div>

      {/* 表格 */}
      <div class="card overflow-hidden">
        <div class="overflow-x-auto">
          <table class="w-full">
            <thead>
              <tr class="border-b border-gray-700 text-gray-400 text-sm">
                <th class="text-left py-3 px-4">{t('market.currency')}</th>
                <th class="text-center py-3 px-4">{t('market.closingPrice')}</th>
                <th class="text-center py-3 px-4">{t('market.change24')}</th>
                <th class="text-center py-3 px-4 hidden md:table-cell">{t('market.high')}</th>
                <th class="text-center py-3 px-4 hidden md:table-cell">{t('market.low')}</th>
                <th class="text-center py-3 px-4 hidden lg:table-cell">{t('market.volume')}</th>
                <th class="text-center py-3 px-4">{t('market.marketTrade')}</th>
              </tr>
            </thead>
            <tbody>
              <For each={filteredData()}>
                {(item) => (
                  <tr
                    class="border-b border-gray-800 hover:bg-dark-300 cursor-pointer"
                    onClick={() => goTrade(item)}
                  >
                    <td class="py-3 px-4">
                      <div class="flex items-center gap-2">
                        <span class="text-yellow-500/80 cursor-default">★</span>
                        <span class="flex-shrink-0 w-6 h-6 rounded-full bg-[#1a1b1e] overflow-hidden">
                          <img
                            class="w-full h-full object-cover"
                            src={coinIconUrl(item)}
                            alt=""
                            referrerPolicy="no-referrer"
                            decoding="async"
                            onError={(e) => onIconError(e, item.currency_name)}
                          />
                        </span>
                        <span>{item.currency_name}</span>
                      </div>
                    </td>
                    <td class="text-center py-3 px-4 font-mono">{item.now_price ? formatPrice(item.now_price) : t('common.noData')}{item.now_price ? <span class="text-gray-400 text-xs block">{formatFiatPrice(locale(), item.now_price)}</span> : null}</td>
                    <td class="text-center py-3 px-4">
                      <span class={item.change >= 0 ? 'text-green-400' : 'text-red-400'}>
                        {formatPercent(item.change)}
                      </span>
                    </td>
                    <td class="text-center py-3 px-4 text-gray-400 hidden md:table-cell">{item.high ? formatPrice(item.high) : t('common.noData')}{item.high ? <span class="text-gray-500 text-xs block">{formatFiatPrice(locale(), item.high)}</span> : null}</td>
                    <td class="text-center py-3 px-4 text-gray-400 hidden md:table-cell">{item.low ? formatPrice(item.low) : t('common.noData')}{item.low ? <span class="text-gray-500 text-xs block">{formatFiatPrice(locale(), item.low)}</span> : null}</td>
                    <td class="text-center py-3 px-4 text-gray-400 hidden lg:table-cell">{item.now_price && item.volume ? formatVolume((item.volume || 0) * (item.now_price || 0)) : t('common.noData')}</td>
                    <td class="text-center py-3 px-4">
                      <A
                        href={`/trade/${item.currency_name}-${item.legal_name}`}
                        class="inline-block px-4 py-1.5 rounded bg-primary/20 text-primary text-sm hover:bg-primary/30"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {t('common.trade')}
                      </A>
                    </td>
                  </tr>
                )}
              </For>
            </tbody>
          </table>
        </div>
        {loading() && (
          <div class="text-center py-12 text-gray-500">{t('common.loading')}</div>
        )}
        {!loading() && filteredData().length === 0 && (
          <div class="text-center py-12 text-gray-500">{t('market.noQuotation')}</div>
        )}
      </div>
    </div>
  );
};

export default Market;
