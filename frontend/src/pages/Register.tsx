import { Component, createSignal } from 'solid-js';
import { A, useNavigate, useSearchParams } from '@solidjs/router';
import { useAuth } from '../contexts/AuthContext';
import { useI18n } from '../contexts/I18nContext';

const Register: Component = () => {
  const { register } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [tabIndex, setTabIndex] = createSignal(1); // 0=phone, 1=email
  const [email, setEmail] = createSignal('');
  const [password, setPassword] = createSignal('');
  const [confirmPassword, setConfirmPassword] = createSignal('');
  const [invitationCode, setInvitationCode] = createSignal(searchParams.extension_code || '');
  const [verificationCode, setVerificationCode] = createSignal('');
  const [agree, setAgree] = createSignal(false);
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal('');
  const [countdown, setCountdown] = createSignal(0);

  const handleGetCode = async () => {
    if (countdown() > 0) return;
    if (!email().trim()) {
      setError('Please enter your email');
      return;
    }

    // Start countdown
    setCountdown(60);
    const interval = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(interval);
          return 0;
        }
        return c - 1;
      });
    }, 1000);

    // TODO: Call API to send verification code
  };

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    setError('');

    if (!email().trim()) {
      setError('Please enter your email');
      return;
    }

    if (!password().trim()) {
      setError('Please enter your password');
      return;
    }

    if (password() !== confirmPassword()) {
      setError('Passwords do not match');
      return;
    }

    if (!agree()) {
      setError('Please agree to the terms of service');
      return;
    }

    setLoading(true);

    try {
      const success = await register({
        user_string: email(),
        password: password(),
        re_password: confirmPassword(),
        extension_code: invitationCode(),
        code: verificationCode(),
        type: tabIndex() === 0 ? 'mobile' : 'email'
      });

      if (success) {
        navigate('/login');
      } else {
        setError('Registration failed');
      }
    } catch (err) {
      setError('Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div class="min-h-screen flex items-center justify-center px-4 py-12 bg-gradient-to-br from-dark-300 via-dark-400 to-dark-500">
      <div class="w-full max-w-md">
        <div class="card">
          <div class="text-center mb-8">
            <h1 class="text-2xl font-bold">{t('register.title')}</h1>
            <p class="text-gray-400 mt-2">{t('register.subtitle')}</p>
          </div>

          {/* Tabs */}
          <div class="flex space-x-4 mb-6">
            <button
              class={`flex-1 py-2 rounded-lg font-medium transition-colors ${
                tabIndex() === 0 ? 'bg-primary text-dark-400' : 'bg-dark-300 text-gray-400'
              }`}
              onClick={() => setTabIndex(0)}
            >
              {t('register.phone')}
            </button>
            <button
              class={`flex-1 py-2 rounded-lg font-medium transition-colors ${
                tabIndex() === 1 ? 'bg-primary text-dark-400' : 'bg-dark-300 text-gray-400'
              }`}
              onClick={() => setTabIndex(1)}
            >
              {t('register.email')}
            </button>
          </div>

          {error() && (
            <div class="bg-danger/20 border border-danger/50 text-danger rounded-lg p-3 mb-6">
              {error()}
            </div>
          )}

          <form onSubmit={handleSubmit} class="space-y-4">
            <div class="form-group">
              <label class="form-label">
                {tabIndex() === 0 ? t('register.phone') : t('register.email')}
              </label>
              <input
                type={tabIndex() === 0 ? 'tel' : 'email'}
                class="form-input"
                placeholder={tabIndex() === 0 ? 'Enter phone number' : 'Enter email address'}
                value={email()}
                onInput={(e) => setEmail(e.target.value)}
              />
            </div>

            <div class="form-group">
              <label class="form-label">{t('register.verificationCode')}</label>
              <div class="flex space-x-2">
                <input
                  type="text"
                  class="form-input flex-1"
                  placeholder="Enter code"
                  value={verificationCode()}
                  onInput={(e) => setVerificationCode(e.target.value)}
                />
                <button
                  type="button"
                  class="btn btn-outline whitespace-nowrap"
                  onClick={handleGetCode}
                  disabled={countdown() > 0}
                >
                  {countdown() > 0 ? `${countdown()}s` : t('register.getCode')}
                </button>
              </div>
            </div>

            <div class="form-group">
              <label class="form-label">{t('register.password')}</label>
              <input
                type="password"
                class="form-input"
                placeholder="Enter password"
                value={password()}
                onInput={(e) => setPassword(e.target.value)}
              />
            </div>

            <div class="form-group">
              <label class="form-label">{t('register.confirmPassword')}</label>
              <input
                type="password"
                class="form-input"
                placeholder="Confirm password"
                value={confirmPassword()}
                onInput={(e) => setConfirmPassword(e.target.value)}
              />
            </div>

            <div class="form-group">
              <label class="form-label">{t('register.invitationCode')}</label>
              <input
                type="text"
                class="form-input"
                placeholder="Enter invitation code (optional)"
                value={invitationCode()}
                onInput={(e) => setInvitationCode(e.target.value)}
              />
            </div>

            <div class="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={agree()}
                onChange={(e) => setAgree(e.target.checked)}
                class="w-4 h-4 rounded border-gray-600 bg-dark-300 text-primary focus:ring-primary"
              />
              <span class="text-sm text-gray-400">
                {t('register.agree')}{' '}
                <A href="/terms" class="text-primary hover:underline">
                  {t('register.terms')}
                </A>
              </span>
            </div>

            <button
              type="submit"
              class="btn btn-primary w-full"
              disabled={loading()}
            >
              {loading() ? t('common.loading') : t('register.registerBtn')}
            </button>
          </form>

          <div class="mt-6 text-center">
            <span class="text-gray-400">{t('register.hasAccount')} </span>
            <A href="/login" class="text-primary hover:underline">
              {t('common.login')}
            </A>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Register;
