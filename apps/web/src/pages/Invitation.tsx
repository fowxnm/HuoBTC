import { Component, createSignal, onMount, Show } from 'solid-js';
import { useI18n } from '../contexts/I18nContext';
import { useAuth } from '../contexts/AuthContext';
import { copyToClipboard } from '../utils/api';
import { openConnectModal } from '../appkit/openAppKit';
import { formatFiatPrice } from '../utils/priceLocale';

const Invitation: Component = () => {
  const { t, locale } = useI18n();
  const { user, isLoggedIn } = useAuth();

  const [copied, setCopied] = createSignal(false);
  const [invitedCount, setInvitedCount] = createSignal(0);
  const [totalReward, setTotalReward] = createSignal(0);

  const inviteCode = () => user()?.extension_code || 'XXXXXX';
  const inviteLink = () => `${window.location.origin}/register?extension_code=${inviteCode()}`;

  onMount(async () => {
    // 从 API 获取真实邀请数据
    try {
      // TODO: 对接真实的邀请统计 API
      // const response = await api.get('/api/user/invitationStats');
      // if (response.type === 'ok') {
      //   setInvitedCount(response.data.count);
      //   setTotalReward(response.data.reward);
      // }
      
      // 暂时显示 0，等待 API 对接
      setInvitedCount(0);
      setTotalReward(0);
    } catch (error) {
      console.error('Failed to fetch invitation stats:', error);
    }
  });

  const handleCopyCode = async () => {
    const success = await copyToClipboard(inviteCode());
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleCopyLink = async () => {
    const success = await copyToClipboard(inviteLink());
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (!isLoggedIn()) {
    return (
      <div class="max-w-4xl mx-auto px-4 py-12 text-center">
        <p class="text-gray-400 mb-4">{t('common.pleaseConnectBefore')}<button type="button" class="text-primary cursor-pointer hover:underline bg-transparent border-none p-0 inline" onClick={() => openConnectModal()}>{t('common.connectWallet')}</button>{t('common.pleaseConnectAfter')}</p>
        <button type="button" class="btn btn-primary" onClick={() => openConnectModal()}>{t('common.connectWallet')}</button>
      </div>
    );
  }

  return (
    <div class="max-w-4xl mx-auto px-4 py-8">
      <h1 class="text-2xl font-bold mb-8">{t('invitation.title')}</h1>

      {/* Stats Cards */}
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div class="card bg-gradient-to-br from-primary/20 to-primary/5">
          <div class="flex items-center space-x-4">
            <div class="w-14 h-14 bg-primary/30 rounded-full flex items-center justify-center">
              <svg class="w-7 h-7 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <div>
              <p class="text-sm text-gray-400">{t('invitation.invitedUsers')}</p>
              <p class="text-3xl font-bold">{invitedCount()}</p>
            </div>
          </div>
        </div>

        <div class="card bg-gradient-to-br from-success/20 to-success/5">
          <div class="flex items-center space-x-4">
            <div class="w-14 h-14 bg-success/30 rounded-full flex items-center justify-center">
              <svg class="w-7 h-7 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p class="text-sm text-gray-400">{t('invitation.totalReward')}</p>
              <p class="text-3xl font-bold">${totalReward().toFixed(2)}</p>
              <p class="text-sm text-gray-400 mt-1">{formatFiatPrice(locale(), totalReward())}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Invitation Code */}
      <div class="card mb-8">
        <h2 class="text-lg font-semibold mb-6">{t('invitation.yourCode')}</h2>
        
        <div class="bg-dark-300 rounded-lg p-6 mb-6">
          <div class="text-center">
            <p class="text-sm text-gray-400 mb-2">Your Invitation Code</p>
            <p class="text-4xl font-mono font-bold text-primary tracking-widest mb-4">
              {inviteCode()}
            </p>
            <button
              class="btn btn-primary"
              onClick={handleCopyCode}
            >
              <Show when={copied()} fallback={
                <>
                  <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  Copy Code
                </>
              }>
                <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                </svg>
                Copied!
              </Show>
            </button>
          </div>
        </div>

        {/* Invite Link */}
        <div class="mb-6">
          <label class="form-label">Invitation Link</label>
          <div class="flex space-x-2">
            <input
              type="text"
              class="form-input flex-1"
              value={inviteLink()}
              readonly
            />
            <button
              class="btn btn-outline"
              onClick={handleCopyLink}
            >
              {t('invitation.copyLink')}
            </button>
          </div>
        </div>

        {/* Share Buttons */}
        <div class="flex space-x-4">
          <button class="flex-1 btn bg-[#25D366] hover:bg-[#25D366]/90 text-white">
            <svg class="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 24 24">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
            </svg>
            WhatsApp
          </button>
          <button class="flex-1 btn bg-[#1DA1F2] hover:bg-[#1DA1F2]/90 text-white">
            <svg class="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 24 24">
              <path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z"/>
            </svg>
            Twitter
          </button>
          <button class="flex-1 btn bg-[#0088cc] hover:bg-[#0088cc]/90 text-white">
            <svg class="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 24 24">
              <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
            </svg>
            Telegram
          </button>
        </div>
      </div>

      {/* How It Works */}
      <div class="card">
        <h2 class="text-lg font-semibold mb-6">How It Works</h2>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div class="text-center">
            <div class="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <span class="text-2xl font-bold text-primary">1</span>
            </div>
            <h3 class="font-semibold mb-2">Share Your Code</h3>
            <p class="text-sm text-gray-400">Share your unique invitation code with friends</p>
          </div>
          <div class="text-center">
            <div class="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <span class="text-2xl font-bold text-primary">2</span>
            </div>
            <h3 class="font-semibold mb-2">{t('invitation.step2Title')}</h3>
            <p class="text-sm text-gray-400">{t('invitation.step2Desc')}</p>
          </div>
          <div class="text-center">
            <div class="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <span class="text-2xl font-bold text-primary">3</span>
            </div>
            <h3 class="font-semibold mb-2">Earn Rewards</h3>
            <p class="text-sm text-gray-400">Get commission from their trading activity</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Invitation;
