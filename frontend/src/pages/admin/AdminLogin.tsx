/**
 * 后台管理登录页
 */
import { Component, createSignal } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import { api } from '../../utils/api';

const AdminLogin: Component = () => {
  const navigate = useNavigate();
  const [username, setUsername] = createSignal('');
  const [password, setPassword] = createSignal('');
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal('');

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await api.post('/api/agent/login', {
        username: username(),
        password: password(),
      });

      if (res.type === 'ok' && res.token) {
        localStorage.setItem('admin_token', res.token);
        localStorage.setItem('admin_name', res.data?.username || username());
        localStorage.setItem('admin_role_type', String(res.data?.role_type ?? 1));
        navigate('/admin');
      } else {
        setError((res.message as string) || '登录失败');
      }
    } catch (e) {
      setError('网络错误，请重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div class="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900 flex items-center justify-center p-4">
      <div class="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8">
        <div class="text-center mb-8">
          <div class="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
            <svg class="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
            </svg>
          </div>
          <h1 class="text-2xl font-bold text-gray-900">后台管理系统</h1>
          <p class="text-gray-600 mt-2">请登录管理员账号</p>
        </div>

        {error() && (
          <div class="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm font-medium">
            {error()}
          </div>
        )}

        <form onSubmit={handleSubmit} class="space-y-5">
          <div>
            <label class="block text-sm font-semibold text-gray-800 mb-2">用户名</label>
            <input
              type="text"
              class="w-full px-4 py-3 text-gray-900 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:bg-white placeholder-gray-400 font-medium"
              style="color: #1a202c !important;"
              placeholder="输入管理员用户名"
              value={username()}
              onInput={(e) => setUsername(e.target.value)}
              required
            />
          </div>
          <div>
            <label class="block text-sm font-semibold text-gray-800 mb-2">密码</label>
            <input
              type="password"
              class="w-full px-4 py-3 text-gray-900 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:bg-white placeholder-gray-400 font-medium"
              style="color: #1a202c !important;"
              placeholder="输入密码"
              value={password()}
              onInput={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <button
            type="submit"
            class="w-full py-3.5 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl transition-all duration-200"
            disabled={loading()}
          >
            {loading() ? '登录中...' : '登录'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default AdminLogin;
