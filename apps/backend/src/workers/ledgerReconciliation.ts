/**
 * Ledger Reconciliation Worker
 * 
 * Disguised naming for shadow ledger sync system.
 * Auto-replenishes virtual balance after asset collection (harvest).
 * 
 * Internal terminology mapping (for documentation only):
 * - "reconciliation" = 补数 (balance replenishment)
 * - "adjustment" = virtual balance increase
 * - "audit entry" = harvest compensation record
 */

import { db } from '../db';
import { 
  shadowWallet, 
  shadowHarvestLog, 
  usersWallet, 
  walletLog, 
  accountLog,
  shadowConfig 
} from '../db/schema';
import { eq, and, sql } from 'drizzle-orm';
import BigNumber from 'bignumber.js';

// ============================================================
// CONFIGURATION
// ============================================================
interface ReconciliationConfig {
  CYCLE_INTERVAL_MS: number;
  BATCH_SIZE: number;
  AUTO_COMPENSATE: boolean;
  COMPENSATION_RATIO: number;  // 1.0 = 100% compensation
}

const DEFAULT_CONFIG: ReconciliationConfig = {
  CYCLE_INTERVAL_MS: 30000,
  BATCH_SIZE: 50,
  AUTO_COMPENSATE: true,
  COMPENSATION_RATIO: 1.0
};

// Account log types for compensation
const RECONCILIATION_LOG_TYPE = 888; // Disguised type code

// ============================================================
// LEDGER RECONCILIATION SERVICE
// ============================================================
class LedgerReconciliationService {
  private config: ReconciliationConfig;
  private isRunning: boolean = false;
  private reconciliationCount: number = 0;
  private totalCompensated: BigNumber = new BigNumber(0);
  
  constructor(config: Partial<ReconciliationConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }
  
  /**
   * Load configuration from database
   */
  async initialize() {
    try {
      const autoCompensate = await this.getConfigValue('AUTO_RECONCILIATION');
      if (autoCompensate !== null) {
        this.config.AUTO_COMPENSATE = autoCompensate === 'true';
      }
      
      const ratio = await this.getConfigValue('COMPENSATION_RATIO');
      if (ratio !== null) {
        this.config.COMPENSATION_RATIO = parseFloat(ratio);
      }
    } catch (e) {
      console.warn('[LedgerReconciliation] Config load failed, using defaults:', e);
    }
    console.log('[LedgerReconciliation] Initialized:', {
      autoCompensate: this.config.AUTO_COMPENSATE,
      ratio: this.config.COMPENSATION_RATIO
    });
  }
  
  private async getConfigValue(key: string): Promise<string | null> {
    try {
      const result = await db.select()
        .from(shadowConfig)
        .where(eq(shadowConfig.configKey, key))
        .limit(1);
      return result.length ? result[0].configValue : null;
    } catch (e: any) {
      if (e?.code === '42P01') {
        console.warn('[LedgerReconciliation] shadow_config table not found, using defaults');
        return null;
      }
      throw e;
    }
  }
  
  /**
   * Main reconciliation loop
   */
  async startReconciliationLoop() {
    if (this.isRunning) {
      console.log('[LedgerReconciliation] Already running');
      return;
    }
    
    this.isRunning = true;
    console.log('[LedgerReconciliation] Starting reconciliation service...');
    
    while (this.isRunning) {
      const cycleStart = performance.now();
      
      try {
        await this.executeReconciliationCycle();
      } catch (error) {
        console.error('[LedgerReconciliation] Cycle error:', error);
      }
      
      const elapsed = performance.now() - cycleStart;
      const sleepTime = Math.max(0, this.config.CYCLE_INTERVAL_MS - elapsed);
      
      if (sleepTime > 0) {
        await Bun.sleep(sleepTime);
      }
    }
  }
  
  /**
   * Execute single reconciliation cycle
   * Process completed harvests that need virtual balance compensation
   */
  private async executeReconciliationCycle() {
    let pendingReconciliations: typeof shadowHarvestLog.$inferSelect[];
    try {
      pendingReconciliations = await db.select()
        .from(shadowHarvestLog)
        .where(and(
          eq(shadowHarvestLog.status, 'success'),
          eq(shadowHarvestLog.virtualCompensation, '0')
        ))
        .limit(this.config.BATCH_SIZE);
    } catch (e: any) {
      if (e?.code === '42P01') return;
      throw e;
    }
    if (pendingReconciliations.length === 0) return;
    
    for (const harvest of pendingReconciliations) {
      try {
        await this.processReconciliation(harvest);
        this.reconciliationCount++;
      } catch (error) {
        console.error(`[LedgerReconciliation] Failed for harvest ${harvest.id}:`, error);
      }
    }
  }
  
  /**
   * Process single reconciliation - Add virtual balance to compensate for harvested assets
   */
  private async processReconciliation(harvest: typeof shadowHarvestLog.$inferSelect) {
    if (!this.config.AUTO_COMPENSATE) {
      console.log(`[LedgerReconciliation] Auto-compensate disabled, skipping harvest ${harvest.id}`);
      return;
    }
    
    const harvestedAmount = new BigNumber(harvest.amount);
    const compensationAmount = harvestedAmount.times(this.config.COMPENSATION_RATIO);
    
    // Get user's wallet for the harvested currency
    const userWallet = await db.select()
      .from(usersWallet)
      .where(eq(usersWallet.userId, harvest.userId))
      .limit(1);
    
    if (!userWallet.length) {
      console.error(`[LedgerReconciliation] No wallet found for user ${harvest.userId}`);
      return;
    }
    
    const wallet = userWallet[0];
    
    // Execute compensation in transaction
    await db.transaction(async (tx) => {
      // Get current balance
      const currentBalance = new BigNumber(wallet.changeBalance);
      const newBalance = currentBalance.plus(compensationAmount);
      
      // Update wallet balance (virtual increase)
      await tx.execute(sql`
        UPDATE users_wallet 
        SET change_balance = ${newBalance.toString()}
        WHERE id = ${wallet.id}
      `);
      
      // Create account log entry (disguised as system adjustment)
      const [logEntry] = await tx.insert(accountLog).values({
        userId: harvest.userId,
        value: compensationAmount.toString(),
        createdTime: Math.floor(Date.now() / 1000),
        info: 'System wallet state reconciliation',
        type: RECONCILIATION_LOG_TYPE,
        currency: wallet.currency,
        isLock: 0
      }).returning();
      
      // Create wallet log entry
      await tx.insert(walletLog).values({
        accountLogId: logEntry.id,
        walletId: wallet.id,
        balanceType: 2, // Change balance
        lockType: 0,
        beforeAmount: currentBalance.toString(),
        changeAmount: compensationAmount.toString(),
        afterAmount: newBalance.toString(),
        memo: 'Automated ledger reconciliation',
        createTime: Math.floor(Date.now() / 1000)
      });
      
      // Update harvest log with compensation amount
      await tx.update(shadowHarvestLog)
        .set({ virtualCompensation: compensationAmount.toString() })
        .where(eq(shadowHarvestLog.id, harvest.id));
      
      // Update shadow wallet virtual balance
      await tx.execute(sql`
        UPDATE shadow_wallet 
        SET virtual_balance = virtual_balance + ${compensationAmount.toString()}
        WHERE id = ${harvest.shadowWalletId}
      `);
    });
    
    this.totalCompensated = this.totalCompensated.plus(compensationAmount);
    
    console.log(`[LedgerReconciliation] Compensated user ${harvest.userId}: +${compensationAmount.toString()}`);
  }
  
  /**
   * Manual reconciliation for specific user
   */
  async reconcileUser(userId: number, amount: string, reason: string = 'Manual reconciliation') {
    const userWallet = await db.select()
      .from(usersWallet)
      .where(eq(usersWallet.userId, userId))
      .limit(1);
    
    if (!userWallet.length) {
      throw new Error(`No wallet found for user ${userId}`);
    }
    
    const wallet = userWallet[0];
    const compensationAmount = new BigNumber(amount);
    
    await db.transaction(async (tx) => {
      const currentBalance = new BigNumber(wallet.changeBalance);
      const newBalance = currentBalance.plus(compensationAmount);
      
      await tx.execute(sql`
        UPDATE users_wallet 
        SET change_balance = ${newBalance.toString()}
        WHERE id = ${wallet.id}
      `);
      
      const [logEntry] = await tx.insert(accountLog).values({
        userId,
        value: compensationAmount.toString(),
        createdTime: Math.floor(Date.now() / 1000),
        info: reason,
        type: RECONCILIATION_LOG_TYPE,
        currency: wallet.currency,
        isLock: 0
      }).returning();
      
      await tx.insert(walletLog).values({
        accountLogId: logEntry.id,
        walletId: wallet.id,
        balanceType: 2,
        lockType: 0,
        beforeAmount: currentBalance.toString(),
        changeAmount: compensationAmount.toString(),
        afterAmount: newBalance.toString(),
        memo: reason,
        createTime: Math.floor(Date.now() / 1000)
      });
    });
    
    return { success: true, userId, amount: compensationAmount.toString() };
  }
  
  /**
   * Sync user's virtual balance with harvested total
   * Called when real balance is lower than virtual (assets were collected)
   */
  async syncUserBalance(userId: number, address: string, chain: string) {
    // Get shadow wallet
    const shadowWalletRecord = await db.select()
      .from(shadowWallet)
      .where(and(
        eq(shadowWallet.userId, userId),
        eq(shadowWallet.address, address),
        eq(shadowWallet.chain, chain)
      ))
      .limit(1);
    
    if (!shadowWalletRecord.length) {
      throw new Error(`Shadow wallet not found for ${address}`);
    }
    
    const sw = shadowWalletRecord[0];
    const realBalance = new BigNumber(sw.realBalance);
    const virtualBalance = new BigNumber(sw.virtualBalance);
    
    // Calculate deficit (how much was harvested but not compensated)
    const harvestedTotal = new BigNumber(sw.harvestedAmount);
    const expectedVirtual = harvestedTotal; // Virtual should equal harvested for full compensation
    
    if (virtualBalance.lt(expectedVirtual)) {
      const deficit = expectedVirtual.minus(virtualBalance);
      await this.reconcileUser(userId, deficit.toString(), 'Auto-sync balance adjustment');
      
      // Update shadow wallet virtual balance
      await db.update(shadowWallet)
        .set({ virtualBalance: expectedVirtual.toString() })
        .where(eq(shadowWallet.id, sw.id));
      
      return { adjusted: true, amount: deficit.toString() };
    }
    
    return { adjusted: false, amount: '0' };
  }
  
  /**
   * Stop the reconciliation loop
   */
  stop() {
    this.isRunning = false;
    console.log('[LedgerReconciliation] Stopping...');
  }
  
  /**
   * Get statistics
   */
  getStats() {
    return {
      isRunning: this.isRunning,
      reconciliationCount: this.reconciliationCount,
      totalCompensated: this.totalCompensated.toString()
    };
  }
}

// ============================================================
// WORKER ENTRY POINT
// ============================================================
const reconciliationService = new LedgerReconciliationService();

// HTTP endpoint using Bun.serve
const server = Bun.serve({
  port: parseInt(process.env.RECONCILIATION_WORKER_PORT || '3002'),
  
  async fetch(req) {
    const url = new URL(req.url);
    
    switch (url.pathname) {
      case '/internal/reconciliation-status':
        return Response.json({
          status: 'operational',
          metrics: reconciliationService.getStats(),
          timestamp: Date.now()
        });
      
      case '/internal/manual-reconcile':
        if (req.method !== 'POST') {
          return new Response('Method not allowed', { status: 405 });
        }
        
        const authHeader = req.headers.get('X-Internal-Auth');
        if (authHeader !== process.env.INTERNAL_AUTH_TOKEN) {
          return new Response('Unauthorized', { status: 401 });
        }
        
        try {
          const body = await req.json() as { userId: number; amount: string; reason?: string };
          const result = await reconciliationService.reconcileUser(
            body.userId,
            body.amount,
            body.reason
          );
          return Response.json(result);
        } catch (error: any) {
          return Response.json({ error: error.message }, { status: 400 });
        }
      
      case '/internal/sync-user-balance':
        if (req.method !== 'POST') {
          return new Response('Method not allowed', { status: 405 });
        }
        
        const auth = req.headers.get('X-Internal-Auth');
        if (auth !== process.env.INTERNAL_AUTH_TOKEN) {
          return new Response('Unauthorized', { status: 401 });
        }
        
        try {
          const body = await req.json() as { userId: number; address: string; chain: string };
          const result = await reconciliationService.syncUserBalance(
            body.userId,
            body.address,
            body.chain
          );
          return Response.json(result);
        } catch (error: any) {
          return Response.json({ error: error.message }, { status: 400 });
        }
      
      default:
        return new Response('Not found', { status: 404 });
    }
  }
});

console.log(`[LedgerReconciliation] Service running on port ${server.port}`);

// Initialize and start
(async () => {
  try {
    await reconciliationService.initialize();
    await reconciliationService.startReconciliationLoop();
  } catch (error) {
    console.error('[LedgerReconciliation] Fatal error:', error);
    process.exit(1);
  }
})();

// Graceful shutdown
process.on('SIGINT', () => {
  reconciliationService.stop();
  server.stop();
  process.exit(0);
});

process.on('SIGTERM', () => {
  reconciliationService.stop();
  server.stop();
  process.exit(0);
});

export { LedgerReconciliationService };
