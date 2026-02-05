/**
 * Register 页面 - 仅支持钱包连接注册
 * 连接钱包时自动注册/登录
 */
import { Component, onMount } from 'solid-js';
import { useNavigate, useSearchParams } from '@solidjs/router';
import { useAuth } from '../contexts/AuthContext';
import { useI18n } from '../contexts/I18nContext';
import { openWalletModal } from '../components/WalletModal';

const Register: Component = () => {
  const { isLoggedIn } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // 保存邀请码到 localStorage，钱包连接时使用
  onMount(() => {
    if (searchParams.extension_code) {
      localStorage.setItem('ref_code', searchParams.extension_code);
    }
    if (isLoggedIn()) {
      navigate('/');
    }
  });

  const handleConnect = () => {
    openWalletModal();
  };

  return (
    <div class="min-h-screen flex items-center justify-center px-4 py-12 bg-gradient-to-br from-dark-300 via-dark-400 to-dark-500">
      <div class="w-full max-w-md">
        <div class="card p-8">
          <div class="text-center mb-8">
            <div class="w-20 h-20 bg-primary rounded-2xl flex items-center justify-center mx-auto mb-6">
              <svg class="w-10 h-10 text-dark-400" viewBox="0 0 24 24" fill="currentColor">
                <path d="M21.8 8.001c0-.66-.532-1.2-1.2-1.2H3.4c-.66 0-1.2.54-1.2 1.2v7.8c0 .66.54 1.2 1.2 1.2h17.2c.668 0 1.2-.54 1.2-1.2v-7.8zm-9.8 5.6c-1.5 0-2.7-1.2-2.7-2.7s1.2-2.7 2.7-2.7 2.7 1.2 2.7 2.7-1.2 2.7-2.7 2.7z"/>
              </svg>
            </div>
            <h1 class="text-2xl font-bold text-white mb-2">{t('register.title')}</h1>
            <p class="text-gray-400">{t('register.walletHint') || '连接钱包即可自动注册并登录'}</p>
          </div>

          <button
            type="button"
            class="btn btn-primary w-full py-4 text-lg font-semibold flex items-center justify-center gap-3"
            onClick={handleConnect}
          >
            <svg class="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
              <path d="M21.8 8.001c0-.66-.532-1.2-1.2-1.2H3.4c-.66 0-1.2.54-1.2 1.2v7.8c0 .66.54 1.2 1.2 1.2h17.2c.668 0 1.2-.54 1.2-1.2v-7.8zm-9.8 5.6c-1.5 0-2.7-1.2-2.7-2.7s1.2-2.7 2.7-2.7 2.7 1.2 2.7 2.7-1.2 2.7-2.7 2.7z"/>
            </svg>
            {t('common.connectWallet')}
          </button>

          <div class="mt-8 text-center">
            <p class="text-sm text-gray-500">{t('login.supportedWallets') || '支持 TronLink、TokenPocket、BitKeep、OKX 钱包'}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Register;
