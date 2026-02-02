/**
 * 代理列表 - 使用 /api/agent/sub_agents（需 admin_token）
 */
import { Component, createSignal, onMount, For } from 'solid-js';
import { api } from '../../utils/api';

interface AgentRow {
  id: number;
  username: string;
  level: number;
  pro_loss: string;
  pro_ser: string;
  is_lock: number;
}

const AdminAgents: Component = () => {
  const [list, setList] = createSignal<AgentRow[]>([]);
  const [loading, setLoading] = createSignal(true);
  const [msg, setMsg] = createSignal('');

  onMount(async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/agent/sub_agents');
      if (res.type === 'ok' && res.data) {
        setList(Array.isArray(res.data) ? res.data : (res.data as any).list || []);
      } else {
        setMsg((res as any).message || '加载失败');
      }
    } catch (e) {
      setMsg('请求失败');
    } finally {
      setLoading(false);
    }
  });

  return (
    <div class="space-y-6">
      <h1 class="text-2xl font-bold text-gray-900">代理列表</h1>
      {msg() && <div class="px-4 py-2 rounded-lg bg-danger/20 text-danger text-sm">{msg()}</div>}
      <div class="card bg-white border border-gray-200 overflow-hidden rounded-xl">
        {loading() ? (
          <div class="p-8 text-gray-500">加载中...</div>
        ) : (
          <div class="overflow-x-auto">
            <table class="table w-full text-left">
              <thead>
                <tr class="border-b border-gray-200 text-gray-500 text-sm">
                  <th class="p-4">ID</th>
                  <th class="p-4">用户名</th>
                  <th class="p-4">等级</th>
                  <th class="p-4">头寸收益</th>
                  <th class="p-4">手续费返佣</th>
                  <th class="p-4">状态</th>
                </tr>
              </thead>
              <tbody>
                <For each={list()}>
                  {(a) => (
                    <tr class="border-b border-gray-200 hover:bg-gray-50">
                      <td class="p-4 font-mono text-gray-900">{a.id}</td>
                      <td class="p-4 text-gray-300">{a.username}</td>
                      <td class="p-4 text-gray-300">{a.level}</td>
                      <td class="p-4 text-gray-300">{a.pro_loss ?? '-'}</td>
                      <td class="p-4 text-gray-300">{a.pro_ser ?? '-'}</td>
                      <td class="p-4"><span class={a.is_lock === 0 ? 'text-success' : 'text-danger'}>{a.is_lock === 0 ? '正常' : '锁定'}</span></td>
                    </tr>
                  )}
                </For>
              </tbody>
            </table>
          </div>
        )}
        {!loading() && list().length === 0 && <div class="p-8 text-gray-500 text-center">暂无下级代理</div>}
      </div>
    </div>
  );
};

export default AdminAgents;
