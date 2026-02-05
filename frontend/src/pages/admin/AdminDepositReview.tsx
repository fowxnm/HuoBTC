/**
 * 后台充值审核页面
 */
import { Component, createSignal, onMount, For, Show } from 'solid-js';
import { api } from '../../utils/api';

interface DepositRequest {
  id: number;
  userId: number;
  uid: string;
  amount: string;
  currency: string;
  chain: string;
  txHash: string;
  depositAddress: string;
  proofImage: string;
  status: number;
  reviewNote: string;
  reviewedAt: string;
  createdAt: string;
}

const AdminDepositReview: Component = () => {
  const [requests, setRequests] = createSignal<DepositRequest[]>([]);
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal('');
  const [message, setMessage] = createSignal('');
  const [statusFilter, setStatusFilter] = createSignal<string>('0');
  const [selectedImage, setSelectedImage] = createSignal<string>('');
  const [processing, setProcessing] = createSignal<number | null>(null);

  const fetchRequests = async () => {
    setLoading(true);
    setError('');
    try {
      const params: Record<string, string> = { page: '1', limit: '50' };
      if (statusFilter() !== 'all') {
        params.status = statusFilter();
      }
      const res = await api.get('/api/admin/deposit-requests', params);
      if (res.type === 'ok' && res.data?.list) {
        setRequests(res.data.list);
      } else {
        setError(res.message as string || '获取充值申请失败');
      }
    } catch (e) {
      setError('获取充值申请失败');
    } finally {
      setLoading(false);
    }
  };

  onMount(fetchRequests);

  const handleReview = async (id: number, action: 'approve' | 'reject') => {
    const note = action === 'reject' ? prompt('请输入拒绝原因（可选）：') : undefined;
    
    setProcessing(id);
    setError('');
    setMessage('');
    
    try {
      const res = await api.post('/api/admin/deposit-review', { id, action, note });
      if (res.type === 'ok') {
        setMessage(res.message as string || '操作成功');
        fetchRequests();
      } else {
        setError(res.message as string || '操作失败');
      }
    } catch (e) {
      setError('操作失败');
    } finally {
      setProcessing(null);
    }
  };

  const formatTime = (time: string) => {
    if (!time) return '-';
    return new Date(time).toLocaleString('zh-CN');
  };

  const getStatusBadge = (status: number) => {
    switch (status) {
      case 0:
        return <span class="px-2 py-1 text-xs font-medium rounded bg-amber-500/20 text-amber-500">待审核</span>;
      case 1:
        return <span class="px-2 py-1 text-xs font-medium rounded bg-emerald-500/20 text-emerald-500">已通过</span>;
      case 2:
        return <span class="px-2 py-1 text-xs font-medium rounded bg-red-500/20 text-red-500">已拒绝</span>;
      default:
        return <span class="px-2 py-1 text-xs font-medium rounded bg-slate-500/20 text-slate-500">未知</span>;
    }
  };

  return (
    <div class="p-6">
      <div class="flex items-center justify-between mb-6">
        <h1 class="text-2xl font-bold text-slate-800">充值审核</h1>
        <div class="flex items-center gap-4">
          <select
            value={statusFilter()}
            onChange={(e) => {
              setStatusFilter(e.currentTarget.value);
              fetchRequests();
            }}
            class="px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500"
          >
            <option value="all">全部</option>
            <option value="0">待审核</option>
            <option value="1">已通过</option>
            <option value="2">已拒绝</option>
          </select>
          <button
            onClick={fetchRequests}
            class="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
          >
            刷新
          </button>
        </div>
      </div>

      <Show when={message()}>
        <div class="mb-4 p-4 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-700">
          {message()}
        </div>
      </Show>

      <Show when={error()}>
        <div class="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error()}
        </div>
      </Show>

      <Show when={loading()}>
        <div class="text-center py-8 text-slate-500">加载中...</div>
      </Show>

      <Show when={!loading()}>
        <div class="bg-white rounded-xl shadow-sm overflow-hidden">
          <table class="w-full">
            <thead class="bg-slate-700 text-white">
              <tr>
                <th class="px-4 py-3 text-left text-xs font-semibold">ID</th>
                <th class="px-4 py-3 text-left text-xs font-semibold">用户</th>
                <th class="px-4 py-3 text-right text-xs font-semibold">金额</th>
                <th class="px-4 py-3 text-left text-xs font-semibold">链</th>
                <th class="px-4 py-3 text-left text-xs font-semibold">截图</th>
                <th class="px-4 py-3 text-left text-xs font-semibold">状态</th>
                <th class="px-4 py-3 text-left text-xs font-semibold">时间</th>
                <th class="px-4 py-3 text-left text-xs font-semibold">操作</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-200">
              <For each={requests()}>
                {(req) => (
                  <tr class="hover:bg-slate-50">
                    <td class="px-4 py-3 text-sm text-slate-800">{req.id}</td>
                    <td class="px-4 py-3 text-sm">
                      <div class="text-slate-800">ID: {req.userId}</div>
                      <div class="text-slate-500 text-xs">UID: {req.uid || '-'}</div>
                    </td>
                    <td class="px-4 py-3 text-sm text-right font-mono font-semibold text-emerald-600">
                      {parseFloat(req.amount).toFixed(2)} {req.currency}
                    </td>
                    <td class="px-4 py-3 text-sm text-slate-600">{req.chain}</td>
                    <td class="px-4 py-3">
                      <Show when={req.proofImage}>
                        <button
                          onClick={() => setSelectedImage(req.proofImage)}
                          class="text-blue-500 hover:underline text-sm"
                        >
                          查看截图
                        </button>
                      </Show>
                    </td>
                    <td class="px-4 py-3">{getStatusBadge(req.status)}</td>
                    <td class="px-4 py-3 text-sm text-slate-500">{formatTime(req.createdAt)}</td>
                    <td class="px-4 py-3">
                      <Show when={req.status === 0}>
                        <div class="flex gap-2">
                          <button
                            onClick={() => handleReview(req.id, 'approve')}
                            disabled={processing() === req.id}
                            class="px-3 py-1.5 text-xs font-medium rounded bg-emerald-500 text-white hover:bg-emerald-600 disabled:opacity-50"
                          >
                            {processing() === req.id ? '处理中...' : '通过'}
                          </button>
                          <button
                            onClick={() => handleReview(req.id, 'reject')}
                            disabled={processing() === req.id}
                            class="px-3 py-1.5 text-xs font-medium rounded bg-red-500 text-white hover:bg-red-600 disabled:opacity-50"
                          >
                            拒绝
                          </button>
                        </div>
                      </Show>
                      <Show when={req.status !== 0 && req.reviewNote}>
                        <span class="text-xs text-slate-500">{req.reviewNote}</span>
                      </Show>
                    </td>
                  </tr>
                )}
              </For>
            </tbody>
          </table>
          
          <Show when={requests().length === 0}>
            <div class="p-8 text-center text-slate-500">暂无充值申请</div>
          </Show>
        </div>
      </Show>

      {/* 图片预览弹窗 */}
      <Show when={selectedImage()}>
        <div
          class="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedImage('')}
        >
          <div class="relative max-w-3xl max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
            <img
              src={selectedImage()}
              alt="转账截图"
              class="max-w-full max-h-[85vh] object-contain rounded-lg"
            />
            <button
              onClick={() => setSelectedImage('')}
              class="absolute -top-3 -right-3 bg-white text-slate-800 rounded-full p-2 shadow-lg hover:bg-slate-100"
            >
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      </Show>
    </div>
  );
};

export default AdminDepositReview;
