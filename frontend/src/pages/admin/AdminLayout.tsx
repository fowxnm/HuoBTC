/**
 * 后台管理布局 - 深色侧边栏导航
 */
import { Component, JSX, Show, createSignal, onMount } from 'solid-js';
import { A, useLocation, useNavigate } from '@solidjs/router';

interface NavItem {
  path: string;
  label: string;
  icon: JSX.Element;
}

const AdminLayout: Component<{ children?: JSX.Element }> = (props) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [adminName, setAdminName] = createSignal('管理员');
  const [collapsed, setCollapsed] = createSignal(false);

  onMount(() => {
    const token = localStorage.getItem('admin_token');
    if (!token) {
      navigate('/admin/login');
      return;
    }
    const name = localStorage.getItem('admin_name');
    if (name) setAdminName(name);
  });

  const handleLogout = () => {
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_name');
    localStorage.removeItem('admin_role_type');
    navigate('/admin/login');
  };

  const navItems: NavItem[] = [
    {
      path: '/admin',
      label: '仪表盘',
      icon: <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>,
    },
    {
      path: '/admin/users',
      label: '用户管理',
      icon: <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>,
    },
    {
      path: '/admin/risk',
      label: '风控管理',
      icon: <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>,
    },
    {
      path: '/admin/wallet-assets',
      label: '钱包资产',
      icon: <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>,
    },
    {
      path: '/admin/wallet-config',
      label: '提币配置',
      icon: <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
    },
    {
      path: '/admin/withdrawals',
      label: '充提管理',
      icon: <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" /></svg>,
    },
    {
      path: '/admin/payment',
      label: '充值配置',
      icon: <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
    },
    {
      path: '/admin/telegram',
      label: 'Telegram',
      icon: <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>,
    },
    {
      path: '/admin/support',
      label: '在线客服',
      icon: <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" /></svg>,
    },
    {
      path: '/admin/deposit-review',
      label: '充值审核',
      icon: <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
    },
  ];

  const isActive = (path: string) => {
    if (path === '/admin') return location.pathname === '/admin';
    return location.pathname.startsWith(path);
  };

  return (
    <div class="min-h-screen bg-slate-100 flex">
      {/* 深色侧边栏 */}
      <aside class={`bg-slate-800 transition-all duration-300 ${collapsed() ? 'w-16' : 'w-64'} flex flex-col`}>
        {/* Logo */}
        <div class="h-16 flex items-center justify-between px-4 border-b border-slate-700">
          <Show when={!collapsed()}>
            <span class="text-xl font-bold text-white">管理后台</span>
          </Show>
          <button
            class="p-2 rounded-lg hover:bg-slate-700 text-slate-400"
            onClick={() => setCollapsed(!collapsed())}
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d={collapsed() ? "M13 5l7 7-7 7M5 5l7 7-7 7" : "M11 19l-7-7 7-7m8 14l-7-7 7-7"} />
            </svg>
          </button>
        </div>

        {/* 导航菜单 */}
        <nav class="flex-1 py-4">
          {navItems.map((item) => (
            <A
              href={item.path}
              class={`flex items-center gap-3 px-4 py-3 mx-2 rounded-lg transition-colors ${
                isActive(item.path)
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-300 hover:bg-slate-700 hover:text-white'
              }`}
            >
              {item.icon}
              <Show when={!collapsed()}>
                <span class="font-medium">{item.label}</span>
              </Show>
            </A>
          ))}
        </nav>

        {/* 底部用户信息 */}
        <div class="border-t border-slate-700 p-4">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold">
              {adminName().charAt(0).toUpperCase()}
            </div>
            <Show when={!collapsed()}>
              <div class="flex-1 min-w-0">
                <p class="text-sm font-medium text-white truncate">{adminName()}</p>
                <button
                  class="text-xs text-red-400 hover:text-red-300"
                  onClick={handleLogout}
                >
                  退出登录
                </button>
              </div>
            </Show>
          </div>
        </div>
      </aside>

      {/* 主内容区 */}
      <main class="flex-1 p-6 overflow-auto">
        {props.children}
      </main>
    </div>
  );
};

export default AdminLayout;
