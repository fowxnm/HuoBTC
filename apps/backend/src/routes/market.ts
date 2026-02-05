import { Elysia, t } from 'elysia';
import { db, currency, siteConfig, notice } from '../db';
import { eq, sql } from 'drizzle-orm';
import { binanceMarketData } from '../services/binanceMarketData';
import { fetchCoinGeckoTickers, getCoinGeckoImageUrl } from '../services/coingeckoMarketData';
import { fetchForexRates } from '../services/frankfurterForex';
import { redisGet, REDIS_KEYS } from '../lib/redis';
import { rateToUsdPrice } from '../services/exchangerateApi';

// 行情源：加密货币=Binance 国际 API（香港/台湾可用）；外汇/股票/贵金属=Redis 或第三方

/** 前端传原生币名 BTC/ETH 时，底层调用 Binance 需映射为 BTCUSDT/ETHUSDT */
function toBinanceSymbol(symbol: string | undefined): string {
  const s = (symbol || '').trim().toUpperCase();
  if (!s) return 'BTCUSDT';
  if (s.endsWith('USDT')) return s;
  return s + 'USDT';
}

/** 行情接口不返回的币种（已从行情页移除） */
const HIDDEN_QUOTATION_SYMBOLS = new Set(['USDT', 'USDC', 'MANTA']);

// 当 currency 表为空时使用的默认币种列表（已移除 USDT/USDC/MANTA）
const DEFAULT_QUOTATION_SYMBOLS = [
  'BTC', 'ETH', 'BNB', 'SOL', 'XRP', 'DOGE', 'ADA', 'AVAX', 'DOT', 'MATIC', 'LINK', 'UNI', 'ATOM', 'LTC', 'BCH', 'ETC', 'XLM', 'FIL', 'TRX',
  'ARB', 'OP', 'INJ', 'SUI', 'SEI', 'NEAR', 'FTM', 'AAVE', 'CRV', 'MKR', 'SNX', 'COMP', 'SUSHI', 'YFI', 'SAND', 'MANA', 'AXS', 'ENJ', 'CHZ',
  'FLOW', 'ICP', 'VET', 'ALGO', 'EOS', 'XTZ', 'THETA', 'GRT', 'BAT', 'ZRX', '1INCH', 'LDO', 'ZEC', 'DASH', 'HBAR', 'GMT', 'APE', 'PEPE', 'ORDI',
];
export const marketRoutes = new Elysia({ prefix: '/market' })
  // Get market quotation - 🚨 使用 Binance 真实数据
  .get('/quotation', async ({ query }) => {
    const legalId = parseInt(String(query?.legal_id || '3'), 10) || 3;
    try {
      // 1. 从数据库获取所有币种配置；若为空则用默认列表（仍从 Binance 取真实数据）
      let currencies = await db.select().from(currency)
        .where(eq(currency.isDisplay, 1));

      const useDefaultList = currencies.length === 0;
      if (useDefaultList) {
        currencies = DEFAULT_QUOTATION_SYMBOLS.map((name, i) => ({
          id: i + 1,
          name,
          getAddress: '',
          sort: i,
          logo: '',
          createTime: 0,
          isDisplay: 1 as any,
          minNumber: '0' as any,
          rate: '0' as any,
          isLever: 0 as any,
          isLegal: 0 as any,
          isMatch: 1 as any,
          showLegal: 0 as any,
          type: '',
          blackLimit: 1,
          key: '',
          contractAddress: '',
          totalAccount: ''
        }));
      }
      currencies = currencies.filter((c) => !HIDDEN_QUOTATION_SYMBOLS.has(String(c.name)));

      // 2. 加密货币 Ticker：优先 Redis，再 CoinGecko，再 Binance
      const tickerMap = new Map<string, { symbol: string; lastPrice: string; priceChangePercent: string; volume: string; highPrice: string; lowPrice: string }>();
      const cryptoCurrencies = currencies.filter(c => (c.type || '').toLowerCase() === 'crypto' || !c.type);
      for (const c of cryptoCurrencies) {
        const key = REDIS_KEYS.CRYPTO(c.name);
        const cached = await redisGet<{ lastPrice: string; priceChangePercent: string; volume: string; highPrice: string; lowPrice: string }>(key);
        if (cached && cached.lastPrice != null) {
          const binanceSymbol = `${c.name}USDT`;
          tickerMap.set(binanceSymbol, {
            symbol: binanceSymbol,
            lastPrice: String(cached.lastPrice),
            priceChangePercent: String(cached.priceChangePercent ?? 0),
            volume: String(cached.volume ?? 0),
            highPrice: String(cached.highPrice ?? cached.lastPrice),
            lowPrice: String(cached.lowPrice ?? cached.lastPrice),
          });
        }
      }
      if (tickerMap.size > 0) {
        console.log('[Market] Redis hit for', tickerMap.size, 'crypto symbols');
      }
      // Redis 无数据或不全时：优先 CoinGecko（Docker/国内 Binance 常不可达），再补 Binance
      if (tickerMap.size < cryptoCurrencies.length) {
        const cryptoNames: string[] = [...new Set(cryptoCurrencies.map(c => String(c.name)))];
        const cgTickers = await fetchCoinGeckoTickers(cryptoNames.length ? cryptoNames : DEFAULT_QUOTATION_SYMBOLS);
        cgTickers.forEach(t => { if (!tickerMap.has(t.symbol)) tickerMap.set(t.symbol, t); });
        if (cgTickers.length > 0) console.log('[Market] CoinGecko loaded', cgTickers.length, 'symbols');
      }
      if (tickerMap.size < cryptoCurrencies.length) {
        try {
          const binanceTickers = await binanceMarketData.getAllTickers();
          for (const t of binanceTickers) {
            if (!t.symbol?.endsWith('USDT')) continue;
            const native = t.symbol.replace(/USDT$/i, '').toUpperCase();
            const binanceSymbol = native + 'USDT';
            if (!tickerMap.has(binanceSymbol)) tickerMap.set(binanceSymbol, t);
          }
        } catch (binanceErr) {
          console.warn('[Market] Binance unavailable:', (binanceErr as Error)?.message);
        }
      }

      // 3. 外汇：优先 Redis (Exchangerate-API 每 30 分钟更新)，失败则 Frankfurter 兜底
      let forexRates: Record<string, number> | null = null;
      const redisForex = await redisGet<Record<string, number>>(REDIS_KEYS.FOREX);
      if (redisForex && typeof redisForex === 'object') {
        forexRates = redisForex;
      }
      if (!forexRates) {
        try {
          const forexSymbols: string[] = [...new Set(currencies.filter(c => (c.type || '').toLowerCase() === 'forex').map(c => String(c.name)))];
          const frank = forexSymbols.length ? await fetchForexRates(forexSymbols) : null;
          if (frank?.rates) {
            forexRates = { USD: 1, ...frank.rates };
          }
        } catch (_) {}
      }
      const forexToUsd = (sym: string) => forexRates ? rateToUsdPrice(forexRates, sym) : null;

      // 4. 合并：加密货币=Redis/CoinGecko/Binance 原生行情（含 USDT/USDC）；外汇=Redis/Frankfurter；股票/黄金=Redis(FMP)
      const quotationData = await Promise.all(currencies.map(async (c) => {
        const assetType = (c.type || 'crypto').toLowerCase();
        const isCrypto = assetType === 'crypto' || !assetType;
        const isForex = assetType === 'forex';
        const name = String(c.name);
        // USDT 无 Binance 交易对 USDTUSDT，用 CoinGecko 的 USDTUSDT（tether）；USDC 用 Binance USDCUSDT 或 CoinGecko
        const binanceSymbol = name === 'USDT' ? 'USDTUSDT' : `${name}USDT`;
        const ticker = isCrypto ? tickerMap.get(binanceSymbol) : null;

        if (ticker) {
          return {
            currency_id: c.id,
            currency_name: c.name,
            legal_id: legalId,
            legal_name: 'USDT',
            logo: c.logo || getCoinGeckoImageUrl(c.name) || '',
            asset_type: assetType,
            now_price: parseFloat(ticker.lastPrice),
            change: parseFloat(ticker.priceChangePercent),
            volume: parseFloat(ticker.volume),
            high: parseFloat(ticker.highPrice),
            low: parseFloat(ticker.lowPrice),
            cny_price: parseFloat(ticker.lastPrice) * 7
          };
        }
        if (isForex && forexRates) {
          const price = forexToUsd(c.name);
          if (price != null) {
            return {
              currency_id: c.id,
              currency_name: c.name,
              legal_id: legalId,
              legal_name: 'USDT',
              logo: c.logo || '',
              asset_type: assetType,
              now_price: price,
              change: 0,
              volume: 0,
              high: price,
              low: price,
              cny_price: price * 7
            };
          }
        }
        // 股票：从 Redis (FMP 每 5 分钟更新) 读取
        if (assetType === 'stock') {
          const cached = await redisGet<{ price: number; change: number; high: number; low: number; volume: number }>(REDIS_KEYS.STOCK(c.name));
          if (cached && typeof cached.price === 'number' && cached.price > 0) {
            return {
              currency_id: c.id,
              currency_name: c.name,
              legal_id: legalId,
              legal_name: 'USDT',
              logo: c.logo || '',
              asset_type: assetType,
              now_price: cached.price,
              change: cached.change ?? 0,
              volume: cached.volume ?? 0,
              high: cached.high ?? cached.price,
              low: cached.low ?? cached.price,
              cny_price: (cached.price || 0) * 7
            };
          }
        }
        // 大宗/贵金属 (XAU 等)：从 Redis (FMP 黄金) 读取
        if (assetType === 'metal') {
          const cached = await redisGet<{ price: number; change: number; high: number; low: number; volume: number }>(REDIS_KEYS.COMMODITY(c.name));
          if (cached && typeof cached.price === 'number' && cached.price > 0) {
            return {
              currency_id: c.id,
              currency_name: c.name,
              legal_id: legalId,
              legal_name: 'USDT',
              logo: c.logo || '',
              asset_type: assetType,
              now_price: cached.price,
              change: cached.change ?? 0,
              volume: cached.volume ?? 0,
              high: cached.high ?? cached.price,
              low: cached.low ?? cached.price,
              cny_price: (cached.price || 0) * 7
            };
          }
        }
        // 期货/ETF 等暂无实时 API 时返回 0，前端展示「暂无数据」
        return {
          currency_id: c.id,
          currency_name: c.name,
          legal_id: legalId,
          legal_name: 'USDT',
          logo: c.logo || (assetType === 'crypto' || !assetType ? getCoinGeckoImageUrl(c.name) : '') || '',
          asset_type: assetType,
          now_price: 0,
          change: 0,
          volume: 0,
          high: 0,
          low: 0,
          cny_price: 0
        };
      }));

      const filtered = quotationData.filter((c) => !HIDDEN_QUOTATION_SYMBOLS.has(c.currency_name));
      // 永不返回空数组：过滤后为空时返回兜底列表，避免前端“断开”
      const data = filtered.length > 0 ? filtered : DEFAULT_QUOTATION_SYMBOLS.map((name, i) => ({
        currency_id: i + 1,
        currency_name: name,
        legal_id: legalId,
        legal_name: 'USDT',
        logo: getCoinGeckoImageUrl(name) || '',
        asset_type: 'crypto',
        now_price: 0,
        change: 0,
        volume: 0,
        high: 0,
        low: 0,
        cny_price: 0
      }));
      return { type: 'ok' as const, data };
    } catch (error) {
      console.error('[Market] Failed to fetch quotation:', error);
      // 仍返回 200 + 默认列表，避免前端完全无数据（无硬编码价格）
      const fallback = DEFAULT_QUOTATION_SYMBOLS.map((name, i) => ({
        currency_id: i + 1,
        currency_name: name,
        legal_id: legalId,
        legal_name: 'USDT',
        logo: getCoinGeckoImageUrl(name) || '',
        asset_type: 'crypto',
        now_price: 0,
        change: 0,
        volume: 0,
        high: 0,
        low: 0,
        cny_price: 0
      }));
      return { type: 'ok' as const, data: fallback };
    }
  }, {
    query: t.Object({
      legal_id: t.Optional(t.String())
    })
  })

  // Get kline data - 仅 Binance 真实 K 线，非加密货币返回空（禁止假数据）
  .get('/kline', async ({ query }) => {
    const { symbol, period, size } = query;
    const dataSize = parseInt(size || '100');
    const binanceSymbol = toBinanceSymbol(symbol?.replace('/', ''));
    const binancePeriod = convertPeriodToBinance(period || '1min');

    try {
      const klineData = await binanceMarketData.getHistoricalKlines(
        binanceSymbol,
        binancePeriod,
        dataSize
      );

      const klines = klineData.map(k => ({
        timestamp: k.closeTime,
        open: k.open,
        high: k.high,
        low: k.low,
        close: k.close,
        volume: k.volume
      }));

      return { type: 'ok', data: klines };
    } catch {
      // 非 Binance 标的（外汇/股票/贵金属）无真实 K 线 API，禁止假数据，返回空
      return { type: 'ok', data: [] };
    }
  }, {
    query: t.Object({
      symbol: t.Optional(t.String()),
      period: t.Optional(t.String()),
      size: t.Optional(t.String())
    })
  })

  // Get depth data - 🚨 使用 Binance 真实深度数据
  .get('/depth', async ({ query }) => {
    const { symbol } = query;

    try {
      const binanceSymbol = toBinanceSymbol(symbol?.replace('/', ''));
      
      // 从 Binance 获取深度数据（如果已订阅）
      const cachedDepth = binanceMarketData.getDepth(binanceSymbol);

      if (cachedDepth) {
        return {
          type: 'ok',
          data: {
            asks: cachedDepth.asks.slice(0, 20).map(([price, amount]) => ({
              price: parseFloat(price).toFixed(2),
              amount: parseFloat(amount).toFixed(4)
            })),
            bids: cachedDepth.bids.slice(0, 20).map(([price, amount]) => ({
              price: parseFloat(price).toFixed(2),
              amount: parseFloat(amount).toFixed(4)
            }))
          }
        };
      } else {
        // 如果缓存中没有，订阅并等待数据
        binanceMarketData.subscribeDepth(binanceSymbol, 20);
        
        // 等待 2 秒获取数据
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        const depth = binanceMarketData.getDepth(binanceSymbol);
        if (depth) {
          return {
            type: 'ok',
            data: {
              asks: depth.asks.slice(0, 20).map(([price, amount]) => ({
                price: parseFloat(price).toFixed(2),
                amount: parseFloat(amount).toFixed(4)
              })),
              bids: depth.bids.slice(0, 20).map(([price, amount]) => ({
                price: parseFloat(price).toFixed(2),
                amount: parseFloat(amount).toFixed(4)
              }))
            }
          };
        } else {
          throw new Error('Failed to fetch depth data');
        }
      }
    } catch (error) {
      console.error('[Market] Failed to fetch depth:', error);
      return {
        type: 'error',
        message: 'Failed to fetch depth data from Binance',
        data: { asks: [], bids: [] }
      };
    }
  }, {
    query: t.Object({
      symbol: t.Optional(t.String())
    })
  })

  // Get site config
  .get('/getSiteConfig', async ({ query }) => {
    const lang = query.lang || 'en';

    const configs = await db.select().from(siteConfig);
    const configMap = new Map(configs.map(c => [c.key, c.value]));

    return {
      type: 'ok',
      message: {
        site_name: configMap.get('site_name') || 'BTC Exchange',
        mobile_register: parseInt(configMap.get('mobile_register') || '1'),
        email_register: parseInt(configMap.get('email_register') || '1'),
        yzm_radio: parseInt(configMap.get('yzm_radio') || '0'),
        sharar_radio: parseInt(configMap.get('sharar_radio') || '0')
      }
    };
  }, {
    query: t.Object({
      lang: t.Optional(t.String())
    })
  })

  // Get notice list
  .get('/notice', async ({ query }) => {
    const lang = query.lang || 'en';
    const page = parseInt(query.page || '1');
    const limit = parseInt(query.limit || '10');
    const offset = (page - 1) * limit;

    const notices = await db.select().from(notice)
      .where(eq(notice.isDisplay, 1))
      .limit(limit)
      .offset(offset)
      .orderBy(sql`${notice.sort} DESC`);

    return {
      type: 'ok',
      data: notices.map(n => ({
        id: n.id,
        title: n.title,
        content: n.content,
        created_at: n.createdAt
      }))
    };
  }, {
    query: t.Object({
      lang: t.Optional(t.String()),
      page: t.Optional(t.String()),
      limit: t.Optional(t.String())
    })
  })

  // Get notice detail
  .get('/notice/:id', async ({ params }) => {
    const [noticeData] = await db.select().from(notice)
      .where(eq(notice.id, parseInt(params.id)))
      .limit(1);

    if (!noticeData) {
      return { type: 'error', message: 'Notice not found' };
    }

    return {
      type: 'ok',
      data: {
        id: noticeData.id,
        title: noticeData.title,
        content: noticeData.content,
        created_at: noticeData.createdAt
      }
    };
  })

  // Get area codes
  .post('/get_area_code', async () => {
    const areaCodes = [
      { costName: '+86', country: 'China' },
      { costName: '+1', country: 'United States' },
      { costName: '+44', country: 'United Kingdom' },
      { costName: '+81', country: 'Japan' },
      { costName: '+82', country: 'Korea' },
      { costName: '+65', country: 'Singapore' },
      { costName: '+61', country: 'Australia' },
      { costName: '+49', country: 'Germany' },
      { costName: '+33', country: 'France' },
      { costName: '+91', country: 'India' },
      { costName: '+7', country: 'Russia' },
      { costName: '+55', country: 'Brazil' },
      { costName: '+52', country: 'Mexico' },
      { costName: '+34', country: 'Spain' },
      { costName: '+39', country: 'Italy' }
    ];

    return {
      type: 'ok',
      message: { costList: areaCodes }
    };
  });

/**
 * 转换周期格式：前端 -> Binance
 * 1min -> 1m, 5min -> 5m, 1h -> 1h, 1d -> 1d
 */
function convertPeriodToBinance(period: string): string {
  const periodMap: Record<string, string> = {
    '1min': '1m',
    '5min': '5m',
    '15min': '15m',
    '30min': '30m',
    '1h': '1h',
    '4h': '4h',
    '1d': '1d',
    '1w': '1w'
  };
  return periodMap[period] || '1m';
}

function getPeriodMs(period: string): number {
  const periods: Record<string, number> = {
    '1min': 60000,
    '5min': 300000,
    '15min': 900000,
    '30min': 1800000,
    '1h': 3600000,
    '4h': 14400000,
    '1d': 86400000,
    '1w': 604800000
  };
  return periods[period] || 60000;
}
