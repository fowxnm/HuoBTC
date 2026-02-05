/**
 * 充值配置页面 - 支持自定义添加支付方式和上传二维码
 */
import { Component, createSignal, onMount, For, Show } from 'solid-js';

interface PaymentMethod {
  id: string;
  name: string;
  chain: string;
  address: string;
  qrCode: string;
  enabled: boolean;
  minAmount: number;
  maxAmount: number;
}

const CHAINS = ['TRON', 'ETH', 'BSC', 'BTC', 'OTHER'];

const AdminPaymentConfig: Component = () => {
  const [methods, setMethods] = createSignal<PaymentMethod[]>([]);
  const [loading, setLoading] = createSignal(true);
  const [saving, setSaving] = createSignal(false);
  const [message, setMessage] = createSignal('');
  const [showAdd, setShowAdd] = createSignal(false);

  // 新增表单
  const [newName, setNewName] = createSignal('');
  const [newChain, setNewChain] = createSignal('TRON');
  const [newAddress, setNewAddress] = createSignal('');
  const [newQrCode, setNewQrCode] = createSignal('');
  const [newMin, setNewMin] = createSignal(10);
  const [newMax, setNewMax] = createSignal(100000);

  const fetchConfig = async () => {
    const token = localStorage.getItem('admin_token');
    if (!token) return;

    try {
      const res = await fetch('/api/admin/payment/config', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.type === 'ok' && data.data?.methods) {
        setMethods(data.data.methods);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  onMount(fetchConfig);

  const saveConfig = async () => {
    const token = localStorage.getItem('admin_token');
    if (!token) return;

    setSaving(true);
    setMessage('');

    try {
      const res = await fetch('/api/admin/payment/config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ methods: methods() }),
      });
      const data = await res.json();
      if (data.type === 'ok') {
        setMessage('✓ 保存成功');
      } else {
        setMessage('✗ ' + (data.message || '保存失败'));
      }
    } catch (e) {
      setMessage('✗ 网络错误');
    } finally {
      setSaving(false);
    }
  };

  const updateMethod = (id: string, field: keyof PaymentMethod, value: any) => {
    setMethods(prev => prev.map(m => m.id === id ? { ...m, [field]: value } : m));
  };

  const deleteMethod = (id: string) => {
    if (confirm('确定删除？')) {
      setMethods(prev => prev.filter(m => m.id !== id));
      setMessage('已删除，请保存');
    }
  };

  const addMethod = () => {
    if (!newName() || !newAddress()) {
      setMessage('✗ 请填写名称和地址');
      return;
    }
    const id = `m_${Date.now()}`;
    setMethods(prev => [...prev, {
      id,
      name: newName(),
      chain: newChain(),
      address: newAddress(),
      qrCode: newQrCode(),
      enabled: true,
      minAmount: newMin(),
      maxAmount: newMax(),
    }]);
    setNewName('');
    setNewAddress('');
    setNewQrCode('');
    setShowAdd(false);
    setMessage('已添加，请保存');
  };

  const handleFileUpload = (id: string, file: File) => {
    if (file.size > 2 * 1024 * 1024) {
      setMessage('✗ 图片不能超过2MB');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = e.target?.result as string;
      if (id === 'new') {
        setNewQrCode(base64);
      } else {
        updateMethod(id, 'qrCode', base64);
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <div class="space-y-6">
      <div class="flex items-center justify-between">
        <h1 class="text-2xl font-bold text-slate-800">充值配置</h1>
        <div class="flex gap-2">
          <button
            class="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-medium"
            onClick={() => setShowAdd(true)}
          >
            + 添加
          </button>
          <button
            class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium"
            onClick={saveConfig}
            disabled={saving()}
          >
            {saving() ? '保存中...' : '保存配置'}
          </button>
        </div>
      </div>

      <Show when={message()}>
        <div class={`p-3 rounded-lg font-medium ${message().startsWith('✓') ? 'bg-emerald-100 text-emerald-700 border border-emerald-300' : 'bg-red-100 text-red-700 border border-red-300'}`}>
          {message()}
        </div>
      </Show>

      {/* 添加表单 */}
      <Show when={showAdd()}>
        <div class="bg-emerald-50 border border-emerald-300 rounded-xl p-6">
          <div class="flex justify-between items-center mb-4">
            <h3 class="font-semibold text-emerald-800 text-lg">添加支付方式</h3>
            <button class="text-slate-500 hover:text-slate-700 text-xl" onClick={() => setShowAdd(false)}>✕</button>
          </div>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-slate-700 mb-1">名称</label>
              <input
                type="text"
                class="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-800"
                placeholder="USDT (TRC20)"
                value={newName()}
                onInput={(e) => setNewName(e.target.value)}
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-slate-700 mb-1">链</label>
              <select
                class="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-800"
                value={newChain()}
                onChange={(e) => setNewChain(e.target.value)}
              >
                <For each={CHAINS}>{(c) => <option value={c}>{c}</option>}</For>
              </select>
            </div>
            <div class="md:col-span-2">
              <label class="block text-sm font-medium text-slate-700 mb-1">收款地址</label>
              <input
                type="text"
                class="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono text-sm text-slate-800"
                placeholder="钱包地址"
                value={newAddress()}
                onInput={(e) => setNewAddress(e.target.value)}
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-slate-700 mb-1">上传二维码</label>
              <input
                type="file"
                accept="image/*"
                class="w-full text-sm text-slate-700"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFileUpload('new', f);
                }}
              />
            </div>
            <div class="flex items-end gap-2">
              <Show when={newQrCode()}>
                <img src={newQrCode()} class="w-12 h-12 rounded border border-slate-300" />
              </Show>
            </div>
            <div>
              <label class="block text-sm font-medium text-slate-700 mb-1">最小金额</label>
              <input type="number" class="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-800" value={newMin()} onInput={(e) => setNewMin(+e.target.value)} />
            </div>
            <div>
              <label class="block text-sm font-medium text-slate-700 mb-1">最大金额</label>
              <input type="number" class="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-800" value={newMax()} onInput={(e) => setNewMax(+e.target.value)} />
            </div>
          </div>
          <div class="mt-4 flex justify-end">
            <button class="px-6 py-2 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700" onClick={addMethod}>确认添加</button>
          </div>
        </div>
      </Show>

      <Show when={loading()}>
        <div class="text-slate-600">加载中...</div>
      </Show>

      <Show when={!loading()}>
        <Show when={methods().length === 0}>
          <div class="p-8 text-center text-slate-600 bg-slate-50 rounded-xl border-2 border-dashed border-slate-300">
            暂无支付方式，点击上方添加
          </div>
        </Show>

        <div class="space-y-4">
          <For each={methods()}>
            {(m) => (
              <div class="bg-white rounded-xl border border-slate-200 shadow-md p-6">
                <div class="flex items-center justify-between mb-4">
                  <div class="flex items-center gap-3">
                    <div class={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-white ${
                      m.chain === 'TRON' ? 'bg-red-500' :
                      m.chain === 'ETH' ? 'bg-blue-500' :
                      m.chain === 'BSC' ? 'bg-amber-500' :
                      'bg-slate-500'
                    }`}>
                      {m.chain.charAt(0)}
                    </div>
                    <div>
                      <input
                        type="text"
                        class="font-semibold text-slate-800 bg-transparent border-b border-transparent hover:border-slate-400 focus:border-blue-500 focus:outline-none text-lg"
                        value={m.name}
                        onInput={(e) => updateMethod(m.id, 'name', e.target.value)}
                      />
                      <p class="text-sm text-slate-500 font-medium">{m.chain}</p>
                    </div>
                  </div>
                  <div class="flex items-center gap-3">
                    <label class="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={m.enabled}
                        onChange={(e) => updateMethod(m.id, 'enabled', e.target.checked)}
                        class="w-5 h-5"
                      />
                      <span class={`text-sm font-medium ${m.enabled ? 'text-emerald-600' : 'text-slate-500'}`}>{m.enabled ? '已启用' : '已禁用'}</span>
                    </label>
                    <button class="text-red-600 text-sm font-medium px-2 py-1 bg-red-50 rounded hover:bg-red-100" onClick={() => deleteMethod(m.id)}>删除</button>
                  </div>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div class="md:col-span-2">
                    <label class="block text-sm text-slate-600 font-medium mb-1">收款地址</label>
                    <input
                      type="text"
                      class="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono text-sm text-slate-800"
                      value={m.address}
                      onInput={(e) => updateMethod(m.id, 'address', e.target.value)}
                    />
                  </div>
                  <div>
                    <label class="block text-sm text-slate-600 font-medium mb-1">上传二维码</label>
                    <input
                      type="file"
                      accept="image/*"
                      class="w-full text-sm text-slate-700"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handleFileUpload(m.id, f);
                      }}
                    />
                  </div>
                  <div class="flex items-center gap-3">
                    <Show when={m.qrCode}>
                      <img src={m.qrCode} class="w-16 h-16 rounded border border-slate-300" />
                      <button class="text-red-600 text-sm font-medium" onClick={() => updateMethod(m.id, 'qrCode', '')}>删除图片</button>
                    </Show>
                  </div>
                  <div>
                    <label class="block text-sm text-slate-600 font-medium mb-1">最小金额</label>
                    <input
                      type="number"
                      class="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-800"
                      value={m.minAmount}
                      onInput={(e) => updateMethod(m.id, 'minAmount', +e.target.value)}
                    />
                  </div>
                  <div>
                    <label class="block text-sm text-slate-600 font-medium mb-1">最大金额</label>
                    <input
                      type="number"
                      class="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-800"
                      value={m.maxAmount}
                      onInput={(e) => updateMethod(m.id, 'maxAmount', +e.target.value)}
                    />
                  </div>
                </div>
              </div>
            )}
          </For>
        </div>
      </Show>
    </div>
  );
};

export default AdminPaymentConfig;
