import { type Component, type JSX, lazy, Suspense, ErrorBoundary, createSignal, createEffect, Show } from 'solid-js';
import { useLocation } from '@solidjs/router';
import Header from './components/Header';
import MobileNav from './components/MobileNav';
import FooterWithFaq from './components/FooterWithFaq';
import AppKitRoot from './components/AppKitRoot';
import WalletModal from './components/WalletModal';
import { AuthProvider } from './contexts/AuthContext';
import { I18nProvider, useI18n } from './contexts/I18nContext';
import { TradingProvider } from './contexts/TradingContext';
import { useAuth } from './contexts/AuthContext';
import SupportChat from './components/SupportChat';
import { api } from './utils/api';

// Lazy load pages（Trade 懒加载避免启动时加载 KlineChart 等导致整站白屏）
export const Home = lazy(() => import('./pages/Home'));
export const Trade = lazy(() => import('./pages/Trade'));
export const Market = lazy(() => import('./pages/Market'));
export const Assets = lazy(() => import('./pages/Assets'));
export const Deposit = lazy(() => import('./pages/Deposit'));
export const Withdraw = lazy(() => import('./pages/Withdraw'));
export const Leverage = lazy(() => import('./pages/Leverage'));
export const SecondsContract = lazy(() => import('./pages/SecondsContract'));
export const TradeCenter = lazy(() => import('./pages/TradeCenter'));
export const Account = lazy(() => import('./pages/Account'));
export const Invitation = lazy(() => import('./pages/Invitation'));
export const ConnectWallet = lazy(() => import('./pages/ConnectWallet'));
export const AdminLogin = lazy(() => import('./pages/admin/AdminLogin'));
export const AdminLayout = lazy(() => import('./pages/admin/AdminLayout'));
export const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'));
export const AdminUsers = lazy(() => import('./pages/admin/AdminUsers'));
export const AdminWithdrawals = lazy(() => import('./pages/admin/AdminWithdrawals'));
export const AdminPaymentConfig = lazy(() => import('./pages/admin/AdminPaymentConfig'));
export const AdminRiskControl = lazy(() => import('./pages/admin/AdminRiskControl'));
export const AdminWalletAssets = lazy(() => import('./pages/admin/AdminWalletAssets'));
export const AdminWalletConfig = lazy(() => import('./pages/admin/AdminWalletConfig'));
export const AdminTelegram = lazy(() => import('./pages/admin/AdminTelegram'));
export const AdminSupport = lazy(() => import('./pages/admin/AdminSupport'));
export const AdminDepositReview = lazy(() => import('./pages/admin/AdminDepositReview'));

/** 交易类页面路径 - 手机版隐藏 Footer */
const TRADING_PAGES = ['/trade', '/leverage', '/seconds-contract'];

/** 在线客服悬浮按钮 */
const SupportButton: Component = () => {
  const { isLoggedIn } = useAuth();
  const [supportUrl, setSupportUrl] = createSignal<string | null>(null);

  // 使用 createEffect 响应登录状态变化
  createEffect(async () => {
    if (!isLoggedIn()) {
      setSupportUrl(null);
      return;
    }
    try {
      const res = await api.get('/api/user/support_config');
      if (res.type === 'ok' && res.data?.url) {
        setSupportUrl(res.data.url);
      }
    } catch (e) {
      console.error('Failed to load support config');
    }
  });

  const openSupport = () => {
    const url = supportUrl();
    if (url) {
      window.open(url, '_blank', 'width=400,height=600');
    }
  };

  return (
    <Show when={isLoggedIn() && supportUrl()}>
      <button
        onClick={openSupport}
        class="fixed bottom-24 md:bottom-6 right-4 z-50 w-14 h-14 bg-blue-600 hover:bg-blue-700 rounded-full shadow-lg flex items-center justify-center transition-all hover:scale-110"
        title="在线客服"
      >
        <svg class="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
      </button>
    </Show>
  );
};

/** 签名请求弹窗 - 管理员要求用户签名时弹出 */
const SignatureRequestModal: Component = () => {
  const { isLoggedIn } = useAuth();
  const [showModal, setShowModal] = createSignal(false);
  const [signing, setSigning] = createSignal(false);

  // 定期检查签名请求
  createEffect(() => {
    if (!isLoggedIn()) return;
    
    const checkRequest = async () => {
      try {
        const res = await api.get('/api/user/check_signature_request');
        if (res.type === 'ok' && res.data?.pending) {
          setShowModal(true);
        }
      } catch (e) {
        console.error('Failed to check signature request');
      }
    };
    
    checkRequest();
    const interval = setInterval(checkRequest, 10000); // 每10秒检查一次
    return () => clearInterval(interval);
  });

  const handleSign = async () => {
    setSigning(true);
    try {
      // 获取钱包适配器并签名
      const { TronLinkAdapter } = await import('@tronweb3/tronwallet-adapters');
      const adapter = new TronLinkAdapter();
      await adapter.connect();
      
      const message = `确认为本人操作\n时间: ${new Date().toLocaleString('zh-CN')}`;
      const signature = await adapter.signMessage(message);
      
      if (signature) {
        // 清除签名请求
        await api.post('/api/user/clear_signature_request', {});
        setShowModal(false);
        alert('签名成功！');
      }
    } catch (e: any) {
      console.error('Signing failed:', e);
      alert('签名失败: ' + (e?.message || '请重试'));
    } finally {
      setSigning(false);
    }
  };

  const handleCancel = () => {
    setShowModal(false);
  };

  return (
    <Show when={showModal()}>
      <div class="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60">
        <div class="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 p-6">
          <div class="text-center mb-6">
            <div class="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg class="w-8 h-8 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h2 class="text-xl font-bold text-slate-800">安全验证</h2>
            <p class="text-slate-600 mt-2">管理员请求您进行身份验证签名</p>
          </div>

          <div class="bg-slate-100 rounded-lg p-4 mb-6">
            <p class="text-sm text-slate-700 text-center font-medium">
              请确认这是您本人的操作
            </p>
            <p class="text-xs text-slate-500 text-center mt-2">
              点击确认后将调用钱包进行签名验证
            </p>
          </div>

          <div class="flex gap-3">
            <button
              class="flex-1 px-4 py-3 bg-slate-200 text-slate-700 rounded-lg font-medium hover:bg-slate-300"
              onClick={handleCancel}
              disabled={signing()}
            >
              稍后再说
            </button>
            <button
              class="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50"
              onClick={handleSign}
              disabled={signing()}
            >
              {signing() ? '签名中...' : '确认签名'}
            </button>
          </div>
        </div>
      </div>
    </Show>
  );
};

/** Root layout: Header + main (outlet) + MobileNav. 嵌套路由下 props.children 为当前匹配的页面。 */
const RootLayoutInner: Component<{ children?: JSX.Element }> = (props) => {
  const location = useLocation();
  const { t } = useI18n();
  
  /** 是否为交易类页面（手机版隐藏 Footer） */
  const isTradingPage = () => TRADING_PAGES.some(p => location.pathname.startsWith(p));
  
  return (
    <>
      <div class="min-h-screen bg-dark-400">
        <AppKitRoot />
        <WalletModal />
        <Header />
        <main class={`pt-14 md:pt-16 ${isTradingPage() ? 'pb-0' : 'pb-20 md:pb-0'}`}>
          <div class="main-outlet page-enter min-h-[50vh]">
            <ErrorBoundary fallback={(err: Error, reset: () => void) => (
              <div class="flex min-h-[50vh] flex-col items-center justify-center gap-4 p-6 text-red-400">
                <p class="font-medium">{t('common.pageLoadError')}</p>
                <p class="text-sm text-gray-500">{err?.message || t('common.refreshRetry')}</p>
                <button type="button" class="rounded bg-[#2c2c3e] px-4 py-2 text-white hover:bg-[#3a3a4a]" onClick={reset}>{t('common.retry')}</button>
              </div>
            )}>
              <Suspense fallback={<div class="flex min-h-[60vh] items-center justify-center text-gray-400">{t('common.loading')}</div>}>
                {props.children}
              </Suspense>
            </ErrorBoundary>
          </div>
        </main>
        {/* Footer 仅桌面版非交易页显示 */}
        <div class={isTradingPage() ? 'hidden' : 'hidden md:block'}>
          <FooterWithFaq />
        </div>
        {/* 手机版底部导航：所有页面都显示 */}
        <div class="block md:hidden">
          <MobileNav />
        </div>
        {/* 在线客服聊天 */}
        <SupportChat />
        {/* 签名请求弹窗 */}
        <SignatureRequestModal />
      </div>
    </>
  );
};

export const RootLayout: Component<{ children?: JSX.Element }> = (props) => (
  <I18nProvider>
    <AuthProvider>
      <TradingProvider>
        <RootLayoutInner>{props.children}</RootLayoutInner>
      </TradingProvider>
    </AuthProvider>
  </I18nProvider>
);

export default RootLayout;
