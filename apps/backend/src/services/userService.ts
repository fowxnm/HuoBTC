import { db } from '../db';
import { users, usersWallet, accountLog, walletLog, algebra, userAlgebra, agent } from '../db/schema';
import { eq, and, sql } from 'drizzle-orm';

// Account log types - ported from PHP
export const AccountLogType = {
  ADMIN_LEGAL_BALANCE: 1,
  ADMIN_LOCK_LEGAL_BALANCE: 2,
  ADMIN_CHANGE_BALANCE: 3,
  ADMIN_LOCK_CHANGE_BALANCE: 4,
  ADMIN_LEVER_BALANCE: 5,
  ADMIN_LOCK_LEVER_BALANCE: 6,
  ADMIN_MICRO_BALANCE: 7,
  ADMIN_LOCK_MICRO_BALANCE: 8,
  WALLET_CURRENCY_OUT: 7,
  WALLET_CURRENCY_IN: 8,
  INVITATION_TO_RETURN: 33,
  LEVER_TRANSACTION: 30,
  LEVER_TRANSACTION_ADD: 31,
  MICRO_TRADE_SUBMIT: 501,
  MICRO_TRADE_CLOSE_SETTLE: 502,
  LOWER_REBATE: 250,
} as const;

// Balance types
export const BalanceType = {
  LEGAL: 1,    // 资金账户
  CHANGE: 2,   // 币币账户
  LEVER: 3,    // 合约账户
  MICRO: 4,    // 期权账户
} as const;

/**
 * Generate extension/invitation code
 */
export async function generateExtensionCode(): Promise<string> {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  
  // Check if code exists
  const existing = await db.select().from(users).where(eq(users.extensionCode, code)).limit(1);
  if (existing.length > 0) {
    return generateExtensionCode(); // Recursively generate new code
  }
  return code;
}

/**
 * Hash password - ported from PHP Users::MakePassword
 */
export function makePassword(password: string, type: number = 0): string {
  if (type === 0) {
    let salt = 'ABCDEFG';
    for (const char of password) {
      salt += Bun.hash(char).toString(16);
    }
    return Bun.hash(salt).toString(16);
  } else {
    const salt = 'TPSHOP' + password;
    return Bun.hash(salt).toString(16);
  }
}

/**
 * Get user's agent hierarchy path
 */
export async function getAgentPath(parentId: number): Promise<string> {
  if (parentId === 0) return '';
  
  const parentUser = await db.select().from(users).where(eq(users.id, parentId)).limit(1);
  if (!parentUser.length) return '';
  
  const parent = parentUser[0];
  
  // If parent is an agent, get agent's path
  if (parent.agentId > 0) {
    const agentRecord = await db.select().from(agent).where(eq(agent.id, parent.agentId)).limit(1);
    if (agentRecord.length) {
      return agentRecord[0].agentPath;
    }
  }
  
  return parent.path || '';
}

/**
 * Get user's parent agent ID
 */
export async function getParentAgentId(parentId: number): Promise<number> {
  if (parentId === 0) {
    // No parent - return admin agent or 0
    const adminAgent = await db.select().from(agent)
      .where(and(eq(agent.isAdmin, 1), eq(agent.level, 0)))
      .limit(1);
    return adminAgent.length ? adminAgent[0].id : 0;
  }
  
  const parentUser = await db.select().from(users).where(eq(users.id, parentId)).limit(1);
  if (!parentUser.length) return 0;
  
  const parent = parentUser[0];
  
  // If parent is an agent, return their agent ID
  if (parent.agentId > 0) {
    return parent.agentId;
  }
  
  // If parent belongs to an agent, return that agent
  if (parent.agentNoteId > 0) {
    return parent.agentNoteId;
  }
  
  return 0;
}

/**
 * Change wallet balance and log the transaction
 * Ported from PHP change_wallet_balance helper
 */
export async function changeWalletBalance(
  userId: number,
  currencyId: number,
  balanceType: number,
  change: number,
  logType: number,
  info: string,
  isLock: boolean = false
): Promise<boolean> {
  try {
    return await db.transaction(async (tx) => {
      // Get wallet
      const wallet = await tx.select().from(usersWallet)
        .where(and(eq(usersWallet.userId, userId), eq(usersWallet.currency, currencyId)))
        .limit(1);
      
      if (!wallet.length) {
        throw new Error('Wallet not found');
      }
      
      const w = wallet[0];
      let beforeAmount: number;
      let afterAmount: number;
      let updateField: string;
      
      // Determine which balance to update
      switch (balanceType) {
        case BalanceType.LEGAL:
          beforeAmount = isLock ? parseFloat(w.lockLegalBalance) : parseFloat(w.legalBalance);
          afterAmount = beforeAmount + change;
          updateField = isLock ? 'lock_legal_balance' : 'legal_balance';
          break;
        case BalanceType.CHANGE:
          beforeAmount = isLock ? parseFloat(w.lockChangeBalance) : parseFloat(w.changeBalance);
          afterAmount = beforeAmount + change;
          updateField = isLock ? 'lock_change_balance' : 'change_balance';
          break;
        case BalanceType.LEVER:
          beforeAmount = isLock ? parseFloat(w.lockLeverBalance) : parseFloat(w.leverBalance);
          afterAmount = beforeAmount + change;
          updateField = isLock ? 'lock_lever_balance' : 'lever_balance';
          break;
        case BalanceType.MICRO:
          beforeAmount = isLock ? parseFloat(w.lockMicroBalance) : parseFloat(w.microBalance);
          afterAmount = beforeAmount + change;
          updateField = isLock ? 'lock_micro_balance' : 'micro_balance';
          break;
        default:
          throw new Error('Invalid balance type');
      }
      
      if (afterAmount < 0) {
        throw new Error('Insufficient balance');
      }
      
      // Update wallet balance
      await tx.execute(sql`
        UPDATE users_wallet 
        SET ${sql.raw(updateField)} = ${afterAmount.toFixed(8)}
        WHERE id = ${w.id}
      `);
      
      // Insert account log
      const [logEntry] = await tx.insert(accountLog).values({
        userId,
        value: change.toFixed(8),
        createdTime: Math.floor(Date.now() / 1000),
        info,
        type: logType,
        currency: currencyId,
        isLock: isLock ? 1 : 0
      }).returning();
      
      // Insert wallet log
      await tx.insert(walletLog).values({
        accountLogId: logEntry.id,
        walletId: w.id,
        balanceType,
        lockType: isLock ? 1 : 0,
        beforeAmount: beforeAmount.toFixed(8),
        changeAmount: change.toFixed(8),
        afterAmount: afterAmount.toFixed(8),
        memo: info,
        createTime: Math.floor(Date.now() / 1000)
      });
      
      return true;
    });
  } catch (error) {
    console.error('changeWalletBalance error:', error);
    return false;
  }
}

/**
 * Tiered rebate system - ported from PHP Users::rebate
 * Recursively calculates and distributes rebates up the referral chain
 */
export async function processRebate(
  userId: number,
  touchUserId: number,
  currencyId: number,
  amount: number,
  generation: number = 1,
  maxGenerations: number = 0
): Promise<boolean> {
  try {
    // Get user
    const userRecord = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!userRecord.length) return true;
    
    const user = userRecord[0];
    
    // No parent - end recursion
    if (user.parentId === 0) return true;
    
    // Get parent's wallet
    const parentWallet = await db.select().from(usersWallet)
      .where(and(eq(usersWallet.userId, user.parentId), eq(usersWallet.currency, currencyId)))
      .limit(1);
    
    // Get rebate rate for this generation
    const algebraRecord = await db.select().from(algebra)
      .where(eq(algebra.algebra, generation))
      .limit(1);
    
    if (!algebraRecord.length || !parentWallet.length) {
      // No rate defined for this generation, continue to next
      return processRebate(user.parentId, touchUserId, currencyId, amount, generation + 1, maxGenerations - 1);
    }
    
    const rate = parseFloat(algebraRecord[0].rate);
    const rebateAmount = amount * rate / 100;
    
    // Get touch user info for logging
    const touchUser = await db.select().from(users).where(eq(users.id, touchUserId)).limit(1);
    const touchAccountNumber = touchUser.length ? touchUser[0].accountNumber : String(touchUserId);
    
    const info = `第${generation}代用户${touchAccountNumber}返手续费：${rebateAmount.toFixed(8)}`;
    
    // Credit rebate to parent
    await changeWalletBalance(
      user.parentId,
      currencyId,
      BalanceType.MICRO,
      rebateAmount,
      AccountLogType.MICRO_TRADE_CLOSE_SETTLE,
      info
    );
    
    // Record rebate log
    await db.insert(userAlgebra).values({
      userId: user.parentId,
      touchUserId,
      algebra: generation,
      info,
      value: rebateAmount.toFixed(8)
    });
    
    // Continue to next generation if not at limit
    if (maxGenerations === 0 || maxGenerations > 1) {
      return processRebate(
        user.parentId,
        touchUserId,
        currencyId,
        amount,
        generation + 1,
        maxGenerations > 0 ? maxGenerations - 1 : 0
      );
    }
    
    return true;
  } catch (error) {
    console.error('processRebate error:', error);
    return false;
  }
}

/**
 * Initialize wallets for a new user
 */
export async function initializeUserWallets(userId: number): Promise<void> {
  // Get all currencies
  const currencies = await db.execute(sql`SELECT id FROM currency WHERE is_display = 1`);
  const now = Math.floor(Date.now() / 1000);
  
  for (const curr of currencies.rows as any[]) {
    await db.insert(usersWallet).values({
      userId,
      currency: curr.id,
      createTime: now
    }).onConflictDoNothing();
  }
}

/**
 * Get user with all relationships
 */
export async function getUserWithDetails(userId: number) {
  const user = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user.length) return null;
  
  const wallets = await db.select().from(usersWallet).where(eq(usersWallet.userId, userId));
  
  let parentAgent = null;
  if (user[0].agentNoteId > 0) {
    const agentRecord = await db.select().from(agent).where(eq(agent.id, user[0].agentNoteId)).limit(1);
    if (agentRecord.length) {
      parentAgent = agentRecord[0];
    }
  }
  
  return {
    ...user[0],
    wallets,
    parentAgent
  };
}
