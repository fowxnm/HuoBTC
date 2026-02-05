import { Component, createSignal, Show } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import { useI18n } from '../contexts/I18nContext';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../utils/api';
import { openConnectModal } from '../appkit/openAppKit';

const Account: Component = () => {
  const { t } = useI18n();
  const { user, isLoggedIn, logout } = useAuth();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = createSignal<'profile' | 'security' | 'password'>('profile');
  const [oldPassword, setOldPassword] = createSignal('');
  const [newPassword, setNewPassword] = createSignal('');
  const [confirmPassword, setConfirmPassword] = createSignal('');
  const [payPassword, setPayPassword] = createSignal('');
  const [confirmPayPassword, setConfirmPayPassword] = createSignal('');
  const [loading, setLoading] = createSignal(false);
  const [message, setMessage] = createSignal({ type: '', text: '' });

  if (!isLoggedIn()) {
    return (
      <div class="max-w-2xl mx-auto px-4 py-12 text-center">
        <p class="text-gray-400 mb-4">{t('common.pleaseConnectBefore')}</p>
        <button type="button" class="btn btn-primary" onClick={() => openConnectModal()}>{t('common.connectWallet')}</button>
      </div>
    );
  }

  const handleChangePassword = async (e: Event) => {
    e.preventDefault();
    setMessage({ type: '', text: '' });

    if (newPassword() !== confirmPassword()) {
      setMessage({ type: 'error', text: 'Passwords do not match' });
      return;
    }

    if (newPassword().length < 6) {
      setMessage({ type: 'error', text: 'Password must be at least 6 characters' });
      return;
    }

    setLoading(true);

    try {
      const response = await api.post('/api/user/change-password', {
        old_password: oldPassword(),
        password: newPassword(),
        repassword: confirmPassword()
      });

      if (response.type === 'ok') {
        setMessage({ type: 'success', text: 'Password changed successfully' });
        setOldPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        setMessage({ type: 'error', text: response.message || 'Failed to change password' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to change password' });
    } finally {
      setLoading(false);
    }
  };

  const handleSetPayPassword = async (e: Event) => {
    e.preventDefault();
    setMessage({ type: '', text: '' });

    if (payPassword() !== confirmPayPassword()) {
      setMessage({ type: 'error', text: 'Pay passwords do not match' });
      return;
    }

    if (payPassword().length !== 6) {
      setMessage({ type: 'error', text: 'Pay password must be 6 digits' });
      return;
    }

    setLoading(true);

    try {
      const response = await api.post('/api/user/set-pay-password', {
        pay_password: payPassword()
      });

      if (response.type === 'ok') {
        setMessage({ type: 'success', text: 'Pay password set successfully' });
        setPayPassword('');
        setConfirmPayPassword('');
      } else {
        setMessage({ type: 'error', text: response.message || 'Failed to set pay password' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to set pay password' });
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <div class="max-w-4xl mx-auto px-4 py-8">
      <h1 class="text-2xl font-bold mb-8">{t('account.title')}</h1>

      <div class="grid grid-cols-1 md:grid-cols-4 gap-6">
        {/* Sidebar */}
        <div class="card md:col-span-1">
          <div class="text-center mb-6">
            <div class="w-20 h-20 bg-primary/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <span class="text-primary text-2xl font-bold">
                {user()?.account_number?.slice(0, 2) || 'U'}
              </span>
            </div>
            <h3 class="font-semibold">{user()?.account_number || 'User'}</h3>
            <p class="text-sm text-gray-500">{user()?.email || 'No email'}</p>
          </div>

          <nav class="space-y-2">
            <button
              class={`w-full text-left px-4 py-2 rounded-lg transition-colors ${
                activeTab() === 'profile' ? 'bg-primary text-dark-400' : 'hover:bg-dark-300'
              }`}
              onClick={() => setActiveTab('profile')}
            >
              {t('account.profile')}
            </button>
            <button
              class={`w-full text-left px-4 py-2 rounded-lg transition-colors ${
                activeTab() === 'security' ? 'bg-primary text-dark-400' : 'hover:bg-dark-300'
              }`}
              onClick={() => setActiveTab('security')}
            >
              {t('account.security')}
            </button>
            <button
              class={`w-full text-left px-4 py-2 rounded-lg transition-colors ${
                activeTab() === 'password' ? 'bg-primary text-dark-400' : 'hover:bg-dark-300'
              }`}
              onClick={() => setActiveTab('password')}
            >
              {t('account.changePassword')}
            </button>
            <hr class="border-gray-700 my-4" />
            <button
              class="w-full text-left px-4 py-2 rounded-lg text-danger hover:bg-danger/20 transition-colors"
              onClick={handleLogout}
            >
              {t('common.logout')}
            </button>
          </nav>
        </div>

        {/* Content */}
        <div class="card md:col-span-3">
          <Show when={message().text}>
            <div class={`mb-6 p-3 rounded-lg ${
              message().type === 'success' 
                ? 'bg-success/20 border border-success/50 text-success' 
                : 'bg-danger/20 border border-danger/50 text-danger'
            }`}>
              {message().text}
            </div>
          </Show>

          {/* Profile Tab */}
          <Show when={activeTab() === 'profile'}>
            <h2 class="text-lg font-semibold mb-6">{t('account.profile')}</h2>
            <div class="space-y-4">
              <div class="flex justify-between py-3 border-b border-gray-700">
                <span class="text-gray-400">Account Number</span>
                <span>{user()?.account_number || '-'}</span>
              </div>
              <div class="flex justify-between py-3 border-b border-gray-700">
                <span class="text-gray-400">Email</span>
                <span>{user()?.email || 'Not set'}</span>
              </div>
              <div class="flex justify-between py-3 border-b border-gray-700">
                <span class="text-gray-400">Phone</span>
                <span>{user()?.phone || 'Not set'}</span>
              </div>
              <div class="flex justify-between py-3 border-b border-gray-700">
                <span class="text-gray-400">User Level</span>
                <span class="px-2 py-1 bg-primary/20 text-primary rounded text-sm">
                  Level {user()?.user_level || 0}
                </span>
              </div>
              <div class="flex justify-between py-3 border-b border-gray-700">
                <span class="text-gray-400">Invitation Code</span>
                <span class="font-mono">{user()?.extension_code || '-'}</span>
              </div>
            </div>
          </Show>

          {/* Security Tab */}
          <Show when={activeTab() === 'security'}>
            <h2 class="text-lg font-semibold mb-6">{t('account.security')}</h2>
            
            <div class="space-y-6">
              {/* Set Pay Password */}
              <div class="p-4 bg-dark-300 rounded-lg">
                <h3 class="font-semibold mb-4">{t('account.setPayPassword')}</h3>
                <form onSubmit={handleSetPayPassword} class="space-y-4">
                  <div class="form-group">
                    <label class="form-label">Pay Password (6 digits)</label>
                    <input
                      type="password"
                      class="form-input"
                      maxLength={6}
                      placeholder="Enter 6-digit password"
                      value={payPassword()}
                      onInput={(e) => setPayPassword(e.target.value)}
                    />
                  </div>
                  <div class="form-group">
                    <label class="form-label">Confirm Pay Password</label>
                    <input
                      type="password"
                      class="form-input"
                      maxLength={6}
                      placeholder="Confirm password"
                      value={confirmPayPassword()}
                      onInput={(e) => setConfirmPayPassword(e.target.value)}
                    />
                  </div>
                  <button type="submit" class="btn btn-primary" disabled={loading()}>
                    {loading() ? t('common.loading') : t('common.submit')}
                  </button>
                </form>
              </div>

              {/* 2FA Notice */}
              <div class="p-4 bg-secondary/20 border border-secondary/50 rounded-lg">
                <div class="flex items-center justify-between">
                  <div>
                    <h3 class="font-semibold">Two-Factor Authentication</h3>
                    <p class="text-sm text-gray-400">Add extra security to your account</p>
                  </div>
                  <button class="btn btn-outline">Enable</button>
                </div>
              </div>
            </div>
          </Show>

          {/* Password Tab */}
          <Show when={activeTab() === 'password'}>
            <h2 class="text-lg font-semibold mb-6">{t('account.changePassword')}</h2>
            <form onSubmit={handleChangePassword} class="space-y-4 max-w-md">
              <div class="form-group">
                <label class="form-label">Current Password</label>
                <input
                  type="password"
                  class="form-input"
                  placeholder="Enter current password"
                  value={oldPassword()}
                  onInput={(e) => setOldPassword(e.target.value)}
                />
              </div>
              <div class="form-group">
                <label class="form-label">New Password</label>
                <input
                  type="password"
                  class="form-input"
                  placeholder="Enter new password"
                  value={newPassword()}
                  onInput={(e) => setNewPassword(e.target.value)}
                />
              </div>
              <div class="form-group">
                <label class="form-label">Confirm New Password</label>
                <input
                  type="password"
                  class="form-input"
                  placeholder="Confirm new password"
                  value={confirmPassword()}
                  onInput={(e) => setConfirmPassword(e.target.value)}
                />
              </div>
              <button type="submit" class="btn btn-primary" disabled={loading()}>
                {loading() ? t('common.loading') : t('common.submit')}
              </button>
            </form>
          </Show>
        </div>
      </div>
    </div>
  );
};

export default Account;
