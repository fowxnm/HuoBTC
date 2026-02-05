import { Component, createSignal } from 'solid-js';
import { A, useNavigate } from '@solidjs/router';
import { useAuth } from '../contexts/AuthContext';
import { useI18n } from '../contexts/I18nContext';
import { openConnectModal } from '../appkit/openAppKit';

const Login: Component = () => {
  const { login } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();

  const [account, setAccount] = createSignal('');
  const [password, setPassword] = createSignal('');
  const [remember, setRemember] = createSignal(false);
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal('');

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    setError('');

    if (!account().trim()) {
      setError('Please enter your email or phone');
      return;
    }

    if (!password().trim()) {
      setError('Please enter your password');
      return;
    }

    setLoading(true);

    try {
      const success = await login(account(), password());
      if (success) {
        navigate('/');
      } else {
        setError('Invalid credentials');
      }
    } catch (err) {
      setError('Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div class="min-h-screen flex items-center justify-center px-4 py-12 bg-gradient-to-br from-dark-300 via-dark-400 to-dark-500">
      <div class="w-full max-w-md">
        <div class="card">
          <div class="text-center mb-8">
            <div class="w-16 h-16 bg-primary rounded-xl flex items-center justify-center mx-auto mb-4">
              <span class="text-dark-400 font-bold text-2xl">B</span>
            </div>
            <h1 class="text-2xl font-bold">{t('login.title')}</h1>
            <p class="text-gray-400 mt-2">{t('login.subtitle')}</p>
          </div>

          {error() && (
            <div class="bg-danger/20 border border-danger/50 text-danger rounded-lg p-3 mb-6">
              {error()}
            </div>
          )}

          <form onSubmit={handleSubmit} class="space-y-6">
            <div class="form-group">
              <label class="form-label">{t('login.email')}</label>
              <input
                type="text"
                class="form-input"
                placeholder={t('login.placeholder.email')}
                value={account()}
                onInput={(e) => setAccount(e.target.value)}
              />
            </div>

            <div class="form-group">
              <label class="form-label">{t('login.password')}</label>
              <input
                type="password"
                class="form-input"
                placeholder={t('login.placeholder.password')}
                value={password()}
                onInput={(e) => setPassword(e.target.value)}
              />
            </div>

            <div class="flex items-center justify-between">
              <label class="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={remember()}
                  onChange={(e) => setRemember(e.target.checked)}
                  class="w-4 h-4 rounded border-gray-600 bg-dark-300 text-primary focus:ring-primary"
                />
                <span class="text-sm text-gray-400">{t('login.remember')}</span>
              </label>
              <A href="/forgot-password" class="text-sm text-primary hover:underline">
                {t('login.forgot')}
              </A>
            </div>

            <button
              type="submit"
              class="btn btn-primary w-full"
              disabled={loading()}
            >
              {loading() ? t('common.loading') : t('login.loginBtn')}
            </button>
          </form>

          <div class="mt-6 text-center">
            <span class="text-gray-400">{t('login.noAccount')} </span>
            <A href="/register" class="text-primary hover:underline">
              {t('common.register')}
            </A>
          </div>

          {/* Web3 Login */}
          <div class="mt-8 pt-6 border-t border-gray-700">
            <p class="text-center text-gray-400 text-sm mb-4">Or connect with wallet</p>
            <button type="button" class="btn btn-outline w-full flex items-center justify-center space-x-2" onClick={() => openConnectModal()}>
              <svg class="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M21.8 8.001c0-.66-.532-1.2-1.2-1.2H3.4c-.66 0-1.2.54-1.2 1.2v7.8c0 .66.54 1.2 1.2 1.2h17.2c.668 0 1.2-.54 1.2-1.2v-7.8zm-9.8 5.6c-1.5 0-2.7-1.2-2.7-2.7s1.2-2.7 2.7-2.7 2.7 1.2 2.7 2.7-1.2 2.7-2.7 2.7z"/>
              </svg>
              <span>{t('common.connectWallet')}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
