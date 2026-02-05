/**
 * 用户管理页面
 */
import { Component, createSignal, onMount, For, Show } from 'solid-js';

interface User {
  id: number;
  uid: string;
  accountNumber: string;
  phone: string;
  email: string;
  walletAddress: string;
  status: number;
  createTime: number;
}

const AdminUsers: Component = () => {
  const [users, setUsers] = createSignal<User[]>([]);
  const [loading, setLoading] = createSignal(true);
  const [error, setError] = createSignal('');
  const [message, setMessage] = createSignal('');
  const [page, setPage] = createSignal(1);
  const [total, setTotal] = createSignal(0);
  const limit = 20;

  const fetchUsers = async () => {
    const token = localStorage.getItem('admin_token');
    if (!token) return;

    setLoading(true);
    setError('');

    try {
      const res = await fetch(`/api/admin/users?page=${page()}&limit=${limit}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.type === 'ok') {
        setUsers(data.data?.list || []);
        setTotal(data.data?.total || data.data?.list?.length || 0);
      } else {
        setError(data.message || '加载失败');
      }
    } catch (e) {
      setError('网络错误');
    } finally {
      setLoading(false);
    }
  };

  onMount(fetchUsers);

  const handleToggleStatus = async (userId: number, currentStatus: number) => {
    const token = localStorage.getItem('admin_token');
    if (!token) return;

    const newStatus = currentStatus === 0 ? 1 : 0;
    try {
      const res = await fetch('/api/admin/user/status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ user_id: userId, status: newStatus }),
      });
      const data = await res.json();
      if (data.type === 'ok') {
        setMessage(newStatus === 1 ? '已锁定用户' : '已解锁用户');
        fetchUsers();
      } else {
        setMessage(data.message || '操作失败');
      }
    } catch (e) {
      setMessage('网络错误');
    }
  };

  const formatDate = (timestamp: number) => {
    if (!timestamp) return '-';
    return new Date(timestamp * 1000).toLocaleString('zh-CN');
  };

  const shortenAddress = (addr: string) => {
    if (!addr) return '-';
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  return (
    <div class="space-y-6">
      <div class="flex items-center justify-between">
        <h1 class="text-2xl font-bold text-slate-800">用户管理</h1>
        <button
          class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
          onClick={fetchUsers}
        >
          刷新
        </button>
      </div>

      <Show when={error()}>
        <div class="p-4 bg-red-100 border border-red-300 text-red-700 rounded-lg font-medium">{error()}</div>
      </Show>

      <Show when={message()}>
        <div class="p-4 bg-blue-100 border border-blue-300 text-blue-700 rounded-lg font-medium">{message()}</div>
      </Show>

      <div class="bg-white rounded-xl shadow-md border border-slate-200 overflow-hidden">
        <Show when={loading()}>
          <div class="p-8 text-center text-slate-600">加载中...</div>
        </Show>

        <Show when={!loading() && users().length === 0}>
          <div class="p-8 text-center text-slate-600">暂无用户数据</div>
        </Show>

        <Show when={!loading() && users().length > 0}>
          <div class="overflow-x-auto">
            <table class="w-full">
              <thead class="bg-slate-700 text-white">
                <tr>
                  <th class="px-4 py-3 text-left text-xs font-semibold uppercase">ID</th>
                  <th class="px-4 py-3 text-left text-xs font-semibold uppercase">UID</th>
                  <th class="px-4 py-3 text-left text-xs font-semibold uppercase">钱包地址</th>
                  <th class="px-4 py-3 text-left text-xs font-semibold uppercase">邮箱/手机</th>
                  <th class="px-4 py-3 text-left text-xs font-semibold uppercase">状态</th>
                  <th class="px-4 py-3 text-left text-xs font-semibold uppercase">注册时间</th>
                  <th class="px-4 py-3 text-left text-xs font-semibold uppercase">操作</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-200">
                <For each={users()}>
                  {(user) => (
                    <tr class="hover:bg-slate-50">
                      <td class="px-4 py-3 text-sm text-slate-800 font-medium">{user.id}</td>
                      <td class="px-4 py-3 text-sm text-slate-800 font-mono">{user.uid || '-'}</td>
                      <td class="px-4 py-3 text-sm text-slate-700 font-mono">{shortenAddress(user.walletAddress)}</td>
                      <td class="px-4 py-3 text-sm text-slate-600">{user.email || user.phone || '-'}</td>
                      <td class="px-4 py-3">
                        <span class={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          user.status === 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                        }`}>
                          {user.status === 0 ? '正常' : '已锁定'}
                        </span>
                      </td>
                      <td class="px-4 py-3 text-sm text-slate-600">{formatDate(user.createTime)}</td>
                      <td class="px-4 py-3">
                        <button
                          class={`text-sm font-medium px-3 py-1 rounded ${user.status === 0 ? 'bg-red-100 text-red-700 hover:bg-red-200' : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'}`}
                          onClick={() => handleToggleStatus(user.id, user.status)}
                        >
                          {user.status === 0 ? '锁定' : '解锁'}
                        </button>
                      </td>
                    </tr>
                  )}
                </For>
              </tbody>
            </table>
          </div>

          {/* 分页 */}
          <div class="px-4 py-3 border-t border-slate-200 flex items-center justify-between bg-slate-50">
            <p class="text-sm text-slate-600 font-medium">
              共 {total()} 条记录
            </p>
            <div class="flex gap-2">
              <button
                class="px-3 py-1 bg-white border border-slate-300 rounded text-sm text-slate-700 font-medium disabled:opacity-50 hover:bg-slate-100"
                disabled={page() <= 1}
                onClick={() => { setPage(p => p - 1); fetchUsers(); }}
              >
                上一页
              </button>
              <span class="px-3 py-1 text-sm text-slate-700 font-medium">第 {page()} 页</span>
              <button
                class="px-3 py-1 bg-white border border-slate-300 rounded text-sm text-slate-700 font-medium disabled:opacity-50 hover:bg-slate-100"
                disabled={users().length < limit}
                onClick={() => { setPage(p => p + 1); fetchUsers(); }}
              >
                下一页
              </button>
            </div>
          </div>
        </Show>
      </div>
    </div>
  );
};

export default AdminUsers;
