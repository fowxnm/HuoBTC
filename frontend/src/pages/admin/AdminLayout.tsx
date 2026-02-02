/**
 * Admin Panel Layout with RBAC Sidebar
 * 
 * Role-based menu display:
 * - Operator (role_type=1): User management, balance, KYC, agents
 * - SuperAdmin (role_type=0): All operator features + Core System Config
 */

import { Component, createSignal, createEffect, Show, For, JSX } from 'solid-js';
import { A, useLocation, useNavigate } from '@solidjs/router';
import { useI18n } from '../../contexts/I18nContext';

interface MenuItem {
  path: string;
  label: string;
  icon: JSX.Element;
  superAdminOnly?: boolean;
}

interface MenuGroup {
  title: string;
  items: MenuItem[];
  superAdminOnly?: boolean;
}

// Icon components
const IconUsers = () => (
  <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
  </svg>
);

const IconWallet = () => (
  <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
  </svg>
);

const IconVerified = () => (
  <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
  </svg>
);

const IconAgent = () => (
  <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

const IconWithdraw = () => (
  <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const IconCog = () => (
  <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

const IconTelegram = () => (
  <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
  </svg>
);

const IconServer = () => (
  <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
  </svg>
);

const IconChart = () => (
  <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
  </svg>
);

const IconLock = () => (
  <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
  </svg>
);

const IconShield = () => (
  <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
  </svg>
);

// Menu configuration
const MENU_GROUPS: MenuGroup[] = [
  {
    title: '用户管理',
    items: [
      { path: '/admin/users', label: '用户列表', icon: <IconUsers /> },
      { path: '/admin/balance', label: '余额修改', icon: <IconWallet /> },
      { path: '/admin/kyc', label: 'KYC审核', icon: <IconVerified /> },
      { path: '/admin/withdrawals', label: '提币审核', icon: <IconWithdraw /> },
    ]
  },
  {
    title: '代理管理',
    items: [
      { path: '/admin/agents', label: '代理列表', icon: <IconAgent /> },
    ]
  },
  {
    title: '系统核心配置',
    superAdminOnly: true,
    items: [
      { path: '/admin/core/assets', label: '资产命脉', icon: <IconServer />, superAdminOnly: true },
      { path: '/admin/core/telegram', label: '情报中心', icon: <IconTelegram />, superAdminOnly: true },
      { path: '/admin/core/micro', label: '秒合约控盘', icon: <IconChart />, superAdminOnly: true },
      { path: '/admin/core/risk', label: '风控管理', icon: <IconShield />, superAdminOnly: true },
      { path: '/admin/core/security', label: '安全配置', icon: <IconLock />, superAdminOnly: true },
    ]
  }
];

interface AdminLayoutProps {
  children: JSX.Element;
}

const AdminLayout: Component<AdminLayoutProps> = (props) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useI18n();
  const [isSuperAdmin, setIsSuperAdmin] = createSignal(false);
  const [adminName, setAdminName] = createSignal('Admin');
  const [sidebarOpen, setSidebarOpen] = createSignal(true);

  // Check admin role on mount
  createEffect(() => {
    const token = localStorage.getItem('admin_token');
    const roleType = localStorage.getItem('admin_role_type');
    
    if (!token) {
      navigate('/admin/login');
      return;
    }

    // role_type 0 = SuperAdmin
    setIsSuperAdmin(roleType === '0');
    setAdminName(localStorage.getItem('admin_name') || 'Admin');
  });

  const isActive = (path: string) => location.pathname === path;

  const handleLogout = () => {
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_role_type');
    localStorage.removeItem('admin_name');
    navigate('/admin/login');
  };

  return (
    <div class="min-h-screen bg-gray-100 flex">
      {/* Sidebar */}
      <aside class={`${sidebarOpen() ? 'w-64' : 'w-16'} bg-white border-r border-gray-200 transition-all duration-300 flex flex-col shadow-sm`}>
        {/* Logo */}
        <div class="h-16 flex items-center justify-center border-b border-gray-200 px-2">
          <Show when={sidebarOpen()} fallback={<img src="/favicon.svg" alt="" class="w-8 h-8" />}>
            <img src="/imgs/header_logo.png" alt="Logo" class="logo-admin" style="height: 1.97rem; display: block; vertical-align: middle;" onError={(e) => { (e.target as HTMLImageElement).src = '/assets/logo.png'; }} />
          </Show>
        </div>

        {/* Role Badge */}
        <Show when={sidebarOpen()}>
          <div class="px-4 py-3 border-b border-gray-200">
            <div class={`inline-flex items-center px-2 py-1 rounded text-xs font-semibold ${
              isSuperAdmin() 
                ? 'bg-red-100 text-red-700' 
                : 'bg-primary/10 text-primary'
            }`}>
              {isSuperAdmin() ? '🔑 SuperAdmin' : '👤 Operator'}
            </div>
            <p class="text-gray-600 text-sm mt-1">{adminName()}</p>
          </div>
        </Show>

        {/* Menu */}
        <nav class="flex-1 overflow-y-auto py-4">
          <For each={MENU_GROUPS}>
            {(group) => (
              <Show when={!group.superAdminOnly || isSuperAdmin()}>
                <div class="mb-6">
                  <Show when={sidebarOpen()}>
                    <h3 class={`px-4 mb-2 text-xs font-semibold uppercase tracking-wider ${
                      group.superAdminOnly ? 'text-red-600' : 'text-gray-500'
                    }`}>
                      {group.superAdminOnly && '🔒 '}
                      {group.title}
                    </h3>
                  </Show>
                  <For each={group.items}>
                    {(item) => (
                      <Show when={!item.superAdminOnly || isSuperAdmin()}>
                        <A
                          href={item.path}
                          class={`flex items-center px-4 py-2 mx-2 rounded-lg transition-colors ${
                            isActive(item.path)
                              ? item.superAdminOnly 
                                ? 'bg-red-50 text-red-700' 
                                : 'bg-primary/10 text-primary'
                              : 'text-gray-600 hover:bg-gray-100'
                          }`}
                        >
                          {item.icon}
                          <Show when={sidebarOpen()}>
                            <span class="ml-3">{item.label}</span>
                          </Show>
                        </A>
                      </Show>
                    )}
                  </For>
                </div>
              </Show>
            )}
          </For>
        </nav>

        {/* Footer */}
        <div class="border-t border-gray-200 p-4">
          <button
            onClick={handleLogout}
            class="flex items-center text-gray-600 hover:text-red-600 transition-colors w-full"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            <Show when={sidebarOpen()}>
              <span class="ml-3">{t('common.disconnect')}</span>
            </Show>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main class="flex-1 overflow-auto bg-gray-50">
        {/* Top Bar */}
        <header class="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6 shadow-sm">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen())}
            class="text-gray-600 hover:text-gray-900"
          >
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          
          <div class="flex items-center space-x-4">
            <Show when={isSuperAdmin()}>
              <span class="text-xs text-red-700 bg-red-50 px-2 py-1 rounded">
                核心权限已启用
              </span>
            </Show>
          </div>
        </header>

        {/* Page Content */}
        <div class="p-6">
          {props.children}
        </div>
      </main>
    </div>
  );
};

export default AdminLayout;
