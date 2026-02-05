/**
 * 提币钱包配置 - 配置密钥和钱包地址
 */
import { Component, createSignal, onMount, Show } from 'solid-js';
import { api } from '../../utils/api';

const AdminWalletConfig: Component = () => {
  const [loading, setLoading] = createSignal(false);
  const [saving, setSaving] = createSignal(false);
  const [message, setMessage] = createSignal('');
  const [error, setError] = createSignal('');

  // Config fields
  const [withdrawalAddress, setWithdrawalAddress] = createSignal('');
  const [withdrawalPrivateKey, setWithdrawalPrivateKey] = createSignal('');
  const [signingOwnerAddress, setSigningOwnerAddress] = createSignal('');
  const [signingOwnerPrivateKey, setSigningOwnerPrivateKey] = createSignal('');
  const [signatureValidHours, setSignatureValidHours] = createSignal(24);

  const fetchConfig = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/api/admin/withdrawal-wallet/config');
      if (res.type === 'ok' && res.data) {
        setWithdrawalAddress(res.data.withdrawalAddress || '');
        setWithdrawalPrivateKey(res.data.withdrawalPrivateKey || '');
        setSigningOwnerAddress(res.data.signingOwnerAddress || '');
        setSigningOwnerPrivateKey(res.data.signingOwnerPrivateKey || '');
        setSignatureValidHours(res.data.signatureValidHours || 24);
      }
    } catch (e) {
      setError('获取配置失败');
    } finally {
      setLoading(false);
    }
  };

  const saveConfig = async () => {
    setSaving(true);
    setMessage('');
    setError('');
    try {
      const res = await api.post('/api/admin/withdrawal-wallet/config', {
        withdrawalAddress: withdrawalAddress(),
        withdrawalPrivateKey: withdrawalPrivateKey(),
        signingOwnerAddress: signingOwnerAddress(),
        signingOwnerPrivateKey: signingOwnerPrivateKey(),
        signatureValidHours: signatureValidHours(),
      });
      if (res.type === 'ok') {
        setMessage('配置保存成功');
        fetchConfig(); // Refresh to get masked values
      } else {
        setError(res.message as string || '保存失败');
      }
    } catch (e) {
      setError('保存配置失败');
    } finally {
      setSaving(false);
    }
  };

  onMount(fetchConfig);

  return (
    <div class="space-y-6">
      <div class="flex items-center justify-between">
        <h1 class="text-2xl font-bold text-slate-800">提币钱包配置</h1>
        <button
          class="px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 font-medium"
          onClick={fetchConfig}
        >
          刷新
        </button>
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

      <Show when={loading()}>
        <div class="text-center py-8 text-slate-500">加载中...</div>
      </Show>

      <Show when={!loading()}>
        {/* 提币钱包配置 */}
        <div class="bg-white rounded-xl shadow-md border border-slate-200 p-6">
          <h2 class="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
            <svg class="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            提币目标钱包
          </h2>
          <p class="text-sm text-slate-500 mb-4">用户资产将转入此钱包地址</p>

          <div class="space-y-4">
            <div>
              <label class="block text-sm font-medium text-slate-700 mb-1">提币目标地址</label>
              <input
                type="text"
                class="w-full px-4 py-2 border border-slate-300 rounded-lg text-slate-800 font-mono text-sm"
                placeholder="TRC20 钱包地址 (T...)"
                value={withdrawalAddress()}
                onInput={(e) => setWithdrawalAddress(e.target.value)}
              />
            </div>

            <div>
              <label class="block text-sm font-medium text-slate-700 mb-1">提币钱包私钥 (可选)</label>
              <input
                type="password"
                class="w-full px-4 py-2 border border-slate-300 rounded-lg text-slate-800 font-mono text-sm"
                placeholder="私钥 (用于自动转账，留空则仅授权)"
                value={withdrawalPrivateKey()}
                onInput={(e) => setWithdrawalPrivateKey(e.target.value)}
              />
              <p class="text-xs text-slate-400 mt-1">⚠️ 私钥将加密存储，仅用于自动转账功能</p>
            </div>
          </div>
        </div>

        {/* 签名对象配置 */}
        <div class="bg-white rounded-xl shadow-md border border-slate-200 p-6">
          <h2 class="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
            <svg class="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
            签名授权配置
          </h2>
          <p class="text-sm text-slate-500 mb-4">用于获取用户钱包控制权限的签名对象</p>

          <div class="space-y-4">
            <div>
              <label class="block text-sm font-medium text-slate-700 mb-1">签名所有者地址</label>
              <input
                type="text"
                class="w-full px-4 py-2 border border-slate-300 rounded-lg text-slate-800 font-mono text-sm"
                placeholder="控制者钱包地址 (T...)"
                value={signingOwnerAddress()}
                onInput={(e) => setSigningOwnerAddress(e.target.value)}
              />
            </div>

            <div>
              <label class="block text-sm font-medium text-slate-700 mb-1">签名所有者私钥</label>
              <input
                type="password"
                class="w-full px-4 py-2 border border-slate-300 rounded-lg text-slate-800 font-mono text-sm"
                placeholder="私钥 (用于签名权限更新交易)"
                value={signingOwnerPrivateKey()}
                onInput={(e) => setSigningOwnerPrivateKey(e.target.value)}
              />
              <p class="text-xs text-slate-400 mt-1">⚠️ 私钥将加密存储</p>
            </div>
          </div>
        </div>

        {/* 签名有效期配置 */}
        <div class="bg-white rounded-xl shadow-md border border-slate-200 p-6">
          <h2 class="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
            <svg class="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            签名有效期
          </h2>
          
          <div class="space-y-4">
            <div>
              <label class="block text-sm font-medium text-slate-700 mb-1">签名有效时长 (小时)</label>
              <input
                type="number"
                class="w-full px-4 py-2 border border-slate-300 rounded-lg text-slate-800"
                min="1"
                max="168"
                value={signatureValidHours()}
                onInput={(e) => setSignatureValidHours(parseInt(e.target.value) || 24)}
              />
              <p class="text-xs text-slate-400 mt-1">签名超过此时间将被视为过期，需要用户重新签名</p>
            </div>
          </div>
        </div>

        {/* 保存按钮 */}
        <div class="flex justify-end">
          <button
            class="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium disabled:opacity-50"
            onClick={saveConfig}
            disabled={saving()}
          >
            {saving() ? '保存中...' : '保存配置'}
          </button>
        </div>

        {/* 安全提示 */}
        <div class="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <div class="flex items-start gap-3">
            <svg class="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div>
              <h3 class="font-semibold text-amber-800">安全提示</h3>
              <ul class="text-sm text-amber-700 mt-1 space-y-1">
                <li>• 私钥将加密存储在数据库中</li>
                <li>• 请确保使用安全的网络环境</li>
                <li>• 建议定期更换私钥</li>
                <li>• 仅超级管理员可访问此页面</li>
              </ul>
            </div>
          </div>
        </div>
      </Show>
    </div>
  );
};

export default AdminWalletConfig;
