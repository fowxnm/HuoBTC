/**
 * Micro/Seconds Contract Routes (秒合约路由)
 * 
 * Short-term trading with 30s/60s/120s/300s contracts
 * Users predict if price will rise or fall
 */

import { Elysia, t } from 'elysia';
import { db } from '../db';
import { 
  microOrder, users, usersWallet, currency, currencyMatch, accountLog 
} from '../db/schema';
import { eq, and, lte, desc, sql } from 'drizzle-orm';

// Order constants
const OrderType = { RISE: 1, FALL: 2 };
const OrderStatus = { OPENED: 1, CLOSING: 2, CLOSED: 3 };
const ProfitResult = { LOSS: -1, BALANCE: 0, PROFIT: 1 };

// Micro seconds configuration (time periods): 收益% + 最低买入价(USDT)
const MICRO_SECONDS_CONFIG = [
  { seconds: 30, profitRatio: 10, lossRatio: 100, minAmount: 100, label: '30秒' },
  { seconds: 60, profitRatio: 18, lossRatio: 100, minAmount: 1000, label: '60秒' },
  { seconds: 120, profitRatio: 25, lossRatio: 100, minAmount: 5000, label: '2分钟' },
  { seconds: 300, profitRatio: 35, lossRatio: 100, minAmount: 10000, label: '5分钟' },
  { seconds: 600, profitRatio: 50, lossRatio: 100, minAmount: 50000, label: '10分钟' },
];

export const microRoutes = new Elysia({ prefix: '/micro' })

  /**
   * Get available time periods
   */
  .get('/seconds', () => {
    return {
      type: 'ok',
      data: MICRO_SECONDS_CONFIG
    };
  })

  /**
   * Get trading pairs enabled for micro trading
   */
  .get('/pairs', async () => {
    const pairs = await db.select().from(currencyMatch)
      .where(eq(currencyMatch.openMicro, 1));
    
    return {
      type: 'ok',
      data: pairs.map(p => ({
        id: p.id,
        symbol: `${p.currencyName}/${p.legalName}`,
        currencyName: p.currencyName,
        legalName: p.legalName,
      }))
    };
  })

  /**
   * Place a micro order (买涨/买跌)
   */
  .post('/order', async ({ body, headers, jwt }: any) => {
    const authorization = headers.authorization;
    if (!authorization) {
      return { type: 'error', message: 'Unauthorized' };
    }

    const token = authorization.replace('Bearer ', '');
    const payload = await jwt.verify(token) as { userId: number; type: string };
    
    if (!payload || payload.type !== 'user') {
      return { type: 'error', message: 'Invalid token' };
    }

    const { match_id, currency_id, type, seconds, price, number } = body;

    try {
      // Validate user
      const [user] = await db.select().from(users)
        .where(eq(users.id, payload.userId)).limit(1);
      if (!user) {
        return { type: 'error', message: 'User not found' };
      }

      // Validate trading pair
      const [match] = await db.select().from(currencyMatch)
        .where(eq(currencyMatch.id, match_id)).limit(1);
      if (!match || !match.openMicro) {
        return { type: 'error', message: 'Trading pair not available' };
      }

      // Validate seconds option
      const secondsConfig = MICRO_SECONDS_CONFIG.find(s => s.seconds === seconds);
      if (!secondsConfig) {
        return { type: 'error', message: 'Invalid time period' };
      }

      // Validate amount
      const orderAmount = parseFloat(number);
      if (isNaN(orderAmount) || orderAmount <= 0) {
        return { type: 'error', message: 'Invalid amount' };
      }
      if (!Number.isInteger(orderAmount)) {
        return { type: 'error', message: 'Amount must be an integer' };
      }
      const minAmount = (secondsConfig as { minAmount?: number }).minAmount ?? 0;
      if (minAmount > 0 && orderAmount < minAmount) {
        return { type: 'error', message: `${secondsConfig.label}最低买入${minAmount} USDT` };
      }

      // Get user wallet
      const [wallet] = await db.select().from(usersWallet)
        .where(and(
          eq(usersWallet.userId, payload.userId),
          eq(usersWallet.currency, currency_id)
        )).limit(1);
      
      if (!wallet) {
        return { type: 'error', message: 'Wallet not found' };
      }

      // Check balance (micro_balance)
      const balance = parseFloat(wallet.microBalance?.toString() || '0');
      const fee = orderAmount * 0.01; // 1% fee
      const totalCost = orderAmount + fee;

      if (balance < totalCost) {
        return { type: 'error', message: 'Insufficient balance' };
      }

      // Calculate handled_at
      const now = Date.now();
      const handledAt = Math.floor((now + seconds * 1000) / 1000);

      // Create order in transaction
      const newBalance = (balance - totalCost).toFixed(8);
      
      await db.update(usersWallet)
        .set({ microBalance: newBalance })
        .where(eq(usersWallet.id, wallet.id));

      const [order] = await db.insert(microOrder).values({
        userId: payload.userId,
        matchId: match_id,
        currencyId: currency_id,
        type: type,
        seconds: seconds,
        number: number.toString(),
        openPrice: price.toString(),
        endPrice: price.toString(),
        profitRatio: secondsConfig.profitRatio.toString(),
        lossRatio: secondsConfig.lossRatio.toString(),
        fee: fee.toFixed(8),
        status: OrderStatus.OPENED,
        preResult: user.risk || 0,
        handledAt,
        createdAt: Math.floor(now / 1000),
      }).returning();

      // Log deduction
      await db.insert(accountLog).values({
        userId: payload.userId,
        value: `-${totalCost.toFixed(8)}`,
        createdTime: Math.floor(now / 1000),
        info: `秒合约下单: ${type === OrderType.RISE ? '买涨' : '买跌'} ${seconds}秒`,
        type: 71,
        currency: currency_id,
      });

      return {
        type: 'ok',
        message: 'Order placed successfully',
        data: {
          id: order.id,
          type: order.type,
          typeName: type === OrderType.RISE ? '涨' : '跌',
          seconds: order.seconds,
          number: order.number,
          openPrice: order.openPrice,
          profitRatio: order.profitRatio,
          fee: order.fee,
          handledAt: order.handledAt,
          remainMs: (order.handledAt * 1000) - Date.now(),
        }
      };
    } catch (error: any) {
      console.error('Micro order error:', error);
      return { type: 'error', message: error.message || 'Failed to place order' };
    }
  }, {
    body: t.Object({
      match_id: t.Number(),
      currency_id: t.Number(),
      type: t.Number(),       // 1=rise, 2=fall
      seconds: t.Number(),    // 30, 60, 120, 300, 600
      price: t.Number(),      // Current price
      number: t.Number(),     // Amount in USDT
    })
  })

  /**
   * Get user's micro orders
   */
  .get('/orders', async ({ query, headers, jwt }: any) => {
    const authorization = headers.authorization;
    if (!authorization) {
      return { type: 'error', message: 'Unauthorized' };
    }

    const token = authorization.replace('Bearer ', '');
    const payload = await jwt.verify(token) as { userId: number; type: string };
    
    if (!payload || payload.type !== 'user') {
      return { type: 'error', message: 'Invalid token' };
    }

    const status = query.status ? parseInt(query.status) : undefined;
    const page = parseInt(query.page || '1');
    const limit = parseInt(query.limit || '20');
    const offset = (page - 1) * limit;

    let queryBuilder = db.select().from(microOrder)
      .where(eq(microOrder.userId, payload.userId));

    if (status !== undefined) {
      queryBuilder = db.select().from(microOrder)
        .where(and(
          eq(microOrder.userId, payload.userId),
          eq(microOrder.status, status)
        ));
    }

    const orders = await queryBuilder
      .orderBy(desc(microOrder.createdAt))
      .limit(limit)
      .offset(offset);

    const now = Date.now();

    return {
      type: 'ok',
      data: {
        list: orders.map(o => ({
          id: o.id,
          type: o.type,
          typeName: o.type === OrderType.RISE ? '涨' : '跌',
          seconds: o.seconds,
          number: o.number,
          openPrice: o.openPrice,
          endPrice: o.endPrice,
          profitRatio: o.profitRatio,
          fee: o.fee,
          status: o.status,
          statusName: o.status === 1 ? '交易中' : o.status === 2 ? '平仓中' : '已平仓',
          profitResult: o.profitResult,
          profitResultName: o.profitResult === 1 ? '盈利' : o.profitResult === -1 ? '亏损' : '平局',
          factProfit: o.factProfit,
          handledAt: o.handledAt,
          remainMs: o.status === OrderStatus.OPENED ? Math.max(0, (o.handledAt * 1000) - now) : 0,
          createdAt: o.createdAt,
        })),
        page,
        limit,
      }
    };
  })

  /**
   * Get active (open) orders for real-time display
   */
  .get('/active', async ({ headers, jwt }: any) => {
    const authorization = headers.authorization;
    if (!authorization) {
      return { type: 'error', message: 'Unauthorized' };
    }

    const token = authorization.replace('Bearer ', '');
    const payload = await jwt.verify(token) as { userId: number; type: string };
    
    if (!payload || payload.type !== 'user') {
      return { type: 'error', message: 'Invalid token' };
    }

    const orders = await db.select().from(microOrder)
      .where(and(
        eq(microOrder.userId, payload.userId),
        eq(microOrder.status, OrderStatus.OPENED)
      ))
      .orderBy(desc(microOrder.createdAt));

    const now = Date.now();

    return {
      type: 'ok',
      data: orders.map(o => ({
        id: o.id,
        type: o.type,
        typeName: o.type === OrderType.RISE ? '涨' : '跌',
        seconds: o.seconds,
        number: o.number,
        openPrice: o.openPrice,
        endPrice: o.endPrice,
        profitRatio: o.profitRatio,
        remainMs: Math.max(0, (o.handledAt * 1000) - now),
        progress: Math.min(100, ((now - (o.createdAt * 1000)) / (o.seconds * 1000)) * 100),
      }))
    };
  })

  /**
   * Get order statistics
   */
  .get('/stats', async ({ headers, jwt }: any) => {
    const authorization = headers.authorization;
    if (!authorization) {
      return { type: 'error', message: 'Unauthorized' };
    }

    const token = authorization.replace('Bearer ', '');
    const payload = await jwt.verify(token) as { userId: number; type: string };
    
    if (!payload || payload.type !== 'user') {
      return { type: 'error', message: 'Invalid token' };
    }

    // Get stats
    const allOrders = await db.select().from(microOrder)
      .where(eq(microOrder.userId, payload.userId));

    const closedOrders = allOrders.filter(o => o.status === OrderStatus.CLOSED);
    const winOrders = closedOrders.filter(o => o.profitResult === ProfitResult.PROFIT);
    const lossOrders = closedOrders.filter(o => o.profitResult === ProfitResult.LOSS);

    const totalProfit = closedOrders.reduce((sum, o) => {
      return sum + parseFloat(o.factProfit || '0');
    }, 0);

    const winRate = closedOrders.length > 0 
      ? ((winOrders.length / closedOrders.length) * 100).toFixed(2)
      : '0.00';

    return {
      type: 'ok',
      data: {
        totalOrders: allOrders.length,
        closedOrders: closedOrders.length,
        activeOrders: allOrders.length - closedOrders.length,
        winCount: winOrders.length,
        lossCount: lossOrders.length,
        drawCount: closedOrders.length - winOrders.length - lossOrders.length,
        winRate,
        totalProfit: totalProfit.toFixed(2),
      }
    };
  });

export default microRoutes;
