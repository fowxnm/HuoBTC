/**
 * CoinGecko 备用行情源（无 API Key，有频率限制）
 * 仅当 Binance 不可用时使用；香港/台湾以 Binance 国际 API 为主
 */

const COINGECKO_IDS: Record<string, string> = {
  BTC: 'bitcoin',
  ETH: 'ethereum',
  BNB: 'binancecoin',
  SOL: 'solana',
  XRP: 'ripple',
  DOGE: 'dogecoin',
  ADA: 'cardano',
  AVAX: 'avalanche-2',
  DOT: 'polkadot',
  MATIC: 'matic-network',
  LINK: 'chainlink',
  UNI: 'uniswap',
  ATOM: 'cosmos',
  LTC: 'litecoin',
  BCH: 'bitcoin-cash',
  ETC: 'ethereum-classic',
  XLM: 'stellar',
  FIL: 'filecoin',
  TRX: 'tron',
  APT: 'aptos',
  ARB: 'arbitrum',
  OP: 'optimism',
  INJ: 'injective-protocol',
  SUI: 'sui',
  SEI: 'sei-network',
  NEAR: 'near',
  FTM: 'fantom',
  AAVE: 'aave',
  CRV: 'curve-dao-token',
  MKR: 'maker',
  SNX: 'havven',
  COMP: 'compound-governance-token',
  SUSHI: 'sushi',
  YFI: 'yearn-finance',
  SAND: 'the-sandbox',
  MANA: 'decentraland',
  AXS: 'axie-infinity',
  ENJ: 'enjincoin',
  CHZ: 'chiliz',
  FLOW: 'flow',
  ICP: 'internet-computer',
  VET: 'vechain',
  ALGO: 'algorand',
  EOS: 'eos',
  XTZ: 'tezos',
  THETA: 'theta-token',
  GRT: 'the-graph',
  BAT: 'basic-attention-token',
  ZRX: '0x',
  LDO: 'lido-dao',
  IMX: 'immutable-x',
  ROSE: 'oasis-network',
  KAVA: 'kava',
  ZEC: 'zcash',
  DASH: 'dash',
  HBAR: 'hedera-hashgraph',
  EGLD: 'elrond-erd-2',
  RUNE: 'thorchain',
  GMT: 'stepn',
  APE: 'apecoin',
  BLUR: 'blur',
  PEPE: 'pepe',
  WLD: 'worldcoin-wld',
  JUP: 'jupiter-exchange-solana',
  STRK: 'starknet',
  ORDI: 'ordinals',
  JTO: 'jito-governance-token',
  MANTA: 'manta-network',
  ALT: 'altlayer',
  AEVO: 'aevo',
  ETHFI: 'ether-fi',
  TAO: 'bittensor',
  SAGA: 'saga-2',
  W: 'wormhole',
  '1INCH': '1inch',
  PIXEL: 'pixels',
  PORTAL: 'portal-token',
  MEME: 'memecoin',
  BOME: 'book-of-meme',
  USDT: 'tether',
  USDC: 'usd-coin',
};

/** CoinGecko 图片路径 (id/small/slug)，用于前端图标；无则返回空 */
const COINGECKO_IMAGE_PATH: Record<string, string> = {
  BTC: '1/small/bitcoin', ETH: '279/small/ethereum', BNB: '825/small/bnb', SOL: '4128/small/solana', XRP: '44/small/xrp', DOGE: '5/small/dogecoin',
  ADA: '975/small/cardano', AVAX: '12559/small/avalanche-2', DOT: '12171/small/polkadot', MATIC: '4713/small/matic-network', LINK: '877/small/chainlink',
  UNI: '1256/small/uniswap', ATOM: '4486/small/cosmos', LTC: '2/small/litecoin', BCH: '780/small/bitcoin-cash', ETC: '12271/small/ethereum-classic',
  XLM: '100/small/stellar', FIL: '3821/small/filecoin', TRX: '1094/small/tron', APT: '26455/small/aptos', ARB: '16547/small/arbitrum', OP: '25244/small/optimism',
  INJ: '12723/small/injective-protocol', SUI: '26375/small/sui', SEI: '23115/small/sei-network', NEAR: '10365/small/near', FTM: '4001/small/fantom',
  AAVE: '12645/small/aave', CRV: '12124/small/curve-dao-token', MKR: '1364/small/maker', SNX: '3406/small/havven', COMP: '1172/small/compound-governance-token',
  SUSHI: '11976/small/sushi', YFI: '11849/small/yearn-finance', SAND: '12129/small/the-sandbox', MANA: '878/small/decentraland', AXS: '13029/small/axie-infinity',
  ENJ: '1102/small/enjincoin', CHZ: '8834/small/chiliz', FLOW: '13446/small/flow', ICP: '14495/small/internet-computer', VET: '493/small/vechain',
  ALGO: '4380/small/algorand', EOS: '738/small/eos', XTZ: '976/small/tezos', THETA: '2538/small/theta-token', GRT: '3830/small/the-graph',
  BAT: '1496/small/basic-attention-token', ZRX: '863/small/0x', LDO: '13573/small/lido-dao', PEPE: '29850/small/pepe-token', WLD: '28769/small/worldcoin-wld',
  JUP: '34131/small/jupiter-exchange-solana', ORDI: '25757/small/ordinals', RUNE: '4157/small/thorchain', HBAR: '4642/small/hedera-hashgraph',
  USDT: '325/small/tether-usdt', USDC: '6319/small/usd-coin',
};

export function getCoinGeckoImageUrl(symbol: string): string {
  const key = (symbol || '').toUpperCase().replace(/USDT$/, '');
  const path = COINGECKO_IMAGE_PATH[key];
  return path ? `https://assets.coingecko.com/coins/images/${path}.png` : '';
}

export interface CoinGeckoTicker {
  symbol: string;
  lastPrice: string;
  priceChangePercent: string;
  volume: string;
  highPrice: string;
  lowPrice: string;
}

export async function fetchCoinGeckoTickers(
  symbols: string[]
): Promise<CoinGeckoTicker[]> {
  const ids = symbols
    .map((s) => COINGECKO_IDS[s.toUpperCase()])
    .filter(Boolean);
  if (ids.length === 0) return [];

  const idList = ids.join(',');
  const url = `https://api.coingecko.com/api/v3/simple/price?ids=${idList}&vs_currencies=usd&include_24hr_change=true&include_24hr_vol=true&include_high_24h=true&include_low_24h=true`;

  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 10000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(t);
    if (!res.ok) throw new Error(`CoinGecko ${res.status}`);
    const data = (await res.json()) as Record<string, { usd?: number; usd_24h_change?: number; usd_24h_vol?: number; usd_high_24h?: number; usd_low_24h?: number }>;

    const idToSym = Object.fromEntries(
      Object.entries(COINGECKO_IDS).map(([k, v]) => [v, k])
    );

    return Object.entries(data).map(([id, v]) => ({
      symbol: `${idToSym[id] || id}USDT`,
      lastPrice: String(v.usd ?? 0),
      priceChangePercent: String(v.usd_24h_change ?? 0),
      volume: String(v.usd_24h_vol ?? 0),
      highPrice: String(v.usd_high_24h ?? v.usd ?? 0),
      lowPrice: String(v.usd_low_24h ?? v.usd ?? 0),
    }));
  } catch (e) {
    console.warn('[CoinGecko] fetch failed:', (e as Error)?.message);
    return [];
  }
}
