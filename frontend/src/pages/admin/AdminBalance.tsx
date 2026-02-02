/**
 * 余额修改 - 按用户、币种、账户类型调整
 */
import { Component, createSignal } from 'solid-js';
import { adminApi } from '../../utils/api';

const BALANCE_TYPES = [
  { value: 1, label: '法币账户' },
  { value: 2, label: '币币账户' },
  { value: 3, label: '杠杆账户' },
  { value: 4, label: '秒合约/期权' },
];

const AdminBalance: Component = () => {
  const [userId, setUserId] = createSignal('');
  const [currencyId, setCurrencyId] = createSignal('3');
  const [balanceType, setBalanceType] = createSignal(1);
  const [amount, setAmount] = createSignal('');
  const [memo, setMemo] = createSignal('');
  const [loading, setLoading] = createSignal(false);
  const [msg, setMsg] = createSignal('');

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    const uid = parseInt(userId().trim(), 10);
    const amt = parseFloat(amount().trim());
    if (!uid || isNaN(uid)) {
      setMsg('请输入有效用户 ID');
      return;
    }
    if (isNaN(amt)) {
      setMsg('请输入有效金额');
      return;
    }
    setMsg('');
    setLoading(true);
    try {
      const res = await adminApi.modifyBalance({
        user_id: uid,
        currency_id: parseInt(currencyId(), 10) || 3,
        balance_type: balanceType(),
        amount: amt,
        memo: memo().trim() || undefined,
      });
      if (res.type === 'ok') {
        setMsg('余额已更新');
        setAmount('');
        setMemo('');
      } else {
        setMsg((res as any).message || '操作失败');
      }
    } catch (e) {
      setMsg('请求失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div class="space-y-6">
      <h1 class="text-2xl font-bold text-gray-900">余额修改</h1>
      {msg() && (
        <div class={"px-4 py-2 rounded-lg text-sm " + (msg().includes('失败') || msg().includes('有效') ? 'bg-red-50 text-red-700' : 'bg-primary/10 text-primary')}>{msg()}</div>
      )}
      <div class="card bg-white border border-gray-200 rounded-xl p-6 max-w-lg shadow-sm">
        <form onSubmit={handleSubmit} class="space-y-4">
          <div>
            <label class="block text-sm text-gray-600 mb-2">用户 ID</label>
            <input
              type="number"
              class="w-full px-4 py-2 rounded bg-gray-50 border border-gray-300 text-gray-900"
              placeholder="用户 ID"
              value={userId()}
              onInput={(e) => setUserId(e.currentTarget.value)}
            />
          </div>
          <div>
            <label class="block text-sm text-gray-600 mb-2">币种 ID（1=BTC, 2=ETH, 3=USDT）</label>
            <input
              type="number"
              class="w-full px-4 py-2 rounded bg-gray-50 border border-gray-300 text-gray-900"
              value={currencyId()}
              onInput={(e) => setCurrencyId(e.currentTarget.value)}
            />
          </div>
          <div>
            <label class="block text-sm text-gray-600 mb-2">账户类型</label>
            <select
              class="w-full px-4 py-2 rounded bg-gray-50 border border-gray-300 text-gray-900"
              value={balanceType()}
              onInput={(e) => setBalanceType(parseInt(e.currentTarget.value, 10))}
            >
              {BALANCE_TYPES.map((t) => (
                <option value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label class="block text-sm text-gray-600 mb-2">调整金额（正数增加，负数扣减）</label>
            <input
              type="text"
              class="w-full px-4 py-2 rounded bg-gray-50 border border-gray-300 text-gray-900"
              placeholder="例如 100 或 -50"
              value={amount()}
              onInput={(e) => setAmount(e.currentTarget.value)}
            />
          </div>
          <div>
            <label class="block text-sm text-gray-600 mb-2">备注（可选）</label>
            <input
              type="text"
              class="w-full px-4 py-2 rounded bg-gray-50 border border-gray-300 text-gray-900"
              placeholder="操作备注"
              value={memo()}
              onInput={(e) => setMemo(e.currentTarget.value)}
            />
          </div>
          <button
            type="submit"
            disabled={loading()}
            class="w-full py-3 rounded-lg bg-primary text-white font-medium hover:opacity-90 disabled:opacity-50"
          >
            {loading() ? '提交中...' : '提交调整'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default AdminBalance;
