/**
 * Micro/Seconds Contract Service (秒合约服务)
 * 
 * Ported from PHP: MicroTradeLogic.php, MicroOrder.php
 * 
 * Features:
 * - Short-term trading (30s, 60s, 120s, 300s contracts)
 * - Rise/Fall prediction (买涨/买跌)
 * - Profit/Loss settlement
 * - Risk control integration
 */

import { db } from '../db';
import { 
  microOrder, microSeconds, users, usersWallet, currency, currencyMatch, accountLog 
} from '../db/schema';
import { eq, and, lte, sql, desc } from 'drizzle-orm';
import BigNumber from 'bignumber.js';

// Order Types
export const OrderType = {
  RISE: 1,  // 买涨
  FALL: 2,  // 买跌
} as const;

// Order Status
export const OrderStatus = {
  OPENED: 1,   // 交易中
  CLOSING: 2,  // 平仓中
  CLOSED: 3,   // 已平仓
} as const;

// Profit Result
export const ProfitResult = {
  LOSS: -1,    // 亏损
  BALANCE: 0,  // 平局
  PROFIT: 1,   // 盈利
} as const;

// Account Log Types for micro trading
export const MicroLogType = {
  DEDUCT_PRINCIPAL: 71,       // 秒合约下单扣除本金
  DEDUCT_FEE: 72,             // 秒合约下单扣除手续费
  SETTLE_PROFIT: 73,          // 秒合约平仓盈利结算
  SETTLE_LOSS: 74,            // 秒合约平仓亏损结算
  SETTLE_BALANCE: 75,         // 秒合约平仓平局结算
} as const;

interface AddOrderParams {
  userId: number;
  matchId: number;
  currencyId: number;
  type: 1 | 2;  // 1=rise, 2=fall
  seconds: number;
  price: string;
  number: string;  // Amount in USDT
}

interface MicroOrderResult {
  id: number;
  userId: number;
  matchId: number;
  currencyId: number;
  type: number;
  seconds: number;
  number: string;
  openPrice: string;
  endPrice: string;
  profitRatio: string;
  lossRatio: string;
  fee: string;
  status: number;
  handledAt: Date;
}

/**
 * Add a new micro/seconds contract order
 */
export async function addMicroOrder(params: AddOrderParams): Promise<MicroOrderResult> {
  const { userId, matchId, currencyId, type, seconds, price, number } = params;

  // Validate user
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) throw new Error('User not found');

  // Validate currency match
  const [match] = await db.select().from(currencyMatch).where(eq(currencyMatch.id, matchId)).limit(1);
  if (!match) throw new Error('Trading pair not found');
  if (!match.openMicro) throw new Error('Micro trading not enabled for this pair');

  // Validate currency
  const [curr] = await db.select().from(currency).where(eq(currency.id, currencyId)).limit(1);
  if (!curr) throw new Error('Currency not found');

  // Validate seconds option
  const [secondsOption] = await db.select().from(microSeconds)
    .where(eq(microSeconds.seconds, seconds)).limit(1);
  if (!secondsOption) throw new Error('Invalid time period');

  // Validate amount
  const orderAmount = new BigNumber(number);
  if (orderAmount.lte(0)) throw new Error('Amount must be greater than 0');
  if (!orderAmount.isInteger()) throw new Error('Amount must be an integer');

  // Get user wallet
  const [wallet] = await db.select().from(usersWallet)
    .where(and(
      eq(usersWallet.userId, userId),
      eq(usersWallet.currency, currencyId)
    )).limit(1);
  if (!wallet) throw new Error('Wallet not found');

  // Check balance (use micro_balance)
  const availableBalance = new BigNumber(wallet.microBalance?.toString() || '0');
  
  // Calculate fee
  const feeRate = new BigNumber(curr.microTradeFee?.toString() || '0');
  const fee = orderAmount.times(feeRate).div(100);
  const totalCost = orderAmount.plus(fee);

  if (availableBalance.lt(totalCost)) {
    throw new Error('Insufficient balance');
  }

  // Calculate handled_at (when the order should be settled)
  const now = new Date();
  const handledAt = new Date(now.getTime() + seconds * 1000);

  // Get user risk setting for pre-determined result
  const preResult = user.risk || 0;

  // Start transaction
  const result = await db.transaction(async (tx) => {
    // Deduct principal
    const newBalance = availableBalance.minus(totalCost).toFixed(8);
    await tx.update(usersWallet)
      .set({ microBalance: newBalance })
      .where(eq(usersWallet.id, wallet.id));

    // Log principal deduction
    await tx.insert(accountLog).values({
      userId,
      value: `-${number}`,
      createdTime: Math.floor(Date.now() / 1000),
      info: '秒合约下单扣除本金',
      type: MicroLogType.DEDUCT_PRINCIPAL,
      currency: currencyId,
    });

    // Log fee deduction
    if (fee.gt(0)) {
      await tx.insert(accountLog).values({
        userId,
        value: `-${fee.toFixed(8)}`,
        createdTime: Math.floor(Date.now() / 1000),
        info: `秒合约下单扣除${feeRate.toFixed(2)}%手续费`,
        type: MicroLogType.DEDUCT_FEE,
        currency: currencyId,
      });
    }

    // Create order
    const [order] = await tx.insert(microOrder).values({
      userId,
      matchId,
      currencyId,
      type,
      seconds,
      number,
      openPrice: price,
      endPrice: price,
      profitRatio: secondsOption.profitRatio?.toString() || '85',
      lossRatio: secondsOption.lossRatio?.toString() || '100',
      fee: fee.toFixed(8),
      status: OrderStatus.OPENED,
      preResult,
      handledAt: Math.floor(handledAt.getTime() / 1000),
      createdAt: Math.floor(now.getTime() / 1000),
    }).returning();

    return order;
  });

  return {
    id: result.id,
    userId: result.userId,
    matchId: result.matchId,
    currencyId: result.currencyId,
    type: result.type,
    seconds: result.seconds,
    number: result.number,
    openPrice: result.openPrice,
    endPrice: result.endPrice,
    profitRatio: result.profitRatio,
    lossRatio: result.lossRatio,
    fee: result.fee,
    status: result.status,
    handledAt: new Date(result.handledAt * 1000),
  };
}

/**
 * Get available time periods for micro trading
 */
export async function getMicroSeconds() {
  const seconds = await db.select().from(microSeconds)
    .where(eq(microSeconds.status, 1))
    .orderBy(microSeconds.seconds);
  
  return seconds.map(s => ({
    seconds: s.seconds,
    profitRatio: s.profitRatio,
    lossRatio: s.lossRatio,
    label: formatSecondsLabel(s.seconds),
  }));
}

function formatSecondsLabel(seconds: number): string {
  if (seconds < 60) return `${seconds}秒`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}分钟`;
  return `${Math.floor(seconds / 3600)}小时`;
}

/**
 * Get user's micro orders
 */
export async function getUserMicroOrders(userId: number, status?: number, limit = 20, offset = 0) {
  let query = db.select().from(microOrder)
    .where(eq(microOrder.userId, userId));
  
  if (status !== undefined) {
    query = query.where(and(
      eq(microOrder.userId, userId),
      eq(microOrder.status, status)
    )) as any;
  }

  const orders = await query
    .orderBy(desc(microOrder.createdAt))
    .limit(limit)
    .offset(offset);

  return orders.map(order => ({
    ...order,
    typeName: order.type === OrderType.RISE ? '涨' : '跌',
    statusName: getStatusName(order.status),
    remainMs: getRemainingMs(order.handledAt, order.status),
  }));
}

function getStatusName(status: number): string {
  switch (status) {
    case OrderStatus.OPENED: return '交易中';
    case OrderStatus.CLOSING: return '平仓中';
    case OrderStatus.CLOSED: return '已平仓';
    default: return '未知';
  }
}

function getRemainingMs(handledAt: number, status: number): number {
  if (status !== OrderStatus.OPENED) return 0;
  const remaining = handledAt * 1000 - Date.now();
  return Math.max(0, remaining);
}

/**
 * Close expired orders (called by worker)
 */
export async function closeExpiredOrders(matchId: number) {
  const now = Math.floor(Date.now() / 1000);
  
  // Find orders that need closing
  const expiredOrders = await db.select().from(microOrder)
    .where(and(
      eq(microOrder.matchId, matchId),
      eq(microOrder.status, OrderStatus.OPENED),
      lte(microOrder.handledAt, now)
    ));

  if (expiredOrders.length === 0) return { closed: 0 };

  let closedCount = 0;

  for (const order of expiredOrders) {
    try {
      await settleOrder(order);
      closedCount++;
    } catch (error) {
      console.error(`Failed to close order ${order.id}:`, error);
    }
  }

  return { closed: closedCount };
}

/**
 * Settle a single order
 */
async function settleOrder(order: any) {
  // Determine profit/loss based on price movement
  const openPrice = new BigNumber(order.openPrice);
  const endPrice = new BigNumber(order.endPrice);
  
  let profitType: number;
  
  if (endPrice.gt(openPrice)) {
    // Price went up
    profitType = order.type === OrderType.RISE ? ProfitResult.PROFIT : ProfitResult.LOSS;
  } else if (endPrice.lt(openPrice)) {
    // Price went down
    profitType = order.type === OrderType.FALL ? ProfitResult.PROFIT : ProfitResult.LOSS;
  } else {
    // No change
    profitType = ProfitResult.BALANCE;
  }

  // Override with pre-determined result if set
  if (order.preResult !== 0) {
    profitType = order.preResult;
  }

  // Calculate settlement
  const principal = new BigNumber(order.number);
  const profitRatio = new BigNumber(order.profitRatio).div(100);
  const lossRatio = new BigNumber(order.lossRatio).div(100);

  let change: BigNumber;
  let factProfit: BigNumber;
  let logType: number;
  let memo: string;

  if (profitType === ProfitResult.PROFIT) {
    // Win: return principal + profit
    factProfit = principal.times(profitRatio);
    change = principal.plus(factProfit);
    logType = MicroLogType.SETTLE_PROFIT;
    memo = '秒合约订单平仓,盈利结算';
  } else if (profitType === ProfitResult.BALANCE) {
    // Draw: return principal only
    factProfit = new BigNumber(0);
    change = principal;
    logType = MicroLogType.SETTLE_BALANCE;
    memo = '秒合约订单平仓,平局结算';
  } else {
    // Loss: return partial or nothing based on loss ratio
    factProfit = principal.times(lossRatio).negated();
    change = principal.minus(principal.times(lossRatio));
    logType = MicroLogType.SETTLE_LOSS;
    memo = '秒合约订单,亏损结算';
  }

  await db.transaction(async (tx) => {
    // Update order status
    await tx.update(microOrder)
      .set({
        status: OrderStatus.CLOSED,
        profitResult: profitType,
        factProfit: factProfit.toFixed(8),
        completeAt: Math.floor(Date.now() / 1000),
      })
      .where(eq(microOrder.id, order.id));

    // Credit user wallet if any return
    if (change.gt(0)) {
      const [wallet] = await tx.select().from(usersWallet)
        .where(and(
          eq(usersWallet.userId, order.userId),
          eq(usersWallet.currency, order.currencyId)
        )).limit(1);

      if (wallet) {
        const newBalance = new BigNumber(wallet.microBalance?.toString() || '0')
          .plus(change).toFixed(8);
        
        await tx.update(usersWallet)
          .set({ microBalance: newBalance })
          .where(eq(usersWallet.id, wallet.id));

        // Log settlement
        await tx.insert(accountLog).values({
          userId: order.userId,
          value: change.toFixed(8),
          createdTime: Math.floor(Date.now() / 1000),
          info: memo,
          type: logType,
          currency: order.currencyId,
        });
      }
    }
  });
}

/**
 * Update end price for open orders (called when price updates)
 */
export async function updateOrderEndPrice(matchId: number, newPrice: string) {
  await db.update(microOrder)
    .set({ endPrice: newPrice })
    .where(and(
      eq(microOrder.matchId, matchId),
      eq(microOrder.status, OrderStatus.OPENED),
      eq(microOrder.preResult, 0)  // Only update non-preset orders
    ));
}

/**
 * Get micro trading pairs
 */
export async function getMicroTradingPairs() {
  const pairs = await db.select().from(currencyMatch)
    .where(eq(currencyMatch.openMicro, 1));
  
  return pairs;
}

export default {
  addMicroOrder,
  getMicroSeconds,
  getUserMicroOrders,
  closeExpiredOrders,
  updateOrderEndPrice,
  getMicroTradingPairs,
  OrderType,
  OrderStatus,
  ProfitResult,
};
