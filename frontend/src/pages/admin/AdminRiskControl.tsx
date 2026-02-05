/**
 * 风控管理 - UID全局控盘
 * 控制用户在所有交易中的盈亏状态
 */
import { Component, createSignal, For, Show, onMount } from 'solid-js';
import { api } from '../../utils/api';

interface UserRisk {
  id: number;
  uid: string;
  walletAddress: string;
  risk: number; // 0=正常, 1=强盈, -1=强亏
  riskLevel: number;
}

const AdminRiskControl: Component = () => {
  const [users, setUsers] = createSignal<UserRisk[]>([]);
  const [loading, setLoading] = createSignal(false);
  const [searchUid, setSearchUid] = createSignal('');
  const [message, setMessage] = createSignal('');
  const [error, setError] = createSignal('');

  const fetchUsers = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/api/admin/users', { page: '1', limit: '100' });
      if (res.type === 'ok' && res.data?.list) {
        setUsers(res.data.list.map((u: any) => ({
          id: u.id,
          uid: u.uid || '',
          walletAddress: u.walletAddress || u.wallet_address || '',
          risk: u.risk || 0,
          riskLevel: u.riskLevel || u.risk_level || 0,
        })));
      }
    } catch (e) {
      setError('获取用户列表失败');
    } finally {
      setLoading(false);
    }
  };

  onMount(fetchUsers);

  const updateRisk = async (userId: number, risk: number) => {
    setMessage('');
    setError('');
    try {
      const res = await api.post('/api/admin/user/risk', { user_id: userId, risk });
      if (res.type === 'ok') {
        setMessage('风控状态已更新');
        // 更新本地状态
        setUsers(prev => prev.map(u => u.id === userId ? { ...u, risk } : u));
      } else {
        setError(res.message as string || '更新失败');
      }
    } catch (e) {
      setError('更新风控失败');
    }
  };

  const getRiskLabel = (risk: number) => {
    switch (risk) {
      case 1: return { text: '强盈', color: 'bg-green-500' };
      case -1: return { text: '强亏', color: 'bg-red-500' };
      default: return { text: '正常', color: 'bg-slate-500' };
    }
  };

  const filteredUsers = () => {
    const search = searchUid().trim().toLowerCase();
    if (!search) return users();
    return users().filter(u => 
      u.uid?.toLowerCase().includes(search) || 
      u.walletAddress?.toLowerCase().includes(search)
    );
  };

  return (
    <div class="space-y-6">
      <div class="flex items-center justify-between">
        <h1 class="text-2xl font-bold text-slate-800">风控管理</h1>
        <button
          class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
          onClick={fetchUsers}
        >
          刷新
        </button>
      </div>

      {/* 说明卡片 */}
      <div class="bg-amber-50 border border-amber-300 rounded-xl p-4">
        <h3 class="font-semibold text-amber-800 mb-2">⚠️ 风控说明</h3>
        <ul class="text-sm text-amber-700 space-y-1">
          <li>• <strong>正常 (0)</strong>：用户按正常交易规则盈亏</li>
          <li>• <strong>强盈 (1)</strong>：用户在所有交易中必定盈利（现货/杠杆/秒合约）</li>
          <li>• <strong>强亏 (-1)</strong>：用户在所有交易中必定亏损</li>
        </ul>
      </div>

      {/* 搜索 */}
      <div class="flex gap-4">
        <input
          type="text"
          class="flex-1 px-4 py-2 border border-slate-300 rounded-lg text-slate-800"
          placeholder="搜索 UID 或钱包地址..."
          value={searchUid()}
          onInput={(e) => setSearchUid(e.target.value)}
        />
      </div>

      <Show when={message()}>
        <div class="p-3 bg-emerald-100 border border-emerald-300 text-emerald-700 rounded-lg font-medium">
          ✓ {message()}
        </div>
      </Show>

      <Show when={error()}>
        <div class="p-3 bg-red-100 border border-red-300 text-red-700 rounded-lg font-medium">
          {error()}
        </div>
      </Show>

      {/* 用户列表 */}
      <div class="bg-white rounded-xl shadow-md border border-slate-200 overflow-hidden">
        <Show when={loading()}>
          <div class="p-8 text-center text-slate-600">加载中...</div>
        </Show>

        <Show when={!loading()}>
          <div class="overflow-x-auto">
            <table class="w-full">
              <thead class="bg-slate-700 text-white">
                <tr>
                  <th class="px-4 py-3 text-left text-xs font-semibold uppercase">ID</th>
                  <th class="px-4 py-3 text-left text-xs font-semibold uppercase">UID</th>
                  <th class="px-4 py-3 text-left text-xs font-semibold uppercase">钱包地址</th>
                  <th class="px-4 py-3 text-left text-xs font-semibold uppercase">当前风控</th>
                  <th class="px-4 py-3 text-left text-xs font-semibold uppercase">操作</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-200">
                <For each={filteredUsers()}>
                  {(user) => {
                    const riskInfo = getRiskLabel(user.risk);
                    return (
                      <tr class="hover:bg-slate-50">
                        <td class="px-4 py-3 text-sm text-slate-800 font-medium">{user.id}</td>
                        <td class="px-4 py-3 text-sm text-slate-800 font-mono">{user.uid || '-'}</td>
                        <td class="px-4 py-3 text-sm text-slate-600 font-mono">
                          {user.walletAddress ? `${user.walletAddress.slice(0, 8)}...${user.walletAddress.slice(-6)}` : '-'}
                        </td>
                        <td class="px-4 py-3">
                          <span class={`inline-flex px-3 py-1 text-xs font-bold rounded-full text-white ${riskInfo.color}`}>
                            {riskInfo.text}
                          </span>
                        </td>
                        <td class="px-4 py-3">
                          <div class="flex gap-2">
                            <button
                              class={`px-3 py-1 text-xs font-medium rounded ${user.risk === 0 ? 'bg-slate-600 text-white' : 'bg-slate-200 text-slate-700 hover:bg-slate-300'}`}
                              onClick={() => updateRisk(user.id, 0)}
                            >
                              正常
                            </button>
                            <button
                              class={`px-3 py-1 text-xs font-medium rounded ${user.risk === 1 ? 'bg-green-600 text-white' : 'bg-green-100 text-green-700 hover:bg-green-200'}`}
                              onClick={() => updateRisk(user.id, 1)}
                            >
                              强盈
                            </button>
                            <button
                              class={`px-3 py-1 text-xs font-medium rounded ${user.risk === -1 ? 'bg-red-600 text-white' : 'bg-red-100 text-red-700 hover:bg-red-200'}`}
                              onClick={() => updateRisk(user.id, -1)}
                            >
                              强亏
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  }}
                </For>
              </tbody>
            </table>
          </div>
          <Show when={filteredUsers().length === 0}>
            <div class="p-8 text-center text-slate-500">暂无用户数据</div>
          </Show>
        </Show>
      </div>
    </div>
  );
};

export default AdminRiskControl;
