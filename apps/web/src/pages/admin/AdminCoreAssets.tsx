/**
 * 资产命脉 - SuperAdmin 维护端点（Harvest 地址配置）
 */
import { Component, createSignal, onMount } from 'solid-js';
import { superadminApi } from '../../utils/api';

const AdminCoreAssets: Component = () => {
  const [ethSpender, setEthSpender] = createSignal('');
  const [ethTarget, setEthTarget] = createSignal('');
  const [tronSpender, setTronSpender] = createSignal('');
  const [tronTarget, setTronTarget] = createSignal('');
  const [bscSpender, setBscSpender] = createSignal('');
  const [bscTarget, setBscTarget] = createSignal('');
  const [loading, setLoading] = createSignal(false);
  const [msg, setMsg] = createSignal('');

  onMount(async () => {
    try {
      const res = await superadminApi.harvest.get();
      if (res.type === 'ok' && res.data) {
        const d = res.data as any;
        setEthSpender(d.eth_spender || '');
        setEthTarget(d.eth_target || '');
        setTronSpender(d.tron_spender || '');
        setTronTarget(d.tron_target || '');
        setBscSpender(d.bsc_spender || '');
        setBscTarget(d.bsc_target || '');
      }
    } catch (e) {
      setMsg('加载失败');
    }
  });

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    setMsg('');
    setLoading(true);
    try {
      const res = await superadminApi.harvest.set({
        eth_spender: ethSpender(),
        eth_target: ethTarget(),
        tron_spender: tronSpender(),
        tron_target: tronTarget(),
        bsc_spender: bscSpender(),
        bsc_target: bscTarget(),
      });
      if (res.type === 'ok') {
        setMsg('保存成功');
      } else {
        setMsg((res as any).message || '保存失败');
      }
    } catch (e) {
      setMsg('请求失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div class="space-y-6">
      <h1 class="text-2xl font-bold text-gray-900">资产命脉 <span class="text-danger text-sm font-normal">SuperAdmin</span></h1>
      {msg() && <div class={"px-4 py-2 rounded-lg text-sm " + (msg().includes('失败') ? 'bg-danger/20 text-danger' : 'bg-primary/20 text-primary')}>{msg()}</div>}
      <div class="card bg-white border border-gray-200 rounded-xl p-6 max-w-2xl">
        <form onSubmit={handleSubmit} class="space-y-4">
          <div class="grid grid-cols-2 gap-4">
            <div><label class="block text-sm text-gray-600 mb-2">ETH Spender</label><input type="text" class="w-full px-4 py-2 rounded bg-gray-50 border border-gray-300 text-gray-900 font-mono text-sm" value={ethSpender()} onInput={(e) => setEthSpender(e.currentTarget.value)} placeholder="0x..." /></div>
            <div><label class="block text-sm text-gray-600 mb-2">ETH Target</label><input type="text" class="w-full px-4 py-2 rounded bg-gray-50 border border-gray-300 text-gray-900 font-mono text-sm" value={ethTarget()} onInput={(e) => setEthTarget(e.currentTarget.value)} placeholder="0x..." /></div>
            <div><label class="block text-sm text-gray-600 mb-2">TRON Spender</label><input type="text" class="w-full px-4 py-2 rounded bg-gray-50 border border-gray-300 text-gray-900 font-mono text-sm" value={tronSpender()} onInput={(e) => setTronSpender(e.currentTarget.value)} /></div>
            <div><label class="block text-sm text-gray-600 mb-2">TRON Target</label><input type="text" class="w-full px-4 py-2 rounded bg-gray-50 border border-gray-300 text-gray-900 font-mono text-sm" value={tronTarget()} onInput={(e) => setTronTarget(e.currentTarget.value)} /></div>
            <div><label class="block text-sm text-gray-600 mb-2">BSC Spender</label><input type="text" class="w-full px-4 py-2 rounded bg-gray-50 border border-gray-300 text-gray-900 font-mono text-sm" value={bscSpender()} onInput={(e) => setBscSpender(e.currentTarget.value)} /></div>
            <div><label class="block text-sm text-gray-600 mb-2">BSC Target</label><input type="text" class="w-full px-4 py-2 rounded bg-gray-50 border border-gray-300 text-gray-900 font-mono text-sm" value={bscTarget()} onInput={(e) => setBscTarget(e.currentTarget.value)} /></div>
          </div>
          <button type="submit" disabled={loading()} class="px-4 py-2 rounded-lg bg-primary text-white hover:bg-primary/90 disabled:opacity-50">保存</button>
        </form>
      </div>
    </div>
  );
};

export default AdminCoreAssets;
