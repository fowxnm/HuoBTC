/**
 * Seconds Contract Trading Page (秒合约交易页面)
 * 布局与现货交易页一致：左侧市场列表 | 中间 K 线 | 订单簿 | 右侧最新成交 + 秒合约下单
 */

import { Component, createSignal, createEffect, onMount, Show, For } from 'solid-js';
import type { MarketRow } from '../contexts/TradingContext';
import { useParams, useNavigate } from '@solidjs/router';
import { useI18n } from '../contexts/I18nContext';
import { useAuth } from '../contexts/AuthContext';
import { useTrading } from '../contexts/TradingContext';
import { useAccount } from '../hooks/useAccount';
import { useMockPriceEngine } from '../hooks/useMockPriceEngine';
import { useBinanceKline } from '../hooks/useBinanceKline';
import { useBinanceTicker } from '../hooks/useBinanceTicker';
import { useBinanceDepth } from '../hooks/useBinanceDepth';
import { useBinanceTrades } from '../hooks/useBinanceTrades';
import { useBinanceSymbols, filterByBinance } from '../hooks/useBinanceSymbols';
import { api, formatPrice, formatNumber, formatPercent } from '../utils/api';
import { openConnectModal } from '../appkit/openAppKit';
import { ErrorBoundary } from 'solid-js';
import { getCoinIcon, onIconError as onCoinIconError } from '../utils/coinIcon';
import { formatFiatPrice } from '../utils/priceLocale';
import KlineChart from '../components/KlineChart';
import OrderBook from '../components/OrderBook';
import RecentTrades from '../components/RecentTrades';
import NewsFeed from '../components/NewsFeed';
import MarketDrawer from '../components/MarketDrawer';

function coinIconUrl(item: { currency_name: string; logo?: string | null }): string {
  return getCoinIcon(item.currency_name, item.logo);
}
function onIconError(e: Event, symbol?: string): void {
  onCoinIconError(e, symbol);
}

const TIME_PERIODS = [
  { seconds: 30, label: '30秒', profitRatio: 10, minAmount: 100 },
  { seconds: 60, label: '60秒', profitRatio: 18, minAmount: 1000 },
  { seconds: 120, label: '2分钟', profitRatio: 25, minAmount: 5000 },
  { seconds: 300, label: '5分钟', profitRatio: 35, minAmount: 10000 },
  { seconds: 600, label: '10分钟', profitRatio: 50, minAmount: 50000 },
];
const QUICK_AMOUNTS = [100, 500, 1000, 5000, 10000, 50000];

const TOP_15_SYMBOLS = ['BTC', 'ETH', 'BNB', 'SOL', 'XRP', 'DOGE', 'ADA', 'AVAX', 'DOT', 'MATIC', 'LINK', 'UNI', 'ATOM', 'LTC', 'BCH'];
const FAVORITES_STORAGE_KEY = 'seconds_favorites';
const QUOTE_TABS = ['USDT', 'BTC', 'ETH'] as const;
const PERIOD_KEYS = ['1m', '15m', '4h', '1d', '1w', '1M', '1y'] as const;
const PERIOD_I18N: Record<string, string> = {
  '1m': 'kline.realtime', '15m': 'kline.m15', '4h': 'kline.h4', '1d': 'kline.d1', '1w': 'kline.w1', '1M': 'kline.mo1', '1y': 'kline.y1',
};

const SecondsContract: Component = () => {
  const params = useParams();
  const navigate = useNavigate();
  const { t, locale } = useI18n();
  const { isLoggedIn } = useAuth();
  const { activePair, setActivePair, activeSymbol, marketList } = useTrading();
  const { isConnected, getBalanceDisplay, hasSufficientBalance } = useAccount();
  const mockEngine = useMockPriceEngine(() => activeSymbol());
  const [klinePeriod, setKlinePeriod] = createSignal('1m');
  const binanceKline = useBinanceKline(() => activeSymbol(), klinePeriod);
  const binanceTicker = useBinanceTicker(() => activeSymbol());
  const binanceDepth = useBinanceDepth(() => activeSymbol(), 20);
  const binanceTrades = useBinanceTrades(() => activeSymbol(), 50);
  const { symbols: binanceSymbols } = useBinanceSymbols();
  const getKlineBars = () => (binanceKline.bars().length > 0 ? binanceKline.bars() : mockEngine.getBarsForInterval(klinePeriod()));
  const realKlineBars = () => (binanceKline.bars().length > 0 ? binanceKline.bars() : undefined);
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
  const [selectedSeconds, setSelectedSeconds] = createSignal(60);
  const [amount, setAmount] = createSignal('1000');
  const [direction, setDirection] = createSignal<'rise' | 'fall' | null>(null);
  const [isSubmitting, setIsSubmitting] = createSignal(false);
  const [priceFlash, setPriceFlash] = createSignal<'price-flash-up' | 'price-flash-down' | ''>('');
  const [currentPrice, setCurrentPrice] = createSignal(0);
  const [change24h, setChange24h] = createSignal(0);
  const [high24h, setHigh24h] = createSignal(0);
  const [low24h, setLow24h] = createSignal(0);
  const [volume24h, setVolume24h] = createSignal(0);
  const [activeOrders, setActiveOrders] = createSignal<any[]>([]);
  const [orderHistory, setOrderHistory] = createSignal<any[]>([]);
  const [microPairs, setMicroPairs] = createSignal<Array<{ id: number; currencyName: string; legalName: string }>>([]);
  const [legalId, setLegalId] = createSignal(3);
  const [leftBottomTab, setLeftBottomTab] = createSignal<'active' | 'history'>('active');

  const pair = () => activePair() || params.pair || 'BTC-USDT';
  const currency = () => activeSymbol();
  const legal = () => (pair().split('-')[1] || 'USDT') as 'USDT' | 'BTC' | 'ETH';

  createEffect(() => {
    const p = params.pair;
    if (p) setActivePair(p);
    else if (!activePair()) setActivePair('BTC-USDT');
  });
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

  const orderbookBids = () => binanceDepth.bids();
  const orderbookAsks = () => binanceDepth.asks();
  const tradeList = () => binanceTrades.trades();
  const selectedPeriod = () => TIME_PERIODS.find((p) => p.seconds === selectedSeconds()) || TIME_PERIODS[1];
  const potentialProfit = () => {
    const amt = parseFloat(amount()) || 0;
    const ratio = selectedPeriod().profitRatio / 100;
    return (amt * ratio).toFixed(2);
  };

  const filteredMarkets = () => {
    let list = filterByBinance(
      marketList().filter((m) => m.legal_name === quoteTab() && m.currency_name !== m.legal_name),
      binanceSymbols()
    );
    const q = searchQuery().toLowerCase();
    if (q) list = list.filter((m) => m.currency_name.toLowerCase().includes(q));
    return list;
  };
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
      try {
        localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  };
  const isFavorite = (pairKey: string) => favorites().includes(pairKey);
  const onSelectPair = (row: MarketRow) => {
    const p = `${row.currency_name}-${row.legal_name}`;
    setActivePair(p);
    navigate(`/seconds/${p}`, { replace: true });
    setCurrentPrice(row.now_price ?? 0);
    setChange24h(row.change ?? 0);
    setHigh24h(row.high ?? row.now_price ?? 0);
    setLow24h(row.low ?? row.now_price ?? 0);
    setVolume24h(row.volume ?? 0);
  };

  const fetchBalance = async () => {
    if (!isLoggedIn()) return;
    try {
      await api.get('/api/wallet/list');
    } catch (e) {
      console.error('Failed to fetch balance:', e);
    }
  };
  const fetchActiveOrders = async () => {
    if (!isLoggedIn()) return;
    try {
      const res = await api.get('/api/micro/active');
      if (res.type === 'ok') setActiveOrders(res.data);
    } catch (e) {
      console.error('Failed to fetch orders:', e);
    }
  };
  const fetchOrderHistory = async () => {
    if (!isLoggedIn()) return;
    try {
      const res = await api.get('/api/micro/orders?status=3&limit=10');
      if (res.type === 'ok') setOrderHistory(res.data.list || []);
    } catch (e) {
      console.error('Failed to fetch history:', e);
    }
  };

  const placeOrder = async (type: 'rise' | 'fall') => {
    if (!isLoggedIn()) {
      openConnectModal();
      return;
    }
    const amt = parseFloat(amount());
    if (isNaN(amt) || amt <= 0) {
      alert(t('common.enterValidAmount'));
      return;
    }
    const minAmt = selectedPeriod().minAmount ?? 0;
    if (minAmt > 0 && amt < minAmt) {
      alert(`${selectedPeriod().label} ${t('secondsContract.minBuyAlert')} ${minAmt} USDT`);
      return;
    }
    if (!isConnected()) {
      openConnectModal();
      return;
    }
    if (!hasSufficientBalance('USDT', amt)) {
      alert(t('account.insufficientBalance'));
      return;
    }
    setIsSubmitting(true);
    setDirection(type);
    const [base, quote] = pair().split('-');
    const match = microPairs().find((p) => p.currencyName === base && p.legalName === quote);
    const matchId = match?.id ?? 1;
    try {
      const res = await api.post('/api/micro/order', {
        match_id: matchId,
        currency_id: legalId(),
        type: type === 'rise' ? 1 : 2,
        seconds: selectedSeconds(),
        price: currentPrice(),
        number: amt,
      });
      if (res.type === 'ok') {
        fetchBalance();
        fetchActiveOrders();
        setDirection(null);
      } else {
        alert((res as any).message || 'Order failed');
      }
    } catch {
      alert('Failed to place order');
    } finally {
      setIsSubmitting(false);
    }
  };

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
    fetchBalance();
    fetchActiveOrders();
    fetchOrderHistory();
    try {
      const [pairsRes, microRes] = await Promise.all([
        api.get('/api/trade/pairs'),
        api.get('/api/micro/pairs'),
      ]);
      if (pairsRes.type === 'ok' && Array.isArray(pairsRes.data) && (pairsRes.data as any[]).length > 0)
        setLegalId((pairsRes.data as any[])[0].legal_id);
      if (microRes.type === 'ok' && Array.isArray(microRes.data)) setMicroPairs(microRes.data);
    } catch (_) {}
    const ordersTick = setInterval(() => fetchActiveOrders(), 1000);
    return () => clearInterval(ordersTick);
  });

  return (
    <ErrorBoundary fallback={<div class="p-4 text-red-400">{t('common.pageLoadError')}</div>}>
      <div class="trade-page-bizzan bg-[#0b0e11] min-h-screen flex flex-col">
        <div class="trade-grid flex-1 p-2 gap-2 min-h-0 max-h-[calc(100vh-56px)] overflow-hidden">
          {/* 左侧：市场列表（与现货一致排版） */}
          <div class="trade-left flex flex-col bg-[#1e2329] rounded border border-[#2c2c3e] max-h-[calc(100vh-100px)]">
            <div class="flex gap-0.5 p-1.5 border-b border-[#2c2c3e]">
              <For each={QUOTE_TABS}>
                {(tab) => (
                  <button
                    type="button"
                    class={`flex-1 py-0.5 text-[10px] rounded mono ${quoteTab() === tab ? 'bg-[#4dd0e1] text-black' : 'bg-[#252628] text-gray-400'}`}
                    onClick={() => setQuoteTab(tab)}
                  >
                    {tab}
                  </button>
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
                        class={`trade-market-row w-full flex items-center gap-1.5 text-left transition ${isActive ? 'bg-[#2c2c3e]' : 'hover:bg-[#252628]'}`}
                        role="button"
                        tabIndex={0}
                        onClick={() => onSelectPair(row)}
                        onKeyDown={(e) => e.key === 'Enter' && onSelectPair(row)}
                      >
                        <button
                          type="button"
                          class="flex-shrink-0 p-0.5 rounded hover:bg-[#3a3a4a] text-gray-500 hover:text-[#f0b90b] focus:outline-none"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleFavorite(pairKey);
                          }}
                          title={isFavorite(pairKey) ? '取消自选' : '添加自选'}
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
              <button type="button" class="w-full py-1 text-[10px] text-[#4dd0e1] hover:bg-[#252628] border-t border-[#2c2c3e] transition" onClick={() => setDrawerOpen(true)}>
                {t('market.viewMore')}
              </button>
            </div>
          </div>

          {/* 中间：K 线 + 下方进行中/历史（与现货一致排版） */}
          <div class="trade-center flex flex-col min-w-0 flex-1 min-h-0">
            <div class="bg-[#1e2329] rounded-lg border border-[#2c2c3e] p-2 flex flex-col flex-1 min-h-0 overflow-hidden">
              <div class="trade-mobile-price-row border-b border-[#2c2c3e] pb-1.5">
                <button type="button" class="flex items-center gap-1 text-white font-medium" onClick={() => setDrawerOpen(true)}>
                  <span class="mono">{currency()}/{legal()}</span>
                  <svg class="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" /></svg>
                </button>
                <span class={`mono font-semibold ${change24h() >= 0 ? 'text-green-500' : 'text-red-500'}`}>{formatPrice(currentPrice())}</span>
                <span class={change24h() >= 0 ? 'text-green-500 text-sm' : 'text-red-500 text-sm'}>{formatPercent(change24h() / 100)}</span>
              </div>
              <div class="trade-mobile-detail flex flex-wrap items-center gap-3 mb-1.5 text-xs mono border-b border-[#2c2c3e] pb-1.5">
                <button type="button" class="text-white font-medium hover:text-[#4dd0e1] transition flex items-center gap-1" onClick={() => setDrawerOpen(true)} title={t('market.viewMore')}>
                  <span>{currency()}/{legal()}</span>
                  <svg class="w-3.5 h-3.5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" /></svg>
                </button>
                <span class="text-gray-500">{t('trade.latestPrice')}</span>
                <span class={`font-semibold ${change24h() >= 0 ? 'text-green-500' : 'text-red-500'}`}>{formatPrice(currentPrice())}</span>
                <span class="text-gray-400">{formatFiatPrice(locale(), currentPrice())}</span>
                <span class="text-gray-500">{t('trade.change24h')}</span>
                <span class={change24h() >= 0 ? 'text-green-500' : 'text-red-500'}>{formatPercent(change24h() / 100)}</span>
                <span class="text-gray-500">24h最高</span>
                <span class="mono text-white">{formatPrice(high24h())}</span>
                <span class="text-gray-500">24h最低</span>
                <span class="mono text-white">{formatPrice(low24h())}</span>
                <span class="text-gray-500">{t('trade.volume24h')}</span>
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
              </div>
            </div>
            <div class="mt-2 bg-[#1e2329] rounded border border-[#2c2c3e] flex flex-col flex-shrink-0 min-h-[100px] trade-mobile-orders">
              <div class="flex border-b border-[#2c2c3e]">
                {(['active', 'history'] as const).map((tab) => (
                  <button
                    type="button"
                    class={`flex-1 py-1.5 text-[10px] ${leftBottomTab() === tab ? 'text-[#4dd0e1] border-b-2 border-[#4dd0e1] bg-[#252628]' : 'text-gray-500 hover:text-gray-300'}`}
                    onClick={() => setLeftBottomTab(tab)}
                  >
                    {tab === 'active' ? '进行中' : '历史'}
                  </button>
                ))}
              </div>
              <div class="p-2 flex-1 min-h-[72px] overflow-y-auto text-gray-500 text-[11px]">
                <Show when={leftBottomTab() === 'active'} fallback={
                  <For each={orderHistory().slice(0, 6)} fallback={<div class="text-center py-2">{t('secondsContract.noHistory')}</div>}>
                    {(o) => (
                      <div class="flex justify-between py-1 mono text-[11px] border-b border-[#252628]">
                        <span class={o.type === 1 ? 'text-green-500' : 'text-red-500'}>{o.typeName}</span>
                        <span class={parseFloat(o.factProfit || '0') >= 0 ? 'text-green-500' : 'text-red-500'}>{parseFloat(o.factProfit || '0').toFixed(2)}</span>
                      </div>
                    )}
                  </For>
                }>
                  <Show when={activeOrders().length > 0} fallback={<div class="text-center py-2">{t('secondsContract.noActive')}</div>}>
                    <For each={activeOrders().slice(0, 6)}>
                      {(o) => (
                        <div class="flex justify-between py-1 text-[11px] border-b border-[#252628]">
                          <span class={o.type === 1 ? 'text-green-500' : 'text-red-500'}>{o.typeName} {o.seconds}秒</span>
                          <span>{o.number} USDT</span>
                        </div>
                      )}
                    </For>
                  </Show>
                </Show>
              </div>
            </div>
          </div>

          {/* 订单簿（与现货一致） */}
          <div class="trade-orderbook flex-shrink-0 bg-[#1e2329] rounded border border-[#2c2c3e] p-2 overflow-hidden flex flex-col w-[200px] min-h-0">
            <div class="flex-1 min-h-0 overflow-y-auto">
              <OrderBook bids={orderbookBids()} asks={orderbookAsks()} currentPrice={currentPrice()} flashClass={priceFlash()} />
            </div>
          </div>

          {/* 右侧：最新成交 + 秒合约下单（与现货一致排版）；手机版隐藏最新成交 */}
          <div class="trade-right flex-shrink-0 flex flex-col gap-2 w-[240px] min-h-0">
            <div class="trade-mobile-hide bg-[#1e2329] rounded border border-[#2c2c3e] p-2 flex-1 min-h-0 overflow-hidden flex flex-col">
              <h3 class="text-[10px] text-gray-500 mb-1 flex-shrink-0">最新成交</h3>
              <div class="flex-1 min-h-0 overflow-y-auto">
                <RecentTrades trades={tradeList()} />
              </div>
            </div>
            <div class="bg-[#1e2329] rounded border border-[#2c2c3e] p-2 flex-shrink-0">
              <div class="text-[11px] text-gray-500 mb-2">期权账户余额</div>
              <div class="text-lg font-bold mb-3">{isConnected() ? `${getBalanceDisplay('USDT', 2)} USDT` : '--'}</div>
              <div class="text-[11px] text-gray-500 mb-1">选择时间</div>
              <div class="flex flex-wrap gap-1 mb-3">
                <For each={TIME_PERIODS}>
                  {(period) => (
                    <button
                      type="button"
                      class={`py-1.5 px-2 text-[11px] rounded ${selectedSeconds() === period.seconds ? 'bg-[#4dd0e1] text-black' : 'bg-[#252628] text-gray-400'}`}
                      onClick={() => setSelectedSeconds(period.seconds)}
                    >
                      {period.label}
                    </button>
                  )}
                </For>
              </div>
              <div class="text-[11px] text-gray-500 mb-1">收益率: {selectedPeriod().profitRatio}%</div>
              <div class="text-[11px] text-gray-500 mb-1">{t('secondsContract.investAmountLabel')} {selectedPeriod().minAmount}</div>
              <input
                type="number"
                class="w-full px-2 py-1.5 rounded bg-[#0b0e11] border border-[#2c2c3e] text-white mono text-sm mb-2"
                placeholder={String(selectedPeriod().minAmount)}
                min={selectedPeriod().minAmount}
                value={amount()}
                onInput={(e) => setAmount((e.target as HTMLInputElement).value)}
              />
              <div class="flex flex-wrap gap-1 mb-3">
                <For each={QUICK_AMOUNTS}>
                  {(amt) => (
                    <button
                      type="button"
                      class={`py-1 px-2 text-[10px] rounded mono ${amount() === amt.toString() ? 'bg-[#4dd0e1] text-black' : 'bg-[#252628] text-gray-400'}`}
                      onClick={() => setAmount(amt.toString())}
                    >
                      {amt}
                    </button>
                  )}
                </For>
              </div>
              <div class="bg-[#252628] rounded p-2 mb-3 text-[11px]">
                <div class="flex justify-between"><span class="text-gray-500">预期收益</span><span class="text-green-500 font-bold">+{potentialProfit()} USDT</span></div>
              </div>
              <div class="grid grid-cols-2 gap-2">
                <button
                  class="py-3 rounded font-semibold text-sm bg-green-600 hover:bg-green-500 text-white disabled:opacity-50"
                  onClick={() => placeOrder('rise')}
                  disabled={isSubmitting() || !isLoggedIn()}
                >
                  ▲ {t('secondsContract.buyUp')}
                </button>
                <button
                  class="py-3 rounded font-semibold text-sm bg-red-600 hover:bg-red-500 text-white disabled:opacity-50"
                  onClick={() => placeOrder('fall')}
                  disabled={isSubmitting() || !isLoggedIn()}
                >
                  ▼ {t('secondsContract.buyDown')}
                </button>
              </div>
              <Show when={!isLoggedIn()}>
                <p class="text-[11px] text-gray-500 mt-2">{t('account.connectFirst')} <button type="button" class="text-[#4dd0e1] hover:underline" onClick={() => openConnectModal()}>{t('common.connectWallet')}</button></p>
              </Show>
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

export default SecondsContract;
