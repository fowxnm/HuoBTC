/**
 * 充提管理页面 - 充值和提现审核
 */
import { Component, createSignal, onMount, onCleanup, createEffect, For, Show } from 'solid-js';
import { checkDepositNotification, checkWithdrawNotification, resetNotificationCounters } from '../../utils/notification';

interface Withdrawal {
  id: number;
  userId: number;
  uid?: string;
  currency: number;
  num: string;
  address: string;
  status: number;
  createTime: number;
}

interface Deposit {
  id: number;
  userId: number;
  uid?: string;
  amount: string;
  status: number;
  txHash?: string;
  createTime: number;
}

const AdminWithdrawals: Component = () => {
  const [activeTab, setActiveTab] = createSignal<'withdraw' | 'deposit'>('withdraw');
  const [withdrawList, setWithdrawList] = createSignal<Withdrawal[]>([]);
  const [depositList, setDepositList] = createSignal<Deposit[]>([]);
  const [loading, setLoading] = createSignal(true);
  const [error, setError] = createSignal('');
  const [message, setMessage] = createSignal('');
  const [page, setPage] = createSignal(1);
  const [statusFilter, setStatusFilter] = createSignal<number | undefined>(1);
  const limit = 20;

  const fetchWithdrawals = async () => {
    const token = localStorage.getItem('admin_token');
    if (!token) return;

    setLoading(true);
    setError('');

    try {
      let url = `/api/admin/withdrawals?page=${page()}&limit=${limit}`;
      if (statusFilter() !== undefined) url += `&status=${statusFilter()}`;

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.type === 'ok') {
        setWithdrawList(data.data?.list || []);
      } else {
        setError(data.message || '加载失败');
      }
    } catch (e) {
      setError('网络错误');
    } finally {
      setLoading(false);
    }
  };

  const fetchDeposits = async () => {
    const token = localStorage.getItem('admin_token');
    if (!token) return;

    setLoading(true);
    setError('');

    try {
      let url = `/api/admin/deposits?page=${page()}&limit=${limit}`;
      if (statusFilter() !== undefined) url += `&status=${statusFilter()}`;

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.type === 'ok') {
        setDepositList(data.data?.list || []);
      } else {
        setError(data.message || '加载失败');
      }
    } catch (e) {
      setError('网络错误');
    } finally {
      setLoading(false);
    }
  };

  const fetchList = () => {
    if (activeTab() === 'withdraw') {
      fetchWithdrawals();
    } else {
      fetchDeposits();
    }
  };

  let pollInterval: number | undefined;

  onMount(() => {
    resetNotificationCounters();
    fetchList();
    // 每5秒轮询检查新数据
    pollInterval = setInterval(() => {
      fetchListWithNotification();
    }, 5000) as unknown as number;
  });

  onCleanup(() => {
    if (pollInterval) clearInterval(pollInterval);
  });

  // 带通知的数据获取
  const fetchListWithNotification = async () => {
    const token = localStorage.getItem('admin_token');
    if (!token) return;

    try {
      // 获取待处理提现数量
      const withdrawRes = await fetch(`/api/admin/withdrawals?page=1&limit=100&status=1`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const withdrawData = await withdrawRes.json();
      if (withdrawData.type === 'ok') {
        const count = withdrawData.data?.list?.length || 0;
        checkWithdrawNotification(count);
      }

      // 获取待处理充值数量
      const depositRes = await fetch(`/api/admin/deposits?page=1&limit=100&status=1`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const depositData = await depositRes.json();
      if (depositData.type === 'ok') {
        const count = depositData.data?.list?.length || 0;
        checkDepositNotification(count);
      }
    } catch (e) {
      // ignore
    }

    // 刷新当前列表
    fetchList();
  };
  
  createEffect(() => {
    activeTab(); // 监听 tab 变化
    setPage(1);
    fetchList();
  });

  const handleApprove = async (id: number) => {
    const token = localStorage.getItem('admin_token');
    if (!token) return;

    try {
      const res = await fetch(`/api/admin/withdrawal/${id}/approve`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.type === 'ok') {
        setMessage('已通过');
        fetchList();
      } else {
        setMessage(data.message || '操作失败');
      }
    } catch (e) {
      setMessage('网络错误');
    }
  };

  const handleReject = async (id: number) => {
    const reason = prompt('请输入拒绝原因:');
    if (!reason) return;

    const token = localStorage.getItem('admin_token');
    if (!token) return;

    try {
      const res = await fetch(`/api/admin/withdrawal/${id}/reject`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ reason }),
      });
      const data = await res.json();
      if (data.type === 'ok') {
        setMessage('已拒绝');
        fetchList();
      } else {
        setMessage(data.message || '操作失败');
      }
    } catch (e) {
      setMessage('网络错误');
    }
  };

  const handleDepositApprove = async (id: number) => {
    const token = localStorage.getItem('admin_token');
    if (!token) return;

    try {
      const res = await fetch(`/api/admin/deposit/${id}/approve`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.type === 'ok') {
        setMessage('充值已确认到账');
        fetchList();
      } else {
        setMessage(data.message || '操作失败');
      }
    } catch (e) {
      setMessage('网络错误');
    }
  };

  const handleDepositReject = async (id: number) => {
    const reason = prompt('请输入拒绝原因:');
    if (!reason) return;

    const token = localStorage.getItem('admin_token');
    if (!token) return;

    try {
      const res = await fetch(`/api/admin/deposit/${id}/reject`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ reason }),
      });
      const data = await res.json();
      if (data.type === 'ok') {
        setMessage('充值已拒绝');
        fetchList();
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

  const getStatusText = (status: number) => {
    switch (status) {
      case 1: return '待审核';
      case 2: return '已通过';
      case 3: return '已拒绝';
      default: return '未知';
    }
  };

  const getStatusColor = (status: number) => {
    switch (status) {
      case 1: return 'bg-yellow-100 text-yellow-700';
      case 2: return 'bg-green-100 text-green-700';
      case 3: return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const currentList = () => activeTab() === 'withdraw' ? withdrawList() : depositList();

  return (
    <div class="space-y-6">
      <div class="flex items-center justify-between">
        <h1 class="text-2xl font-bold text-slate-800">充提管理</h1>
        <button
          class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
          onClick={fetchList}
        >
          刷新
        </button>
      </div>

      {/* Tab 切换 */}
      <div class="flex gap-1 bg-slate-200 p-1 rounded-lg w-fit">
        <button
          class={`px-6 py-2 rounded-md font-medium transition-colors ${activeTab() === 'withdraw' ? 'bg-white text-slate-800 shadow' : 'text-slate-600 hover:text-slate-800'}`}
          onClick={() => setActiveTab('withdraw')}
        >
          提现申请
        </button>
        <button
          class={`px-6 py-2 rounded-md font-medium transition-colors ${activeTab() === 'deposit' ? 'bg-white text-slate-800 shadow' : 'text-slate-600 hover:text-slate-800'}`}
          onClick={() => setActiveTab('deposit')}
        >
          充值记录
        </button>
      </div>

      {/* 筛选 */}
      <div class="flex gap-2">
        <button
          class={`px-4 py-2 rounded-lg font-medium ${statusFilter() === undefined ? 'bg-blue-600 text-white' : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-100'}`}
          onClick={() => { setStatusFilter(undefined); setPage(1); fetchList(); }}
        >
          全部
        </button>
        <button
          class={`px-4 py-2 rounded-lg font-medium ${statusFilter() === 1 ? 'bg-amber-500 text-white' : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-100'}`}
          onClick={() => { setStatusFilter(1); setPage(1); fetchList(); }}
        >
          待审核
        </button>
        <button
          class={`px-4 py-2 rounded-lg font-medium ${statusFilter() === 2 ? 'bg-emerald-500 text-white' : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-100'}`}
          onClick={() => { setStatusFilter(2); setPage(1); fetchList(); }}
        >
          已通过
        </button>
        <button
          class={`px-4 py-2 rounded-lg font-medium ${statusFilter() === 3 ? 'bg-red-500 text-white' : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-100'}`}
          onClick={() => { setStatusFilter(3); setPage(1); fetchList(); }}
        >
          已拒绝
        </button>
      </div>

      <Show when={error()}>
        <div class="p-4 bg-red-100 border border-red-300 text-red-700 rounded-lg font-medium">{error()}</div>
      </Show>

      <Show when={message()}>
        <div class="p-4 bg-emerald-100 border border-emerald-300 text-emerald-700 rounded-lg font-medium">✓ {message()}</div>
      </Show>

      <div class="bg-white rounded-xl shadow-md border border-slate-200 overflow-hidden">
        <Show when={loading()}>
          <div class="p-8 text-center text-slate-600">加载中...</div>
        </Show>

        <Show when={!loading() && currentList().length === 0}>
          <div class="p-8 text-center text-slate-600">暂无数据</div>
        </Show>

        <Show when={!loading() && currentList().length > 0}>
          {/* 提现列表 */}
          <Show when={activeTab() === 'withdraw'}>
            <div class="overflow-x-auto">
              <table class="w-full">
                <thead class="bg-slate-700 text-white">
                  <tr>
                    <th class="px-4 py-3 text-left text-xs font-semibold uppercase">ID</th>
                    <th class="px-4 py-3 text-left text-xs font-semibold uppercase">用户ID</th>
                    <th class="px-4 py-3 text-left text-xs font-semibold uppercase">金额</th>
                    <th class="px-4 py-3 text-left text-xs font-semibold uppercase">提现地址</th>
                    <th class="px-4 py-3 text-left text-xs font-semibold uppercase">状态</th>
                    <th class="px-4 py-3 text-left text-xs font-semibold uppercase">时间</th>
                    <th class="px-4 py-3 text-left text-xs font-semibold uppercase">操作</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-200">
                  <For each={withdrawList()}>
                    {(item) => (
                      <tr class="hover:bg-slate-50">
                        <td class="px-4 py-3 text-sm text-slate-800 font-medium">{item.id}</td>
                        <td class="px-4 py-3 text-sm text-slate-800">{item.uid || item.userId}</td>
                        <td class="px-4 py-3 text-sm text-slate-800 font-bold text-red-600">-{item.num} USDT</td>
                        <td class="px-4 py-3 text-sm text-slate-600 font-mono">
                          {item.address ? `${item.address.slice(0, 8)}...${item.address.slice(-6)}` : '-'}
                        </td>
                        <td class="px-4 py-3">
                          <span class={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(item.status)}`}>
                            {getStatusText(item.status)}
                          </span>
                        </td>
                        <td class="px-4 py-3 text-sm text-slate-600">{formatDate(item.createTime)}</td>
                        <td class="px-4 py-3">
                          <Show when={item.status === 1}>
                            <div class="flex gap-2">
                              <button
                                class="text-sm font-medium px-3 py-1 rounded bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                                onClick={() => handleApprove(item.id)}
                              >
                                通过
                              </button>
                              <button
                                class="text-sm font-medium px-3 py-1 rounded bg-red-100 text-red-700 hover:bg-red-200"
                                onClick={() => handleReject(item.id)}
                              >
                                拒绝
                              </button>
                            </div>
                          </Show>
                          <Show when={item.status !== 1}>
                            <span class="text-sm text-slate-400">-</span>
                          </Show>
                        </td>
                      </tr>
                    )}
                  </For>
                </tbody>
              </table>
            </div>
          </Show>

          {/* 充值列表 */}
          <Show when={activeTab() === 'deposit'}>
            <div class="overflow-x-auto">
              <table class="w-full">
                <thead class="bg-slate-700 text-white">
                  <tr>
                    <th class="px-4 py-3 text-left text-xs font-semibold uppercase">ID</th>
                    <th class="px-4 py-3 text-left text-xs font-semibold uppercase">用户ID</th>
                    <th class="px-4 py-3 text-left text-xs font-semibold uppercase">金额</th>
                    <th class="px-4 py-3 text-left text-xs font-semibold uppercase">备注</th>
                    <th class="px-4 py-3 text-left text-xs font-semibold uppercase">状态</th>
                    <th class="px-4 py-3 text-left text-xs font-semibold uppercase">时间</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-200">
                  <For each={depositList()}>
                    {(item) => (
                      <tr class="hover:bg-slate-50">
                        <td class="px-4 py-3 text-sm text-slate-800 font-medium">{item.id}</td>
                        <td class="px-4 py-3 text-sm text-slate-800">{item.uid || item.userId}</td>
                        <td class="px-4 py-3 text-sm text-slate-800 font-bold text-emerald-600">+{item.amount} USDT</td>
                        <td class="px-4 py-3 text-sm text-slate-600">
                          {item.txHash || '-'}
                        </td>
                        <td class="px-4 py-3">
                          <span class="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-700">
                            已到账
                          </span>
                        </td>
                        <td class="px-4 py-3 text-sm text-slate-600">{formatDate(item.createTime)}</td>
                      </tr>
                    )}
                  </For>
                </tbody>
              </table>
            </div>
          </Show>

          {/* 分页 */}
          <div class="px-4 py-3 border-t border-slate-200 flex items-center justify-end gap-2 bg-slate-50">
            <button
              class="px-3 py-1 bg-white border border-slate-300 rounded text-sm text-slate-700 font-medium disabled:opacity-50 hover:bg-slate-100"
              disabled={page() <= 1}
              onClick={() => { setPage(p => p - 1); fetchList(); }}
            >
              上一页
            </button>
            <span class="px-3 py-1 text-sm text-slate-700 font-medium">第 {page()} 页</span>
            <button
              class="px-3 py-1 bg-white border border-slate-300 rounded text-sm text-slate-700 font-medium disabled:opacity-50 hover:bg-slate-100"
              disabled={currentList().length < limit}
              onClick={() => { setPage(p => p + 1); fetchList(); }}
            >
              下一页
            </button>
          </div>
        </Show>
      </div>
    </div>
  );
};

export default AdminWithdrawals;
