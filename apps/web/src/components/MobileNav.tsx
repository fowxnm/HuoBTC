import { Component } from 'solid-js';
import { A, useLocation } from '@solidjs/router';
import { useI18n } from '../contexts/I18nContext';
import { useAuth } from '../contexts/AuthContext';
import { useTrading } from '../contexts/TradingContext';
import { openConnectModal } from '../appkit/openAppKit';

const MobileNav: Component = () => {
  const location = useLocation();
  const { t } = useI18n();
  const { isLoggedIn } = useAuth();
  const { activePair } = useTrading();
  const tradeHref = () => `/trade/${activePair() || 'BTC-USDT'}`;

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  return (
    <nav class="fixed bottom-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-md border-t border-gray-200 md:hidden pb-safe flex justify-around items-center h-[56px] shadow-lg">
      <A href="/" class={`flex flex-col items-center justify-center w-full h-full gap-1 ${isActive('/') ? 'text-primary' : 'text-gray-400 hover:text-gray-600'}`}>
        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
        <span class="text-[10px] font-medium">{t('indexHeader.home')}</span>
      </A>

      <A href="/markets" class={`flex flex-col items-center justify-center w-full h-full gap-1 ${isActive('/markets') || isActive('/market') ? 'text-primary' : 'text-gray-400 hover:text-gray-600'}`}>
        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
        </svg>
        <span class="text-[10px] font-medium">{t('indexHeader.discovery')}</span>
      </A>

      <div class="relative -top-5">
        <A href={tradeHref()} class="flex items-center justify-center w-14 h-14 rounded-full bg-primary text-white shadow-lg shadow-primary/30 transform transition active:scale-95">
          <svg class="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
          </svg>
        </A>
      </div>

      <A href="/finance" class={`flex flex-col items-center justify-center w-full h-full gap-1 ${isActive('/finance') || isActive('/assets') ? 'text-primary' : 'text-gray-400 hover:text-gray-600'}`}>
        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
        </svg>
        <span class="text-[10px] font-medium">{t('indexHeader.finance')}</span>
      </A>

      {isLoggedIn() ? (
        <A href="/account" class={`flex flex-col items-center justify-center w-full h-full gap-1 ${isActive('/account') ? 'text-primary' : 'text-gray-400 hover:text-gray-600'}`}>
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
          <span class="text-[10px] font-medium">{t('common.account')}</span>
        </A>
      ) : (
        <button type="button" class={`flex flex-col items-center justify-center w-full h-full gap-1 ${isActive('/connect') ? 'text-primary' : 'text-gray-400 hover:text-gray-600'}`} onClick={() => openConnectModal()}>
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
          <span class="text-[10px] font-medium">{t('common.connectWallet')}</span>
        </button>
      )}
    </nav>
  );
};

export default MobileNav;
