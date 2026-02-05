/**
 * Market Worker - 多源采集 (Bun cron)
 * 只定义原生币种（BTC, ETH, TRX...）；请求币安时 toLowerCase() + 'usdt'；Redis/WS 以原生大写为 Key。
 * 启动瞬间立即执行一次所有 API；Binance 不可达时用 CoinGecko 填充 Redis。
 */
import { getRedis, redisSet, REDIS_KEYS } from '../lib/redis';
import { fetchExchangerateRates } from '../services/exchangerateApi';
import { fetchFMPStockQuotes, fetchFMPCommodityQuotes } from '../services/fmpApi';
import { fetchCoinGeckoTickers } from '../services/coingeckoMarketData';

const FOREX_TTL = 60 * 31;
const STOCK_TTL = 60 * 6;
const CRYPTO_TTL = 60;

/** 仅处理的原生币种（与 DB / 前端一致）；请求币安 API 时用 symbol.toLowerCase() + 'usdt'；USDC 有 USDCUSDT，USDT 无 USDTUSDT 由 CoinGecko 补 */
const NATIVE_SYMBOLS = [
  'BTC', 'ETH', 'USDT', 'USDC', 'BNB', 'SOL', 'XRP', 'DOGE', 'ADA', 'AVAX', 'DOT', 'MATIC', 'LINK', 'UNI', 'ATOM', 'LTC', 'BCH', 'ETC', 'XLM', 'FIL', 'TRX',
  'APT', 'ARB', 'OP', 'INJ', 'SUI', 'SEI', 'NEAR', 'FTM', 'AAVE', 'CRV', 'MKR', 'SNX', 'COMP', 'SUSHI', 'YFI', 'SAND', 'MANA', 'AXS', 'ENJ', 'CHZ',
  'FLOW', 'ICP', 'VET', 'ALGO', 'EOS', 'XTZ', 'THETA', 'GRT', 'BAT', 'ZRX', '1INCH', 'LDO', 'IMX', 'ROSE', 'KAVA', 'ZEC', 'DASH', 'HBAR', 'EGLD', 'RUNE',
  'GMT', 'APE', 'BLUR', 'PEPE', 'WLD', 'JUP', 'STRK', 'PIXEL', 'PORTAL', 'MEME', 'ORDI', 'JTO', 'MANTA', 'ALT', 'AEVO', 'ETHFI', 'BOME', 'TAO', 'SAGA', 'W',
];

/** Binance 交易对 -> 原生币名（btcusdt -> BTC）；Redis Key 与 WS 广播均用原生大写 */
function toNativeSymbol(binancePair: string): string {
  const m = (binancePair || '').match(/^(.+?)usdt$/i);
  return m ? m[1].toUpperCase() : (binancePair || '').toUpperCase();
}

/** 从 Binance 拉取 24h 行情；只处理 NATIVE_SYMBOLS，以原生大写 Key 写入 Redis */
async function runCrypto() {
  const url = 'https://api.binance.com/api/v3/ticker/24hr';
  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 15000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(t);
    if (!res.ok) return;
    const data = (await res.json()) as Array<{ symbol: string; lastPrice: string; priceChangePercent: string; volume: string; highPrice: string; lowPrice: string }>;
    for (const tick of data) {
      const pair = (tick.symbol || '').toLowerCase();
      if (!pair.endsWith('usdt')) continue;
      const native = toNativeSymbol(tick.symbol!);
      if (!NATIVE_SYMBOLS.includes(native)) continue;
      const key = REDIS_KEYS.CRYPTO(native);
      await redisSet(key, {
        symbol: native,
        lastPrice: tick.lastPrice,
        priceChangePercent: tick.priceChangePercent,
        volume: tick.volume,
        highPrice: tick.highPrice,
        lowPrice: tick.lowPrice,
        updatedAt: Date.now(),
      }, CRYPTO_TTL);
      console.log('[Market] Redis Set Success for', native + ':', tick.lastPrice);
    }
  } catch (e) {
    console.warn('[MarketWorker] Binance tickers failed:', (e as Error)?.message);
    // Binance 不可达时用 CoinGecko 填充 Redis，保证前端有数据
    try {
      const cgTickers = await fetchCoinGeckoTickers(NATIVE_SYMBOLS);
      for (const t of cgTickers) {
        const native = (t.symbol || '').replace(/USDT$/i, '').toUpperCase();
        if (!native || !NATIVE_SYMBOLS.includes(native)) continue;
        const key = REDIS_KEYS.CRYPTO(native);
        await redisSet(key, {
          symbol: native,
          lastPrice: t.lastPrice,
          priceChangePercent: t.priceChangePercent ?? '0',
          volume: t.volume ?? '0',
          highPrice: t.highPrice ?? t.lastPrice,
          lowPrice: t.lowPrice ?? t.lastPrice,
          updatedAt: Date.now(),
        }, CRYPTO_TTL);
        console.log('[Market] Redis Set Success for', native + ':', t.lastPrice);
      }
      if (cgTickers.length > 0) console.log('[MarketWorker] Redis filled from CoinGecko:', cgTickers.length, 'symbols');
    } catch (cgErr) {
      console.warn('[MarketWorker] CoinGecko fallback failed:', (cgErr as Error)?.message);
    }
  }
}

async function runForex() {
  const rates = await fetchExchangerateRates();
  if (rates) await redisSet(REDIS_KEYS.FOREX, rates, FOREX_TTL);
}

async function runStocksAndCommodities() {
  const [stocks, commodities] = await Promise.all([
    fetchFMPStockQuotes(['AAPL', 'TSLA']),
    fetchFMPCommodityQuotes(),
  ]);
  for (const q of stocks) {
    await redisSet(REDIS_KEYS.STOCK(q.symbol), {
      symbol: q.symbol,
      price: q.price,
      change: q.changesPercentage ?? 0,
      high: q.dayHigh ?? q.price,
      low: q.dayLow ?? q.price,
      volume: q.volume ?? 0,
      updatedAt: Date.now(),
    }, STOCK_TTL);
  }
  for (const q of commodities) {
    await redisSet(REDIS_KEYS.COMMODITY(q.symbol), {
      symbol: q.symbol,
      price: q.price,
      change: q.changesPercentage ?? 0,
      high: q.dayHigh ?? q.price,
      low: q.dayLow ?? q.price,
      volume: q.volume ?? 0,
      updatedAt: Date.now(),
    }, STOCK_TTL);
  }
}

export async function startMarketWorker() {
  const r = getRedis();
  if (!r) {
    console.warn('[MarketWorker] Redis not available');
    return;
  }
  // 启动时重试连接 Redis（Docker 中 db/redis 可能稍晚就绪）
  for (let i = 0; i < 10; i++) {
    try {
      await r.ping();
      break;
    } catch {
      if (i === 9) {
        console.warn('[MarketWorker] Redis ping failed after 10 retries');
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }
  // 启动瞬间立即执行一次所有 API，不等待 5 分钟/30 分钟定时器
  console.log('[MarketWorker] Running initial fetch: FMP, Exchangerate, Binance...');
  await runForex();
  await runStocksAndCommodities();
  await runCrypto();
  setInterval(runForex, 30 * 60 * 1000);
  setInterval(runStocksAndCommodities, 5 * 60 * 1000);
  setInterval(runCrypto, 60 * 1000);
  console.log('[MarketWorker] Started: forex 30m, stocks/commodities 5m, crypto 1m (Redis key = market:crypto:BTC)');
}
