/**
 * 加密货币图标：主用 jsDelivr CDN（专为嵌入设计），失败再试 CoinGecko/Binance 直链 → cryptoicons → 透明图
 */

const BINANCE_ICO = 'https://bin.bnbstatic.com/static/images/common/cryptocurrency/ico';
/** Binance 图标路径与 symbol 不一致的映射 */
const BINANCE_MAP: Record<string, string> = {
  APT: 'aptos', ARB: 'arbitrum', OP: 'optimism', INJ: 'injective', SUI: 'sui', SEI: 'sei',
  BLUR: 'blur', PEPE: 'pepe', WLD: 'world', JUP: 'jupiter', STRK: 'starknet', PIXEL: 'pixel',
  PORTAL: 'portal', MEME: 'meme', ORDI: 'ordi', JTO: 'jto', MANTA: 'manta', ALT: 'altlayer',
  AEVO: 'aevo', ETHFI: 'ethfi', BOME: 'bome', TAO: 'bittensor', SAGA: 'saga', W: 'wormhole',
};

/** 常用币 CoinGecko 大图直链（可被 img 直接加载，允许外链） */
const COINGECKO_COMMON: Record<string, string> = {
  BTC: 'https://assets.coingecko.com/coins/images/1/large/bitcoin.png',
  ETH: 'https://assets.coingecko.com/coins/images/279/large/ethereum.png',
  BNB: 'https://assets.coingecko.com/coins/images/825/large/bnb-icon2_2x.png',
  SOL: 'https://assets.coingecko.com/coins/images/4128/large/solana.png',
  XRP: 'https://assets.coingecko.com/coins/images/44/large/xrp-symbol-white-128.png',
  DOGE: 'https://assets.coingecko.com/coins/images/5/large/dogecoin.png',
  ADA: 'https://assets.coingecko.com/coins/images/975/large/cardano.png',
  AVAX: 'https://assets.coingecko.com/coins/images/12559/large/Avalanche_Circle_RedWhite_Trans.png',
  DOT: 'https://assets.coingecko.com/coins/images/12171/large/polkadot.png',
  MATIC: 'https://assets.coingecko.com/coins/images/4713/large/matic-token-icon.png',
  LINK: 'https://assets.coingecko.com/coins/images/877/large/chainlink-new-logo.png',
  UNI: 'https://assets.coingecko.com/coins/images/12504/large/uni.jpg',
  ATOM: 'https://assets.coingecko.com/coins/images/1481/large/cosmos_hub.png',
  LTC: 'https://assets.coingecko.com/coins/images/2/large/litecoin.png',
  BCH: 'https://assets.coingecko.com/coins/images/780/large/bitcoin-cash-circle.png',
  ETC: 'https://assets.coingecko.com/coins/images/453/large/ethereum-classic-logo.png',
  FIL: 'https://assets.coingecko.com/coins/images/12817/large/filecoin.png',
  TRX: 'https://assets.coingecko.com/coins/images/1094/large/tron-logo.png',
  USDT: 'https://assets.coingecko.com/coins/images/325/large/Tether.png',
  USDC: 'https://assets.coingecko.com/coins/images/6319/large/usdc.png',
};

/** 这些币在 Binance 路径常不可用，优先用 CoinGecko 大图直链（可被 img 直接加载） */
const COINGECKO_ICON: Record<string, string> = {
  APT: 'https://assets.coingecko.com/coins/images/26455/large/Aptos-Network-Symbol-Black-RGB-1x.png',
  ARB: 'https://assets.coingecko.com/coins/images/16547/large/arb.jpg',
  OP: 'https://assets.coingecko.com/coins/images/25244/large/Optimism.png',
  INJ: 'https://assets.coingecko.com/coins/images/12882/large/Other_200x200.png',
  SUI: 'https://assets.coingecko.com/coins/images/26375/large/sui-ocean-square.png',
  SEI: 'https://assets.coingecko.com/coins/images/28205/large/Sei_Logo_-_Transparent.png',
  NEAR: 'https://assets.coingecko.com/coins/images/10365/large/near.jpg',
  FTM: 'https://assets.coingecko.com/coins/images/4001/large/Fantom_round.png',
  AXS: 'https://assets.coingecko.com/coins/images/13029/large/axie_infinity_logo.png',
  FLOW: 'https://assets.coingecko.com/coins/images/13446/large/5f6294c0c7a8cda55cb1c936_Flow_Wordmark.png',
  LDO: 'https://assets.coingecko.com/coins/images/13573/large/Lido_DAO.png',
  IMX: 'https://assets.coingecko.com/coins/images/17233/large/immutable-x.png',
  ROSE: 'https://assets.coingecko.com/coins/images/12171/large/rose.png',
  KAVA: 'https://assets.coingecko.com/coins/images/4526/large/kava.png',
  HBAR: 'https://assets.coingecko.com/coins/images/3688/large/hbar.png',
  EGLD: 'https://assets.coingecko.com/coins/images/6892/large/egld.png',
  RUNE: 'https://assets.coingecko.com/coins/images/4157/large/rune.png',
  BLUR: 'https://assets.coingecko.com/coins/images/23121/large/blur.png',
  PEPE: 'https://assets.coingecko.com/coins/images/29850/large/pepe-token.jpeg',
  WLD: 'https://assets.coingecko.com/coins/images/22861/large/worldcoin.jpeg',
  JUP: 'https://assets.coingecko.com/coins/images/29204/large/jup.png',
  STRK: 'https://assets.coingecko.com/coins/images/22691/large/starknet.png',
  PIXEL: 'https://assets.coingecko.com/coins/images/23539/large/pixel.png',
  PORTAL: 'https://assets.coingecko.com/coins/images/29504/large/portal.png',
  MEME: 'https://assets.coingecko.com/coins/images/28301/large/meme.png',
  ORDI: 'https://assets.coingecko.com/coins/images/30162/large/ordi.png',
  JTO: 'https://assets.coingecko.com/coins/images/29202/large/jto.png',
  MANTA: 'https://assets.coingecko.com/coins/images/16931/large/manta.png',
  ALT: 'https://assets.coingecko.com/coins/images/27441/large/altlayer.png',
  AEVO: 'https://assets.coingecko.com/coins/images/31104/large/aevo.png',
  ETHFI: 'https://assets.coingecko.com/coins/images/32334/large/ether-fi.png',
  BOME: 'https://assets.coingecko.com/coins/images/28696/large/bome.png',
  TAO: 'https://assets.coingecko.com/coins/images/28452/large/bittensor.png',
  SAGA: 'https://assets.coingecko.com/coins/images/28673/large/saga.png',
  W: 'https://assets.coingecko.com/coins/images/25251/large/wormhole.png',
  XLM: 'https://assets.coingecko.com/coins/images/100/large/Stellar_symbol_black_RGB.png',
  XML: 'https://assets.coingecko.com/coins/images/100/large/Stellar_symbol_black_RGB.png', // Stellar 别名
};

const JSDELIVR_BASE = 'https://cdn.jsdelivr.net/npm/cryptocurrency-icons@0.18.1/128/color';
const JSDELIVR_GENERIC = `${JSDELIVR_BASE}/generic.png`;
const CRYPTOICONS_BASE = 'https://cryptoicons.org/api/icon';
/** 1x1 透明 PNG，最终回退避免裂图 */
const TRANSPARENT_PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

/** jsDelivr cryptocurrency-icons 中文件名与 symbol 不一致的映射（XLM/XML 用 xlm，保证 Stellar 图标显示） */
const JSDELIVR_ALIAS: Record<string, string> = {
  '1INCH': '1inch',
  POL: 'matic-network',
  WLD: 'worldcoin',
  LDO: 'lido-dao',
  INJ: 'injective-protocol',
  SEI: 'sei-network',
  EGLD: 'elrond',
  JUP: 'jupiter-exchange-solana',
  TAO: 'bittensor',
  XLM: 'xlm',
  XML: 'xlm', // Stellar 别名
};

function symbolToKey(symbol: string): string {
  return (symbol || '').toUpperCase().replace(/[-/].*$/, '').trim() || 'BTC';
}

function symbolToLower(symbol: string): string {
  return (symbol || '').toLowerCase().replace(/[-/].*$/, '').trim() || '';
}

const rawApiBase = typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL;
const API_BASE = (rawApiBase && String(rawApiBase).trim()) ? String(rawApiBase).trim().replace(/\/$/, '') : '';
const API_COIN_ICON = API_BASE ? `${API_BASE}/api/coin-icon` : '/api/coin-icon';

/** 主用：常用币用 CoinGecko 直链（最稳），其余用 jsDelivr；失败时 onError 会试直链 → cryptoicons */
export function getCoinIcon(symbol: string, _logoFromApi?: string | null): string {
  const key = symbolToKey(symbol);
  if (COINGECKO_COMMON[key]) return COINGECKO_COMMON[key];
  return getCoinIconJsDelivr(symbol);
}

/** 回退用：直链（CoinGecko 常用币 → CoinGecko 特殊映射 → Binance），需配合 img referrerPolicy="no-referrer" */
export function getCoinIconDirect(symbol: string): string {
  const key = symbolToKey(symbol);
  const common = COINGECKO_COMMON[key];
  if (common) return common;
  const cg = COINGECKO_ICON[key];
  if (cg) return cg;
  const binanceKey = BINANCE_MAP[key] ?? key.toLowerCase();
  return `${BINANCE_ICO}/${binanceKey}@2x.png`;
}

/** 回退：jsDelivr cryptocurrency-icons（包内文件名为小写 symbol，少数用 JSDELIVR_ALIAS） */
export function getCoinIconJsDelivr(symbol: string): string {
  const upper = symbolToKey(symbol);
  const lower = symbolToLower(symbol);
  const alias = JSDELIVR_ALIAS[upper] ?? lower;
  return `${JSDELIVR_BASE}/${alias}.png`;
}

/** 第三回退：cryptoicons.org（小写 symbol，如 apt/arb/sui） */
function getCoinIconCryptoIcons(symbol: string): string {
  const key = symbolToLower(symbol);
  return `${CRYPTOICONS_BASE}/${key}/200`;
}

/** onError：先试直链(no-referrer) → jsDelivr → cryptoicons → generic → 透明图 */
export function onIconError(e: Event, symbol?: string): void {
  const el = e.target as HTMLImageElement;
  if (!el) return;
  const sym = symbol ?? (el.dataset?.symbol ?? '');
  const level = el.dataset?.fallbackLevel ?? '0';
  if (level === '3') {
    el.src = TRANSPARENT_PNG;
    el.alt = sym || '?';
    el.dataset.fallbackLevel = '4';
    el.onerror = null;
    return;
  }
  if (level === '2') {
    el.src = JSDELIVR_GENERIC;
    el.alt = sym || '?';
    el.dataset.fallbackLevel = '3';
    el.onerror = () => {
      el.src = TRANSPARENT_PNG;
      el.alt = sym || '?';
      el.dataset.fallbackLevel = '4';
      el.onerror = null;
    };
    return;
  }
  if (level === '1') {
    el.dataset.fallbackLevel = '1c';
    el.src = getCoinIconJsDelivr(sym);
    el.onerror = () => {
      onIconError({ target: el } as Event, sym);
    };
    return;
  }
  if (level === '1c') {
    el.dataset.fallbackLevel = '2';
    el.src = getCoinIconCryptoIcons(sym);
    el.onerror = () => {
      onIconError({ target: el } as Event, sym);
    };
    return;
  }
  if (level === '0') {
    el.dataset.fallbackLevel = '1';
    el.referrerPolicy = 'no-referrer';
    el.src = getCoinIconDirect(sym);
    el.onerror = () => {
      onIconError({ target: el } as Event, sym);
    };
    return;
  }
  el.dataset.fallbackLevel = '1';
  el.src = getCoinIconJsDelivr(sym);
  el.onerror = () => {
    onIconError({ target: el } as Event, sym);
  };
}

/** 非币种场景占位（如市场页标题），用直链保证有图 */
export const FALLBACK_PNG = getCoinIconDirect('BTC');
