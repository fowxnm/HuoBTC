import { Component, createSignal, onMount, For, Show, createMemo } from 'solid-js';
import { A } from '@solidjs/router';
import { useI18n } from '../contexts/I18nContext';
import { useAccount } from '../hooks/useAccount';
import { useTrading } from '../contexts/TradingContext';
import { api, formatNumber } from '../utils/api';
import { openConnectModal } from '../appkit/openAppKit';
import { formatFiatPrice } from '../utils/priceLocale';

interface Wallet {
  id: number;
  currency: number;
  legal_balance: string;
  change_balance: string;
  lever_balance: string;
  micro_balance: string;
  address: string;
}

const currencyNames: Record<number, string> = {
  1: 'BTC',
  2: 'ETH',
  3: 'USDT'
};

/** 使用全局账本（TradingContext）时展示的币种顺序 */
const LEDGER_CURRENCIES = ['USDT', 'BTC', 'ETH', 'BNB', 'SOL', 'XRP', 'DOGE', 'ADA', 'AVAX', 'DOT', 'MATIC', 'LINK', 'UNI', 'ATOM', 'LTC', 'BCH'];

const useMockLedger = () => true;

const Assets: Component = () => {
  const { t, locale } = useI18n();
  const { isConnected, getBalanceDisplay, getBalanceRaw } = useAccount();
  const { balances } = useTrading();
  const [wallets, setWallets] = createSignal<Wallet[]>([]);
  const [loading, setLoading] = createSignal(true);
  const [activeTab, setActiveTab] = createSignal<'spot' | 'lever' | 'contract'>('spot');

  onMount(async () => {
    if (!isConnected()) return;
    try {
      const response = await api.get('/api/wallet/list');
      if (response.type === 'ok') setWallets(response.data ?? []);
    } catch (e) {
      console.error('Failed to fetch wallets:', e);
    } finally {
      setLoading(false);
    }
  });

  const ledgerEntries = createMemo(() => {
    if (!useMockLedger() || !isConnected()) return [];
    const bal = balances();
    const main = ['USDT', 'BTC', 'ETH'];
    const withBalance = LEDGER_CURRENCIES.filter((c) => (bal[c] ?? 0) > 0);
    const seen = new Set<string>();
    return [...main, ...withBalance].filter((c) => { if (seen.has(c)) return false; seen.add(c); return true; }).map((currency) => ({ currency, balance: getBalanceRaw(currency) }));
  });

  const totalBalanceNumeric = () => {
    if (!isConnected()) return 0;
    if (useMockLedger()) {
      return Object.values(balances()).reduce((s, v) => s + (v ?? 0), 0);
    }
    return wallets().reduce((sum, w) => {
      const b = activeTab() === 'spot' ? parseFloat(w.legal_balance || '0') : activeTab() === 'lever' ? parseFloat(w.lever_balance || '0') : parseFloat(w.micro_balance || '0');
      return sum + b;
    }, 0);
  };
  const totalBalanceDisplay = () => {
    const total = totalBalanceNumeric();
    if (!isConnected() || total <= 0) return '--';
    return `$${formatNumber(total, 2)}`;
  };

  return (
    <div class="max-w-7xl mx-auto px-4 py-8">
      <Show when={isConnected()} fallback={
        <div class="text-center py-12">
          <p class="text-gray-400 mb-4">{t('account.connectFirst')} <button type="button" class="text-primary cursor-pointer hover:underline bg-transparent border-none p-0 inline" onClick={() => openConnectModal()}>{t('common.connectWallet')}</button></p>
          <button type="button" class="btn btn-primary" onClick={() => openConnectModal()}>{t('common.connectWallet')}</button>
          <div class="mt-8 card bg-dark-300/50 max-w-md mx-auto">
            <div class="text-sm text-gray-500 mb-2">{t('assets.totalBalance')}</div>
            <div class="text-2xl font-bold text-gray-500">--</div>
            <p class="text-xs text-gray-500 mt-2">{t('account.connectFirst')}</p>
          </div>
        </div>
      }>
      <div class="flex items-center justify-between mb-8">
        <h1 class="text-2xl font-bold">{t('assets.title')}</h1>
        <div class="flex space-x-3">
          <A href="/deposit" class="btn btn-primary">{t('assets.deposit')}</A>
          <A href="/withdraw" class="btn btn-outline">{t('assets.withdraw')}</A>
        </div>
      </div>

      <div class="card bg-gradient-to-r from-primary/20 to-secondary/20 mb-8">
        <div class="text-sm text-gray-400 mb-2">{t('assets.totalBalance')}</div>
        <div class={`text-4xl font-bold mb-1 ${!isConnected() ? 'text-gray-500' : ''}`}>{totalBalanceDisplay()}</div>
        <div class="text-sm text-gray-400 mb-4">{totalBalanceNumeric() > 0 ? formatFiatPrice(locale(), totalBalanceNumeric()) : ''}</div>
        <div class="flex space-x-8 text-sm">
          <div>
            <span class="text-gray-400">{t('assets.available')}: </span>
            <span class="text-success">{getBalanceDisplay('USDT', 2)}</span>
            <span class="text-gray-400 text-xs ml-1">{isConnected() ? formatFiatPrice(locale(), getBalanceRaw('USDT') ?? 0) : ''}</span>
          </div>
        </div>
      </div>

      <div class="flex space-x-4 mb-6">
        <button class={`px-6 py-2 rounded-lg font-medium transition-colors ${activeTab() === 'spot' ? 'bg-primary text-dark-400' : 'bg-dark-300 text-gray-400'}`} onClick={() => setActiveTab('spot')}>Spot</button>
        <button class={`px-6 py-2 rounded-lg font-medium transition-colors ${activeTab() === 'lever' ? 'bg-primary text-dark-400' : 'bg-dark-300 text-gray-400'}`} onClick={() => setActiveTab('lever')}>Leverage</button>
        <button class={`px-6 py-2 rounded-lg font-medium transition-colors ${activeTab() === 'contract' ? 'bg-primary text-dark-400' : 'bg-dark-300 text-gray-400'}`} onClick={() => setActiveTab('contract')}>Contract</button>
      </div>

      <div class="card overflow-hidden">
        <table class="table">
          <thead>
            <tr>
              <th>Currency</th>
              <th>{t('assets.available')}</th>
              <th>Total</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <Show when={useMockLedger()} fallback={
              <Show when={!loading()} fallback={<tr><td colSpan={4} class="text-center py-8 text-gray-500">Loading...</td></tr>}>
                <For each={wallets()}>
                  {(wallet) => {
                    const balance = activeTab() === 'spot' ? parseFloat(wallet.legal_balance || '0') : activeTab() === 'lever' ? parseFloat(wallet.lever_balance || '0') : parseFloat(wallet.micro_balance || '0');
                    return (
                      <tr class="hover:bg-dark-300">
                        <td><div class="font-semibold">{currencyNames[wallet.currency] || 'Unknown'}</div></td>
                        <td class="font-mono">{formatNumber(balance * 0.9, 8)}</td>
                        <td class="font-mono">{formatNumber(balance, 8)}</td>
                        <td><A href="/deposit" class="text-primary text-sm hover:underline">{t('assets.deposit')}</A> <A href="/withdraw" class="text-primary text-sm hover:underline ml-2">{t('assets.withdraw')}</A></td>
                      </tr>
                    );
                  }}
                </For>
              </Show>
            }>
              <For each={ledgerEntries()} fallback={<tr><td colSpan={4} class="text-center py-8 text-gray-500">{t('assets.noLedgerHint')}</td></tr>}>
                {(entry) => (
                  <tr class="hover:bg-dark-300">
                    <td><div class="font-semibold">{entry.currency}</div></td>
                    <td class="font-mono">{getBalanceDisplay(entry.currency, 8)}</td>
                    <td class="font-mono">{getBalanceDisplay(entry.currency, 8)}</td>
                    <td><A href="/deposit" class="text-primary text-sm hover:underline">{t('assets.deposit')}</A> <A href="/withdraw" class="text-primary text-sm hover:underline ml-2">{t('assets.withdraw')}</A></td>
                  </tr>
                )}
              </For>
            </Show>
          </tbody>
        </table>
      </div>
      </Show>
    </div>
  );
};

export default Assets;
