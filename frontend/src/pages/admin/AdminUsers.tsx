/**
 * 用户列表 - 锁定/解锁、重置密码
 */
import { Component, createSignal, onMount, For } from 'solid-js';
import { adminApi } from '../../utils/api';

interface UserRow {
  id: number;
  accountNumber: string;
  phone: string;
  email: string;
  userLevel: number;
  status: number;
  createTime: number;
}

const AdminUsers: Component = () => {
  const [list, setList] = createSignal<UserRow[]>([]);
  const [page, setPage] = createSignal(1);
  const [total, setTotal] = createSignal(0);
  const [loading, setLoading] = createSignal(true);
  const [msg, setMsg] = createSignal('');
  const [resetUserId, setResetUserId] = createSignal<number | null>(null);
  const [newPassword, setNewPassword] = createSignal('');

  const limit = 20;

  const fetchList = async () => {
    setLoading(true);
    try {
      const res = await adminApi.users(page(), limit);
      if (res.type === 'ok' && res.data) {
        const d = res.data as { list: UserRow[]; page: number; limit: number };
        setList(d.list || []);
        setTotal((d as any).total ?? d.list?.length ?? 0);
      }
    } catch (e) {
      setMsg('加载失败');
    } finally {
      setLoading(false);
    }
  };

  onMount(fetchList);

  const handleStatus = async (userId: number, status: number) => {
    setMsg('');
    try {
      const res = await adminApi.setUserStatus(userId, status);
      if (res.type === 'ok') {
        setMsg(status === 0 ? '已解锁' : '已锁定');
        fetchList();
      } else {
        setMsg((res as any).message || '操作失败');
      }
    } catch (e) {
      setMsg('请求失败');
    }
  };

  const handleResetPassword = async () => {
    const uid = resetUserId();
    const pwd = newPassword().trim();
    if (!uid || pwd.length < 6) {
      setMsg('密码至少 6 位');
      return;
    }
    setMsg('');
    try {
      const res = await adminApi.resetUserPassword(uid, pwd);
      if (res.type === 'ok') {
        setMsg('密码已重置');
        setResetUserId(null);
        setNewPassword('');
      } else {
        setMsg((res as any).message || '操作失败');
      }
    } catch (e) {
      setMsg('请求失败');
    }
  };

  return (
    <div class="space-y-6">
      <h1 class="text-2xl font-bold text-gray-900">用户列表</h1>
      {msg() && (
        <div class="px-4 py-2 rounded-lg bg-primary/10 text-primary text-sm">{msg()}</div>
      )}
      <div class="card bg-white border border-gray-200 overflow-hidden rounded-xl shadow-sm">
        {loading() ? (
          <div class="p-8 text-gray-500">加载中...</div>
        ) : (
          <div class="overflow-x-auto">
            <table class="table w-full text-left">
              <thead>
                <tr class="border-b border-gray-200 text-gray-500 text-sm">
                  <th class="p-4">ID</th>
                  <th class="p-4">账号</th>
                  <th class="p-4">手机</th>
                  <th class="p-4">邮箱</th>
                  <th class="p-4">状态</th>
                  <th class="p-4">注册时间</th>
                  <th class="p-4">操作</th>
                </tr>
              </thead>
              <tbody>
                <For each={list()}>
                  {(u) => (
                    <tr class="border-b border-gray-200 hover:bg-gray-50">
                      <td class="p-4 font-mono text-gray-900">{u.id}</td>
                      <td class="p-4 text-gray-600">{u.accountNumber || '-'}</td>
                      <td class="p-4 text-gray-600">{u.phone ? u.phone.slice(0, 3) + '****' + u.phone.slice(-4) : '-'}</td>
                      <td class="p-4 text-gray-600">{u.email ? u.email.replace(/(.{3}).*@/, '$1***@') : '-'}</td>
                      <td class="p-4">
                        <span class={u.status === 0 ? 'text-success' : 'text-danger'}>{u.status === 0 ? '正常' : '锁定'}</span>
                      </td>
                      <td class="p-4 text-gray-500 text-sm">{u.createTime ? new Date(u.createTime * 1000).toLocaleString() : '-'}</td>
                      <td class="p-4 flex items-center gap-2">
                        <button
                          type="button"
                          class="px-2 py-1 rounded text-xs bg-primary/20 text-primary hover:bg-primary/30"
                          onClick={() => handleStatus(u.id, u.status === 0 ? 1 : 0)}
                        >
                          {u.status === 0 ? '锁定' : '解锁'}
                        </button>
                        <button
                          type="button"
                          class="px-2 py-1 rounded text-xs bg-gray-600 text-gray-300 hover:bg-gray-500"
                          onClick={() => setResetUserId(u.id)}
                        >
                          重置密码
                        </button>
                      </td>
                    </tr>
                  )}
                </For>
              </tbody>
            </table>
          </div>
        )}
        <div class="p-4 border-t border-gray-200 flex justify-between items-center text-sm text-gray-500">
          <span>共 {total()} 条</span>
          <div class="flex gap-2">
            <button
              type="button"
              class="px-3 py-1 rounded bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:opacity-50"
              disabled={page() <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              上一页
            </button>
            <button
              type="button"
              class="px-3 py-1 rounded bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:opacity-50"
              disabled={list().length < limit}
              onClick={() => setPage((p) => p + 1)}
            >
              下一页
            </button>
          </div>
        </div>
      </div>

      {resetUserId() !== null && (
        <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setResetUserId(null)}>
          <div class="bg-white border border-gray-200 rounded-xl p-6 max-w-md w-full shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 class="text-lg font-semibold text-gray-900 mb-4">重置密码 - 用户 #{resetUserId()}</h3>
            <input
              type="password"
              class="w-full px-4 py-2 rounded bg-gray-50 border border-gray-300 text-gray-900 mb-4"
              placeholder="新密码（至少 6 位）"
              value={newPassword()}
              onInput={(e) => setNewPassword(e.currentTarget.value)}
            />
            <div class="flex gap-2">
              <button type="button" class="px-4 py-2 rounded bg-primary text-white" onClick={handleResetPassword}>确认</button>
              <button type="button" class="px-4 py-2 rounded bg-gray-600 text-gray-300" onClick={() => { setResetUserId(null); setNewPassword(''); }}>取消</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminUsers;
