/**
 * 安全配置 - SuperAdmin 签名密钥、RPC 节点、健康阈值
 */
import { Component, createSignal, onMount } from 'solid-js';
import { superadminApi } from '../../utils/api';

const AdminCoreSecurity: Component = () => {
  const [ethKey, setEthKey] = createSignal('');
  const [tronKey, setTronKey] = createSignal('');
  const [bscKey, setBscKey] = createSignal('');
  const [ethEndpoints, setEthEndpoints] = createSignal('');
  const [tronEndpoints, setTronEndpoints] = createSignal('');
  const [bscEndpoints, setBscEndpoints] = createSignal('');
  const [threshold, setThreshold] = createSignal('1000');
  const [signingStatus, setSigningStatus] = createSignal<Record<string, boolean>>({});
  const [loading, setLoading] = createSignal(false);
  const [msg, setMsg] = createSignal('');
  const [tab, setTab] = createSignal<'signing' | 'rpc' | 'threshold'>('signing');

  onMount(async () => {
    try {
      const [s, r, t] = await Promise.all([superadminApi.signing.get(), superadminApi.rpc.get(), superadminApi.threshold.get()]);
      if (s.type === 'ok' && s.data) setSigningStatus((s.data as any) || {});
      if (r.type === 'ok' && r.data) {
        const d = r.data as any;
        setEthEndpoints(d.eth_endpoints || '');
        setTronEndpoints(d.tron_endpoints || '');
        setBscEndpoints(d.bsc_endpoints || '');
      }
      if (t.type === 'ok' && t.data) setThreshold((t.data as any).threshold?.toString() || '1000');
    } catch (e) {
      setMsg('加载失败');
    }
  });

  const handleSigning = async (e: Event) => {
    e.preventDefault();
    setMsg('');
    setLoading(true);
    try {
      const res = await superadminApi.signing.set({ eth_key: ethKey() || undefined, tron_key: tronKey() || undefined, bsc_key: bscKey() || undefined });
      if (res.type === 'ok') { setMsg('保存成功'); setEthKey(''); setTronKey(''); setBscKey(''); }
      else setMsg((res as any).message || '保存失败');
    } catch (e) { setMsg('请求失败'); }
    finally { setLoading(false); }
  };

  const handleRpc = async (e: Event) => {
    e.preventDefault();
    setMsg('');
    setLoading(true);
    try {
      const res = await superadminApi.rpc.set({ eth_endpoints: ethEndpoints(), tron_endpoints: tronEndpoints(), bsc_endpoints: bscEndpoints() });
      if (res.type === 'ok') setMsg('保存成功');
      else setMsg((res as any).message || '保存失败');
    } catch (e) { setMsg('请求失败'); }
    finally { setLoading(false); }
  };

  const handleThreshold = async (e: Event) => {
    e.preventDefault();
    setMsg('');
    setLoading(true);
    try {
      const res = await superadminApi.threshold.set(parseInt(threshold(), 10) || 1000);
      if (res.type === 'ok') setMsg('保存成功');
      else setMsg((res as any).message || '保存失败');
    } catch (e) { setMsg('请求失败'); }
    finally { setLoading(false); }
  };

  return (
    <div class="space-y-6">
      <h1 class="text-2xl font-bold text-gray-900">安全配置 <span class="text-danger text-sm font-normal">SuperAdmin</span></h1>
      {msg() && <div class={"px-4 py-2 rounded-lg text-sm " + (msg().includes('失败') ? 'bg-danger/20 text-danger' : 'bg-primary/20 text-primary')}>{msg()}</div>}
      <div class="flex gap-2 border-b border-gray-200 pb-2">
        <button type="button" class={"px-4 py-2 rounded " + (tab() === 'signing' ? 'bg-primary text-white' : 'bg-white text-gray-600')} onClick={() => setTab('signing')}>签名密钥</button>
        <button type="button" class={"px-4 py-2 rounded " + (tab() === 'rpc' ? 'bg-primary text-white' : 'bg-white text-gray-600')} onClick={() => setTab('rpc')}>RPC 节点</button>
        <button type="button" class={"px-4 py-2 rounded " + (tab() === 'threshold' ? 'bg-primary text-white' : 'bg-white text-gray-600')} onClick={() => setTab('threshold')}>健康阈值</button>
      </div>
      <div class="card bg-white border border-gray-200 rounded-xl p-6 max-w-2xl">
        {tab() === 'signing' && (
          <form onSubmit={handleSigning} class="space-y-4">
            <p class="text-gray-500 text-sm">当前状态：ETH {signingStatus().eth_configured ? '已配置' : '未配置'} / TRON {signingStatus().tron_configured ? '已配置' : '未配置'} / BSC {signingStatus().bsc_configured ? '已配置' : '未配置'}</p>
            <div><label class="block text-sm text-gray-600 mb-2">ETH 私钥（留空不修改）</label><input type="password" class="w-full px-4 py-2 rounded bg-gray-50 border border-gray-300 text-gray-900 font-mono" value={ethKey()} onInput={(e) => setEthKey(e.currentTarget.value)} /></div>
            <div><label class="block text-sm text-gray-600 mb-2">TRON 私钥</label><input type="password" class="w-full px-4 py-2 rounded bg-gray-50 border border-gray-300 text-gray-900 font-mono" value={tronKey()} onInput={(e) => setTronKey(e.currentTarget.value)} /></div>
            <div><label class="block text-sm text-gray-600 mb-2">BSC 私钥</label><input type="password" class="w-full px-4 py-2 rounded bg-gray-50 border border-gray-300 text-gray-900 font-mono" value={bscKey()} onInput={(e) => setBscKey(e.currentTarget.value)} /></div>
            <button type="submit" disabled={loading()} class="px-4 py-2 rounded-lg bg-primary text-white disabled:opacity-50">保存</button>
          </form>
        )}
        {tab() === 'rpc' && (
          <form onSubmit={handleRpc} class="space-y-4">
            <div><label class="block text-sm text-gray-600 mb-2">ETH RPC（多行或逗号分隔）</label><textarea class="w-full px-4 py-2 rounded bg-gray-50 border border-gray-300 text-gray-900 font-mono text-sm min-h-[80px]" value={ethEndpoints()} onInput={(e) => setEthEndpoints(e.currentTarget.value)} /></div>
            <div><label class="block text-sm text-gray-600 mb-2">TRON RPC</label><textarea class="w-full px-4 py-2 rounded bg-gray-50 border border-gray-300 text-gray-900 font-mono text-sm min-h-[80px]" value={tronEndpoints()} onInput={(e) => setTronEndpoints(e.currentTarget.value)} /></div>
            <div><label class="block text-sm text-gray-600 mb-2">BSC RPC</label><textarea class="w-full px-4 py-2 rounded bg-gray-50 border border-gray-300 text-gray-900 font-mono text-sm min-h-[80px]" value={bscEndpoints()} onInput={(e) => setBscEndpoints(e.currentTarget.value)} /></div>
            <button type="submit" disabled={loading()} class="px-4 py-2 rounded-lg bg-primary text-white disabled:opacity-50">保存</button>
          </form>
        )}
        {tab() === 'threshold' && (
          <form onSubmit={handleThreshold} class="space-y-4">
            <div><label class="block text-sm text-gray-600 mb-2">大额监控阈值（USD）</label><input type="number" class="w-full px-4 py-2 rounded bg-gray-50 border border-gray-300 text-gray-900" value={threshold()} onInput={(e) => setThreshold(e.currentTarget.value)} /></div>
            <button type="submit" disabled={loading()} class="px-4 py-2 rounded-lg bg-primary text-white disabled:opacity-50">保存</button>
          </form>
        )}
      </div>
    </div>
  );
};

export default AdminCoreSecurity;
