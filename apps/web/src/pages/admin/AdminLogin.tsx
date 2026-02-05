/**
 * Admin / Agent Login
 * Calls /api/agent/login and stores admin_token, admin_role_type, admin_name
 */

import { Component, createSignal } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import { adminApi } from '../../utils/api';

const AdminLogin: Component = () => {
  const navigate = useNavigate();
  const [username, setUsername] = createSignal('');
  const [password, setPassword] = createSignal('');
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal('');

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    setError('');

    if (!username().trim()) {
      setError('请输入用户名');
      return;
    }
    if (!password().trim()) {
      setError('请输入密码');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const res = await adminApi.login({
        username: username().trim(),
        password: password(),
      });

      if (res.type === 'ok' && res.token && res.data) {
        localStorage.setItem('admin_token', res.token);
        localStorage.setItem('admin_role_type', String((res.data as any).role_type ?? 1));
        localStorage.setItem('admin_name', (res.data as any).username ?? username());
        navigate('/admin', { replace: true });
        return;
      }
      const msg = (res as any).message || '';
      const hint =
        msg === 'Agent not found'
          ? '未找到该管理员账号，请确认用户名'
          : msg === 'Invalid password'
            ? '密码错误，请重试'
            : msg === 'Account is locked'
              ? '账号已锁定，请联系超级管理员'
              : msg || '登录失败，请检查用户名和密码';
      setError(hint);
    } catch (err) {
      const msg = (err as Error)?.message || '网络错误，请重试';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div class="min-h-screen flex items-center justify-center px-4 py-12 bg-gray-100">
      <div class="w-full max-w-md">
        <div class="bg-white border border-gray-200 rounded-xl p-8 shadow-lg">
          <div class="text-center mb-8">
            <img src="/imgs/header_logo.png" alt="Logo" class="logo-admin mx-auto mb-4" style="height: 1.97rem; display: block;" onError={(e) => { (e.target as HTMLImageElement).src = '/assets/logo.png'; }} />
            <h1 class="text-2xl font-bold text-gray-900">管理后台登录</h1>
            <p class="text-gray-500 mt-2">Agent / Admin 账号</p>
          </div>

          {error() && (
            <div role="alert" class="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 mb-6 text-sm">
              {error()}
            </div>
          )}

          <form onSubmit={handleSubmit} class="space-y-6">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">用户名</label>
              <input
                type="text"
                class="w-full px-4 py-3 rounded-lg bg-gray-50 border border-gray-300 text-gray-900 placeholder-gray-400 focus:border-primary focus:ring-1 focus:ring-primary"
                placeholder="请输入用户名"
                value={username()}
                onInput={(e) => setUsername(e.currentTarget.value)}
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">密码</label>
              <input
                type="password"
                class="w-full px-4 py-3 rounded-lg bg-gray-50 border border-gray-300 text-gray-900 placeholder-gray-400 focus:border-primary focus:ring-1 focus:ring-primary"
                placeholder="请输入密码"
                value={password()}
                onInput={(e) => setPassword(e.currentTarget.value)}
              />
            </div>
            <button
              type="submit"
              disabled={loading()}
              class="w-full py-3 rounded-lg bg-primary text-white font-semibold hover:opacity-90 disabled:opacity-50 transition"
            >
              {loading() ? '登录中...' : '登录'}
            </button>
          </form>

          <p class="text-center text-gray-500 text-sm mt-6">
            返回 <a href="/" class="text-primary hover:underline">首页</a>
          </p>
        </div>
      </div>
    </div>
  );
};

export default AdminLogin;
