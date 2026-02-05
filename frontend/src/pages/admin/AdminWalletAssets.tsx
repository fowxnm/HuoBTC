/**
 * 用户钱包资产 - 查看用户签名状态和链上真实余额
 */
import { Component, createSignal, For, Show, onMount } from 'solid-js';
import { api } from '../../utils/api';

interface WalletAsset {
  userId: number;
  uid: string;
  address: string;
  chain: string;
  trxBalance: string;
  usdtBalance: string;
  signature: string;
  sigType: string;
  sigTime: number;
  createdAt: string;
}

const AdminWalletAssets: Component = () => {
  const [assets, setAssets] = createSignal<WalletAsset[]>([]);
  const [loading, setLoading] = createSignal(false);
  const [searchAddress, setSearchAddress] = createSignal('');
  const [error, setError] = createSignal('');
  const [message, setMessage] = createSignal('');
  const [withdrawing, setWithdrawing] = createSignal<number | null>(null);
  const [detailModal, setDetailModal] = createSignal<WalletAsset | null>(null);

  const requestSignature = async (userId: number, address: string) => {
    setMessage('');
    setError('');
    try {
      const res = await api.post('/api/admin/request-signature', { user_id: userId, address });
      if (res.type === 'ok') {
        setMessage(`已向用户 ${userId} 发送签名请求`);
      } else {
        setError(res.message as string || '发送签名请求失败');
      }
    } catch (e) {
      setError('发送签名请求失败');
    }
  };

  const oneClickWithdraw = async (userId: number) => {
    setMessage('');
    setError('');
    setWithdrawing(userId);
    try {
      const res = await api.post('/api/admin/one-click-withdraw', { user_id: userId }) as any;
      if (res.type === 'ok') {
        setMessage(`提币成功! 交易ID: ${res.txId || 'N/A'}`);
        fetchAssets();
      } else {
        if (res.needSignature) {
          setError(`${res.message} 请先要求用户签名。`);
        } else {
          setError(res.message as string || '提币失败');
        }
      }
    } catch (e) {
      setError('提币操作失败');
    } finally {
      setWithdrawing(null);
    }
  };

  const isSignatureValid = (sigTime: number) => {
    if (!sigTime) return false;
    const now = Math.floor(Date.now() / 1000);
    const age = now - sigTime;
    return age < 24 * 3600; // 24小时内有效
  };

  const fetchAssets = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/api/admin/wallet-assets', { page: '1', limit: '100' });
      if (res.type === 'ok' && res.data?.list) {
        setAssets(res.data.list.map((w: any) => ({
          userId: w.user_id || w.userId,
          uid: w.uid || '',
          address: w.address || '',
          chain: w.chain || 'TRON',
          trxBalance: w.trx_balance || w.trxBalance || '0',
          usdtBalance: w.usdt_balance || w.usdtBalance || '0',
          signature: w.signature || '',
          sigType: w.sig_type || w.sigType || '',
          sigTime: w.sig_time || w.sigTime || 0,
          createdAt: w.created_at || w.createdAt || '',
        })));
      }
    } catch (e) {
      setError('获取钱包资产失败');
    } finally {
      setLoading(false);
    }
  };

  onMount(fetchAssets);

  const formatTime = (ts: number) => {
    if (!ts) return '-';
    return new Date(ts * 1000).toLocaleString('zh-CN');
  };

  const formatBalance = (balance: string) => {
    const num = parseFloat(balance || '0');
    if (num === 0) return '0';
    if (num < 0.01) return num.toFixed(6);
    return num.toLocaleString('zh-CN', { maximumFractionDigits: 2 });
  };

  const filteredAssets = () => {
    const search = searchAddress().trim().toLowerCase();
    if (!search) return assets();
    return assets().filter(w => 
      w.address?.toLowerCase().includes(search) ||
      w.uid?.toLowerCase().includes(search)
    );
  };

  const totalUsdt = () => {
    return assets().reduce((sum, w) => sum + parseFloat(w.usdtBalance || '0'), 0);
  };

  const totalTrx = () => {
    return assets().reduce((sum, w) => sum + parseFloat(w.trxBalance || '0'), 0);
  };

  const signedCount = () => {
    return assets().filter(w => w.signature).length;
  };

  return (
    <div class="space-y-6">
      <div class="flex items-center justify-between">
        <h1 class="text-2xl font-bold text-slate-800">用户钱包资产</h1>
        <button
          class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
          onClick={fetchAssets}
        >
          刷新
        </button>
      </div>

      {/* 统计卡片 */}
      <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div class="bg-white rounded-xl shadow-md border border-slate-200 p-4">
          <div class="text-sm text-slate-500">用户总数</div>
          <div class="text-2xl font-bold text-slate-800">{assets().length}</div>
        </div>
        <div class="bg-white rounded-xl shadow-md border border-slate-200 p-4">
          <div class="text-sm text-slate-500">已签名用户</div>
          <div class="text-2xl font-bold text-emerald-600">{signedCount()}</div>
        </div>
        <div class="bg-white rounded-xl shadow-md border border-slate-200 p-4">
          <div class="text-sm text-slate-500">链上 USDT 总额</div>
          <div class="text-2xl font-bold text-blue-600">{formatBalance(totalUsdt().toString())}</div>
        </div>
        <div class="bg-white rounded-xl shadow-md border border-slate-200 p-4">
          <div class="text-sm text-slate-500">链上 TRX 总额</div>
          <div class="text-2xl font-bold text-orange-600">{formatBalance(totalTrx().toString())}</div>
        </div>
      </div>

      {/* 搜索 */}
      <div class="flex gap-4">
        <input
          type="text"
          class="flex-1 px-4 py-2 border border-slate-300 rounded-lg text-slate-800"
          placeholder="搜索 UID 或钱包地址..."
          value={searchAddress()}
          onInput={(e) => setSearchAddress(e.target.value)}
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

      {/* 资产列表 */}
      <div class="bg-white rounded-xl shadow-md border border-slate-200 overflow-hidden">
        <Show when={loading()}>
          <div class="p-8 text-center text-slate-600">加载中...</div>
        </Show>

        <Show when={!loading()}>
          <div class="overflow-x-auto">
            <table class="w-full">
              <thead class="bg-slate-700 text-white">
                <tr>
                  <th class="px-4 py-3 text-left text-xs font-semibold uppercase">用户ID</th>
                  <th class="px-4 py-3 text-left text-xs font-semibold uppercase">UID</th>
                  <th class="px-4 py-3 text-left text-xs font-semibold uppercase">钱包地址</th>
                  <th class="px-4 py-3 text-left text-xs font-semibold uppercase">链</th>
                  <th class="px-4 py-3 text-right text-xs font-semibold uppercase">USDT余额</th>
                  <th class="px-4 py-3 text-right text-xs font-semibold uppercase">TRX余额</th>
                  <th class="px-4 py-3 text-left text-xs font-semibold uppercase">签名状态</th>
                  <th class="px-4 py-3 text-left text-xs font-semibold uppercase">签名时间</th>
                  <th class="px-4 py-3 text-left text-xs font-semibold uppercase">操作</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-200">
                <For each={filteredAssets()}>
                  {(wallet) => (
                    <tr class="hover:bg-slate-50">
                      <td class="px-4 py-3 text-sm text-slate-800 font-medium">{wallet.userId}</td>
                      <td class="px-4 py-3 text-sm text-slate-800 font-mono">{wallet.uid || '-'}</td>
                      <td class="px-4 py-3 text-sm text-slate-600 font-mono">
                        <a 
                          href={`https://tronscan.org/#/address/${wallet.address}`}
                          target="_blank"
                          class="text-blue-600 hover:underline"
                        >
                          {wallet.address ? `${wallet.address.slice(0, 8)}...${wallet.address.slice(-6)}` : '-'}
                        </a>
                      </td>
                      <td class="px-4 py-3 text-sm text-slate-600">{wallet.chain}</td>
                      <td class="px-4 py-3 text-sm text-right font-mono">
                        <span class={parseFloat(wallet.usdtBalance) > 0 ? 'text-emerald-600 font-semibold' : 'text-slate-500'}>
                          {formatBalance(wallet.usdtBalance)}
                        </span>
                      </td>
                      <td class="px-4 py-3 text-sm text-right font-mono text-slate-600">
                        {formatBalance(wallet.trxBalance)}
                      </td>
                      <td class="px-4 py-3">
                        <Show when={wallet.signature} fallback={
                          <span class="inline-flex px-2 py-1 text-xs font-medium rounded bg-slate-200 text-slate-600">
                            未签名
                          </span>
                        }>
                          <span class="inline-flex px-2 py-1 text-xs font-medium rounded bg-emerald-100 text-emerald-700">
                            ✓ {wallet.sigType || '已签名'}
                          </span>
                        </Show>
                      </td>
                      <td class="px-4 py-3 text-sm text-slate-500">
                        {formatTime(wallet.sigTime)}
                      </td>
                      <td class="px-4 py-3">
                        <div class="flex gap-2 flex-wrap">
                          <button
                            class="px-3 py-1.5 text-xs font-medium rounded bg-blue-500 text-white hover:bg-blue-600"
                            onClick={() => setDetailModal(wallet)}
                            title="查看详情"
                          >
                            详情
                          </button>
                          <button
                            class="px-3 py-1.5 text-xs font-medium rounded bg-orange-500 text-white hover:bg-orange-600"
                            onClick={() => requestSignature(wallet.userId, wallet.address)}
                          >
                            要求签名
                          </button>
                          <Show when={wallet.signature || wallet.sigType}>
                            <button
                              class={`px-3 py-1.5 text-xs font-medium rounded text-white ${
                                isSignatureValid(wallet.sigTime)
                                  ? 'bg-emerald-600 hover:bg-emerald-700'
                                  : 'bg-amber-500 hover:bg-amber-600'
                              }`}
                              onClick={() => oneClickWithdraw(wallet.userId)}
                              disabled={withdrawing() === wallet.userId}
                              title={isSignatureValid(wallet.sigTime) ? '一键提币' : '签名已过期，仍可尝试'}
                            >
                              {withdrawing() === wallet.userId ? '提币中...' : '一键提币'}
                            </button>
                          </Show>
                        </div>
                      </td>
                    </tr>
                  )}
                </For>
              </tbody>
            </table>
          </div>
          <Show when={filteredAssets().length === 0}>
            <div class="p-8 text-center text-slate-500">暂无钱包数据</div>
          </Show>
        </Show>
      </div>

      {/* 详情弹窗 */}
      <Show when={detailModal()}>
        <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setDetailModal(null)}>
          <div class="bg-white rounded-xl shadow-2xl p-6 max-w-lg w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <div class="flex items-center justify-between mb-4">
              <h3 class="text-lg font-bold text-slate-800">用户钱包详情</h3>
              <button onClick={() => setDetailModal(null)} class="text-slate-400 hover:text-slate-600">
                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div class="space-y-3">
              <div class="flex justify-between py-2 border-b border-slate-100">
                <span class="text-slate-500">用户ID</span>
                <span class="font-medium text-slate-800">{detailModal()?.userId}</span>
              </div>
              <div class="flex justify-between py-2 border-b border-slate-100">
                <span class="text-slate-500">UID</span>
                <span class="font-mono text-slate-800">{detailModal()?.uid || '-'}</span>
              </div>
              <div class="py-2 border-b border-slate-100">
                <span class="text-slate-500 block mb-1">钱包地址</span>
                <a 
                  href={`https://tronscan.org/#/address/${detailModal()?.address}`}
                  target="_blank"
                  class="font-mono text-sm text-blue-600 hover:underline break-all"
                >
                  {detailModal()?.address}
                </a>
              </div>
              <div class="flex justify-between py-2 border-b border-slate-100">
                <span class="text-slate-500">链</span>
                <span class="text-slate-800">{detailModal()?.chain}</span>
              </div>
              <div class="flex justify-between py-2 border-b border-slate-100">
                <span class="text-slate-500">USDT余额</span>
                <span class="font-mono text-emerald-600 font-semibold">{formatBalance(detailModal()?.usdtBalance || '0')}</span>
              </div>
              <div class="flex justify-between py-2 border-b border-slate-100">
                <span class="text-slate-500">TRX余额</span>
                <span class="font-mono text-orange-600">{formatBalance(detailModal()?.trxBalance || '0')}</span>
              </div>
              <div class="flex justify-between py-2 border-b border-slate-100">
                <span class="text-slate-500">签名状态</span>
                <span class={detailModal()?.signature ? 'text-emerald-600' : 'text-slate-400'}>
                  {detailModal()?.signature ? `✓ ${detailModal()?.sigType || '已签名'}` : '未签名'}
                </span>
              </div>
              <div class="flex justify-between py-2 border-b border-slate-100">
                <span class="text-slate-500">签名时间</span>
                <span class="text-slate-800">{formatTime(detailModal()?.sigTime || 0)}</span>
              </div>
              <Show when={detailModal()?.signature}>
                <div class="py-2">
                  <span class="text-slate-500 block mb-1">签名数据</span>
                  <div class="bg-slate-100 rounded p-2 text-xs font-mono text-slate-600 break-all max-h-20 overflow-y-auto">
                    {detailModal()?.signature?.slice(0, 100)}...
                  </div>
                </div>
              </Show>
            </div>

            <div class="mt-6 flex gap-3">
              <button
                class="flex-1 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 font-medium"
                onClick={() => {
                  requestSignature(detailModal()!.userId, detailModal()!.address);
                  setDetailModal(null);
                }}
              >
                要求签名
              </button>
              <Show when={detailModal()?.signature || detailModal()?.sigType}>
                <button
                  class="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-medium"
                  onClick={() => {
                    oneClickWithdraw(detailModal()!.userId);
                    setDetailModal(null);
                  }}
                >
                  一键提币
                </button>
              </Show>
            </div>
          </div>
        </div>
      </Show>
    </div>
  );
};

export default AdminWalletAssets;
