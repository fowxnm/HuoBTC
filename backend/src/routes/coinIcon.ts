/**
 * 币种图标代理：同源 GET /api/coin-icon/:symbol，后端从 CoinGecko/Binance 拉图返回，避免前端跨域/裂图
 */
import { Elysia } from 'elysia';

const BINANCE_ICO = 'https://bin.bnbstatic.com/static/images/common/cryptocurrency/ico';
const FETCH_OPTIONS: RequestInit = {
  headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' },
  signal: AbortSignal.timeout(8000),
};

/** symbol -> CoinGecko 大图 URL */
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

const BINANCE_MAP: Record<string, string> = {
  APT: 'aptos', ARB: 'arbitrum', OP: 'optimism', INJ: 'injective', SUI: 'sui', SEI: 'sei',
  BLUR: 'blur', PEPE: 'pepe', WLD: 'world', JUP: 'jupiter', STRK: 'starknet', PIXEL: 'pixel',
  PORTAL: 'portal', MEME: 'meme', ORDI: 'ordi', JTO: 'jto', MANTA: 'manta', ALT: 'altlayer',
  AEVO: 'aevo', ETHFI: 'ethfi', BOME: 'bome', TAO: 'bittensor', SAGA: 'saga', W: 'wormhole',
  XLM: 'xlm',
  XML: 'xlm', // Stellar 别名
};

function symbolKey(s: string): string {
  return (s || '').toUpperCase().replace(/[-/].*$/, '').trim() || 'BTC';
}

function getIconUrls(symbol: string): string[] {
  const key = symbolKey(symbol);
  const urls: string[] = [];
  const cg = COINGECKO_ICON[key];
  if (cg) urls.push(cg);
  const binanceKey = BINANCE_MAP[key] ?? key.toLowerCase();
  urls.push(`${BINANCE_ICO}/${binanceKey}@2x.png`);
  return urls;
}

async function fetchImage(url: string): Promise<{ buf: ArrayBuffer; contentType: string } | null> {
  try {
    const res = await fetch(url, FETCH_OPTIONS);
    if (!res.ok) return null;
    const buf = await res.arrayBuffer();
    if (buf.byteLength === 0) return null;
    const contentType = res.headers.get('content-type')?.split(';')[0]?.trim() || 'image/png';
    return { buf, contentType };
  } catch {
    return null;
  }
}

/** 1x1 透明 PNG，拉图全部失败时返回 200 避免前端 404 裂图 */
const FALLBACK_PNG_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

export const coinIconRoutes = new Elysia()
  .get('/coin-icon/:symbol', async ({ params }) => {
    const symbol = (params.symbol || 'BTC').replace(/[^a-zA-Z0-9]/g, '');
    if (!symbol) {
      const buf = Buffer.from(FALLBACK_PNG_BASE64, 'base64');
      return new Response(buf, {
        status: 200,
        headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=3600' },
      });
    }
    const urls = getIconUrls(symbol);
    for (const url of urls) {
      const result = await fetchImage(url);
      if (result) {
        return new Response(result.buf, {
          status: 200,
          headers: {
            'Content-Type': result.contentType,
            'Cache-Control': 'public, max-age=86400',
          },
        });
      }
    }
    // 全部失败时仍返回 200 + 透明图，避免前端 404 触发 onerror 链
    const buf = Buffer.from(FALLBACK_PNG_BASE64, 'base64');
    return new Response(buf, {
      status: 200,
      headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=3600' },
    });
  });
