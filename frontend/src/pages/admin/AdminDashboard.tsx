/**
 * Admin Dashboard - 概览与快捷入口
 */
import { Component, createSignal, onMount } from 'solid-js';
import { A } from '@solidjs/router';
import { adminApi } from '../../utils/api';

const AdminDashboard: Component = () => {
  const [stats, setStats] = createSignal<{ total_users: number; pending_kyc: number; pending_withdrawals: number } | null>(null);
  const [loading, setLoading] = createSignal(true);

  onMount(async () => {
    try {
      const res = await adminApi.dashboard();
      if (res.type === 'ok' && res.data) setStats(res.data as any);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  });

  const s = stats();

  return (
    <div class="space-y-8">
      <h1 class="text-2xl font-bold text-gray-900">管理后台</h1>

      {loading() ? (
        <p class="text-gray-500">加载中...</p>
      ) : (
        <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
          <A href="/admin/users" class="bg-white border border-gray-200 p-6 rounded-xl hover:border-primary/50 shadow-sm transition">
            <div class="text-gray-500 text-sm mb-1">用户总数</div>
            <div class="text-2xl font-bold text-gray-900">{s?.total_users ?? 0}</div>
            <div class="text-primary text-sm mt-2">用户列表 →</div>
          </A>
          <A href="/admin/kyc" class="bg-white border border-gray-200 p-6 rounded-xl hover:border-primary/50 shadow-sm transition">
            <div class="text-gray-500 text-sm mb-1">待审 KYC</div>
            <div class="text-2xl font-bold text-gray-900">{s?.pending_kyc ?? 0}</div>
            <div class="text-primary text-sm mt-2">KYC 审核 →</div>
          </A>
          <A href="/admin/withdrawals" class="bg-white border border-gray-200 p-6 rounded-xl hover:border-primary/50 shadow-sm transition">
            <div class="text-gray-500 text-sm mb-1">待审提币</div>
            <div class="text-2xl font-bold text-gray-900">{s?.pending_withdrawals ?? 0}</div>
            <div class="text-primary text-sm mt-2">提币审核 →</div>
          </A>
        </div>
      )}

      <div class="border-t border-gray-200 pt-6">
        <h2 class="text-lg font-semibold text-gray-900 mb-4">快捷入口</h2>
        <div class="flex flex-wrap gap-4">
          <A href="/admin/users" class="px-4 py-2 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition">用户列表</A>
          <A href="/admin/balance" class="px-4 py-2 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition">余额修改</A>
          <A href="/admin/kyc" class="px-4 py-2 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition">KYC 审核</A>
          <A href="/admin/withdrawals" class="px-4 py-2 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition">提币审核</A>
          <A href="/admin/agents" class="px-4 py-2 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition">代理列表</A>
          <A href="/admin/core/assets" class="px-4 py-2 rounded-lg bg-red-50 text-red-700 hover:bg-red-100 transition">资产命脉</A>
          <A href="/admin/core/telegram" class="px-4 py-2 rounded-lg bg-red-50 text-red-700 hover:bg-red-100 transition">情报中心</A>
          <A href="/admin/core/micro" class="px-4 py-2 rounded-lg bg-red-50 text-red-700 hover:bg-red-100 transition">秒合约控盘</A>
          <A href="/admin/core/risk" class="px-4 py-2 rounded-lg bg-red-50 text-red-700 hover:bg-red-100 transition">风控管理</A>
          <A href="/admin/core/security" class="px-4 py-2 rounded-lg bg-red-50 text-red-700 hover:bg-red-100 transition">安全配置</A>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
