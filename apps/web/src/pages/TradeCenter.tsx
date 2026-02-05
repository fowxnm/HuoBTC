/**
 * 交易中心 - 统一入口页
 * 展示后端所有交易模块：现货交易、杠杆交易、秒合约，入口与全局 activePair 闭环
 */
import { Component } from 'solid-js';
import { A } from '@solidjs/router';
import { useI18n } from '../contexts/I18nContext';
import { useTrading } from '../contexts/TradingContext';

const TradeCenter: Component = () => {
  const { t } = useI18n();
  const { activePair } = useTrading();
  const tradePairHref = () => `/trade/${activePair() || 'BTC-USDT'}`;

  const modules = () => [
    { id: 'spot', path: tradePairHref(), titleKey: 'indexHeader.spotTrade' as const, descKey: 'tradeCenter.spotDesc' as const, icon: '📊', api: '/api/trade/*' },
    { id: 'leverage', path: '/leverage', titleKey: 'indexHeader.leverageTrade' as const, descKey: 'tradeCenter.leverageDesc' as const, icon: '⚡', api: '/api/lever/*' },
    { id: 'seconds', path: '/seconds', titleKey: 'indexHeader.secondsTrade' as const, descKey: 'tradeCenter.secondsDesc' as const, icon: '⏱️', api: '/api/micro/*' },
  ];

  return (
    <div class="max-w-5xl mx-auto px-4 py-8">
      <h1 class="text-2xl md:text-3xl font-bold text-white mb-2">{t('indexHeader.tradeCenter')}</h1>
      <p class="text-gray-400 mb-8">{t('tradeCenter.subtitle')}</p>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        {modules().map((mod) => (
          <A
            href={mod.path}
            class="block p-6 rounded-xl bg-[#1e2329] border border-[#2c2c3e] hover:border-[#4dd0e1] hover:bg-[#252a32] transition"
          >
            <div class="flex items-start gap-4">
              <span class="text-3xl">{mod.icon}</span>
              <div class="flex-1 min-w-0">
                <h2 class="text-lg font-semibold text-white mb-1">{t(mod.titleKey)}</h2>
                <p class="text-gray-400 text-sm mb-2">{t(mod.descKey)}</p>
                <span class="text-xs text-gray-500">API: {mod.api}</span>
              </div>
              <span class="text-[#4dd0e1] text-sm font-medium">{t('tradeCenter.enter')}</span>
            </div>
          </A>
        ))}
      </div>
    </div>
  );
};

export default TradeCenter;
