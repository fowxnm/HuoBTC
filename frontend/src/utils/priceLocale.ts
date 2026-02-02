/**
 * 根据当前语言/地区显示法币等价价格（≈ 符号 + 币种 + 换算金额）
 */

import type { Language } from '../lang';

export interface FiatConfig {
  symbol: string;
  rate: number;
}

const FIAT_BY_LANG: Record<Language, FiatConfig> = {
  zh: { symbol: '¥', rate: 7 },
  zhHant: { symbol: '¥', rate: 7 },
  en: { symbol: '$', rate: 1 },
  ja: { symbol: '¥', rate: 150 },
  ko: { symbol: '₩', rate: 1300 },
};

export function getFiatConfig(locale: Language): FiatConfig {
  return FIAT_BY_LANG[locale] ?? FIAT_BY_LANG.en;
}

/** USDT 价格 → 显示为 "≈ $75420.72" / "≈ ¥527945.04" 等；无效或 0 时显示 "≈ --" 占位 */
export function formatFiatPrice(locale: Language, usdtPrice: number): string {
  if (usdtPrice == null || Number.isNaN(usdtPrice) || usdtPrice <= 0) {
    const { symbol } = getFiatConfig(locale);
    return `≈ ${symbol}--`;
  }
  const { symbol, rate } = getFiatConfig(locale);
  const value = usdtPrice * rate;
  const formatted = value >= 1000 ? value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : value.toFixed(2);
  return `≈ ${symbol}${formatted}`;
}
