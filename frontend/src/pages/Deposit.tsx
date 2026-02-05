import { Component, createSignal, Show, onMount, For } from 'solid-js';
import { useI18n } from '../contexts/I18nContext';
import { useAuth } from '../contexts/AuthContext';
import { copyToClipboard, api } from '../utils/api';

interface PaymentMethod {
  id: string;
  name: string;
  chain: string;
  address: string;
  qrCode: string;
  minAmount: number;
  maxAmount: number;
}

const Deposit: Component = () => {
  const { t } = useI18n();
  const { isLoggedIn } = useAuth();
  const [paymentMethods, setPaymentMethods] = createSignal<PaymentMethod[]>([]);
  const [selectedMethod, setSelectedMethod] = createSignal<PaymentMethod | null>(null);
  const [copied, setCopied] = createSignal(false);
  const [loading, setLoading] = createSignal(true);
  const [dropdownOpen, setDropdownOpen] = createSignal(false);
  
  // 手动提交充值
  const [depositAmount, setDepositAmount] = createSignal('');
  const [txHash, setTxHash] = createSignal('');
  const [proofImage, setProofImage] = createSignal<string>('');
  const [submitting, setSubmitting] = createSignal(false);
  const [submitSuccess, setSubmitSuccess] = createSignal(false);
  const [submitError, setSubmitError] = createSignal('');

  const fetchDepositConfig = async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/admin/public/deposit-config');
      if (res.type === 'ok' && res.data?.methods?.length > 0) {
        setPaymentMethods(res.data.methods);
        setSelectedMethod(res.data.methods[0]);
      }
    } catch (e) {
      console.error('Failed to fetch deposit config');
    } finally {
      setLoading(false);
    }
  };

  onMount(fetchDepositConfig);

  const depositAddress = () => selectedMethod()?.address || '';
  const depositQrCode = () => selectedMethod()?.qrCode || '';

  const handleCopy = async () => {
    const success = await copyToClipboard(depositAddress());
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const selectMethod = (method: PaymentMethod) => {
    setSelectedMethod(method);
    setDropdownOpen(false);
  };

  // 处理图片上传
  const handleImageUpload = (e: Event) => {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    
    if (file.size > 5 * 1024 * 1024) {
      setSubmitError(t('depositForm.imageTooLarge'));
      return;
    }
    
    const reader = new FileReader();
    reader.onload = () => {
      setProofImage(reader.result as string);
      setSubmitError('');
    };
    reader.readAsDataURL(file);
  };

  // 提交充值申请
  const handleSubmitDeposit = async () => {
    if (!isLoggedIn()) {
      setSubmitError(t('depositForm.loginRequired'));
      return;
    }
    
    const amount = parseFloat(depositAmount());
    if (!amount || amount <= 0) {
      setSubmitError(t('depositForm.invalidAmount'));
      return;
    }
    
    if (!proofImage()) {
      setSubmitError(t('depositForm.screenshotRequired'));
      return;
    }
    
    setSubmitting(true);
    setSubmitError('');
    setSubmitSuccess(false);
    
    try {
      const res = await api.post('/api/deposit/submit', {
        amount,
        chain: selectedMethod()?.chain || 'TRC20',
        currency: selectedMethod()?.name || 'USDT',
        txHash: txHash(),
        proofImage: proofImage(),
        depositAddress: depositAddress(),
      });
      
      if (res.type === 'ok') {
        setSubmitSuccess(true);
        setDepositAmount('');
        setTxHash('');
        setProofImage('');
      } else {
        setSubmitError(res.message as string || t('depositForm.submitFailed'));
      }
    } catch (e) {
      setSubmitError(t('depositForm.submitFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div class="min-h-screen bg-dark-400 px-4 py-6 pb-24">
      <h1 class="text-xl font-bold text-white mb-6">{t('deposit.title')}</h1>

      <Show when={loading()}>
        <div class="bg-dark-300 rounded-xl p-8 text-center text-gray-400">{t('common.loading')}</div>
      </Show>

      <Show when={!loading() && paymentMethods().length === 0}>
        <div class="bg-dark-300 rounded-xl p-8 text-center text-gray-400">
          {t('common.noData')}
        </div>
      </Show>

      <Show when={!loading() && paymentMethods().length > 0}>
        <div class="space-y-4">
          {/* Chain Selector Dropdown */}
          <div>
            <label class="block text-gray-400 text-sm mb-2">{t('deposit.selectCurrency')}</label>
            <div class="relative">
              <button
                class="w-full bg-dark-300 border border-dark-200 rounded-xl px-4 py-3 text-left text-white font-medium flex items-center justify-between"
                onClick={() => setDropdownOpen(!dropdownOpen())}
              >
                <span>{selectedMethod()?.name}-{selectedMethod()?.chain} ({selectedMethod()?.chain})</span>
                <svg class={`w-5 h-5 text-gray-400 transition-transform ${dropdownOpen() ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              
              <Show when={dropdownOpen()}>
                <div class="absolute top-full left-0 right-0 mt-2 bg-dark-300 border border-dark-200 rounded-xl overflow-hidden z-50 shadow-xl">
                  <For each={paymentMethods()}>
                    {(method) => (
                      <button
                        class={`w-full px-4 py-3 text-left hover:bg-dark-200 transition-colors flex items-center justify-between ${
                          selectedMethod()?.id === method.id ? 'bg-primary/20 text-primary' : 'text-white'
                        }`}
                        onClick={() => selectMethod(method)}
                      >
                        <span>{method.name}-{method.chain} ({method.chain})</span>
                        <Show when={selectedMethod()?.id === method.id}>
                          <svg class="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                          </svg>
                        </Show>
                      </button>
                    )}
                  </For>
                </div>
              </Show>
            </div>
          </div>

          {/* Deposit Address */}
          <div>
            <label class="block text-gray-400 text-sm mb-2">{t('deposit.address')}</label>
            <div class="bg-dark-300 border border-dark-200 rounded-xl px-4 py-3">
              <div class="flex items-center gap-3">
                <span class="flex-1 font-mono text-sm text-white break-all leading-relaxed">
                  {depositAddress() || t('common.noData')}
                </span>
                <button
                  class="flex-shrink-0 p-2 bg-dark-200 rounded-lg hover:bg-dark-100 transition-colors"
                  onClick={handleCopy}
                >
                  <Show when={copied()} fallback={
                    <svg class="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  }>
                    <svg class="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                    </svg>
                  </Show>
                </button>
              </div>
            </div>
          </div>

          {/* QR Code */}
          <div>
            <label class="block text-gray-400 text-sm mb-2">{t('deposit.qrCode')}</label>
            <div class="flex justify-center">
              <div class="bg-white p-4 rounded-xl">
                <Show when={depositQrCode()} fallback={
                  <div class="w-48 h-48 bg-gray-100 flex items-center justify-center text-gray-400 text-sm">
                    {t('common.noData')}
                  </div>
                }>
                  <img 
                    src={depositQrCode()} 
                    alt="Deposit QR Code" 
                    class="w-48 h-48 object-contain"
                  />
                </Show>
              </div>
            </div>
          </div>

          {/* Notice */}
          <div class="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4">
            <div class="flex items-start gap-3">
              <svg class="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div class="text-sm">
                <p class="font-semibold text-amber-500 mb-2">Important Notice</p>
                <ul class="text-gray-400 space-y-1.5">
                  <li>• Only send {selectedMethod()?.name || ''}-{selectedMethod()?.chain || ''} to this address</li>
                  <li>• Sending other assets may result in permanent loss</li>
                  <Show when={selectedMethod()?.minAmount}>
                    <li>• Minimum deposit: {selectedMethod()?.minAmount} {selectedMethod()?.name}-{selectedMethod()?.chain}</li>
                  </Show>
                  <Show when={selectedMethod()?.maxAmount && selectedMethod()!.maxAmount > 0}>
                    <li>• Maximum deposit: {selectedMethod()?.maxAmount} {selectedMethod()?.name}-{selectedMethod()?.chain}</li>
                  </Show>
                  <li>• Deposits require network confirmations</li>
                </ul>
              </div>
            </div>
          </div>

          {/* 手动提交充值 */}
          <div class="bg-dark-300 border border-dark-200 rounded-xl p-4 mt-4">
            <h3 class="text-white font-semibold mb-4 flex items-center gap-2">
              <svg class="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {t('depositForm.title')}
            </h3>
            
            <Show when={submitSuccess()}>
              <div class="bg-green-500/20 border border-green-500/50 rounded-lg p-4 mb-4">
                <p class="text-green-400 text-sm">{t('depositForm.success')}</p>
              </div>
            </Show>
            
            <Show when={submitError()}>
              <div class="bg-red-500/20 border border-red-500/50 rounded-lg p-3 mb-4">
                <p class="text-red-400 text-sm">{submitError()}</p>
              </div>
            </Show>

            <div class="space-y-4">
              {/* 充值金额 */}
              <div>
                <label class="block text-gray-400 text-sm mb-2">{t('depositForm.amount')} ({selectedMethod()?.name || 'USDT'})</label>
                <input
                  type="number"
                  value={depositAmount()}
                  onInput={(e) => setDepositAmount(e.currentTarget.value)}
                  placeholder={t('depositForm.amountPlaceholder')}
                  class="w-full bg-dark-400 border border-dark-200 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:border-primary focus:outline-none"
                />
              </div>

              {/* 交易哈希（选填） */}
              <div>
                <label class="block text-gray-400 text-sm mb-2">{t('depositForm.txHash')}</label>
                <input
                  type="text"
                  value={txHash()}
                  onInput={(e) => setTxHash(e.currentTarget.value)}
                  placeholder={t('depositForm.txHashPlaceholder')}
                  class="w-full bg-dark-400 border border-dark-200 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:border-primary focus:outline-none font-mono text-sm"
                />
              </div>

              {/* 上传截图 */}
              <div>
                <label class="block text-gray-400 text-sm mb-2">{t('depositForm.screenshot')}</label>
                <div class="relative">
                  <Show when={proofImage()} fallback={
                    <label class="flex flex-col items-center justify-center w-full h-32 bg-dark-400 border-2 border-dashed border-dark-200 rounded-lg cursor-pointer hover:border-primary/50 transition-colors">
                      <svg class="w-8 h-8 text-gray-500 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <span class="text-gray-500 text-sm">{t('depositForm.uploadScreenshot')}</span>
                      <input type="file" accept="image/*" onChange={handleImageUpload} class="hidden" />
                    </label>
                  }>
                    <div class="relative">
                      <img src={proofImage()} alt="转账截图" class="w-full max-h-48 object-contain rounded-lg" />
                      <button
                        onClick={() => setProofImage('')}
                        class="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                      >
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  </Show>
                </div>
              </div>

              {/* 提交按钮 */}
              <button
                onClick={handleSubmitDeposit}
                disabled={submitting()}
                class="w-full bg-primary text-dark-400 font-semibold py-3 rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {submitting() ? t('depositForm.submitting') : t('depositForm.submit')}
              </button>
              
              <p class="text-gray-500 text-xs text-center">
                {t('depositForm.submitHint')}
              </p>
            </div>
          </div>
        </div>
      </Show>
    </div>
  );
};

export default Deposit;
