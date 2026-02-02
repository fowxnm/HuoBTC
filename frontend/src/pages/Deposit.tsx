import { Component, createSignal, Show } from 'solid-js';
import { useI18n } from '../contexts/I18nContext';
import { copyToClipboard } from '../utils/api';
import { openNetworksModal } from '../appkit/openAppKit';

const Deposit: Component = () => {
  const { t } = useI18n();
  const [selectedCurrency, setSelectedCurrency] = createSignal('USDT');
  const [selectedNetwork, setSelectedNetwork] = createSignal('TRC20');
  const [copied, setCopied] = createSignal(false);

  const currencies = ['USDT', 'BTC', 'ETH'];
  const networks: Record<string, string[]> = {
    'USDT': ['TRC20', 'ERC20', 'BEP20'],
    'BTC': ['Bitcoin'],
    'ETH': ['ERC20']
  };

  const depositAddress = () => {
    const addresses: Record<string, string> = {
      'USDT-TRC20': 'TXxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
      'USDT-ERC20': '0xXxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
      'USDT-BEP20': '0xXxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
      'BTC-Bitcoin': 'bc1qxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
      'ETH-ERC20': '0xXxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'
    };
    return addresses[`${selectedCurrency()}-${selectedNetwork()}`] || 'Address not available';
  };

  const handleCopy = async () => {
    const success = await copyToClipboard(depositAddress());
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div class="max-w-2xl mx-auto px-4 py-8">
      <h1 class="text-2xl font-bold mb-8">{t('deposit.title')}</h1>

      <div class="card">
        {/* Currency Selection */}
        <div class="mb-6">
          <label class="form-label">{t('deposit.selectCurrency')}</label>
          <div class="flex space-x-3">
            {currencies.map(currency => (
              <button
                class={`px-6 py-3 rounded-lg font-medium transition-colors ${
                  selectedCurrency() === currency 
                    ? 'bg-primary text-dark-400' 
                    : 'bg-dark-300 text-gray-400 hover:bg-dark-200'
                }`}
                onClick={() => {
                  setSelectedCurrency(currency);
                  setSelectedNetwork(networks[currency][0]);
                }}
              >
                {currency}
              </button>
            ))}
          </div>
        </div>

        {/* Network Selection */}
        <div class="mb-6">
          <label class="form-label">Select Network</label>
          <div class="flex space-x-3">
            {networks[selectedCurrency()]?.map(network => (
              <button
                class={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  selectedNetwork() === network 
                    ? 'bg-secondary text-dark-400' 
                    : 'bg-dark-300 text-gray-400 hover:bg-dark-200'
                }`}
                onClick={() => setSelectedNetwork(network)}
              >
                {network}
              </button>
            ))}
          </div>
          {selectedCurrency() === 'USDT' && selectedNetwork() === 'TRC20' && (
            <p class="mt-2 text-sm text-primary flex items-center gap-2">
              <span>操作 USDT-TRC20 请切换到 Tron 网络</span>
              <button type="button" class="underline" onClick={() => openNetworksModal()}>切换网络</button>
            </p>
          )}
        </div>

        {/* Deposit Address */}
        <div class="mb-6">
          <label class="form-label">{t('deposit.address')}</label>
          <div class="bg-dark-300 rounded-lg p-4">
            <div class="flex items-center justify-between">
              <span class="font-mono text-sm break-all">{depositAddress()}</span>
              <button
                class="ml-4 text-primary hover:text-primary/80"
                onClick={handleCopy}
              >
                <Show when={copied()} fallback={
                  <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                }>
                  <svg class="w-5 h-5 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                  </svg>
                </Show>
              </button>
            </div>
          </div>
        </div>

        {/* QR Code */}
        <div class="mb-6">
          <label class="form-label">{t('deposit.qrCode')}</label>
          <div class="bg-white p-4 rounded-lg inline-block">
            <div class="w-48 h-48 bg-gray-200 flex items-center justify-center text-gray-500">
              QR Code
            </div>
          </div>
        </div>

        {/* Notice */}
        <div class="bg-secondary/20 border border-secondary/50 rounded-lg p-4">
          <div class="flex items-start space-x-3">
            <svg class="w-5 h-5 text-secondary flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div class="text-sm">
              <p class="font-semibold text-secondary mb-1">Important Notice</p>
              <ul class="text-gray-400 space-y-1">
                <li>• Only send {selectedCurrency()} to this address</li>
                <li>• Sending other assets may result in permanent loss</li>
                <li>• Minimum deposit: 10 {selectedCurrency()}</li>
                <li>• Deposits require 12 network confirmations</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Deposit;
