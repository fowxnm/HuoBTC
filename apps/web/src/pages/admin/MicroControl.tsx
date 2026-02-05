/**
 * Micro Contract Control Page (秒合约控盘)
 * 
 * SuperAdmin-only page for controlling user win/loss outcomes
 * 
 * Features:
 * - Search user by UID/phone/email
 * - View user's micro trading statistics
 * - Set user risk: Normal (0), Must Win (1), Must Lose (-1)
 * - Batch risk settings for all users
 */

import { Component, createSignal, Show } from 'solid-js';
import { api } from '../../utils/api';

interface UserRiskData {
  id: number;
  phone: string | null;
  email: string | null;
  current_risk: number;
  risk_name: string;
  total_orders: number;
  closed_orders: number;
  wins: number;
  losses: number;
  win_rate: string;
}

interface BatchRiskData {
  risk_mode: string;
  risk_group_result: string;
  risk_profit_probability: string;
  user_counts: {
    normal: number;
    must_win: number;
    must_lose: number;
  };
}

const MicroControl: Component = () => {
  // Search state
  const [searchType, setSearchType] = createSignal<'uid' | 'phone' | 'email'>('uid');
  const [searchValue, setSearchValue] = createSignal('');
  const [searching, setSearching] = createSignal(false);
  const [userData, setUserData] = createSignal<UserRiskData | null>(null);
  const [error, setError] = createSignal('');

  // Batch settings
  const [batchData, setBatchData] = createSignal<BatchRiskData | null>(null);
  const [loadingBatch, setLoadingBatch] = createSignal(false);

  // Action state
  const [updating, setUpdating] = createSignal(false);
  const [actionMessage, setActionMessage] = createSignal('');

  // Search user
  const searchUser = async () => {
    if (!searchValue().trim()) {
      setError('请输入搜索内容');
      return;
    }

    setSearching(true);
    setError('');
    setUserData(null);

    try {
      const params = new URLSearchParams();
      params.set(searchType(), searchValue());

      const res = await api.get(`/api/admin/accounts/risk-profile/search?${params}`);
      
      if (res.type === 'ok') {
        setUserData(res.data);
      } else {
        setError(res.message || '用户不存在');
      }
    } catch (e) {
      setError('搜索失败');
    } finally {
      setSearching(false);
    }
  };

  // Set user risk
  const setUserRisk = async (userId: number, risk: number) => {
    setUpdating(true);
    setActionMessage('');

    try {
      const res = await api.post('/api/admin/accounts/risk-profile', {
        user_id: userId,
        risk: risk,
      });

      if (res.type === 'ok') {
        setActionMessage(`✓ ${res.message}`);
        // Refresh user data
        await searchUser();
      } else {
        setActionMessage(`✗ ${res.message}`);
      }
    } catch (e) {
      setActionMessage('✗ 操作失败');
    } finally {
      setUpdating(false);
    }
  };

  // Load batch settings
  const loadBatchSettings = async () => {
    setLoadingBatch(true);
    try {
      const res = await api.get('/api/admin/accounts/batch-risk');
      if (res.type === 'ok') {
        setBatchData(res.data);
      }
    } catch (e) {
      console.error('Failed to load batch settings:', e);
    } finally {
      setLoadingBatch(false);
    }
  };

  // Update batch settings
  const updateBatchSettings = async (settings: Partial<BatchRiskData>) => {
    setUpdating(true);
    try {
      const res = await api.post('/api/admin/accounts/batch-risk', settings);
      if (res.type === 'ok') {
        setActionMessage('✓ 群控设置已更新');
        await loadBatchSettings();
      }
    } catch (e) {
      setActionMessage('✗ 更新失败');
    } finally {
      setUpdating(false);
    }
  };

  // Reset all users to normal
  const resetAllUsers = async () => {
    if (!confirm('确定要将所有用户重置为正常风控吗？')) return;
    
    setUpdating(true);
    try {
      const res = await api.post('/api/admin/accounts/batch-risk/reset', {});
      if (res.type === 'ok') {
        setActionMessage('✓ 所有用户已重置为正常');
        await loadBatchSettings();
      }
    } catch (e) {
      setActionMessage('✗ 重置失败');
    } finally {
      setUpdating(false);
    }
  };

  // Load batch settings on mount
  loadBatchSettings();

  return (
    <div class="max-w-6xl mx-auto">
      <div class="flex items-center justify-between mb-6">
        <div>
          <h1 class="text-2xl font-bold">秒合约控盘</h1>
          <p class="text-gray-600 text-sm mt-1">控制用户秒合约交易盈亏结果</p>
        </div>
        <span class="text-xs text-danger bg-danger/20 px-3 py-1 rounded-full">
          🔒 SuperAdmin Only
        </span>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Single User Control */}
        <div class="card">
          <h2 class="text-lg font-semibold mb-4 flex items-center">
            <span class="w-8 h-8 bg-primary/20 rounded-full flex items-center justify-center mr-2">
              👤
            </span>
            单用户控盘
          </h2>

          {/* Search */}
          <div class="space-y-4">
            <div class="flex space-x-2">
              <select
                class="form-input w-24"
                value={searchType()}
                onChange={(e) => setSearchType(e.target.value as any)}
              >
                <option value="uid">UID</option>
                <option value="phone">手机号</option>
                <option value="email">邮箱</option>
              </select>
              <input
                type="text"
                class="form-input flex-1"
                placeholder={searchType() === 'uid' ? '输入用户ID' : searchType() === 'phone' ? '输入手机号' : '输入邮箱'}
                value={searchValue()}
                onInput={(e) => setSearchValue(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && searchUser()}
              />
              <button
                class="btn btn-primary"
                onClick={searchUser}
                disabled={searching()}
              >
                {searching() ? '搜索中...' : '搜索'}
              </button>
            </div>

            <Show when={error()}>
              <div class="text-danger text-sm">{error()}</div>
            </Show>

            {/* User Info */}
            <Show when={userData()}>
              <div class="bg-gray-100 rounded-lg p-4 space-y-4">
                <div class="flex items-center justify-between">
                  <div>
                    <p class="text-lg font-bold">UID: {userData()!.id}</p>
                    <p class="text-gray-600 text-sm">
                      {userData()!.phone || userData()!.email || '无联系方式'}
                    </p>
                  </div>
                  <div class={`px-3 py-1 rounded-full text-sm font-bold ${
                    userData()!.current_risk === 1 
                      ? 'bg-success/20 text-success' 
                      : userData()!.current_risk === -1 
                        ? 'bg-danger/20 text-danger' 
                        : 'bg-gray-600/20 text-gray-600'
                  }`}>
                    {userData()!.risk_name}
                  </div>
                </div>

                {/* Stats */}
                <div class="grid grid-cols-4 gap-2 text-center text-sm">
                  <div class="bg-white rounded p-2">
                    <p class="text-gray-600">总订单</p>
                    <p class="font-bold">{userData()!.total_orders}</p>
                  </div>
                  <div class="bg-white rounded p-2">
                    <p class="text-gray-600">已结算</p>
                    <p class="font-bold">{userData()!.closed_orders}</p>
                  </div>
                  <div class="bg-white rounded p-2">
                    <p class="text-success">盈利</p>
                    <p class="font-bold text-success">{userData()!.wins}</p>
                  </div>
                  <div class="bg-white rounded p-2">
                    <p class="text-danger">亏损</p>
                    <p class="font-bold text-danger">{userData()!.losses}</p>
                  </div>
                </div>

                <div class="text-center text-sm">
                  胜率: <span class="font-bold text-primary">{userData()!.win_rate}%</span>
                </div>

                {/* Risk Control Buttons */}
                <div class="border-t border-gray-700 pt-4">
                  <p class="text-sm text-gray-600 mb-3">设置此用户的秒合约结算结果:</p>
                  <div class="grid grid-cols-3 gap-2">
                    <button
                      class={`py-3 rounded-lg font-bold transition-colors ${
                        userData()!.current_risk === 0 
                          ? 'bg-gray-600 text-white' 
                          : 'bg-white text-gray-600 hover:bg-gray-600'
                      }`}
                      onClick={() => setUserRisk(userData()!.id, 0)}
                      disabled={updating()}
                    >
                      正常
                    </button>
                    <button
                      class={`py-3 rounded-lg font-bold transition-colors ${
                        userData()!.current_risk === 1 
                          ? 'bg-success text-white' 
                          : 'bg-white text-gray-600 hover:bg-success/50'
                      }`}
                      onClick={() => setUserRisk(userData()!.id, 1)}
                      disabled={updating()}
                    >
                      🎯 必赢
                    </button>
                    <button
                      class={`py-3 rounded-lg font-bold transition-colors ${
                        userData()!.current_risk === -1 
                          ? 'bg-danger text-white' 
                          : 'bg-white text-gray-600 hover:bg-danger/50'
                      }`}
                      onClick={() => setUserRisk(userData()!.id, -1)}
                      disabled={updating()}
                    >
                      💀 必输
                    </button>
                  </div>
                </div>
              </div>
            </Show>
          </div>
        </div>

        {/* Batch Control */}
        <div class="card">
          <h2 class="text-lg font-semibold mb-4 flex items-center">
            <span class="w-8 h-8 bg-danger/20 rounded-full flex items-center justify-center mr-2">
              👥
            </span>
            群控设置
          </h2>

          <Show when={batchData()} fallback={
            <div class="text-center py-8 text-gray-600">
              {loadingBatch() ? '加载中...' : '无法加载群控设置'}
            </div>
          }>
            <div class="space-y-4">
              {/* User Distribution */}
              <div class="bg-gray-100 rounded-lg p-4">
                <p class="text-sm text-gray-600 mb-3">用户风控分布:</p>
                <div class="grid grid-cols-3 gap-2 text-center">
                  <div class="bg-white rounded p-3">
                    <p class="text-2xl font-bold">{batchData()!.user_counts.normal}</p>
                    <p class="text-gray-600 text-xs">正常</p>
                  </div>
                  <div class="bg-success/20 rounded p-3">
                    <p class="text-2xl font-bold text-success">{batchData()!.user_counts.must_win}</p>
                    <p class="text-success text-xs">必赢</p>
                  </div>
                  <div class="bg-danger/20 rounded p-3">
                    <p class="text-2xl font-bold text-danger">{batchData()!.user_counts.must_lose}</p>
                    <p class="text-danger text-xs">必输</p>
                  </div>
                </div>
              </div>

              {/* Risk Mode */}
              <div>
                <label class="form-label">风控模式</label>
                <select
                  class="form-input"
                  value={batchData()!.risk_mode}
                  onChange={(e) => updateBatchSettings({ risk_mode: parseInt(e.target.value) as any })}
                >
                  <option value="0">关闭 - 使用用户个人设置</option>
                  <option value="1">按用户 - 优先用户个人风控</option>
                  <option value="2">按群组 - 所有用户统一结果</option>
                  <option value="3">按金额 - 大额订单必输</option>
                  <option value="4">按订单 - 连续订单控制</option>
                  <option value="5">按概率 - 设定胜率</option>
                </select>
              </div>

              {/* Group Result */}
              <div>
                <label class="form-label">群组默认结果</label>
                <select
                  class="form-input"
                  value={batchData()!.risk_group_result}
                  onChange={(e) => updateBatchSettings({ risk_group_result: parseInt(e.target.value) as any })}
                >
                  <option value="1">必赢</option>
                  <option value="0">随机</option>
                  <option value="-1">必输</option>
                </select>
              </div>

              {/* Profit Probability */}
              <div>
                <label class="form-label">用户胜率 (%)</label>
                <input
                  type="number"
                  class="form-input"
                  min="0"
                  max="100"
                  value={batchData()!.risk_profit_probability}
                  onChange={(e) => updateBatchSettings({ risk_profit_probability: parseInt(e.target.value) as any })}
                />
                <p class="text-xs text-gray-500 mt-1">用户盈利概率（0-100），仅在概率模式下生效</p>
              </div>

              {/* Reset Button */}
              <div class="border-t border-gray-700 pt-4">
                <button
                  class="btn btn-danger w-full"
                  onClick={resetAllUsers}
                  disabled={updating()}
                >
                  重置所有用户为正常
                </button>
                <p class="text-xs text-gray-500 mt-2 text-center">
                  将所有用户的个人风控设置清除
                </p>
              </div>
            </div>
          </Show>
        </div>
      </div>

      {/* Action Message */}
      <Show when={actionMessage()}>
        <div class={`fixed bottom-6 right-6 px-4 py-2 rounded-lg ${
          actionMessage().startsWith('✓') ? 'bg-success' : 'bg-danger'
        } text-white shadow-lg`}>
          {actionMessage()}
        </div>
      </Show>

      {/* Usage Guide */}
      <div class="card mt-6">
        <h3 class="font-semibold mb-4">📖 使用说明</h3>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-600">
          <div>
            <p class="font-semibold text-white mb-2">单用户控盘</p>
            <ul class="space-y-1">
              <li>• 通过 UID、手机号或邮箱搜索用户</li>
              <li>• <span class="text-gray-300">正常</span>: 使用系统风控概率</li>
              <li>• <span class="text-success">必赢</span>: 该用户所有秒合约订单强制盈利</li>
              <li>• <span class="text-danger">必输</span>: 该用户所有秒合约订单强制亏损</li>
            </ul>
          </div>
          <div>
            <p class="font-semibold text-white mb-2">群控模式</p>
            <ul class="space-y-1">
              <li>• <span class="text-gray-300">关闭</span>: 只看用户个人设置</li>
              <li>• <span class="text-gray-300">按用户</span>: 有设置的用户按设置，其他随机</li>
              <li>• <span class="text-gray-300">按群组</span>: 全体用户统一按群组结果</li>
              <li>• <span class="text-gray-300">按概率</span>: 所有用户按设定胜率随机</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MicroControl;
