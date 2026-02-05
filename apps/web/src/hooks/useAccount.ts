/**
 * 统一账户余额与钱包联动 Hook
 * - 未连接：禁止假数据，余额显示为 '--'，raw 为 0
 * - 已连接：从全局账本（TradingContext）读取，全站实时同步
 * 使用方式：balanceDisplay = isConnected ? format(actualBalance) : '--'
 */

import { useAuth } from '../contexts/AuthContext';
import { useTrading } from '../contexts/TradingContext';
import { formatNumber } from '../utils/api';

const PLACEHOLDER = '--';
const PLACEHOLDER_GRAY = '0.00';

export function useAccount() {
  const { isLoggedIn } = useAuth();
  const { getBalance } = useTrading();

  const isConnected = () => isLoggedIn();

  /**
   * 余额展示：未连接时返回 '--'（占位），已连接时返回格式化后的账本余额
   * @param currency 币种符号，如 USDT、BTC
   * @param decimals 小数位数，默认 4
   * @param useGrayZero 未连接时是否显示 0.00 置灰（默认 false，显示 --）
   */
  const getBalanceDisplay = (currency: string, decimals: number = 4, useGrayZero: boolean = false): string => {
    if (!isConnected()) return useGrayZero ? PLACEHOLDER_GRAY : PLACEHOLDER;
    const raw = getBalance(currency);
    return formatNumber(raw, decimals);
  };

  /**
   * 余额数值：未连接时为 0，已连接时为账本中的实际数值（用于校验、下单逻辑）
   */
  const getBalanceRaw = (currency: string): number => {
    if (!isConnected()) return 0;
    return getBalance(currency);
  };

  /**
   * 是否足以支付（含校验：余额 >= 所需）
   */
  const hasSufficientBalance = (currency: string, required: number): boolean => {
    return getBalanceRaw(currency) >= required;
  };

  return {
    isConnected,
    getBalanceDisplay,
    getBalanceRaw,
    hasSufficientBalance,
    balancePlaceholder: PLACEHOLDER,
    balancePlaceholderGray: PLACEHOLDER_GRAY,
  };
}
