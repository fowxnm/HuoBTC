import { Component, createSignal } from 'solid-js';
import { useI18n } from '../contexts/I18nContext';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../utils/api';
import { openConnectModal } from '../appkit/openAppKit';
import { formatFiatPrice } from '../utils/priceLocale';

const Withdraw: Component = () => {
  const { t, locale } = useI18n();
  const { isLoggedIn } = useAuth();

  const [selectedCurrency, setSelectedCurrency] = createSignal('USDT');
  const [address, setAddress] = createSignal('');
  const [amount, setAmount] = createSignal('');
  const [payPassword, setPayPassword] = createSignal('');
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal('');

  const currencies = ['USDT', 'BTC', 'ETH'];
  const feeRate = 0.001;

  const fee = () => (parseFloat(amount()) || 0) * feeRate;
  const receive = () => (parseFloat(amount()) || 0) - fee();

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    setError('');

    if (!isLoggedIn()) {
      openConnectModal();
      return;
    }

    if (!address().trim()) {
      setError('Please enter withdrawal address');
      return;
    }

    if (!amount().trim() || parseFloat(amount()) <= 0) {
      setError('Please enter valid amount');
      return;
    }

    if (!payPassword().trim()) {
      setError('Please enter pay password');
      return;
    }

    setLoading(true);

    try {
      const response = await api.post('/api/wallet/postWalletOut', {
        currency: currencies.indexOf(selectedCurrency()) + 1,
        number: parseFloat(amount()),
        address: address(),
        pay_password: payPassword()
      });

      if (response.type === 'ok') {
        alert('Withdrawal request submitted successfully!');
        setAddress('');
        setAmount('');
        setPayPassword('');
      } else {
        setError(response.message || 'Withdrawal failed');
      }
    } catch (err) {
      setError('Withdrawal request failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div class="max-w-2xl mx-auto px-4 py-8">
      <h1 class="text-2xl font-bold mb-8">{t('withdraw.title')}</h1>

      <div class="card">
        {/* Currency Selection */}
        <div class="mb-6">
          <label class="form-label">{t('withdraw.selectCurrency')}</label>
          <div class="flex space-x-3">
            {currencies.map(currency => (
              <button
                class={`px-6 py-3 rounded-lg font-medium transition-colors ${
                  selectedCurrency() === currency 
                    ? 'bg-primary text-dark-400' 
                    : 'bg-dark-300 text-gray-400 hover:bg-dark-200'
                }`}
                onClick={() => setSelectedCurrency(currency)}
              >
                {currency}
              </button>
            ))}
          </div>
        </div>

        {error() && (
          <div class="bg-danger/20 border border-danger/50 text-danger rounded-lg p-3 mb-6">
            {error()}
          </div>
        )}

        <form onSubmit={handleSubmit} class="space-y-6">
          {/* Address */}
          <div class="form-group">
            <label class="form-label">{t('withdraw.address')}</label>
            <input
              type="text"
              class="form-input"
              placeholder={`Enter ${selectedCurrency()} address`}
              value={address()}
              onInput={(e) => setAddress(e.target.value)}
            />
          </div>

          {/* Amount */}
          <div class="form-group">
            <label class="form-label">{t('withdraw.amount')}</label>
            <div class="relative">
              <input
                type="number"
                class="form-input pr-20"
                placeholder="0.00"
                value={amount()}
                onInput={(e) => setAmount(e.target.value)}
              />
              <button
                type="button"
                class="absolute right-3 top-1/2 -translate-y-1/2 text-primary text-sm"
                onClick={() => setAmount('1000')}
              >
                MAX
              </button>
            </div>
            <div class="text-sm text-gray-500 mt-1">
              Available: 1,000.00 {selectedCurrency()}
            </div>
          </div>

          {/* Fee & Receive */}
          <div class="bg-dark-300 rounded-lg p-4 space-y-2">
            <div class="flex justify-between text-sm">
              <span class="text-gray-400">{t('withdraw.fee')}</span>
              <span>{fee().toFixed(8)} {selectedCurrency()}</span>
            </div>
            <div class="flex justify-between text-sm">
              <span class="text-gray-400">{t('withdraw.receive')}</span>
              <span class="text-success font-semibold">{receive().toFixed(8)} {selectedCurrency()}</span>
            </div>
            {selectedCurrency() === 'USDT' && receive() > 0 && (
              <div class="flex justify-between text-xs text-gray-400">
                <span></span>
                <span>{formatFiatPrice(locale(), receive())}</span>
              </div>
            )}
          </div>

          {/* Pay Password */}
          <div class="form-group">
            <label class="form-label">{t('withdraw.payPassword')}</label>
            <input
              type="password"
              class="form-input"
              placeholder="Enter pay password"
              value={payPassword()}
              onInput={(e) => setPayPassword(e.target.value)}
            />
          </div>

          {/* Submit */}
          <button
            type="submit"
            class="btn btn-primary w-full"
            disabled={loading()}
          >
            {loading() ? t('common.loading') : t('withdraw.withdrawBtn')}
          </button>
        </form>

        {/* Notice */}
        <div class="mt-6 bg-secondary/20 border border-secondary/50 rounded-lg p-4">
          <div class="flex items-start space-x-3">
            <svg class="w-5 h-5 text-secondary flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div class="text-sm">
              <p class="font-semibold text-secondary mb-1">Important Notice</p>
              <ul class="text-gray-400 space-y-1">
                <li>• Minimum withdrawal: 10 {selectedCurrency()}</li>
                <li>• Withdrawals are processed within 24 hours</li>
                <li>• Please double-check the address before submitting</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Withdraw;
