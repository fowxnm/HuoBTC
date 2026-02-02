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
    <nav class="mobile-nav md:hidden">
      <A href="/" class={`mobile-nav-item ${isActive('/') ? 'active' : ''}`}>
        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
        <span>{t('indexHeader.home')}</span>
      </A>
      
      <A href="/markets" class={`mobile-nav-item ${isActive('/markets') || isActive('/market') ? 'active' : ''}`}>
        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
        </svg>
        <span>{t('indexHeader.discovery')}</span>
      </A>
      
      <A href={tradeHref()} class={`mobile-nav-item ${isActive('/trade') ? 'active' : ''}`}>
        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
        </svg>
        <span>{t('indexHeader.trading')}</span>
      </A>
      
      <A href="/finance" class={`mobile-nav-item ${isActive('/finance') || isActive('/assets') ? 'active' : ''}`}>
        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
        </svg>
        <span>{t('indexHeader.finance')}</span>
      </A>
      
      {isLoggedIn() ? (
        <A href="/account" class={`mobile-nav-item ${isActive('/account') ? 'active' : ''}`}>
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
          <span>{t('common.account')}</span>
        </A>
      ) : (
        <button type="button" class={`mobile-nav-item ${isActive('/connect') ? 'active' : ''}`} onClick={() => openConnectModal()}>
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
          <span>{t('common.connectWallet')}</span>
        </button>
      )}
    </nav>
  );
};

export default MobileNav;
