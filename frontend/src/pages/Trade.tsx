import { Component, createSignal, createEffect, onMount, Show, For } from 'solid-js';
import type { MarketRow } from '../contexts/TradingContext';
import { useParams, useNavigate } from '@solidjs/router';
import { useI18n } from '../contexts/I18nContext';
import { useAuth } from '../contexts/AuthContext';
import { api, formatPrice, formatNumber, formatPercent } from '../utils/api';
import { tradeApi } from '../utils/api';
import { useTrading } from '../contexts/TradingContext';
import { useAccount } from '../hooks/useAccount';
import { useMockPriceEngine } from '../hooks/useMockPriceEngine';
import { useBinanceKline } from '../hooks/useBinanceKline';
import { useBinanceTicker } from '../hooks/useBinanceTicker';
import { useBinanceDepth } from '../hooks/useBinanceDepth';
import { useBinanceTrades } from '../hooks/useBinanceTrades';
import { useBinanceSymbols, filterByBinance } from '../hooks/useBinanceSymbols';
import KlineChart from '../components/KlineChart';
import OrderBook from '../components/OrderBook';
import RecentTrades from '../components/RecentTrades';
import NewsFeed from '../components/NewsFeed';
import MarketDrawer from '../components/MarketDrawer';
import TradingModeSwitch from '../components/TradingModeSwitch';
import { openConnectModal } from '../appkit/openAppKit';
import { ErrorBoundary } from 'solid-js';
import { getCoinIcon, onIconError as onCoinIconError } from '../utils/coinIcon';
import { formatFiatPrice } from '../utils/priceLocale';

function coinIconUrl(item: { currency_name: string; logo?: string | null }): string {
  return getCoinIcon(item.currency_name, item.logo);
}
function onIconError(e: Event, symbol?: string): void {
  onCoinIconError(e, symbol);
}

/** 精选列表默认展示的前 15 个热门币种 */
const TOP_15_SYMBOLS = ['BTC', 'ETH', 'BNB', 'SOL', 'XRP', 'DOGE', 'ADA', 'AVAX', 'DOT', 'MATIC', 'LINK', 'UNI', 'ATOM', 'LTC', 'BCH'];
const FAVORITES_STORAGE_KEY = 'trade_favorites';

const QUOTE_TABS = ['USDT', 'BTC', 'ETH'] as const;
/** K 线周期：实时 15分 4时 1日 1周 1月 1年，文案由 i18n 提供 */
const PERIOD_KEYS = ['1m', '15m', '4h', '1d', '1w', '1M', '1y'] as const;
const PERIOD_I18N: Record<string, string> = {
  '1m': 'kline.realtime',
  '15m': 'kline.m15',
  '4h': 'kline.h4',
  '1d': 'kline.d1',
  '1w': 'kline.w1',
  '1M': 'kline.mo1',
  '1y': 'kline.y1',
};

const Trade: Component = () => {
  const params = useParams();
  const navigate = useNavigate();
  const { t, locale } = useI18n();
  const { isLoggedIn } = useAuth();
  const { activePair, setActivePair, activeSymbol, quoteCurrency, getBalance, updateBalances, marketList } = useTrading();
  const { isConnected, getBalanceDisplay, getBalanceRaw, hasSufficientBalance } = useAccount();
  const [orderType, setOrderType] = createSignal<'limit' | 'market'>('limit');
  const [side, setSide] = createSignal<'buy' | 'sell'>('buy');
  const [price, setPrice] = createSignal('');
  const [amount, setAmount] = createSignal('');
  const [tradeAmount, setTradeAmount] = createSignal('');
  const [quoteTab, setQuoteTab] = createSignal<'USDT' | 'BTC' | 'ETH'>('USDT');
  const [searchQuery, setSearchQuery] = createSignal('');
  const [listViewTab, setListViewTab] = createSignal<'featured' | 'favorites' | 'all'>('featured');
  const [drawerOpen, setDrawerOpen] = createSignal(false);
  const initialFavorites = ((): string[] => {
    try {
      const raw = localStorage.getItem(FAVORITES_STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  })();
  const [favorites, setFavorites] = createSignal<string[]>(initialFavorites);
  const [klinePeriod, setKlinePeriod] = createSignal('1m');
  const [rightTab, setRightTab] = createSignal<'book' | 'trades'>('book');
  const [currentPrice, setCurrentPrice] = createSignal(0);
  const [change24h, setChange24h] = createSignal(0);
  const [high24h, setHigh24h] = createSignal(0);
  const [low24h, setLow24h] = createSignal(0);
  const [volume24h, setVolume24h] = createSignal(0);
  const [orderHistory, setOrderHistory] = createSignal<any[]>([]);
  const [wallets, setWallets] = createSignal<Array<{ currency: number; legal_balance: string; change_balance: string }>>([]);
  
  /** 是否使用模拟数据模式（当后端无真实数据时） */
  const useMockData = () => binanceTicker.price() === 0;

  const pair = () => activePair() || 'BTC-USDT';
  const currency = () => activeSymbol();
  const legal = () => quoteCurrency();
  const wsSymbol = () => currency();

  createEffect(() => {
    const p = params.pair;
    if (p) setActivePair(p);
    else setActivePair('BTC-USDT');
  });

  const mockEngine = useMockPriceEngine(() => activeSymbol());
  const binanceKline = useBinanceKline(() => activeSymbol(), klinePeriod);
  const binanceTicker = useBinanceTicker(() => activeSymbol());
  const binanceDepth = useBinanceDepth(() => activeSymbol(), 20);
  const binanceTrades = useBinanceTrades(() => activeSymbol(), 50);
  const { symbols: binanceSymbols } = useBinanceSymbols();
  const [priceFlash, setPriceFlash] = createSignal<'price-flash-up' | 'price-flash-down' | ''>('');
  /** K 线数据：优先 Binance 真实数据，无则用 mock */
  const getKlineBars = () => {
    const b = binanceKline.bars();
    return b.length > 0 ? b : mockEngine.getBarsForInterval(klinePeriod());
  };
  const realKlineBars = () => (binanceKline.bars().length > 0 ? binanceKline.bars() : undefined);

  createEffect(() => {
    const next = binanceTicker.price();
    const prev = currentPrice();
    if (next > 0) {
      setCurrentPrice(next);
      setChange24h(binanceTicker.changePercent());
      setHigh24h(binanceTicker.high24h());
      setLow24h(binanceTicker.low24h());
      setVolume24h(binanceTicker.volume24h());
    }
    if (prev > 0 && next > 0 && next !== prev) {
      setPriceFlash(next > prev ? 'price-flash-up' : 'price-flash-down');
      setTimeout(() => setPriceFlash(''), 300);
    }
  });

  const total = () => {
    const p = parseFloat(price()) || currentPrice();
    const a = parseFloat(amount()) || 0;
    return (p * a).toFixed(2);
  };


  const orderbookBids = () => binanceDepth.bids();
  const orderbookAsks = () => binanceDepth.asks();
  const tradeList = () => binanceTrades.trades();

  /** 仅显示 Binance 可交易 USDT 币种 */
  const filteredMarkets = () => {
    let list = filterByBinance(
      marketList().filter((m) => m.legal_name === quoteTab() && m.currency_name !== m.legal_name),
      binanceSymbols()
    );
    const q = searchQuery().toLowerCase();
    if (q) list = list.filter((m) => m.currency_name.toLowerCase().includes(q));
    return list;
  };

  /** 精选：当前计价下前 15 个热门（按 TOP_15 顺序，不足则用列表其余补足），仅 Binance 存在 */
  const featuredList = () => {
    const byQuote = filterByBinance(
      marketList().filter((m) => m.legal_name === quoteTab() && m.currency_name !== m.legal_name),
      binanceSymbols()
    );
    const ordered = [...byQuote].sort((a, b) => {
      const ai = TOP_15_SYMBOLS.indexOf(a.currency_name);
      const bi = TOP_15_SYMBOLS.indexOf(b.currency_name);
      if (ai === -1 && bi === -1) return 0;
      if (ai === -1) return 1;
      if (bi === -1) return -1;
      return ai - bi;
    });
    return ordered.slice(0, 15);
  };

  /** 自选：当前计价下在 favorites 中的交易对，仅 Binance 存在 */
  const favoritesList = () => {
    const fav = favorites();
    const byQuote = filterByBinance(
      marketList().filter((m) => m.legal_name === quoteTab() && m.currency_name !== m.legal_name),
      binanceSymbols()
    );
    return byQuote.filter((m) => fav.includes(`${m.currency_name}-${m.legal_name}`));
  };

  const leftPanelList = () => {
    if (listViewTab() === 'featured') return featuredList();
    if (listViewTab() === 'favorites') return favoritesList();
    return filteredMarkets();
  };

  const toggleFavorite = (pairKey: string) => {
    setFavorites((prev) => {
      const next = prev.includes(pairKey) ? prev.filter((p) => p !== pairKey) : [...prev, pairKey];
      try { localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  };

  const isFavorite = (pairKey: string) => favorites().includes(pairKey);

  createEffect(() => {
    const list = marketList();
    const p = pair();
    const current = list.find((item) => `${item.currency_name}-${item.legal_name}` === p);
    if (current) {
      setCurrentPrice(current.now_price ?? 0);
      setChange24h(current.change ?? 0);
      setHigh24h(current.high ?? current.now_price ?? 0);
      setLow24h(current.low ?? current.now_price ?? 0);
      setVolume24h(current.volume ?? 0);
    }
  });

  onMount(async () => {
    try {
      if (isLoggedIn()) {
        const [hisRes, listRes] = await Promise.all([
          tradeApi.history(1, 20),
          api.get('/api/wallet/list'),
        ]);
        if (hisRes.type === 'ok' && hisRes.data) {
          const list = Array.isArray((hisRes.data as any).list) ? (hisRes.data as any).list : (Array.isArray(hisRes.data) ? hisRes.data : []);
          setOrderHistory(list);
        }
        if (listRes.type === 'ok' && Array.isArray(listRes.data)) {
          setWallets(listRes.data.map((w: any) => ({
            currency: w.currency,
            legal_balance: w.legal_balance ?? '0',
            change_balance: w.change_balance ?? '0',
          })));
        }
      }
    } catch (e) {
      console.error('Trade init:', e);
    }
  });

  const onSelectPair = (row: MarketRow) => {
    const p = `${row.currency_name}-${row.legal_name}`;
    setActivePair(p);
    navigate(`/trade/${p}`, { replace: true });
    // 立即用选中行的行情更新「跟踪」数据，无需刷新
    setCurrentPrice(row.now_price ?? 0);
    setChange24h(row.change ?? 0);
    setHigh24h(row.high ?? row.now_price ?? 0);
    setLow24h(row.low ?? row.now_price ?? 0);
    setVolume24h(row.volume ?? 0);
  };

  const handleSubmit = async () => {
    if (!isLoggedIn()) {
      openConnectModal();
      return;
    }
    const amt = parseFloat(amount()) || 0;
    if (amt <= 0) {
      alert('请输入有效数量');
      return;
    }
    if (useMockData()) {
      const base = activeSymbol();
      const quote = legal();
      const execPrice = orderType() === 'market' ? mockEngine.lastPrice() : (parseFloat(price()) || mockEngine.lastPrice());
      const cost = execPrice * amt;
      if (side() === 'buy') {
        if (!hasSufficientBalance(quote, cost)) {
          alert(t('account.insufficientBalance'));
          return;
        }
        updateBalances({ [quote]: -cost, [base]: amt });
        mockEngine.recordUserTrade(execPrice, amt, 'buy');
      } else {
        if (!hasSufficientBalance(base, amt)) {
          alert(t('account.insufficientBalance'));
          return;
        }
        updateBalances({ [base]: -amt, [quote]: cost });
        mockEngine.recordUserTrade(execPrice, amt, 'sell');
      }
      setAmount('');
      setPrice('');
      setTradeAmount('');
      return;
    }
    const base = currency();
    const quote = legal();
    const pairInfo = marketList().find((m) => m.currency_name === base && m.legal_name === quote);
    const currencyId = pairInfo?.currency_id ?? 1;
    const legalId = pairInfo?.legal_id ?? 3;
    const endpoint = side() === 'buy' ? '/api/trade/buy' : '/api/trade/sell';
    try {
      const response = await api.post(endpoint, {
        currency_id: currencyId,
        legal_id: legalId,
        price: orderType() === 'limit' ? parseFloat(price()) : currentPrice(),
        number: amt,
        type: orderType() === 'limit' ? 1 : 2,
      });
      if (response.type === 'ok') {
        setAmount('');
        setPrice('');
        setTradeAmount('');
        const [hisRes, listRes] = await Promise.all([
          tradeApi.history(1, 20),
          api.get('/api/wallet/list'),
        ]);
        if (hisRes.type === 'ok' && hisRes.data) {
          const list = Array.isArray((hisRes.data as any).list) ? (hisRes.data as any).list : (Array.isArray(hisRes.data) ? hisRes.data : []);
          setOrderHistory(list);
        }
        if (listRes.type === 'ok' && Array.isArray(listRes.data)) {
          setWallets(listRes.data.map((w: any) => ({
            currency: w.currency,
            legal_balance: w.legal_balance ?? '0',
            change_balance: w.change_balance ?? '0',
          })));
        }
      } else {
        alert((response as any).message || 'Order failed');
      }
    } catch {
      alert('Failed to place order');
    }
  };

  const pairInfo = () => {
    const base = currency();
    const quote = legal();
    return marketList().find((m) => m.currency_name === base && m.legal_name === quote);
  };
  const buyMaxAmount = () => {
    if (useMockData()) {
      const p = currentPrice() || 1;
      return p > 0 ? getBalanceRaw(legal()) / p : 0;
    }
    const info = pairInfo();
    if (!info) return 0;
    const w = wallets().find((x) => x.currency === info.legal_id);
    const bal = parseFloat(w?.legal_balance ?? '0');
    const p = currentPrice() || 1;
    return p > 0 ? bal / p : 0;
  };
  const sellMaxAmount = () => {
    if (useMockData()) return getBalanceRaw(activeSymbol());
    const info = pairInfo();
    if (!info) return 0;
    const w = wallets().find((x) => x.currency === info.currency_id);
    return parseFloat(w?.change_balance ?? '0');
  };
  const setAmountByPct = (pct: number) => {
    const isBuy = side() === 'buy';
    const max = isBuy ? buyMaxAmount() : sellMaxAmount();
    setAmount((max * (pct / 100)).toFixed(4));
  };


  const [bottomTab, setBottomTab] = createSignal<'orders' | 'history' | 'balance'>('orders');

  return (
    <ErrorBoundary fallback={<div class="p-4 text-red-400">{t('common.pageLoadError')}</div>}>
      <div class="trade-page-bizzan bg-[#0b0e11] min-h-screen flex flex-col pb-16 md:pb-0">
        {/* 手机版：交易模式快捷切换 */}
        <div class="md:hidden p-2 bg-[#0b0e11] border-b border-[#2c2c3e]">
          <TradingModeSwitch />
        </div>
        <div class="trade-grid flex-1 p-2 gap-2 min-h-0 max-h-[calc(100vh-120px)] md:max-h-[calc(100vh-56px)] overflow-hidden">
          {/* 1. 左侧：币对列表，固定高度成比例 */}
          <div class="trade-left flex flex-col bg-[#1e2329] rounded border border-[#2c2c3e] max-h-[calc(100vh-100px)]">
            <div class="flex gap-0.5 p-1.5 border-b border-[#2c2c3e]">
              <For each={QUOTE_TABS}>
                {(tab) => (
                  <button type="button" class={`flex-1 py-0.5 text-[10px] rounded mono ${quoteTab() === tab ? 'bg-[#4dd0e1] text-black' : 'bg-[#252628] text-gray-400'}`} onClick={() => setQuoteTab(tab)}>{tab}</button>
                )}
              </For>
            </div>
            <div class="flex gap-0.5 px-1 pb-1 border-b border-[#2c2c3e]">
              {(['featured', 'favorites', 'all'] as const).map((tab) => (
                <button
                  type="button"
                  class={`flex-1 py-0.5 text-[9px] rounded ${listViewTab() === tab ? 'bg-[#4dd0e1] text-black' : 'text-gray-500 hover:bg-[#252628]'}`}
                  onClick={() => setListViewTab(tab)}
                >
                  {tab === 'featured' ? t('market.tabFeatured') : tab === 'favorites' ? t('market.tabFav') : t('market.tabAll')}
                </button>
              ))}
            </div>
            <Show when={listViewTab() === 'all'}>
              <input
                type="text"
                class="mx-1.5 mt-0.5 px-1.5 py-0.5 rounded bg-[#0b0e11] border border-[#2c2c3e] text-white text-[10px] placeholder-gray-500"
                placeholder={t('market.searchPlaceholder')}
                value={searchQuery()}
                onInput={(e) => setSearchQuery((e.target as HTMLInputElement).value)}
              />
            </Show>
            <div class="px-1.5 text-[9px] text-gray-500 flex justify-between border-b border-[#2c2c3e] py-0.5">
              <span>{t('trade.contractLabel')}</span>
              <span>{t('trade.priceChange')}</span>
            </div>
            <div class="flex-1 min-h-0 flex flex-col overflow-hidden">
              <div class="trade-market-list flex-1 min-h-0 overflow-y-auto">
                <For each={leftPanelList()}>
                  {(row) => {
                    const pairKey = `${row.currency_name}-${row.legal_name}`;
                    const isActive = pair() === pairKey;
                    const flashClass = isActive ? priceFlash() : '';
                    return (
                      <div
                        class={`trade-market-row w-full flex items-center gap-1 text-left transition ${isActive ? 'bg-[#2c2c3e]' : 'hover:bg-[#252628]'}`}
                        role="button"
                        tabIndex={0}
                        onClick={() => onSelectPair(row)}
                        onKeyDown={(e) => e.key === 'Enter' && onSelectPair(row)}
                      >
                        <button
                          type="button"
                          class="flex-shrink-0 p-0.5 rounded hover:bg-[#3a3a4a] text-gray-500 hover:text-[#f0b90b] focus:outline-none"
                          onClick={(e) => { e.stopPropagation(); toggleFavorite(pairKey); }}
                          title={isFavorite(pairKey) ? '取消自选' : '添加自选'}
                          aria-label={isFavorite(pairKey) ? '取消自选' : '添加自选'}
                        >
                          <svg class="w-3.5 h-3.5" fill={isFavorite(pairKey) ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                          </svg>
                        </button>
                        <img src={coinIconUrl(row)} alt="" class="w-4 h-4 rounded-full flex-shrink-0" data-symbol={row.currency_name} referrerPolicy="no-referrer" onError={(e) => onIconError(e, row.currency_name)} />
                        <div class="flex-1 min-w-0">
                          <div class="text-white text-[10px] truncate">{row.currency_name}/{row.legal_name}</div>
                          <div class="text-[8px] text-gray-500 mono">{formatNumber(row.volume ?? 0, 2)}</div>
                        </div>
                        <div class={`flex flex-col items-end text-right mono text-[10px] ${flashClass}`}>
                          <span class="text-white">{formatPrice(row.now_price ?? 0)}</span>
                          <span class={((row.change ?? 0) >= 0) ? 'text-green-500' : 'text-red-500'}>
                            {((row.change ?? 0) >= 0) ? '+' : ''}{formatPercent((row.change ?? 0) / 100)}
                          </span>
                        </div>
                      </div>
                    );
                  }}
                </For>
              </div>
              <button
                type="button"
                class="w-full py-1 text-[10px] text-[#4dd0e1] hover:bg-[#252628] border-t border-[#2c2c3e] transition"
                onClick={() => setDrawerOpen(true)}
              >
                {t('market.viewMore')}
              </button>
            </div>
          </div>

          {/* 2. 中间：K 线 + 下方委托/历史/资产，填满不溢出 */}
          <div class="trade-center flex flex-col min-w-0 flex-1 min-h-0">
            <div class="bg-[#1e2329] rounded-lg border border-[#2c2c3e] p-2 flex flex-col flex-1 min-h-0 overflow-hidden">
              {/* 手机版：顶部一行 选币 + 最新价 + 24h涨跌 */}
              <div class="trade-mobile-price-row border-b border-[#2c2c3e] pb-1.5">
                <button type="button" class="flex items-center gap-1 text-white font-medium" onClick={() => setDrawerOpen(true)}>
                  <span class="mono">{currency()}/{legal()}</span>
                  <svg class="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" /></svg>
                </button>
                <span class={`mono font-semibold ${change24h() >= 0 ? 'text-green-500' : 'text-red-500'}`}>{formatPrice(currentPrice())}</span>
                <span class={change24h() >= 0 ? 'text-green-500 text-sm' : 'text-red-500 text-sm'}>{formatPercent(change24h() / 100)}</span>
              </div>
              {/* 桌面版：完整行情一行 */}
              <div class="trade-mobile-detail flex flex-wrap items-center gap-3 mb-1.5 text-xs mono border-b border-[#2c2c3e] pb-1.5">
                <button type="button" class="text-white font-medium hover:text-[#4dd0e1] transition flex items-center gap-1" onClick={() => setDrawerOpen(true)} title={t('market.viewMore')}>
                  <span>{currency()}/{legal()}</span>
                  <svg class="w-3.5 h-3.5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" /></svg>
                </button>
                <span class="text-gray-500">最新价</span>
                <span class={`font-semibold ${change24h() >= 0 ? 'text-green-500' : 'text-red-500'}`}>{formatPrice(currentPrice())}</span>
                <span class="text-gray-400">{formatFiatPrice(locale(), currentPrice())}</span>
                <span class="text-gray-500">{t('trade.change24h')}</span>
                <span class={change24h() >= 0 ? 'text-green-500' : 'text-red-500'}>{formatPercent(change24h() / 100)}</span>
                <span class="text-gray-500">24h最高</span>
                <span class="mono text-white">{formatPrice(high24h())}</span>
                <span class="text-gray-500">24h最低</span>
                <span class="mono text-white">{formatPrice(low24h())}</span>
                <span class="text-gray-500">成交量</span>
                <span class="mono text-white">{formatNumber(volume24h(), 4)} {currency()}</span>
              </div>
              <div class="flex gap-1 mb-2">
                <For each={PERIOD_KEYS}>
                  {(key) => (
                    <button
                      type="button"
                      class={`px-2 py-1 text-[11px] rounded mono ${klinePeriod() === key ? 'bg-[#4dd0e1] text-black' : 'bg-[#252628] text-gray-400 hover:bg-[#2c2c3e]'}`}
                      onClick={() => setKlinePeriod(key)}
                    >
                      {t(PERIOD_I18N[key] as any)}
                    </button>
                  )}
                </For>
              </div>
              <div class="flex-1 min-h-[260px] flex items-stretch trade-mobile-chart">
                <Show when={`${currency()}-${klinePeriod()}`} keyed>
                  {(pairKey) => (
                    <KlineChart
                      symbol={currency()}
                      interval={klinePeriod()}
                      height={280}
                      useMock={true}
                      realBars={realKlineBars()}
                      getMockBars={getKlineBars}
                      getMockCurrentBar={() => mockEngine.getCurrentBarForInterval(klinePeriod())}
                      getMockLastPrice={() => mockEngine.lastPrice()}
                      getMockCurrentBarStartTime={() => mockEngine.getCurrentBarStartTime(klinePeriod())}
                    />
                  )}
                </Show>
              </div>
            </div>
            {/* K 线正下方：当前委托 | 历史订单 | 资产余额，固定高度填满 */}
            <div class="mt-2 bg-[#1e2329] rounded border border-[#2c2c3e] flex flex-col flex-shrink-0 min-h-[100px] trade-mobile-orders">
              <div class="flex border-b border-[#2c2c3e]">
                {(['orders', 'history', 'balance'] as const).map((tab) => (
                  <button
                    type="button"
                    class={`flex-1 py-1.5 text-[10px] ${bottomTab() === tab ? 'text-[#4dd0e1] border-b-2 border-[#4dd0e1] bg-[#252628]' : 'text-gray-500 hover:text-gray-300'}`}
                    onClick={() => setBottomTab(tab)}
                  >
                    {tab === 'orders' ? t('trade.openOrders') : tab === 'history' ? t('trade.orderHistory') : t('trade.balanceTab')}
                  </button>
                ))}
              </div>
              <div class="p-2 flex-1 min-h-[72px] overflow-y-auto text-gray-500 text-[11px]">
                <Show when={bottomTab() === 'orders'} fallback={
                  <Show when={bottomTab() === 'history'} fallback={
                    <div class="space-y-1">
                      <div class="flex justify-between mono"><span>USDT</span><span class={!isConnected() ? 'text-gray-500' : ''}>{getBalanceDisplay('USDT')}</span></div>
                      <div class="flex justify-between mono"><span>{currency()}</span><span class={!isConnected() ? 'text-gray-500' : ''}>{getBalanceDisplay(activeSymbol())}</span></div>
                    </div>
                  }>
                    <For each={orderHistory().slice(0, 5)} fallback={<div>{t('trade.noHistory')}</div>}>
                      {(o: any) => (
                        <div class="flex justify-between py-1 mono text-[11px]">
                          <span>{(o?.side ?? o?.type) === 'buy' || o?.type === 1 ? t('trade.buyShort') : t('trade.sellShort')}</span>
                          <span>{formatPrice(o?.price ?? 0)}</span>
                          <span>{o?.status ?? '-'}</span>
                        </div>
                      )}
                    </For>
                  </Show>
                }>
                  <div class="text-center py-4">{t('trade.noOpenOrders')}</div>
                </Show>
              </div>
            </div>
          </div>

          {/* 3. 右侧：深度，填满列高 */}
          <div class="trade-orderbook flex-shrink-0 bg-[#1e2329] rounded border border-[#2c2c3e] p-2 overflow-hidden flex flex-col w-[200px] min-h-0">
            <div class="flex-1 min-h-0 overflow-y-auto">
              <OrderBook
                bids={orderbookBids()}
                asks={orderbookAsks()}
                currentPrice={currentPrice()}
                flashClass={priceFlash()}
              />
            </div>
          </div>

          {/* 4. 最右侧：最新成交 + 下单，填满列高；手机版隐藏最新成交，只保留下单 */}
          <div class="trade-right flex-shrink-0 flex flex-col gap-2 w-[240px] min-h-0">
            <div class="trade-mobile-hide bg-[#1e2329] rounded border border-[#2c2c3e] p-2 flex-1 min-h-0 overflow-hidden flex flex-col">
              <h3 class="text-[10px] text-gray-500 mb-1 flex-shrink-0">最新成交</h3>
              <div class="flex-1 min-h-0 overflow-y-auto">
                <RecentTrades trades={tradeList()} />
              </div>
            </div>
            <div class="bg-[#1e2329] rounded border border-[#2c2c3e] p-2 flex-shrink-0">
              <div class="flex gap-0.5 mb-2">
                <button type="button" class={`flex-1 py-0.5 text-[10px] rounded ${orderType() === 'limit' ? 'bg-[#4dd0e1] text-black' : 'text-gray-500'}`} onClick={() => setOrderType('limit')}>{t('trade.limit')}</button>
                <button type="button" class={`flex-1 py-0.5 text-[10px] rounded ${orderType() === 'market' ? 'bg-[#4dd0e1] text-black' : 'text-gray-500'}`} onClick={() => setOrderType('market')}>{t('trade.market')}</button>
              </div>
              <div class="space-y-1.5 text-[11px]">
                <div class="flex justify-between"><span class="text-gray-500">{t('trade.limitPrice')}</span><input type="number" class="w-24 px-2 py-1 rounded bg-[#0b0e11] border border-[#2c2c3e] text-right mono text-white" value={price()} onInput={(e) => setPrice((e.target as HTMLInputElement).value)} placeholder={formatPrice(currentPrice())} /></div>
                <div class="flex justify-between items-center"><span class="text-gray-500">{t('trade.amount')}</span><input type="number" class="w-24 px-2 py-1 rounded bg-[#0b0e11] border border-[#2c2c3e] text-right mono text-white" value={amount()} onInput={(e) => setAmount((e.target as HTMLInputElement).value)} placeholder="0" /><span class="text-gray-500">{currency()}</span></div>
                <div class="flex gap-1">
                  {[25, 50, 75, 100].map((pct) => (
                    <button type="button" class="flex-1 py-1 text-[10px] bg-[#252628] rounded hover:bg-[#2c2c3e] mono" onClick={() => setAmountByPct(pct)}>{pct}%</button>
                  ))}
                </div>
                <Show when={!isConnected()}>
                  <p class="text-gray-500 text-[11px] mb-1">{t('common.pleaseConnectBefore')}<button type="button" class="text-[#4dd0e1] hover:underline" onClick={() => openConnectModal()}>{t('common.connectWalletBtn')}</button>{t('common.pleaseConnectAfter')}</p>
                </Show>
                <div class="flex gap-2">
                  <button
                    type="button"
                    class={`flex-1 py-2.5 px-3 rounded-lg font-medium text-sm transition-all ${isConnected() ? 'bg-[#0ecb81] text-white hover:opacity-90' : 'border border-[#2c2c3e] text-[#0ecb81] hover:bg-[#0ecb81]/10'}`}
                    onClick={() => { if (isConnected()) { setSide('buy'); handleSubmit(); } else openConnectModal(); }}
                  >
                    {t('trade.buy')} {currency()}
                  </button>
                  <button
                    type="button"
                    class={`flex-1 py-2.5 px-3 rounded-lg font-medium text-sm transition-all ${isConnected() ? 'bg-[#f6465d] text-white hover:opacity-90' : 'border border-[#2c2c3e] text-[#f6465d] hover:bg-[#f6465d]/10'}`}
                    onClick={() => { if (isConnected()) { setSide('sell'); handleSubmit(); } else openConnectModal(); }}
                  >
                    {t('trade.sell')} {currency()}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div class="trade-mobile-hide border-t border-[#2c2c3e] p-2">
          <NewsFeed />
        </div>
        <MarketDrawer
          open={drawerOpen()}
          onClose={() => setDrawerOpen(false)}
          markets={marketList().filter((m) => m.legal_name === quoteTab() && m.currency_name !== m.legal_name)}
          quoteTab={quoteTab()}
          onSelectPair={(row: MarketRow) => {
            onSelectPair(row);
            setDrawerOpen(false);
          }}
          t={t}
          coinIconUrl={coinIconUrl}
          onIconError={onIconError}
          formatPrice={formatPrice}
          formatNumber={formatNumber}
          formatPercent={formatPercent}
        />
      </div>
    </ErrorBoundary>
  );
};

export default Trade;
