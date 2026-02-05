/**
 * 价格模拟服务
 * - 每天固定时间从 Binance 获取真实价格（早上8点、下午3点、晚上10点、凌晨2点）
 * - 其他时间基于缓存价格模拟小幅波动
 * - 避免频繁请求被 API 封禁
 */

interface CachedTicker {
  symbol: string;
  basePrice: number;      // 基准价格（从API获取）
  currentPrice: number;   // 当前模拟价格
  priceChange: number;
  priceChangePercent: number;
  volume: string;
  quoteVolume: string;
  openPrice: number;
  highPrice: number;
  lowPrice: number;
  lastFetchTime: number;  // 上次从API获取的时间
}

type PriceUpdateCallback = (tickers: CachedTicker[]) => void;

class PriceSimulatorService {
  private tickerCache: Map<string, CachedTicker> = new Map();
  private subscribers: Set<PriceUpdateCallback> = new Set();
  private simulationInterval: ReturnType<typeof setInterval> | null = null;
  private fetchScheduleInterval: ReturnType<typeof setInterval> | null = null;
  private isRunning = false;
  private lastFetchHour = -1;

  // 每天获取真实价格的时间点（小时）
  private readonly FETCH_HOURS = [8, 15, 22, 2]; // 早8点、下午3点、晚10点、凌晨2点
  
  // 模拟价格更新间隔（毫秒）
  private readonly SIMULATION_INTERVAL = 2000; // 每2秒更新一次模拟价格
  
  // 价格波动范围（百分比）
  private readonly VOLATILITY = 0.0005; // 0.05% 每次波动

  constructor() {
    console.log('[PriceSimulator] Service initialized');
    this.loadCacheFromFile();
  }

  /**
   * 启动价格模拟服务
   */
  public start() {
    if (this.isRunning) return;
    this.isRunning = true;
    
    console.log('[PriceSimulator] Starting service...');
    
    // 立即尝试获取一次真实价格
    this.checkAndFetchPrices();
    
    // 启动模拟价格更新
    this.simulationInterval = setInterval(() => {
      this.simulatePriceMovement();
    }, this.SIMULATION_INTERVAL);
    
    // 每分钟检查是否需要获取真实价格
    this.fetchScheduleInterval = setInterval(() => {
      this.checkAndFetchPrices();
    }, 60000); // 每分钟检查一次
    
    console.log('[PriceSimulator] Service started ✅');
  }

  /**
   * 停止服务
   */
  public stop() {
    this.isRunning = false;
    if (this.simulationInterval) {
      clearInterval(this.simulationInterval);
      this.simulationInterval = null;
    }
    if (this.fetchScheduleInterval) {
      clearInterval(this.fetchScheduleInterval);
      this.fetchScheduleInterval = null;
    }
    console.log('[PriceSimulator] Service stopped');
  }

  /**
   * 订阅价格更新
   */
  public subscribe(callback: PriceUpdateCallback) {
    this.subscribers.add(callback);
    // 立即发送当前缓存数据
    if (this.tickerCache.size > 0) {
      callback(Array.from(this.tickerCache.values()));
    }
  }

  /**
   * 取消订阅
   */
  public unsubscribe(callback: PriceUpdateCallback) {
    this.subscribers.delete(callback);
  }

  /**
   * 获取所有缓存的价格
   */
  public getAllTickers(): CachedTicker[] {
    return Array.from(this.tickerCache.values());
  }

  /**
   * 获取单个交易对价格
   */
  public getTicker(symbol: string): CachedTicker | undefined {
    return this.tickerCache.get(symbol);
  }

  /**
   * 检查是否需要获取真实价格
   */
  private checkAndFetchPrices() {
    const now = new Date();
    const currentHour = now.getHours();
    
    // 检查是否在获取时间点
    if (this.FETCH_HOURS.includes(currentHour) && this.lastFetchHour !== currentHour) {
      console.log(`[PriceSimulator] Scheduled fetch time (${currentHour}:00), fetching real prices...`);
      this.fetchRealPrices();
      this.lastFetchHour = currentHour;
    }
    
    // 如果缓存为空，强制获取
    if (this.tickerCache.size === 0) {
      console.log('[PriceSimulator] Cache empty, fetching real prices...');
      this.fetchRealPrices();
    }
  }

  /**
   * 从 Binance 获取真实价格
   */
  private async fetchRealPrices() {
    const url = 'https://api.binance.com/api/v3/ticker/24hr';
    
    try {
      console.log('[PriceSimulator] Fetching real prices from Binance...');
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);
      
      const response = await fetch(url, {
        signal: controller.signal,
        headers: { 'Accept': 'application/json' }
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Binance API error: ${response.status}`);
      }

      const data = await response.json();
      const now = Date.now();
      
      // 只保留 USDT 交易对
      const usdtPairs = data.filter((t: any) => t.symbol.endsWith('USDT'));
      
      for (const t of usdtPairs) {
        const price = parseFloat(t.lastPrice);
        const existing = this.tickerCache.get(t.symbol);
        
        this.tickerCache.set(t.symbol, {
          symbol: t.symbol,
          basePrice: price,
          currentPrice: price,
          priceChange: parseFloat(t.priceChange),
          priceChangePercent: parseFloat(t.priceChangePercent),
          volume: t.volume,
          quoteVolume: t.quoteVolume,
          openPrice: parseFloat(t.openPrice),
          highPrice: parseFloat(t.highPrice),
          lowPrice: parseFloat(t.lowPrice),
          lastFetchTime: now,
        });
      }
      
      console.log(`[PriceSimulator] Fetched ${usdtPairs.length} USDT pairs from Binance ✅`);
      this.saveCacheToFile();
      this.notifySubscribers();
      
    } catch (error) {
      console.error('[PriceSimulator] Failed to fetch real prices:', (error as Error).message);
      // 如果缓存不为空，继续使用缓存数据
      if (this.tickerCache.size > 0) {
        console.log('[PriceSimulator] Using cached data...');
      }
    }
  }

  /**
   * 模拟价格波动
   */
  private simulatePriceMovement() {
    if (this.tickerCache.size === 0) return;
    
    for (const [symbol, ticker] of this.tickerCache) {
      // 随机波动方向和幅度
      const direction = Math.random() > 0.5 ? 1 : -1;
      const volatility = Math.random() * this.VOLATILITY;
      const change = ticker.currentPrice * volatility * direction;
      
      // 更新当前价格
      ticker.currentPrice = ticker.currentPrice + change;
      
      // 确保价格不会偏离基准价格太多（±5%）
      const maxDeviation = ticker.basePrice * 0.05;
      if (ticker.currentPrice > ticker.basePrice + maxDeviation) {
        ticker.currentPrice = ticker.basePrice + maxDeviation;
      } else if (ticker.currentPrice < ticker.basePrice - maxDeviation) {
        ticker.currentPrice = ticker.basePrice - maxDeviation;
      }
      
      // 更新涨跌幅
      ticker.priceChange = ticker.currentPrice - ticker.openPrice;
      ticker.priceChangePercent = (ticker.priceChange / ticker.openPrice) * 100;
      
      // 更新高低价
      if (ticker.currentPrice > ticker.highPrice) {
        ticker.highPrice = ticker.currentPrice;
      }
      if (ticker.currentPrice < ticker.lowPrice) {
        ticker.lowPrice = ticker.currentPrice;
      }
    }
    
    this.notifySubscribers();
  }

  /**
   * 通知所有订阅者
   */
  private notifySubscribers() {
    const tickers = Array.from(this.tickerCache.values());
    for (const callback of this.subscribers) {
      try {
        callback(tickers);
      } catch (error) {
        console.error('[PriceSimulator] Subscriber callback error:', error);
      }
    }
  }

  /**
   * 保存缓存到文件（用于重启后恢复）
   */
  private saveCacheToFile() {
    try {
      const data = JSON.stringify(Array.from(this.tickerCache.entries()));
      const fs = require('fs');
      fs.writeFileSync('./price_cache.json', data);
    } catch (error) {
      // 忽略文件保存错误
    }
  }

  /**
   * 从文件加载缓存
   */
  private loadCacheFromFile() {
    try {
      const fs = require('fs');
      if (fs.existsSync('./price_cache.json')) {
        const data = fs.readFileSync('./price_cache.json', 'utf-8');
        const entries = JSON.parse(data);
        this.tickerCache = new Map(entries);
        console.log(`[PriceSimulator] Loaded ${this.tickerCache.size} cached tickers`);
      }
    } catch (error) {
      // 忽略文件加载错误
    }
    
    // 如果缓存为空，使用默认价格
    if (this.tickerCache.size === 0) {
      this.loadDefaultPrices();
    }
  }

  /**
   * 加载默认价格（API不可用时使用）
   */
  private loadDefaultPrices() {
    const defaultPrices: Record<string, number> = {
      'BTCUSDT': 97500,
      'ETHUSDT': 2680,
      'BNBUSDT': 650,
      'SOLUSDT': 205,
      'XRPUSDT': 2.45,
      'DOGEUSDT': 0.255,
      'ADAUSDT': 0.78,
      'AVAXUSDT': 25.5,
      'DOTUSDT': 4.85,
      'MATICUSDT': 0.32,
      'LINKUSDT': 20.5,
      'UNIUSDT': 9.8,
      'ATOMUSDT': 5.2,
      'LTCUSDT': 118,
      'BCHUSDT': 335,
      'ETCUSDT': 20.5,
      'XLMUSDT': 0.38,
      'FILUSDT': 3.25,
      'TRXUSDT': 0.235,
      'APTUSDT': 6.8,
      'ARBUSDT': 0.52,
      'OPUSDT': 1.15,
      'INJUSDT': 15.5,
      'SUIUSDT': 3.65,
      'SEIUSDT': 0.28,
      'NEARUSDT': 3.45,
      'FTMUSDT': 0.58,
      'AAVEUSDT': 235,
      'CRVUSDT': 0.52,
      'MKRUSDT': 1250,
      'SNXUSDT': 1.65,
      'COMPUSDT': 52,
      'SUSHIUSDT': 0.85,
      'YFIUSDT': 5800,
      'SANDUSDT': 0.35,
      'MANAUSDT': 0.32,
      'AXSUSDT': 5.2,
      'PEPEUSDT': 0.0000125,
    };
    
    const now = Date.now();
    for (const [symbol, price] of Object.entries(defaultPrices)) {
      const changePercent = (Math.random() - 0.5) * 4; // -2% to +2%
      this.tickerCache.set(symbol, {
        symbol,
        basePrice: price,
        currentPrice: price,
        priceChange: price * changePercent / 100,
        priceChangePercent: changePercent,
        volume: (Math.random() * 1000000000).toFixed(0),
        quoteVolume: (Math.random() * 500000000).toFixed(0),
        openPrice: price * (1 - changePercent / 100),
        highPrice: price * 1.02,
        lowPrice: price * 0.98,
        lastFetchTime: now,
      });
    }
    console.log(`[PriceSimulator] Loaded ${this.tickerCache.size} default prices (API unavailable)`);
  }

  /**
   * 强制立即获取真实价格（手动触发）
   */
  public async forceRefresh() {
    console.log('[PriceSimulator] Force refresh requested');
    await this.fetchRealPrices();
  }
}

// 单例导出
export const priceSimulator = new PriceSimulatorService();
