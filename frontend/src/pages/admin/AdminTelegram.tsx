/**
 * Telegram 通知配置
 */
import { Component, createSignal, onMount, Show } from 'solid-js';
import { api } from '../../utils/api';

const AdminTelegram: Component = () => {
  const [botToken, setBotToken] = createSignal('');
  const [chatId, setChatId] = createSignal('');
  const [enabled, setEnabled] = createSignal(false);
  const [threshold, setThreshold] = createSignal('1000');
  const [loading, setLoading] = createSignal(false);
  const [saving, setSaving] = createSignal(false);
  const [message, setMessage] = createSignal('');
  const [error, setError] = createSignal('');

  const fetchConfig = async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/admin/system/messaging-gateway');
      if (res.type === 'ok' && res.data) {
        setBotToken(res.data.bot_token || '');
        setChatId(res.data.chat_id || '');
        setEnabled(res.data.enabled || false);
        setThreshold(res.data.threshold || '1000');
      }
    } catch (e) {
      console.error('Failed to load telegram config');
    } finally {
      setLoading(false);
    }
  };

  onMount(fetchConfig);

  const saveConfig = async () => {
    setSaving(true);
    setMessage('');
    setError('');
    try {
      const res = await api.post('/api/admin/system/messaging-gateway', {
        bot_token: botToken(),
        chat_id: chatId(),
        enabled: enabled(),
        threshold: threshold(),
      });
      if (res.type === 'ok') {
        setMessage('配置已保存');
      } else {
        setError(res.message as string || '保存失败');
      }
    } catch (e) {
      setError('保存配置失败');
    } finally {
      setSaving(false);
    }
  };

  const testMessage = async () => {
    setMessage('');
    setError('');
    try {
      const res = await api.post('/api/admin/system/test-telegram', {});
      if (res.type === 'ok') {
        setMessage('测试消息已发送，请检查 Telegram');
      } else {
        setError(res.message as string || '发送失败');
      }
    } catch (e) {
      setError('发送测试消息失败');
    }
  };

  return (
    <div class="space-y-6">
      <h1 class="text-2xl font-bold text-slate-800">Telegram 通知配置</h1>

      <Show when={loading()}>
        <div class="p-8 text-center text-slate-600">加载中...</div>
      </Show>

      <Show when={!loading()}>
        <div class="bg-white rounded-xl shadow-md border border-slate-200 p-6 space-y-6">
          {/* 说明 */}
          <div class="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 class="font-semibold text-blue-800 mb-2">📱 配置说明</h3>
            <ul class="text-sm text-blue-700 space-y-1">
              <li>• 配置后系统将通过 Telegram 发送重要通知</li>
              <li>• 包括：大额充值、提现申请、用户注册、风控告警等</li>
              <li>• Bot Token 从 @BotFather 获取</li>
              <li>• Chat ID 可以是群组ID或个人ID</li>
            </ul>
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

          {/* 表单 */}
          <div class="grid gap-6">
            <div>
              <label class="block text-sm font-semibold text-slate-700 mb-2">Bot Token</label>
              <input
                type="text"
                class="w-full px-4 py-3 border border-slate-300 rounded-lg text-slate-800 font-mono text-sm"
                placeholder="123456789:ABCdefGHIjklMNOpqrsTUVwxyz"
                value={botToken()}
                onInput={(e) => setBotToken(e.target.value)}
              />
            </div>

            <div>
              <label class="block text-sm font-semibold text-slate-700 mb-2">Chat ID</label>
              <input
                type="text"
                class="w-full px-4 py-3 border border-slate-300 rounded-lg text-slate-800 font-mono"
                placeholder="-1001234567890"
                value={chatId()}
                onInput={(e) => setChatId(e.target.value)}
              />
            </div>

            <div>
              <label class="block text-sm font-semibold text-slate-700 mb-2">大额阈值 (USDT)</label>
              <input
                type="number"
                class="w-full px-4 py-3 border border-slate-300 rounded-lg text-slate-800"
                placeholder="1000"
                value={threshold()}
                onInput={(e) => setThreshold(e.target.value)}
              />
              <p class="text-xs text-slate-500 mt-1">超过此金额的充值/提现将触发告警</p>
            </div>

            <div class="flex items-center gap-3">
              <input
                type="checkbox"
                id="enabled"
                class="w-5 h-5 rounded border-slate-300 text-blue-600"
                checked={enabled()}
                onChange={(e) => setEnabled(e.target.checked)}
              />
              <label for="enabled" class="text-sm font-medium text-slate-700">启用 Telegram 通知</label>
            </div>
          </div>

          {/* 按钮 */}
          <div class="flex gap-4 pt-4 border-t border-slate-200">
            <button
              class="px-6 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50"
              onClick={saveConfig}
              disabled={saving()}
            >
              {saving() ? '保存中...' : '保存配置'}
            </button>
            <button
              class="px-6 py-2.5 bg-slate-600 text-white rounded-lg font-medium hover:bg-slate-700"
              onClick={testMessage}
            >
              发送测试消息
            </button>
          </div>
        </div>
      </Show>
    </div>
  );
};

export default AdminTelegram;
