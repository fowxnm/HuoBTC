/**
 * Header - BIZZAN 工业级导航：Logo 唯一首页、快捷买币/探索/交易折叠/金融/更多
 * 全 i18n、200ms 退出防抖 + 透明桥，交易入口与 activePair 闭环
 */
import { Component, Show, createSignal, onMount, onCleanup } from 'solid-js';
import { A, useNavigate } from '@solidjs/router';
import { useAuth } from '../contexts/AuthContext';
import { useI18n } from '../contexts/I18nContext';
import { useTrading } from '../contexts/TradingContext';
import type { Language } from '../lang';
import { openConnectModal } from '../appkit/openAppKit';

const DROPDOWN_LEAVE_MS = 200;

const Header: Component = () => {
  const { isLoggedIn, user, logout } = useAuth();
  const { t, locale, setLocale } = useI18n();
  const { activePair } = useTrading();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = createSignal(false);
  const [tradeDropdownOpen, setTradeDropdownOpen] = createSignal(false);
  const [moreDropdownOpen, setMoreDropdownOpen] = createSignal(false);
  let tradeTimeoutRef: ReturnType<typeof setTimeout> | null = null;
  let moreTimeoutRef: ReturnType<typeof setTimeout> | null = null;

  const handleLogout = () => {
    logout();
    navigate('/');
    setSidebarOpen(false);
  };

  const go = (path: string) => {
    navigate(path);
    setSidebarOpen(false);
    setTradeDropdownOpen(false);
    setMoreDropdownOpen(false);
  };

  const tradePairHref = () => `/trade/${activePair() || 'BTC-USDT'}`;

  const clearTradeTimeout = () => {
    if (tradeTimeoutRef) {
      clearTimeout(tradeTimeoutRef);
      tradeTimeoutRef = null;
    }
  };
  const clearMoreTimeout = () => {
    if (moreTimeoutRef) {
      clearTimeout(moreTimeoutRef);
      moreTimeoutRef = null;
    }
  };

  onMount(() => {
    const closeOnClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.nav-dropdown-trade') && !target.closest('.nav-dropdown-more')) {
        setTradeDropdownOpen(false);
        setMoreDropdownOpen(false);
      }
    };
    document.addEventListener('click', closeOnClickOutside);
    onCleanup(() => document.removeEventListener('click', closeOnClickOutside));
  });

  return (
    <>
      <header class="head">
        <div class="bit-center-wrap head-inner">
          <div class="hd-left">
            {/* 品牌入口：Logo 即首页，无独立「首页」文字 */}
            <div class="hl-item logo-wrap">
              <A href="/" aria-label={t('indexHeader.home')}>
                <img src="/imgs/header_logo.png" alt="Logo" class="logo" onError={(e) => { (e.target as HTMLImageElement).src = '/assets/logo.png'; }} />
              </A>
            </div>
            <div class="fgx" aria-hidden="true"><span style="opacity: 0">1</span></div>

            {/* 快捷买币 -> /buy-crypto */}
            <div class="hl-item" onClick={() => go('/buy-crypto')}>{t('indexHeader.quickBuy')}</div>

            {/* 探索（原行情）-> /markets */}
            <div class="hl-item" onClick={() => go('/markets')}>{t('indexHeader.discovery')}</div>

            {/* 交易（折叠）：现货/杠杆/合约，200ms 防抖 + 透明桥 */}
            <div
              class="hl-item nav-dropdown-trade relative inline-block"
              onMouseEnter={() => {
                clearTradeTimeout();
                setTradeDropdownOpen(true);
              }}
              onMouseLeave={() => {
                tradeTimeoutRef = setTimeout(() => setTradeDropdownOpen(false), DROPDOWN_LEAVE_MS);
              }}
            >
              <button
                type="button"
                class="flex items-center gap-1 border-0 bg-transparent text-inherit cursor-pointer p-0 font-inherit"
                onClick={() => setTradeDropdownOpen((v) => !v)}
                aria-expanded={tradeDropdownOpen()}
                aria-haspopup="true"
              >
                {t('indexHeader.trading')}
                <svg class="w-4 h-4 opacity-80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              <Show when={tradeDropdownOpen()}>
                {/* 透明桥：触发器与菜单间无缝隙，防止移入时菜单消失 */}
                <div class="absolute left-0 right-0 top-full h-1" style={{ 'z-index': 1001 }} aria-hidden="true" />
                <div
                  class="absolute top-full left-0 pt-1 min-w-[200px] rounded-lg z-50"
                  style={{ 'z-index': 1000, 'padding-top': '4px' }}
                  role="menu"
                  onMouseEnter={() => { clearTradeTimeout(); setTradeDropdownOpen(true); }}
                  onMouseLeave={() => { tradeTimeoutRef = setTimeout(() => setTradeDropdownOpen(false), DROPDOWN_LEAVE_MS); }}
                >
                  <div class="py-2 rounded-lg bg-[#1a1b1e] border border-[#2c2c3e] shadow-xl">
                    <A href={tradePairHref()} class="block px-4 py-2 text-left text-sm text-white hover:bg-[#252628]" role="menuitem" onClick={() => setTradeDropdownOpen(false)}>
                      {t('indexHeader.spotTrade')}
                    </A>
                    <A href="/leverage" class="block px-4 py-2 text-left text-sm text-white hover:bg-[#252628]" role="menuitem" onClick={() => setTradeDropdownOpen(false)}>
                      {t('indexHeader.leverageTrade')}
                    </A>
                    <A href="/seconds" class="block px-4 py-2 text-left text-sm text-white hover:bg-[#252628]" role="menuitem" onClick={() => setTradeDropdownOpen(false)}>
                      {t('indexHeader.contractTrade')}
                    </A>
                    <div class="border-t border-[#2c2c3e] my-1" />
                    <A href="/trade-center" class="block px-4 py-2 text-left text-sm text-[#4dd0e1] hover:bg-[#252628]" role="menuitem" onClick={() => setTradeDropdownOpen(false)}>
                      {t('indexHeader.tradeCenter')} →
                    </A>
                  </div>
                </div>
              </Show>
            </div>

            {/* 金融理财 -> /finance */}
            <div class="hl-item" onClick={() => go('/finance')}>{t('indexHeader.finance')}</div>

            {/* 更多（公告/API/帮助中心），200ms 防抖 + 透明桥 */}
            <div
              class="hl-item nav-dropdown-more relative inline-block"
              onMouseEnter={() => {
                clearMoreTimeout();
                setMoreDropdownOpen(true);
              }}
              onMouseLeave={() => {
                moreTimeoutRef = setTimeout(() => setMoreDropdownOpen(false), DROPDOWN_LEAVE_MS);
              }}
            >
              <button
                type="button"
                class="flex items-center gap-1 border-0 bg-transparent text-inherit cursor-pointer p-0 font-inherit"
                onClick={() => setMoreDropdownOpen((v) => !v)}
                aria-expanded={moreDropdownOpen()}
                aria-haspopup="true"
              >
                {t('indexHeader.more')}
                <svg class="w-4 h-4 opacity-80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              <Show when={moreDropdownOpen()}>
                <div class="absolute left-0 right-0 top-full h-1" style={{ 'z-index': 1001 }} aria-hidden="true" />
                <div
                  class="absolute top-full left-0 pt-1 min-w-[180px] rounded-lg z-50"
                  style={{ 'z-index': 1000, 'padding-top': '4px' }}
                  role="menu"
                  onMouseEnter={() => { clearMoreTimeout(); setMoreDropdownOpen(true); }}
                  onMouseLeave={() => { moreTimeoutRef = setTimeout(() => setMoreDropdownOpen(false), DROPDOWN_LEAVE_MS); }}
                >
                  <div class="py-2 rounded-lg bg-[#1a1b1e] border border-[#2c2c3e] shadow-xl">
                    <div class="px-4 py-2 text-sm text-gray-400 cursor-default">{t('indexHeader.announcement')}</div>
                    <div class="px-4 py-2 text-sm text-gray-400 cursor-default">{t('indexHeader.api')}</div>
                    <div class="px-4 py-2 text-sm text-gray-400 cursor-default">{t('indexHeader.helpCenter')}</div>
                  </div>
                </div>
              </Show>
            </div>
          </div>

          <div class="hd-right">
            <div class="dlzc">
              <Show when={!isLoggedIn()} fallback={
                <div class="zc flex items-center gap-3">
                  <A href="/account" class="flex items-center gap-2 text-gray-300 hover:text-primary">
                    <span class="text-sm">{user()?.account_number?.slice(0, 8) || 'User'}...</span>
                  </A>
                  <button type="button" onClick={handleLogout} class="btn-logout">{t('common.disconnect')}</button>
                </div>
              }>
                <button type="button" class="zc dc-item" onClick={() => openConnectModal()}>{t('common.connectWallet')}</button>
              </Show>
            </div>
            <div class="hr-item lang-wrap flex items-center">
              <select value={locale()} onChange={(e) => setLocale((e.target as HTMLSelectElement).value as Language)} class="lang-select dc-item" aria-label={t('common.ariaLang')}>
                <option value="en">{t('common.langEn')}</option>
                <option value="zh">{t('common.langZh')}</option>
                <option value="zhHant">{t('common.langZhHant')}</option>
                <option value="ja">{t('common.langJa')}</option>
                <option value="ko">{t('common.langKo')}</option>
              </select>
            </div>
            <button type="button" class="cd" onClick={() => setSidebarOpen(true)} aria-label="Menu">
              <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" /></svg>
            </button>
          </div>
        </div>
      </header>

      {/* 移动端侧栏：Logo 可点击回首页，无独立「首页」行；全 i18n */}
      <div class={`sidebar ${sidebarOpen() ? 'srShow' : ''}`}>
        <div class="sr-head flex justify-between items-center p-4 border-b border-gray-700">
          <A href="/" onClick={() => setSidebarOpen(false)} class="flex items-center">
            <img src="/assets/logo.png" alt="Logo" class="h-8" />
          </A>
          <button type="button" class="text-white text-2xl" onClick={() => setSidebarOpen(false)}>×</button>
        </div>
        <nav class="tel-nav">
          <div class="tn-item" onClick={() => go('/buy-crypto')}><span class="tm-title">{t('indexHeader.quickBuy')}</span></div>
          <div class="tn-item" onClick={() => go('/markets')}><span class="tm-title">{t('indexHeader.discovery')}</span></div>
          <div class="tn-item" onClick={() => go(tradePairHref())}><span class="tm-title">{t('indexHeader.spotTrade')}</span></div>
          <div class="tn-item" onClick={() => go('/leverage')}><span class="tm-title">{t('indexHeader.leverageTrade')}</span></div>
          <div class="tn-item" onClick={() => go('/seconds')}><span class="tm-title">{t('indexHeader.contractTrade')}</span></div>
          <div class="tn-item" onClick={() => go('/finance')}><span class="tm-title">{t('indexHeader.finance')}</span></div>
          <div class="tn-item" onClick={() => go('/assets')}><span class="tm-title">{t('indexHeader.assets')}</span></div>
          <div class="tn-item" onClick={() => go('/deposit')}><span class="tm-title">{t('indexHeader.deposit')}</span></div>
          <div class="tn-item" onClick={() => go('/withdraw')}><span class="tm-title">{t('indexHeader.withdraw')}</span></div>
          <Show when={!isLoggedIn()}>
            <div class="tn-item" onClick={() => { openConnectModal(); setSidebarOpen(false); }}><span class="tm-title">{t('common.connectWallet')}</span></div>
          </Show>
        </nav>
        <Show when={isLoggedIn()} fallback={<button type="button" class="tcdl" onClick={() => { openConnectModal(); setSidebarOpen(false); }}>{t('common.connectWallet')}</button>}>
          <A href="/account" class="tcdl" onClick={() => setSidebarOpen(false)}>{t('common.account')}</A>
        </Show>
      </div>
      {sidebarOpen() && <div class="sidebar-backdrop" onClick={() => setSidebarOpen(false)} />}
    </>
  );
};

export default Header;
