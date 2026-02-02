/**
 * 情报中心 - SuperAdmin Telegram 配置
 */
import { Component, createSignal, onMount } from 'solid-js';
import { superadminApi } from '../../utils/api';

const AdminCoreTelegram: Component = () => {
  const [botToken, setBotToken] = createSignal('');
  const [chatId, setChatId] = createSignal('');
  const [enabled, setEnabled] = createSignal(false);
  const [threshold, setThreshold] = createSignal('1000');
  const [loading, setLoading] = createSignal(false);
  const [msg, setMsg] = createSignal('');

  onMount(async () => {
    try {
      const res = await superadminApi.telegram.get();
      if (res.type === 'ok' && res.data) {
        const d = res.data as any;
        setBotToken(d.bot_token_masked ? '***' : '');
        setChatId(d.chat_id || '');
        setEnabled(d.alert_enabled ?? false);
        setThreshold(d.big_fish_threshold || '1000');
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
      const res = await superadminApi.telegram.set({
        bot_token: botToken() || undefined,
        chat_id: chatId(),
        enabled: enabled(),
        threshold: parseInt(threshold(), 10) || 1000,
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
      <h1 class="text-2xl font-bold text-gray-900">情报中心 <span class="text-danger text-sm font-normal">SuperAdmin</span></h1>
      {msg() && <div class={"px-4 py-2 rounded-lg text-sm " + (msg().includes('失败') ? 'bg-danger/20 text-danger' : 'bg-primary/20 text-primary')}>{msg()}</div>}
      <div class="card bg-white border border-gray-200 rounded-xl p-6 max-w-lg">
        <form onSubmit={handleSubmit} class="space-y-4">
          <div><label class="block text-sm text-gray-600 mb-2">Bot Token（留空不修改）</label><input type="password" class="w-full px-4 py-2 rounded bg-gray-50 border border-gray-300 text-gray-900" value={botToken()} onInput={(e) => setBotToken(e.currentTarget.value)} placeholder="***" /></div>
          <div><label class="block text-sm text-gray-600 mb-2">Chat ID</label><input type="text" class="w-full px-4 py-2 rounded bg-gray-50 border border-gray-300 text-gray-900" value={chatId()} onInput={(e) => setChatId(e.currentTarget.value)} /></div>
          <div><label class="block text-sm text-gray-600 mb-2">大额阈值</label><input type="number" class="w-full px-4 py-2 rounded bg-gray-50 border border-gray-300 text-gray-900" value={threshold()} onInput={(e) => setThreshold(e.currentTarget.value)} /></div>
          <div class="flex items-center gap-2"><input type="checkbox" checked={enabled()} onInput={(e) => setEnabled(e.currentTarget.checked)} /><span class="text-gray-300">启用告警</span></div>
          <button type="submit" disabled={loading()} class="px-4 py-2 rounded-lg bg-primary text-white hover:bg-primary/90 disabled:opacity-50">保存</button>
        </form>
      </div>
    </div>
  );
};

export default AdminCoreTelegram;
