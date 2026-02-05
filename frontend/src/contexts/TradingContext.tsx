/**
 * 全局交易上下文：当前交易对 + 模拟资产余额（localStorage 持久化）+ 全交易页共用币种列表
 * K 线、订单簿、成交记录、交易表单、资产面板均监听 activePair 与 balances
 * 现货/杠杆/秒合约共用 marketList，定时刷新，币种同步
 */

import { createContext, useContext, createSignal, ParentComponent, Accessor, onMount } from 'solid-js';
import { api } from '../utils/api';

const BALANCES_STORAGE_KEY = 'trade_balances';

/** 交易页左侧列表行类型（与 /api/market/quotation 一致） */
export interface MarketRow {
  currency_id: number;
  currency_name: string;
  legal_id: number;
  legal_name: string;
  now_price: number;
  change: number;
  high?: number;
  low?: number;
  volume?: number;
  logo?: string;
}

const DEFAULT_SYMBOLS = [
  'BTC', 'ETH', 'BNB', 'SOL', 'XRP', 'DOGE', 'ADA', 'AVAX', 'DOT', 'MATIC', 'LINK', 'UNI', 'ATOM', 'LTC', 'BCH', 'ETC', 'XLM', 'FIL', 'TRX',
  'ARB', 'OP', 'INJ', 'SUI', 'SEI', 'NEAR', 'FTM', 'AAVE', 'CRV', 'MKR', 'SNX', 'COMP', 'SUSHI', 'YFI', 'SAND', 'MANA', 'AXS', 'ENJ', 'CHZ',
  'FLOW', 'ICP', 'VET', 'ALGO', 'EOS', 'XTZ', 'THETA', 'GRT', 'BAT', 'ZRX', '1INCH', 'LDO', 'ZEC', 'DASH', 'HBAR', 'GMT', 'APE', 'PEPE', 'ORDI',
];

export const DEFAULT_MARKET_LIST: MarketRow[] = DEFAULT_SYMBOLS.map((name, i) => ({
  currency_id: i + 1,
  currency_name: name,
  legal_id: 3,
  legal_name: 'USDT',
  now_price: 0,
  change: 0,
  high: 0,
  low: 0,
  volume: 0,
}));

/** 合并新行情到当前列表：按 currency_name 原地更新价格等；已有 logo 不覆盖，避免图标闪烁 */
function mergeMarketListInPlace(current: MarketRow[], incoming: MarketRow[]): void {
  const byName = new Map(incoming.map((i) => [i.currency_name, i]));
  for (const c of current) {
    const n = byName.get(c.currency_name);
    if (n) {
      c.now_price = n.now_price;
      c.change = n.change;
      if (n.high != null) c.high = n.high;
      if (n.low != null) c.low = n.low;
      if (n.volume != null) c.volume = n.volume;
      if (!c.logo && n.logo != null) c.logo = n.logo;
    }
  }
  const currentNames = new Set(current.map((i) => i.currency_name));
  for (const n of incoming) {
    if (!currentNames.has(n.currency_name)) {
      current.push(n);
      currentNames.add(n.currency_name);
    }
  }
}

function loadBalances(): Record<string, number> {
  try {
    const raw = localStorage.getItem(BALANCES_STORAGE_KEY);
    if (!raw) return getDefaultBalances();
    const parsed = JSON.parse(raw) as Record<string, number>;
    return { ...getDefaultBalances(), ...parsed };
  } catch {
    return getDefaultBalances();
  }
}

function getDefaultBalances(): Record<string, number> {
  return {
    USDT: 0,
    BTC: 0,
    ETH: 0,
    BNB: 0,
    SOL: 0,
    XRP: 0,
    DOGE: 0,
    ADA: 0,
    AVAX: 0,
    DOT: 0,
    MATIC: 0,
    LINK: 0,
    UNI: 0,
    ATOM: 0,
    LTC: 0,
    BCH: 0,
  };
}

function persistBalances(bal: Record<string, number>) {
  try {
    localStorage.setItem(BALANCES_STORAGE_KEY, JSON.stringify(bal));
  } catch {}
}

interface TradingContextType {
  activePair: Accessor<string>;
  setActivePair: (pair: string) => void;
  activeSymbol: Accessor<string>;
  quoteCurrency: Accessor<string>;
  balances: Accessor<Record<string, number>>;
  setBalance: (currency: string, value: number) => void;
  updateBalances: (updates: Record<string, number>) => void;
  getBalance: (currency: string) => number;
  marketList: Accessor<MarketRow[]>;
  refreshQuotation: () => Promise<void>;
}

const TradingContext = createContext<TradingContextType>();

export const TradingProvider: ParentComponent = (props) => {
  const [activePair, setActivePair] = createSignal('BTC-USDT');
  const [balances, setBalances] = createSignal<Record<string, number>>(loadBalances());
  const [marketList, setMarketList] = createSignal<MarketRow[]>(DEFAULT_MARKET_LIST);

  const refreshQuotation = async () => {
    try {
      const quotationRes = await api.get('/api/market/quotation');
      const list = quotationRes.type === 'ok' && Array.isArray(quotationRes.data) ? (quotationRes.data as MarketRow[]) : [];
      const usdtFromQuotation = list.filter((m) => m.legal_name === 'USDT' && m.currency_name !== 'USDT');
      if (usdtFromQuotation.length === 0) return;
      const current = marketList();
      if (current.length > 0) {
        mergeMarketListInPlace(current, list);
        setMarketList([...current]);
      } else {
        setMarketList(list);
      }
    } catch (_) {}
  };

  onMount(() => {
    refreshQuotation();
    const tick = setInterval(refreshQuotation, 5000);
    return () => clearInterval(tick);
  });

  const activeSymbol = () => {
    const p = activePair().split('-')[0];
    return p || 'BTC';
  };
  const quoteCurrency = () => {
    const p = activePair().split('-')[1];
    return p || 'USDT';
  };

  const setBalance = (currency: string, value: number) => {
    setBalances((prev) => {
      const next = { ...prev, [currency]: Math.max(0, value) };
      persistBalances(next);
      return next;
    });
  };

  const updateBalances = (deltas: Record<string, number>) => {
    setBalances((prev) => {
      const next = { ...prev };
      for (const [k, delta] of Object.entries(deltas)) {
        const cur = next[k] ?? 0;
        next[k] = Math.max(0, cur + delta);
      }
      persistBalances(next);
      return next;
    });
  };

  const getBalance = (currency: string) => balances()[currency] ?? 0;

  return (
    <TradingContext.Provider
      value={{
        activePair,
        setActivePair,
        activeSymbol,
        quoteCurrency,
        balances,
        setBalance,
        updateBalances,
        getBalance,
        marketList,
        refreshQuotation,
      }}
    >
      {props.children}
    </TradingContext.Provider>
  );
};

export const useTrading = () => {
  const ctx = useContext(TradingContext);
  if (!ctx) throw new Error('useTrading must be used within TradingProvider');
  return ctx;
};
