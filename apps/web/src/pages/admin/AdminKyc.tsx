/**
 * KYC 审核 - 身份审核列表与通过/拒绝
 */
import { Component, createSignal, onMount, For } from 'solid-js';
import { adminApi } from '../../utils/api';

interface KycRow {
  id: number;
  userId: number;
  name: string;
  cardId: string;
  reviewStatus: number;
  reviewReason: string | null;
  reviewTime: number | null;
  createdAt: string;
}

const AdminKyc: Component = () => {
  const [list, setList] = createSignal<KycRow[]>([]);
  const [page, setPage] = createSignal(1);
  const [statusFilter, setStatusFilter] = createSignal<number | undefined>(undefined);
  const [loading, setLoading] = createSignal(true);
  const [msg, setMsg] = createSignal('');
  const [rejectId, setRejectId] = createSignal<number | null>(null);
  const [rejectReason, setRejectReason] = createSignal('');

  const limit = 20;

  const fetchList = async () => {
    setLoading(true);
    try {
      const res = await adminApi.kycList(page(), limit, statusFilter());
      if (res.type === 'ok' && res.data) {
        const d = res.data as { list: KycRow[] };
        setList(d.list || []);
      }
    } catch (e) {
      setMsg('加载失败');
    } finally {
      setLoading(false);
    }
  };

  onMount(fetchList);

  const handleReview = async (reviewId: number, status: number, reason?: string) => {
    setMsg('');
    try {
      const res = await adminApi.kycReview(reviewId, status, reason);
      if (res.type === 'ok') {
        setMsg(status === 2 ? '已通过' : '已拒绝');
        setRejectId(null);
        setRejectReason('');
        fetchList();
      } else {
        setMsg((res as any).message || '操作失败');
      }
    } catch (e) {
      setMsg('请求失败');
    }
  };

  const statusText = (s: number) => (s === 0 ? '待审' : s === 1 ? '已拒绝' : '已通过');

  return (
    <div class="space-y-6">
      <h1 class="text-2xl font-bold text-gray-900">KYC 审核</h1>
      {msg() && <div class="px-4 py-2 rounded-lg bg-primary/20 text-primary text-sm">{msg()}</div>}
      <div class="flex gap-2">
        <button
          type="button"
          class={`px-4 py-2 rounded ${statusFilter() === undefined ? 'bg-primary text-white' : 'bg-white text-gray-500'}`}
          onClick={() => { setStatusFilter(undefined); setPage(1); }}
        >
          全部
        </button>
        <button
          type="button"
          class={`px-4 py-2 rounded ${statusFilter() === 0 ? 'bg-primary text-white' : 'bg-white text-gray-500'}`}
          onClick={() => { setStatusFilter(0); setPage(1); }}
        >
          待审
        </button>
        <button
          type="button"
          class={`px-4 py-2 rounded ${statusFilter() === 2 ? 'bg-primary text-white' : 'bg-white text-gray-500'}`}
          onClick={() => { setStatusFilter(2); setPage(1); }}
        >
          已通过
        </button>
        <button
          type="button"
          class={`px-4 py-2 rounded ${statusFilter() === 1 ? 'bg-primary text-white' : 'bg-white text-gray-500'}`}
          onClick={() => { setStatusFilter(1); setPage(1); }}
        >
          已拒绝
        </button>
      </div>
      <div class="card bg-white border border-gray-200 overflow-hidden rounded-xl">
        {loading() ? (
          <div class="p-8 text-gray-500">加载中...</div>
        ) : (
          <div class="overflow-x-auto">
            <table class="table w-full text-left">
              <thead>
                <tr class="border-b border-gray-200 text-gray-500 text-sm">
                  <th class="p-4">ID</th>
                  <th class="p-4">用户 ID</th>
                  <th class="p-4">姓名</th>
                  <th class="p-4">证件号</th>
                  <th class="p-4">状态</th>
                  <th class="p-4">提交时间</th>
                  <th class="p-4">操作</th>
                </tr>
              </thead>
              <tbody>
                <For each={list()}>
                  {(r) => (
                    <tr class="border-b border-gray-200 hover:bg-gray-50">
                      <td class="p-4 font-mono text-gray-900">{r.id}</td>
                      <td class="p-4 text-gray-300">{r.userId}</td>
                      <td class="p-4 text-gray-300">{r.name ? r.name.slice(0, 1) + '**' : '-'}</td>
                      <td class="p-4 text-gray-500 text-sm">{r.cardId ? r.cardId.slice(0, 4) + '********' : '-'}</td>
                      <td class="p-4">
                        <span class={r.reviewStatus === 2 ? 'text-success' : r.reviewStatus === 1 ? 'text-danger' : 'text-warning'}>{statusText(r.reviewStatus)}</span>
                      </td>
                      <td class="p-4 text-gray-500 text-sm">{r.createdAt ? new Date(r.createdAt).toLocaleString() : '-'}</td>
                      <td class="p-4 flex items-center gap-2">
                        {r.reviewStatus === 0 && (
                          <>
                            <button type="button" class="px-2 py-1 rounded text-xs bg-success/20 text-success" onClick={() => handleReview(r.id, 2)}>通过</button>
                            <button type="button" class="px-2 py-1 rounded text-xs bg-danger/20 text-danger" onClick={() => setRejectId(r.id)}>拒绝</button>
                          </>
                        )}
                      </td>
                    </tr>
                  )}
                </For>
              </tbody>
            </table>
          </div>
        )}
      </div>

      {rejectId() !== null && (
        <div class="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setRejectId(null)}>
          <div class="bg-white border border-gray-200 rounded-xl p-6 max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <h3 class="text-lg font-semibold text-gray-900 mb-4">拒绝原因</h3>
            <input
              type="text"
              class="w-full px-4 py-2 rounded bg-gray-50 border border-gray-300 text-gray-900 mb-4"
              placeholder="选填"
              value={rejectReason()}
              onInput={(e) => setRejectReason(e.currentTarget.value)}
            />
            <div class="flex gap-2">
              <button type="button" class="px-4 py-2 rounded bg-danger text-white" onClick={() => handleReview(rejectId()!, 1, rejectReason() || undefined)}>确认拒绝</button>
              <button type="button" class="px-4 py-2 rounded bg-gray-600 text-gray-300" onClick={() => { setRejectId(null); setRejectReason(''); }}>取消</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminKyc;
