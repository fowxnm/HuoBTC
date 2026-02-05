import { Component, createSignal, onMount, For, createEffect, batch } from 'solid-js';
import { A, useNavigate } from '@solidjs/router';
import { useI18n } from '../contexts/I18nContext';
import { useTrading } from '../contexts/TradingContext';
import { api, formatPrice, formatPercent, formatVolume } from '../utils/api';
import { getCoinIcon, onIconError } from '../utils/coinIcon';
import { getNewsCache, setNewsCache } from '../utils/newsCache';
import { formatFiatPrice } from '../utils/priceLocale';

interface MarketItem {
  currency_id: number;
  currency_name: string;
  legal_name: string;
  logo: string;
  now_price: number;
  change: number;
  volume: number;
  type?: string;
}

interface NewsItem {
  title: string;
  link: string;
  pubDate: string;
  source: string;
  image?: string;
}

/** 新闻无图或加载失败时使用的占位图（与 NewsFeed 一致） */
const DEFAULT_NEWS_IMAGE = 'https://images.unsplash.com/photo-1639762681485-074b7f938ba0?w=800&h=450&fit=crop';

const SITE_NAME = 'BTC Exchange';
const HOME_QUOTATION_CACHE_KEY = 'home_quotation_cache';
const FETCH_RETRY_COUNT = 3;
const FETCH_RETRY_DELAY_MS = 2000;

const HOME_EXCLUDE = new Set(['USDT', 'USDC', 'MANTA']);
const HOME_DEFAULT_SYMBOLS = [
  'BTC', 'ETH', 'BNB', 'SOL', 'XRP', 'DOGE', 'ADA', 'AVAX', 'DOT', 'MATIC', 'LINK', 'UNI', 'ATOM', 'LTC', 'BCH', 'ETC', 'XLM', 'FIL', 'TRX',
  'ARB', 'OP', 'INJ', 'SUI', 'SEI', 'NEAR', 'FTM', 'AAVE', 'CRV', 'MKR', 'SNX', 'COMP', 'SUSHI', 'YFI', 'SAND', 'MANA', 'AXS', 'ENJ', 'CHZ',
  'FLOW', 'ICP', 'VET', 'ALGO', 'EOS', 'XTZ', 'THETA', 'GRT', 'BAT', 'ZRX', '1INCH', 'LDO', 'ZEC', 'DASH', 'HBAR', 'GMT', 'APE', 'PEPE', 'ORDI',
];
const HOME_DEFAULT_LIST: MarketItem[] = HOME_DEFAULT_SYMBOLS.map((name, i) => ({
  currency_id: i + 1,
  currency_name: name,
  legal_name: 'USDT',
  logo: '',
  now_price: 0,
  change: 0,
  volume: 0,
}));

function getInitialHomeMarketData(): MarketItem[] {
  try {
    const raw = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem(HOME_QUOTATION_CACHE_KEY) : null;
    if (raw) {
      const parsed = JSON.parse(raw) as MarketItem[];
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (_) { }
  return [...HOME_DEFAULT_LIST];
}

/** 合并新行情到当前列表，原地更新价格等，已有 logo 不覆盖以防图标闪烁 */
function mergeHomeMarketInPlace(current: MarketItem[], incoming: MarketItem[]): void {
  const byName = new Map(incoming.map((i) => [i.currency_name, i]));
  for (const c of current) {
    const n = byName.get(c.currency_name);
    if (n) {
      c.now_price = n.now_price;
      c.change = n.change;
      c.volume = n.volume;
      if (!c.logo && n.logo) c.logo = n.logo;
    }
  }
  const currentNames = new Set(current.map((i) => i.currency_name));
  for (const n of incoming) {
    if (!currentNames.has(n.currency_name) && !HOME_EXCLUDE.has(n.currency_name)) {
      current.push(n);
      currentNames.add(n.currency_name);
    }
  }
}

const Home: Component = () => {
  const { t, locale } = useI18n();
  const navigate = useNavigate();
  const { activePair } = useTrading();
  const tradeHref = () => `/trade/${activePair() || 'BTC-USDT'}`;
  const initialMarket = getInitialHomeMarketData();
  const [marketData, setMarketData] = createSignal<MarketItem[]>(initialMarket);
  const [loading, setLoading] = createSignal(initialMarket.length > 0 && initialMarket.every((m) => m.now_price === 0));
  const [marketError, setMarketError] = createSignal<string | null>(null);
  const [newsItems, setNewsItems] = createSignal<NewsItem[]>([]);
  const [newsLoading, setNewsLoading] = createSignal(true);
  const [tickerOffset, setTickerOffset] = createSignal(0);
  const [, setCarouselIndex] = createSignal(0);

  const fetchNews = async (lang: string) => {
    const cached = getNewsCache(lang);
    if (cached && cached.length > 0) {
      setNewsItems(cached);
      setNewsLoading(false);
    } else {
      setNewsLoading(true);
    }
    try {
      const response = await api.get('/api/news', { lang });
      if (response.type === 'ok' && response.data && Array.isArray((response.data as { items?: NewsItem[] }).items)) {
        const items = (response.data as { items: NewsItem[] }).items;
        setNewsItems(items);
        setNewsCache(lang, items);
      } else if (!cached?.length) {
        setNewsItems([]);
      }
    } catch {
      if (!cached?.length) setNewsItems([]);
    } finally {
      setNewsLoading(false);
    }
  };

  createEffect(() => {
    const lang = locale();
    if (lang) fetchNews(lang);
  });

  const fetchMarket = async () => {
    const isFirstLoad = marketData().length > 0 && marketData().every((m) => m.now_price === 0);
    if (isFirstLoad) setLoading(true);
    setMarketError(null);
    let lastError: string | null = null;
    let success = false;
    for (let attempt = 0; attempt <= FETCH_RETRY_COUNT; attempt++) {
      try {
        const response = await api.get('/api/market/quotation');
        const raw = response.data as any;
        const list: MarketItem[] = (Array.isArray(raw) ? (raw as MarketItem[]) : (raw?.quotation || [])).filter(
          (x: MarketItem) => !HOME_EXCLUDE.has(x.currency_name)
        );
        if (list.length > 0) {
          const current = marketData();
          if (current.length > 0) {
            mergeHomeMarketInPlace(current, list);
            batch(() => {
              setMarketData([...current]);
              try { sessionStorage.setItem(HOME_QUOTATION_CACHE_KEY, JSON.stringify(current)); } catch (_) { }
            });
          } else {
            setMarketData(list);
            try { sessionStorage.setItem(HOME_QUOTATION_CACHE_KEY, JSON.stringify(list)); } catch (_) { }
          }
          success = true;
          break;
        }
        lastError = response.type === 'error' ? (response as any).message : null;
      } catch (e) {
        console.error('Failed to fetch market:', e);
        lastError = t('common.error');
      }
      if (attempt < FETCH_RETRY_COUNT) {
        await new Promise((r) => setTimeout(r, FETCH_RETRY_DELAY_MS));
      }
    }
    if (!success && lastError && marketData().length > 0 && marketData().every((m) => m.now_price === 0)) {
      setMarketError(lastError);
    }
    setLoading(false);
  };

  onMount(() => {
    fetchMarket();
  });
  // 行情轮询：每 5 秒刷新，价格持续跳动
  onMount(() => {
    const id = setInterval(fetchMarket, 5000);
    return () => clearInterval(id);
  });

  // Carousel auto
  onMount(() => {
    const id = setInterval(() => setCarouselIndex((i: number) => (i + 1) % 3), 4000);
    return () => clearInterval(id);
  });

  // Ticker scroll
  onMount(() => {
    const id = setInterval(() => setTickerOffset((x) => (x + 1) % 30), 80);
    return () => clearInterval(id);
  });

  const menuItems = [
    { path: '/withdraw', icon: '/assets/me1.png', label: () => t('homeContent.at6') },
    { path: '/deposit', icon: '/assets/me2.png', label: () => t('homeContent.at7') },
    { path: '/invitation', icon: '/assets/me3.png', label: () => t('homeContent.at8') },
    { path: '/leverage', icon: '/assets/me4.png', label: () => t('homeContent.at9') },
    { path: '/account', icon: '/assets/me5.png', label: () => t('homeContent.at10') },
    { path: '/leverage', icon: '/assets/me6.png', label: () => t('homeContent.at11') },
    { path: '/trade/BTC-USDT', icon: '/assets/me7.png', label: () => t('homeContent.at12') },
    { path: '#', icon: '/assets/me8.png', label: () => 'NFT' },
    { path: '/seconds', icon: '/assets/me9.png', label: () => t('homeContent.at14') },
    { path: '/market', icon: '/assets/me10.png', label: () => 'C2C' },
  ];

  const tickerItems = () => {
    const list = marketData();
    // 🚨 严禁使用 Mock fallback 数据！
    // 如果没有真实数据，显示空列表或加载状态
    if (list.length === 0) {
      return [];
    }
    return list.slice(0, 15).map((m, i) => ({
      key: i,
      pair: `${m.currency_name}/${m.legal_name}`,
      symbol: m.currency_name,
      price: m.now_price,
      change: m.change
    }));
  };

  return (
    <div class="home-page" id="homeTop">
      {/* 1. Video Banner */}
      <section class="swi relative overflow-hidden">
        <video
          class="banner-home w-full h-screen min-h-[80vh] object-cover"
          src="/video2.mp4"
          autoplay
          muted
          loop
          playsinline
        />
        <div class="sw-box absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-white max-w-[850px] flex flex-col items-center justify-center text-center z-10 px-4">
          <div class="top-left">
            <h1 class="text-white text-2xl sm:text-4xl md:text-5xl leading-tight mb-4">
              {t('homeContent.get_rice')}
              <span class="theme-color text-primary ml-1">{SITE_NAME}</span>
            </h1>
            <h4 class="text-lg sm:text-2xl md:text-3xl font-normal text-[#cbd9da] w-[90%] mx-auto my-6">
              {t('homeContent.intro1')}
            </h4>
            <div class="operate-area flex flex-wrap items-center justify-center gap-3 mt-6">
              <input
                type="text"
                class="hidden md:block w-[280px] md:w-[304px] h-12 md:h-[54px] pl-6 rounded-full border border-[#2c2c3e] bg-[#0a0a12] text-white text-base md:text-lg"
                placeholder={t('homeContent.phone_pla')}
              />
              <button
                type="button"
                class="go-btn min-w-[180px] md:min-w-[200px] h-11 md:h-[54px] px-5 rounded-full text-base md:text-xl font-medium bg-primary text-black hover:opacity-90 transition"
                onClick={() => navigate(tradeHref())}
              >
                {t('homeContent.go_pay')}
              </button>
            </div>
            <div class="p1 flex flex-wrap justify-center gap-4 md:gap-8 mt-8 md:mt-12 mx-auto max-w-[540px] border border-white/30 rounded-full bg-black/50 backdrop-blur-sm py-4 px-6 md:py-6 md:px-12">
              <span class="flex flex-col items-center">
                <span class="text-xl md:text-3xl">{t('homeContent.at1')}</span>
                <span class="text-xs md:text-sm text-[#888]">{t('homeContent.at2')}</span>
              </span>
              <span class="flex flex-col items-center">
                <span class="text-xl md:text-3xl">100+</span>
                <span class="text-xs md:text-sm text-[#888]">{t('homeContent.at3')}</span>
              </span>
              <span class="flex flex-col items-center">
                <span class="text-xl md:text-3xl">2{t('homeContent.at4')}</span>
                <span class="text-xs md:text-sm text-[#888]">{t('homeContent.at5')}</span>
              </span>
            </div>
          </div>
        </div>
        {/* Floating parallax images */}
        <div class="parallax-images absolute inset-0 pointer-events-none z-[2]">
          <img src="/assets/129.png" alt="" class="absolute left-[25%] top-[20%] w-8 h-8 md:w-12 md:h-12 animate-float1" />
          <img src="/assets/130.png" alt="" class="absolute left-[15%] top-[50%] w-10 h-10 md:w-16 md:h-16 animate-float2" />
          <img src="/assets/131.png" alt="" class="absolute left-[25%] top-[80%] w-8 h-8 md:w-12 md:h-12 animate-float1" />
          <img src="/assets/132.png" alt="" class="absolute left-[70%] top-[20%] w-8 h-8 md:w-12 md:h-12 animate-float2" />
          <img src="/assets/133.png" alt="" class="absolute left-[80%] top-[50%] w-8 h-8 md:w-12 md:h-12 animate-float1" />
          <img src="/assets/134.png" alt="" class="absolute left-[70%] top-[80%] w-8 h-8 md:w-12 md:h-12 animate-float2" />
        </div>
      </section>

      {/* 2. Home Menu (horizontal scroll on mobile, grid on PC) */}
      <section class="home-menu py-4 md:py-6 px-4 bg-[#0f0f16] border-y border-[#2c2c3e]">
        <ul class="menu-list flex overflow-x-auto gap-4 md:gap-6 justify-center flex-wrap md:flex-nowrap max-w-7xl mx-auto list-none p-0 m-0">
          <For each={menuItems}>
            {(item) => (
              <li class="flex-none w-[20vw] min-w-[72px] md:min-w-[80px] md:w-auto flex flex-col items-center text-center">
                <A href={item.path} class="flex flex-col items-center group">
                  <div class="icon-wrap w-11 h-11 md:w-14 md:h-14 rounded-full overflow-hidden flex items-center justify-center mb-2 bg-dark-200 group-hover:bg-dark-300 transition">
                    <img src={item.icon} alt="" class="w-9 h-9 md:w-12 md:h-12 object-contain" />
                  </div>
                  <span class="text-xs text-gray-400 group-hover:text-primary">{item.label()}</span>
                </A>
              </li>
            )}
          </For>
        </ul>
      </section>

      {/* 3. Scrolling Ticker - 与行情页同一数据源 /api/market/quotation */}
      <section class="zbgd border-t border-b border-[#2c2c3e] bg-[#0f0f16] py-3 overflow-hidden">
        <div class="ticker-wrap flex overflow-hidden" style={{ transform: `translateX(-${tickerOffset() * 2}%)` }}>
          <ul class="ul-gfg flex items-center gap-8 whitespace-nowrap">
            <For each={[...tickerItems(), ...tickerItems()]}>
              {(item) => {
                const ch = typeof item.change === 'number' ? item.change : 0;
                const isUp = ch >= 0;
                return (
                  <li class="li-item flex items-center gap-2 text-white text-sm md:text-base">
                    <span class="jii">{item.symbol} {typeof item.price === 'number' ? formatPrice(item.price) : item.price}</span>
                    {typeof item.price === 'number' && <span class="jii text-gray-400 text-xs ml-1">{formatFiatPrice(locale(), item.price)}</span>}
                    <span class={`jii ${isUp ? 'text-success' : 'text-danger'}`}>
                      {isUp ? '+' : '-'}({Math.abs(ch).toFixed(2)}%)
                    </span>
                  </li>
                );
              }}
            </For>
          </ul>
        </div>
      </section>

      {/* 4. 首页海报：图片 + 与首页一致的 UI */}
      <section class="bit-center-wrap max-w-7xl mx-auto px-4 py-6 hidden md:block" aria-hidden="true">
        <div class="home-poster rounded-xl overflow-hidden relative min-h-[180px] md:min-h-[200px] flex items-center justify-center">
          <img src="/imgs/banner.png" alt="" class="absolute inset-0 w-full h-full object-cover" fetchpriority="high" />
          <span class="home-poster-overlay absolute inset-0 pointer-events-none" aria-hidden="true" />
        </div>
      </section>

      {/* 5. 面向所有人 - 与参考图一致：标语 + 三组数据 + 圆圈/线条/星星装饰 */}
      <section class="hero-for-everyone relative overflow-hidden bg-black py-12 md:py-16 px-4">
        <div class="max-w-7xl mx-auto flex flex-col lg:flex-row items-center lg:items-stretch gap-10 lg:gap-12">
          {/* 左侧：标语 + 双圈 + 星星 */}
          <div class="hero-slogan-wrap flex-shrink-0 relative">
            <div class="hero-slogan-circles absolute inset-0 pointer-events-none" aria-hidden="true">
              <span class="hero-circle hero-circle-outer" />
              <span class="hero-circle hero-circle-inner" />
            </div>
            <p class="hero-slogan relative z-10 text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-medium text-white">
              {t('homeContent.heroSloganBefore')}
              <span class="hero-slogan-highlight">{t('homeContent.heroSloganHighlight')}</span>
            </p>
            <div class="hero-stars absolute left-0 bottom-0 pointer-events-none" aria-hidden="true">
              <span class="hero-star hero-star-cyan" />
              <span class="hero-star hero-star-yellow" />
            </div>
          </div>

          {/* 右侧：三组数据 + 连接线 */}
          <div class="hero-stats flex-1 flex flex-col md:flex-row items-center justify-center gap-8 md:gap-6 lg:gap-10 w-full">
            {/* 9M+ Clients */}
            <div class="hero-stat-item flex flex-col items-center text-center relative">
              <div class="hero-stat-visual hero-stat-sphere" aria-hidden="true" />
              <div class="hero-stat-line hero-stat-line-left" aria-hidden="true"><span class="hero-stat-dot" /></div>
              <span class="hero-stat-value hero-stat-magenta">9M+</span>
              <span class="hero-stat-label text-white text-sm mt-1">{t('homeContent.clients')}</span>
            </div>

            {/* 190+ Countries */}
            <div class="hero-stat-item flex flex-col items-center text-center relative">
              <div class="hero-stat-line hero-stat-line-h" aria-hidden="true">
                <span class="hero-stat-dot" /><span class="hero-stat-dot" />
              </div>
              <div class="hero-stars-inline absolute -top-2 right-0 md:right-4 pointer-events-none" aria-hidden="true">
                <span class="hero-star hero-star-cyan small" /><span class="hero-star hero-star-yellow small" />
              </div>
              <span class="hero-stat-value hero-stat-green">190+</span>
              <span class="hero-stat-label text-white text-sm mt-1">{t('homeContent.countriesSupported')}</span>
            </div>

            {/* $207B+ Quarterly Volume */}
            <div class="hero-stat-item flex flex-col items-center text-center relative">
              <div class="hero-stat-blocks" aria-hidden="true">
                <div class="hero-block-row"><div class="hero-block b1" /><div class="hero-block b2" /><div class="hero-block b3" /></div>
                <div class="hero-block-row"><div class="hero-block b2" /><div class="hero-block b3" /><div class="hero-block b4" /></div>
                <div class="hero-block-row"><div class="hero-block b3" /><div class="hero-block b4" /><div class="hero-block b1" /></div>
                <div class="hero-block-coins">
                  <span class="hero-coin" title="BTC">₿</span>
                  <span class="hero-coin" title="ETH">Ξ</span>
                  <span class="hero-coin up">↑</span>
                </div>
              </div>
              <div class="hero-stat-line hero-stat-line-left hero-stat-line-to-value" aria-hidden="true"><span class="hero-stat-dot" /></div>
              <span class="hero-stat-value hero-stat-cyan">$207B+</span>
              <span class="hero-stat-label text-white text-sm mt-1">{t('homeContent.quarterlyVolume')}</span>
              <div class="hero-slogan-circles hero-circles-right absolute inset-0 pointer-events-none" aria-hidden="true">
                <span class="hero-circle hero-circle-outer" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3.5 横条行情 - 与行情页同一数据源，紧接「面向所有人」下方 */}
      <section class="zbgd border-t border-b border-[#2c2c3e] bg-[#0f0f16] py-3 overflow-hidden">
        <div class="ticker-wrap flex overflow-hidden" style={{ transform: `translateX(-${tickerOffset() * 2}%)` }}>
          <ul class="ul-gfg flex items-center gap-8 whitespace-nowrap">
            <For each={[...tickerItems(), ...tickerItems()]}>
              {(item) => {
                const ch = typeof item.change === 'number' ? item.change : 0;
                const isUp = ch >= 0;
                return (
                  <li class="li-item flex items-center gap-2 text-white text-sm md:text-base">
                    <span class="jii">{item.symbol} {typeof item.price === 'number' ? formatPrice(item.price) : item.price}</span>
                    {typeof item.price === 'number' && <span class="jii text-gray-400 text-xs ml-1">{formatFiatPrice(locale(), item.price)}</span>}
                    <span class={`jii ${isUp ? 'text-success' : 'text-danger'}`}>
                      {isUp ? '+' : '-'}({Math.abs(ch).toFixed(2)}%)
                    </span>
                  </li>
                );
              }}
            </For>
          </ul>
        </div>
      </section>

      {/* 6. Market List - 丝滑揭示 + 列表交错 */}
      <section
        class="bit-center-wrap max-w-7xl mx-auto px-4 py-8 reveal-section"
        ref={(el) => {
          if (!el) return;
          const io = new IntersectionObserver(
            ([e]) => { if (e?.isIntersecting) { el.classList.add('reveal-in'); io.disconnect(); } },
            { threshold: 0.06, rootMargin: '0px 0px -40px 0px' }
          );
          io.observe(el);
        }}
      >
        <div class="cm-card-title flex items-center gap-2 mb-6">
          <img class="icon-square w-5 h-5" src="/assets/129.png" alt="" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
          <span class="text text-white text-lg md:text-xl">{t('homeContent.at20')}</span>
        </div>
        {marketError() && (
          <div class="mb-4 p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 text-sm flex flex-wrap items-center justify-between gap-2">
            <span>{marketError()}</span>
            <button type="button" class="btn btn-primary btn-sm py-2 px-4 rounded-full" onClick={fetchMarket}>
              {t('common.retry')}
            </button>
          </div>
        )}
        <div class="home-currency-list space-y-4">
          <For each={marketData().slice(0, 10)}>
            {(item) => (
              <div
                class="list-row stagger-item flex flex-wrap md:flex-nowrap items-center gap-4 p-4 md:px-6 py-4 rounded-2xl bg-[#0d0e0f] cursor-pointer hover:bg-dark-300"
                onClick={() => navigate(`/trade/${item.currency_name}-${item.legal_name}`)}
              >
                <div class="teb-i flex items-center gap-3 min-w-0 flex-1">
                  <img src={getCoinIcon(item.currency_name, item.logo)} alt="" class="asda w-10 h-10 rounded-full object-cover" data-symbol={item.currency_name} referrerPolicy="no-referrer" onError={(e) => onIconError(e, item.currency_name)} />
                  <div class="min-w-0">
                    <p class="font-medium text-white truncate">{item.currency_name} / <span class="text-gray-500">{item.legal_name}</span></p>
                  </div>
                </div>
                <div class="teb-i2 hidden md:block font-mono">{formatPrice(item.now_price)} <span class="text-gray-400 text-xs">{formatFiatPrice(locale(), item.now_price)}</span></div>
                <div class="teb-i2 md:flex-1">
                  <span class={item.change >= 0 ? 'text-success' : 'text-danger'}>
                    {formatPercent(item.change)}
                  </span>
                </div>
                <div class="teb-i2 hidden md:block text-gray-400">{formatVolume(item.volume)}</div>
                <div class="tel-jg md:hidden text-right ml-auto">
                  <span class={item.change >= 0 ? 'text-success' : 'text-danger'}>{formatPercent(item.change)}</span>
                  <p class="font-mono text-sm">{formatPrice(item.now_price)} <span class="text-gray-400 text-xs">{formatFiatPrice(locale(), item.now_price)}</span></p>
                </div>
                <A href={`/trade/${item.currency_name}-${item.legal_name}`} class="btn btn-primary btn-sm py-2 px-4 rounded-full text-sm hidden md:inline-flex">
                  {t('homeContent.go_pay')}
                </A>
              </div>
            )}
          </For>
        </div>
        <div class="flex justify-center mt-6">
          <A href="/markets" class="cm-btn-animation1 inline-flex items-center justify-center min-w-[200px] h-11 px-8 border border-[#333] bg-black text-white rounded-3xl hover:bg-dark-300 transition">
            <span>{t('homeContent.viewMore')}</span>
          </A>
        </div>
      </section>

      {/* 6.5 加密货币资讯 - 丝滑揭示 + 卡片交错 */}
      <section
        class="bit-center-wrap max-w-7xl mx-auto px-4 py-8 border-t border-[#2c2c3e] reveal-section"
        ref={(el) => {
          if (!el) return;
          const io = new IntersectionObserver(
            ([e]) => { if (e?.isIntersecting) { el.classList.add('reveal-in'); io.disconnect(); } },
            { threshold: 0.06, rootMargin: '0px 0px -40px 0px' }
          );
          io.observe(el);
        }}
      >
        <div class="cm-card-title flex items-center gap-2 mb-6">
          <img class="icon-square w-5 h-5" src="/assets/129.png" alt="" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
          <span class="text text-white text-lg md:text-xl">{t('homeContent.cryptoNews')}</span>
        </div>
        {newsLoading() ? (
          <div class="text-gray-400 text-center py-8">{t('common.loading')}</div>
        ) : newsItems().length === 0 ? (
          <div class="text-gray-400 text-center py-8">{t('homeContent.newsNoData')}</div>
        ) : (
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <For each={newsItems().slice(0, 9)}>
              {(item) => (
                <a
                  href={item.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  class="stagger-item block rounded-2xl bg-[#0d0e0f] hover:bg-dark-300 border border-[#2c2c3e] overflow-hidden"
                >
                  <div class="aspect-[16/9] w-full bg-[#1a1b1e] relative">
                    <img
                      src={item.image && item.image.startsWith('http') ? item.image : DEFAULT_NEWS_IMAGE}
                      alt=""
                      class="w-full h-full object-cover"
                      loading="lazy"
                      referrerPolicy="no-referrer"
                      onError={(e) => {
                        const el = e.target as HTMLImageElement;
                        if (el.dataset.fallback) return;
                        el.dataset.fallback = '1';
                        el.src = DEFAULT_NEWS_IMAGE;
                      }}
                    />
                  </div>
                  <div class="p-4">
                    <p class="text-white text-sm md:text-base font-medium line-clamp-2 mb-2">{item.title}</p>
                    {(item.source || item.pubDate) && (
                      <p class="text-gray-500 text-xs truncate">{item.source || item.pubDate}</p>
                    )}
                  </div>
                </a>
              )}
            </For>
          </div>
        )}
      </section>

      {/* 4. 首页海报：图片 + 与首页一致的 UI */}
      <section class="bit-center-wrap max-w-7xl mx-auto px-4 py-6 hidden md:block" aria-hidden="true">
        <div class="home-poster rounded-xl overflow-hidden relative min-h-[180px] md:min-h-[200px] flex items-center justify-center">
          <img src="/imgs/banner.png" alt="" class="absolute inset-0 w-full h-full object-cover" fetchpriority="high" />
          <span class="home-poster-overlay absolute inset-0 pointer-events-none" aria-hidden="true" />
        </div>
      </section>

      {/* 5. 面向所有人 - 与参考图一致：标语 + 三组数据 + 圆圈/线条/星星装饰 */}
      <section class="hero-for-everyone relative overflow-hidden bg-black py-12 md:py-16 px-4">
        <div class="max-w-7xl mx-auto flex flex-col lg:flex-row items-center lg:items-stretch gap-10 lg:gap-12">
          {/* 左侧：标语 + 双圈 + 星星 */}
          <div class="hero-slogan-wrap flex-shrink-0 relative">
            <div class="hero-slogan-circles absolute inset-0 pointer-events-none" aria-hidden="true">
              <span class="hero-circle hero-circle-outer" />
              <span class="hero-circle hero-circle-inner" />
            </div>
            <p class="hero-slogan relative z-10 text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-medium text-white">
              {t('homeContent.heroSloganBefore')}
              <span class="hero-slogan-highlight">{t('homeContent.heroSloganHighlight')}</span>
            </p>
            <div class="hero-stars absolute left-0 bottom-0 pointer-events-none" aria-hidden="true">
              <span class="hero-star hero-star-cyan" />
              <span class="hero-star hero-star-yellow" />
            </div>
          </div>

          {/* 右侧：三组数据 + 连接线 */}
          <div class="hero-stats flex-1 flex flex-col md:flex-row items-center justify-center gap-8 md:gap-6 lg:gap-10 w-full">
            {/* 9M+ Clients */}
            <div class="hero-stat-item flex flex-col items-center text-center relative">
              <div class="hero-stat-visual hero-stat-sphere" aria-hidden="true" />
              <div class="hero-stat-line hero-stat-line-left" aria-hidden="true"><span class="hero-stat-dot" /></div>
              <span class="hero-stat-value hero-stat-magenta">9M+</span>
              <span class="hero-stat-label text-white text-sm mt-1">{t('homeContent.clients')}</span>
            </div>

            {/* 190+ Countries */}
            <div class="hero-stat-item flex flex-col items-center text-center relative">
              <div class="hero-stat-line hero-stat-line-h" aria-hidden="true">
                <span class="hero-stat-dot" /><span class="hero-stat-dot" />
              </div>
              <div class="hero-stars-inline absolute -top-2 right-0 md:right-4 pointer-events-none" aria-hidden="true">
                <span class="hero-star hero-star-cyan small" /><span class="hero-star hero-star-yellow small" />
              </div>
              <span class="hero-stat-value hero-stat-green">190+</span>
              <span class="hero-stat-label text-white text-sm mt-1">{t('homeContent.countriesSupported')}</span>
            </div>

            {/* $207B+ Quarterly Volume */}
            <div class="hero-stat-item flex flex-col items-center text-center relative">
              <div class="hero-stat-blocks" aria-hidden="true">
                <div class="hero-block-row"><div class="hero-block b1" /><div class="hero-block b2" /><div class="hero-block b3" /></div>
                <div class="hero-block-row"><div class="hero-block b2" /><div class="hero-block b3" /><div class="hero-block b4" /></div>
                <div class="hero-block-row"><div class="hero-block b3" /><div class="hero-block b4" /><div class="hero-block b1" /></div>
                <div class="hero-block-coins">
                  <span class="hero-coin" title="BTC">₿</span>
                  <span class="hero-coin" title="ETH">Ξ</span>
                  <span class="hero-coin up">↑</span>
                </div>
              </div>
              <div class="hero-stat-line hero-stat-line-left hero-stat-line-to-value" aria-hidden="true"><span class="hero-stat-dot" /></div>
              <span class="hero-stat-value hero-stat-cyan">$207B+</span>
              <span class="hero-stat-label text-white text-sm mt-1">{t('homeContent.quarterlyVolume')}</span>
              <div class="hero-slogan-circles hero-circles-right absolute inset-0 pointer-events-none" aria-hidden="true">
                <span class="hero-circle hero-circle-outer" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3.5 横条行情 - 与行情页同一数据源，紧接「面向所有人」下方 */}
      <section class="zbgd border-t border-b border-[#2c2c3e] bg-[#0f0f16] py-3 overflow-hidden">
        <div class="ticker-wrap flex overflow-hidden" style={{ transform: `translateX(-${tickerOffset() * 2}%)` }}>
          <ul class="ul-gfg flex items-center gap-8 whitespace-nowrap">
            <For each={[...tickerItems(), ...tickerItems()]}>
              {(item) => {
                const ch = typeof item.change === 'number' ? item.change : 0;
                const isUp = ch >= 0;
                return (
                  <li class="li-item flex items-center gap-2 text-white text-sm md:text-base">
                    <span class="jii">{item.symbol} {typeof item.price === 'number' ? formatPrice(item.price) : item.price}</span>
                    {typeof item.price === 'number' && <span class="jii text-gray-400 text-xs ml-1">{formatFiatPrice(locale(), item.price)}</span>}
                    <span class={`jii ${isUp ? 'text-success' : 'text-danger'}`}>
                      {isUp ? '+' : '-'}({Math.abs(ch).toFixed(2)}%)
                    </span>
                  </li>
                );
              }}
            </For>
          </ul>
        </div>
      </section>

      {/* 6. Market List */}
      <section
        class="bit-center-wrap max-w-7xl mx-auto px-4 py-8 reveal-section"
        ref={(el) => {
          if (!el) return;
          const io = new IntersectionObserver(
            ([e]) => { if (e?.isIntersecting) { el.classList.add('reveal-in'); io.disconnect(); } },
            { threshold: 0.06, rootMargin: '0px 0px -40px 0px' }
          );
          io.observe(el);
        }}
      >
        <div class="cm-card-title flex items-center gap-2 mb-6">
          <img class="icon-square w-5 h-5" src="/assets/129.png" alt="" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
          <span class="text text-app-text text-lg md:text-xl font-bold">{t('homeContent.at20')}</span>
        </div>
        {marketError() && (
          <div class="mb-4 p-4 rounded-xl bg-yellow-50/50 border border-yellow-200 text-yellow-700 text-sm flex flex-wrap items-center justify-between gap-2">
            <span>{marketError()}</span>
            <button type="button" class="btn btn-primary btn-sm py-2 px-4 rounded-full" onClick={fetchMarket}>
              {t('common.retry')}
            </button>
          </div>
        )}
        <div class="home-currency-list space-y-4">
          <For each={marketData().slice(0, 10)}>
            {(item) => (
              <div
                class="list-row stagger-item flex flex-wrap md:flex-nowrap items-center gap-4 p-4 md:px-6 py-4 rounded-2xl bg-app-card border border-app-border cursor-pointer hover:bg-app-active hover:shadow-md transition-all"
                onClick={() => navigate(`/trade/${item.currency_name}-${item.legal_name}`)}
              >
                <div class="teb-i flex items-center gap-3 min-w-0 flex-1">
                  <img src={getCoinIcon(item.currency_name, item.logo)} alt="" class="asda w-10 h-10 rounded-full object-cover shadow-sm bg-white" data-symbol={item.currency_name} referrerPolicy="no-referrer" onError={(e) => onIconError(e, item.currency_name)} />
                  <div class="min-w-0">
                    <p class="font-bold text-app-text truncate">{item.currency_name} / <span class="text-app-sub font-normal">{item.legal_name}</span></p>
                  </div>
                </div>
                <div class="teb-i2 hidden md:block font-mono text-app-text font-medium">{formatPrice(item.now_price)} <span class="text-app-sub text-xs">{formatFiatPrice(locale(), item.now_price)}</span></div>
                <div class="teb-i2 md:flex-1">
                  <span class={`font-medium ${item.change >= 0 ? 'text-success' : 'text-danger'}`}>
                    {formatPercent(item.change)}
                  </span>
                </div>
                <div class="teb-i2 hidden md:block text-app-sub">{formatVolume(item.volume)}</div>
                <div class="tel-jg md:hidden text-right ml-auto">
                  <span class={`block font-medium ${item.change >= 0 ? 'text-success' : 'text-danger'}`}>{formatPercent(item.change)}</span>
                  <p class="font-mono text-sm text-app-text">{formatPrice(item.now_price)} <span class="text-app-sub text-xs">{formatFiatPrice(locale(), item.now_price)}</span></p>
                </div>
                <A href={`/trade/${item.currency_name}-${item.legal_name}`} class="btn btn-primary btn-sm py-2 px-4 rounded-full text-sm hidden md:inline-flex shadow-sm hover:shadow-md">
                  {t('homeContent.go_pay')}
                </A>
              </div>
            )}
          </For>
        </div>
        <div class="flex justify-center mt-6">
          <A href="/markets" class="cm-btn-animation1 inline-flex items-center justify-center min-w-[200px] h-11 px-8 border border-app-border bg-app-card text-app-text font-medium rounded-3xl hover:bg-app-active hover:shadow-md transition">
            <span>{t('homeContent.viewMore')}</span>
          </A>
        </div>
      </section>

      {/* 6.5 Crypto News */}
      <section
        class="bit-center-wrap max-w-7xl mx-auto px-4 py-8 border-t border-app-border reveal-section"
        ref={(el) => {
          if (!el) return;
          const io = new IntersectionObserver(
            ([e]) => { if (e?.isIntersecting) { el.classList.add('reveal-in'); io.disconnect(); } },
            { threshold: 0.06, rootMargin: '0px 0px -40px 0px' }
          );
          io.observe(el);
        }}
      >
        <div class="cm-card-title flex items-center gap-2 mb-6">
          <img class="icon-square w-5 h-5" src="/assets/129.png" alt="" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
          <span class="text text-app-text text-lg md:text-xl font-bold">{t('homeContent.cryptoNews')}</span>
        </div>
        {newsLoading() ? (
          <div class="text-app-sub text-center py-8">{t('common.loading')}</div>
        ) : newsItems().length === 0 ? (
          <div class="text-app-sub text-center py-8">{t('homeContent.newsNoData')}</div>
        ) : (
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <For each={newsItems().slice(0, 9)}>
              {(item) => (
                <a
                  href={item.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  class="stagger-item block rounded-2xl bg-app-card hover:bg-app-active border border-app-border overflow-hidden transition-all hover:shadow-md group"
                >
                  <div class="aspect-[16/9] w-full bg-gray-100 relative overflow-hidden">
                    <img
                      src={item.image && item.image.startsWith('http') ? item.image : DEFAULT_NEWS_IMAGE}
                      alt=""
                      class="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-500"
                      loading="lazy"
                      referrerPolicy="no-referrer"
                      onError={(e) => {
                        const el = e.target as HTMLImageElement;
                        if (el.dataset.fallback) return;
                        el.dataset.fallback = '1';
                        el.src = DEFAULT_NEWS_IMAGE;
                      }}
                    />
                  </div>
                  <div class="p-4">
                    <p class="text-app-text text-sm md:text-base font-medium line-clamp-2 mb-2 group-hover:text-primary transition-colors">{item.title}</p>
                    {(item.source || item.pubDate) && (
                      <p class="text-app-sub text-xs truncate">{item.source || item.pubDate}</p>
                    )}
                  </div>
                </a>
              )}
            </For>
          </div>
        )}
      </section>

      {/* 7. 值得信賴的合作夥伴 - 平滑弹出进入，非固定焊死 */}
      <section
        class="why-choose-section py-14 px-4 bg-[#0a0a0a] reveal-section"
        ref={(el) => {
          if (!el) return;
          const io = new IntersectionObserver(
            ([e]) => {
              if (e?.isIntersecting) {
                el.classList.add('reveal-in');
                io.disconnect();
              }
            },
            { threshold: 0.08, rootMargin: '0px 0px -30px 0px' }
          );
          io.observe(el);
        }}
      >
        <div class="max-w-6xl mx-auto">
          <header class="text-center mb-12 md:mb-14">
            <h2 class="why-choose-title text-2xl md:text-3xl font-bold text-white mb-4">{t('homeContent.trustTitle')}</h2>
            <p class="why-choose-subtitle text-white/90 text-sm md:text-base max-w-2xl mx-auto leading-relaxed">{t('homeContent.trustSubtitle')}</p>
          </header>
          <div class="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-6">
            {/* Card 01 - 儲備說明 */}
            <div class="why-choose-card flex flex-col">
              <div class="why-choose-card-head">
                <div class="why-choose-number text-[#4dd0e1] font-bold text-3xl md:text-4xl">01</div>
                <div class="why-choose-icon why-choose-icon-wallet" aria-hidden="true">
                  <svg viewBox="0 0 48 48" class="w-12 h-12" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <rect x="6" y="10" width="36" height="30" rx="4" fill="#3a3a3a" stroke="#5a5a5a" stroke-width="1.5" />
                    <rect x="10" y="14" width="28" height="22" rx="2" fill="#252525" stroke="#4a4a4a" stroke-width="1" />
                    <circle cx="24" cy="25" r="7" fill="#4dd0e1" opacity="0.9" />
                    <circle cx="24" cy="25" r="4" fill="#1e1e1e" stroke="#4dd0e1" stroke-width="0.8" />
                    <rect x="22" y="8" width="4" height="4" rx="1" fill="#4dd0e1" opacity="0.8" />
                  </svg>
                </div>
              </div>
              <div class="why-choose-card-body">
                <span class="why-choose-dot" aria-hidden="true" />
                <h3 class="text-white font-semibold text-lg mb-3">{t('homeContent.trustCard1Title')}</h3>
                <p class="text-white/90 text-sm leading-relaxed mb-4">{t('homeContent.trustCard1P1')}</p>
                <p class="text-white font-semibold text-sm mb-2">{t('homeContent.trustCard1Sub')}</p>
                <p class="text-white/90 text-sm leading-relaxed">{t('homeContent.trustCard1P2')}</p>
              </div>
            </div>
            {/* Card 02 - 安全穩定可靠技術 */}
            <div class="why-choose-card flex flex-col">
              <div class="why-choose-card-head">
                <div class="why-choose-number text-[#4dd0e1] font-bold text-3xl md:text-4xl">02</div>
                <div class="why-choose-icon why-choose-icon-shield" aria-hidden="true">
                  <svg viewBox="0 0 48 48" class="w-12 h-12" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M24 4L6 12v10c0 12 8 22 18 26 10-4 18-14 18-26V12L24 4z" fill="#2d2d2d" stroke="#5a5a5a" stroke-width="1.5" />
                    <path d="M24 4L6 12v10c0 12 8 22 18 26 10-4 18-14 18-26V12L24 4z" fill="#3a3a3a" fill-opacity="0.9" stroke="#4dd0e1" stroke-width="1" opacity="0.85" />
                    <rect x="18" y="20" width="12" height="10" rx="2" fill="#252525" stroke="#4dd0e1" stroke-width="1" />
                    <path d="M22 20V17a2 2 0 014 0v3" stroke="#4dd0e1" stroke-width="1.2" fill="none" stroke-linecap="round" />
                    <circle cx="24" cy="25" r="2" fill="#4dd0e1" opacity="0.9" />
                  </svg>
                </div>
              </div>
              <div class="why-choose-card-body">
                <span class="why-choose-dot" aria-hidden="true" />
                <h3 class="text-white font-semibold text-lg mb-3">{t('homeContent.trustCard2Title')}</h3>
                <p class="text-white/90 text-sm leading-relaxed mb-4">{t('homeContent.trustCard2P1')}</p>
                <p class="text-white font-semibold text-sm mb-2">{t('homeContent.trustCard2Sub')}</p>
                <p class="text-white/90 text-sm leading-relaxed">{t('homeContent.trustCard2P2')}</p>
              </div>
            </div>
            {/* Card 03 - 隨時隨地自由交易 */}
            <div class="why-choose-card flex flex-col">
              <div class="why-choose-card-head">
                <span class="why-choose-dot" aria-hidden="true" />
                <div class="why-choose-number text-[#4dd0e1] font-bold text-3xl md:text-4xl">03</div>
                <div class="why-choose-icon why-choose-icon-blocks" aria-hidden="true">
                  <svg viewBox="0 0 48 40" class="w-12 h-10" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M8 28h12v8H8z" fill="#4a4a4a" stroke="#5a5a5a" stroke-width="1" />
                    <path d="M20 20h12v8H20z" fill="#5a5a5a" stroke="#6a6a6a" stroke-width="1" />
                    <path d="M28 12h12v8H28z" fill="#4a4a4a" stroke="#5a5a5a" stroke-width="1" />
                    <circle cx="32" cy="16" r="3" fill="#4dd0e1" opacity="0.8" />
                  </svg>
                </div>
              </div>
              <div class="why-choose-card-body">
                <span class="why-choose-dot" aria-hidden="true" />
                <h3 class="text-white font-semibold text-lg mb-3">{t('homeContent.trustCard3Title')}</h3>
                <p class="text-white/90 text-sm leading-relaxed mb-4">{t('homeContent.trustCard3P1')}</p>
                <p class="text-white font-semibold text-sm mb-2">{t('homeContent.trustCard3Sub')}</p>
                <p class="text-white/90 text-sm leading-relaxed">{t('homeContent.trustCard3P2')}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ + Footer 已移至根布局，所有页面底部一致 */}
    </div>
  );
};

export default Home;
