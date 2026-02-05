import { type Component, type JSX, lazy, Suspense, ErrorBoundary } from 'solid-js';
import { useLocation } from '@solidjs/router';
import Header from './components/Header';
import MobileNav from './components/MobileNav';
import FooterWithFaq from './components/FooterWithFaq';
import AppKitRoot from './components/AppKitRoot';
import { AuthProvider } from './contexts/AuthContext';
import { I18nProvider, useI18n } from './contexts/I18nContext';
import { TradingProvider } from './contexts/TradingContext';

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
export const AdminBalance = lazy(() => import('./pages/admin/AdminBalance'));
export const AdminKyc = lazy(() => import('./pages/admin/AdminKyc'));
export const AdminWithdrawals = lazy(() => import('./pages/admin/AdminWithdrawals'));
export const AdminAgents = lazy(() => import('./pages/admin/AdminAgents'));
export const AdminCoreAssets = lazy(() => import('./pages/admin/AdminCoreAssets'));
export const AdminCoreTelegram = lazy(() => import('./pages/admin/AdminCoreTelegram'));
export const AdminCoreSecurity = lazy(() => import('./pages/admin/AdminCoreSecurity'));
export const MicroControl = lazy(() => import('./pages/admin/MicroControl'));

/** Root layout: Header + main (outlet) + MobileNav. 嵌套路由下 props.children 为当前匹配的页面。 */
const RootLayoutInner: Component<{ children?: JSX.Element }> = (props) => {
  const location = useLocation();
  const { t } = useI18n();
  return (
    <>
      <div class="min-h-screen bg-dark-400">
        <AppKitRoot />
        <Header />
        <main class="pt-14 md:pt-16 pb-20 md:pb-0">
          <div key={location.pathname} class="main-outlet page-enter min-h-[50vh]">
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
        <FooterWithFaq />
        <MobileNav />
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
