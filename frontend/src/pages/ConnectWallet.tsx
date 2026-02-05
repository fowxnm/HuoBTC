/**
 * 连接钱包页 - 纯 TRON 模式
 * 支持 TronLink + WalletConnect（其他 TRON 钱包）
 * 连接后走后端 /api/auth/nonce → sign → /api/auth/verify
 */
import { Component, createSignal, onMount, createEffect } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import { useI18n } from '../contexts/I18nContext';
import { walletStore } from '../stores/walletStore';
import { openConnectModal } from '../appkit/openAppKit';

const ConnectWallet: Component = () => {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [error, setError] = createSignal('');

  const handleConnect = () => {
    setError('');
    openConnectModal();
  };

  onMount(() => {
    openConnectModal();
  });

  createEffect(() => {
    if (walletStore.connected) navigate('/');
  });

  const errMsg = () => error() || walletStore.error;
  const loading = () => walletStore.loading;

  return (
    <div class="min-h-screen flex items-center justify-center px-4 py-12 bg-gradient-to-br from-dark-300 via-dark-400 to-dark-500">
      <div class="w-full max-w-md">
        <div class="card">
          <div class="text-center mb-8">
            <div class="w-16 h-16 bg-primary/20 rounded-xl flex items-center justify-center mx-auto mb-4">
              <svg class="w-10 h-10 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a2.25 2.25 0 00-2.25-2.25H15a2.25 2.25 0 012.25-2.25 2.25 2.25 0 012.25 2.25V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25A2.25 2.25 0 015.25 3H15a2.25 2.25 0 012.25 2.25" />
              </svg>
            </div>
            <h1 class="text-2xl font-bold">{t('common.connectWallet')}</h1>
            <p class="text-gray-400 mt-2">支持 TronLink 及其他 TRON 钱包</p>
          </div>

          {(errMsg()) && (
            <div class="bg-danger/20 border border-danger/50 text-danger rounded-lg p-3 mb-6 text-sm">
              {errMsg()}
            </div>
          )}

          <button
            type="button"
            class="btn btn-primary w-full flex items-center justify-center gap-2"
            disabled={loading()}
            onClick={handleConnect}
          >
            {loading() ? (
              <span>{t('common.loading')}</span>
            ) : (
              <>
                <svg class="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M21.8 8.001c0-.66-.532-1.2-1.2-1.2H3.4c-.66 0-1.2.54-1.2 1.2v7.8c0 .66.54 1.2 1.2 1.2h17.2c.668 0 1.2-.54 1.2-1.2v-7.8zm-9.8 5.6c-1.5 0-2.7-1.2-2.7-2.7s1.2-2.7 2.7-2.7 2.7 1.2 2.7 2.7-1.2 2.7-2.7 2.7z"/>
                </svg>
                <span>{t('common.connectWallet')}</span>
              </>
            )}
          </button>

          <p class="text-center text-gray-500 text-sm mt-6">
            波场 (TRON) 网络，连接后需签名完成登录
          </p>
        </div>
      </div>
    </div>
  );
};

export default ConnectWallet;
