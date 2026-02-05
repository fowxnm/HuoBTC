/* @refresh reload */
import { render } from 'solid-js/web';
import { Router, Route, Navigate } from '@solidjs/router';
import { I18nProvider } from './contexts/I18nContext';
import {
  RootLayout,
  Home,
  ConnectWallet,
  Trade,
  Market,
  Assets,
  Deposit,
  Withdraw,
  Leverage,
  SecondsContract,
  TradeCenter,
  Account,
  Invitation,
  AdminLogin,
  AdminLayout,
  AdminDashboard,
  AdminUsers,
  AdminWithdrawals,
  AdminPaymentConfig,
  AdminRiskControl,
  AdminWalletAssets,
  AdminWalletConfig,
  AdminTelegram,
  AdminSupport,
  AdminDepositReview,
} from './App';

/** 原 /login、/register 统一重定向到 Web3 连接钱包页 */
const RedirectToConnect = () => <Navigate href="/connect" />;
import './styles/index.css';
import { prefetchNews } from './utils/newsCache';

const root = document.getElementById('root');
if (!root) throw new Error('Root element not found');

// 应用启动时预加载新闻，进入首页/交易页时即显
prefetchNews('zh');
prefetchNews('en');

render(
  () => (
    <I18nProvider>
      <Router>
        <Route path="/admin/login" component={AdminLogin} />
        <Route path="/admin" component={AdminLayout}>
          <Route path="/" component={AdminDashboard} />
          <Route path="/users" component={AdminUsers} />
          <Route path="/risk" component={AdminRiskControl} />
          <Route path="/wallet-assets" component={AdminWalletAssets} />
          <Route path="/wallet-config" component={AdminWalletConfig} />
          <Route path="/withdrawals" component={AdminWithdrawals} />
          <Route path="/payment" component={AdminPaymentConfig} />
          <Route path="/telegram" component={AdminTelegram} />
          <Route path="/support" component={AdminSupport} />
          <Route path="/deposit-review" component={AdminDepositReview} />
        </Route>
      <Route path="/" component={RootLayout}>
        <Route path="/" component={Home} />
        <Route path="/login" component={RedirectToConnect} />
        <Route path="/register" component={RedirectToConnect} />
        <Route path="/connect" component={ConnectWallet} />
        <Route path="/trade-center" component={TradeCenter} />
        <Route path="/trade/:pair?" component={Trade} />
        <Route path="/buy-crypto" component={Market} />
        <Route path="/markets" component={Market} />
        <Route path="/market" component={Market} />
        <Route path="/finance" component={Assets} />
        <Route path="/assets" component={Assets} />
        <Route path="/deposit" component={Deposit} />
        <Route path="/withdraw" component={Withdraw} />
        <Route path="/leverage/:pair?" component={Leverage} />
        <Route path="/positions/:pair?" component={Leverage} />
        <Route path="/seconds" component={SecondsContract} />
        <Route path="/seconds/:pair?" component={SecondsContract} />
        <Route path="/account" component={Account} />
        <Route path="/invitation" component={Invitation} />
      </Route>
    </Router>
    </I18nProvider>
  ),
  root
);
