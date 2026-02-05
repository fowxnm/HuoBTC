/**
 * 交易模式快捷切换栏
 * 现货 / 杠杆 / 秒合约
 */
import { Component } from 'solid-js';
import { A, useLocation } from '@solidjs/router';
import { useI18n } from '../contexts/I18nContext';
import { useTrading } from '../contexts/TradingContext';

interface TradingMode {
  key: 'spot' | 'leverage' | 'seconds';
  path: string;
  labelKey: string;
}

const TradingModeSwitch: Component = () => {
  const location = useLocation();
  const { t } = useI18n();
  const { activePair } = useTrading();
  
  const pair = () => activePair() || 'BTC-USDT';
  
  const modes: TradingMode[] = [
    { key: 'spot', path: `/trade/${pair()}`, labelKey: 'trade.spot' },
    { key: 'leverage', path: `/leverage/${pair()}`, labelKey: 'trade.leverage' },
    { key: 'seconds', path: `/seconds-contract/${pair()}`, labelKey: 'trade.seconds' },
  ];
  
  const isActive = (mode: TradingMode) => {
    if (mode.key === 'spot') return location.pathname.startsWith('/trade');
    if (mode.key === 'leverage') return location.pathname.startsWith('/leverage');
    if (mode.key === 'seconds') return location.pathname.startsWith('/seconds-contract');
    return false;
  };
  
  return (
    <div class="trading-mode-switch flex items-center gap-1 bg-[#1e2329] rounded-lg p-1 border border-[#2c2c3e]">
      {modes.map((mode) => (
        <A
          href={mode.path}
          class={`flex-1 px-3 py-1.5 text-center text-xs font-medium rounded transition-all ${
            isActive(mode)
              ? 'bg-primary text-black'
              : 'text-gray-400 hover:text-white hover:bg-[#2c2c3e]'
          }`}
        >
          {t(mode.labelKey as any) || mode.labelKey}
        </A>
      ))}
    </div>
  );
};

export default TradingModeSwitch;
