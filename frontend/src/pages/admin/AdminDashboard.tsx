/**
 * 后台管理仪表盘
 */
import { Component, createSignal, onMount } from 'solid-js';
import { A } from '@solidjs/router';

interface Stats {
  total_users: number;
  pending_kyc: number;
  pending_withdrawals: number;
}

const AdminDashboard: Component = () => {
  const [stats, setStats] = createSignal<Stats | null>(null);
  const [loading, setLoading] = createSignal(true);
  const [error, setError] = createSignal('');

  const fetchStats = async () => {
    const token = localStorage.getItem('admin_token');
    if (!token) return;

    try {
      const res = await fetch('/api/admin/dashboard', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.type === 'ok') {
        setStats(data.data);
      } else {
        setError(data.message || '加载失败');
      }
    } catch (e) {
      setError('网络错误');
    } finally {
      setLoading(false);
    }
  };

  onMount(fetchStats);

  return (
    <div class="space-y-6">
      <h1 class="text-2xl font-bold text-slate-800">仪表盘</h1>

      {error() && (
        <div class="p-4 bg-red-100 border border-red-300 text-red-700 rounded-lg">
          {error()}
        </div>
      )}

      {loading() ? (
        <div class="text-slate-600">加载中...</div>
      ) : (
        <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
          <A
            href="/admin/users"
            class="bg-white rounded-xl p-6 shadow-md border border-slate-200 hover:shadow-lg transition-shadow"
          >
            <div class="flex items-center gap-4">
              <div class="w-14 h-14 bg-blue-500 rounded-xl flex items-center justify-center">
                <svg class="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              </div>
              <div>
                <p class="text-sm text-slate-500 font-medium">用户总数</p>
                <p class="text-3xl font-bold text-slate-800">{stats()?.total_users ?? 0}</p>
              </div>
            </div>
          </A>

          <div class="bg-white rounded-xl p-6 shadow-md border border-slate-200">
            <div class="flex items-center gap-4">
              <div class="w-14 h-14 bg-amber-500 rounded-xl flex items-center justify-center">
                <svg class="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <div>
                <p class="text-sm text-slate-500 font-medium">待审 KYC</p>
                <p class="text-3xl font-bold text-slate-800">{stats()?.pending_kyc ?? 0}</p>
              </div>
            </div>
          </div>

          <A
            href="/admin/withdrawals"
            class="bg-white rounded-xl p-6 shadow-md border border-slate-200 hover:shadow-lg transition-shadow"
          >
            <div class="flex items-center gap-4">
              <div class="w-14 h-14 bg-emerald-500 rounded-xl flex items-center justify-center">
                <svg class="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <div>
                <p class="text-sm text-slate-500 font-medium">待审提币</p>
                <p class="text-3xl font-bold text-slate-800">{stats()?.pending_withdrawals ?? 0}</p>
              </div>
            </div>
          </A>
        </div>
      )}

      <div class="bg-white rounded-xl p-6 shadow-md border border-slate-200">
        <h2 class="text-lg font-semibold text-slate-800 mb-4">快捷操作</h2>
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
          <A href="/admin/users" class="p-4 bg-slate-100 rounded-lg text-center hover:bg-slate-200 transition-colors">
            <p class="text-sm font-medium text-slate-700">用户管理</p>
          </A>
          <A href="/admin/withdrawals" class="p-4 bg-slate-100 rounded-lg text-center hover:bg-slate-200 transition-colors">
            <p class="text-sm font-medium text-slate-700">提币审核</p>
          </A>
          <A href="/admin/payment" class="p-4 bg-slate-100 rounded-lg text-center hover:bg-slate-200 transition-colors">
            <p class="text-sm font-medium text-slate-700">充值配置</p>
          </A>
          <button
            class="p-4 bg-blue-500 rounded-lg text-center hover:bg-blue-600 transition-colors"
            onClick={fetchStats}
          >
            <p class="text-sm font-medium text-white">刷新数据</p>
          </button>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
