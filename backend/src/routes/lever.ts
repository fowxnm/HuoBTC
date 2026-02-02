import { Elysia, t } from 'elysia';
import { db, usersWallet, leverTransaction } from '../db';
import { eq, and, sql } from 'drizzle-orm';

export const leverRoutes = new Elysia({ prefix: '/lever' })
  // Open position
  .post('/open', async ({ body, headers, jwt }) => {
    const authorization = headers.authorization;
    if (!authorization) {
      return { type: 'error', message: 'Unauthorized' };
    }

    const token = authorization.replace('Bearer ', '');
    const payload = await jwt.verify(token) as { uid: number };
    
    if (!payload) {
      return { type: 'error', message: 'Invalid token' };
    }

    const { currency_id, legal_id, type, multiple, price, number } = body;
    const userId = payload.uid;

    // Get user's lever wallet
    const [leverWallet] = await db.select().from(usersWallet)
      .where(and(
        eq(usersWallet.userId, userId),
        eq(usersWallet.currency, legal_id)
      ))
      .limit(1);

    if (!leverWallet) {
      return { type: 'error', message: 'Lever wallet not found' };
    }

    // Calculate margin required
    const margin = (price * number) / multiple;
    const availableBalance = parseFloat(leverWallet.leverBalance?.toString() || '0');

    if (margin > availableBalance) {
      return { type: 'error', message: 'Insufficient margin' };
    }

    const now = Math.floor(Date.now() / 1000);

    // Create lever transaction
    const [newTransaction] = await db.insert(leverTransaction).values({
      userId,
      price: price.toString(),
      number: number.toString(),
      currency: currency_id,
      legal: legal_id,
      type, // 1=做多, 2=做空
      multiple,
      status: 0, // 持仓中
      createTime: now
    }).returning();

    // Lock margin
    const newLeverBalance = (availableBalance - margin).toFixed(8);
    const newLockLeverBalance = (parseFloat(leverWallet.lockLeverBalance?.toString() || '0') + margin).toFixed(8);

    await db.update(usersWallet)
      .set({
        leverBalance: newLeverBalance,
        lockLeverBalance: newLockLeverBalance
      })
      .where(eq(usersWallet.id, leverWallet.id));

    return {
      type: 'ok',
      message: 'Position opened successfully',
      data: {
        order_id: newTransaction.id
      }
    };
  }, {
    body: t.Object({
      currency_id: t.Number(),
      legal_id: t.Number(),
      type: t.Number(), // 1=做多, 2=做空
      multiple: t.Number(),
      price: t.Number(),
      number: t.Number()
    })
  })

  // Close position
  .post('/close', async ({ body, headers, jwt }) => {
    const authorization = headers.authorization;
    if (!authorization) {
      return { type: 'error', message: 'Unauthorized' };
    }

    const token = authorization.replace('Bearer ', '');
    const payload = await jwt.verify(token) as { uid: number };
    
    if (!payload) {
      return { type: 'error', message: 'Invalid token' };
    }

    const { order_id, price } = body;
    const userId = payload.uid;

    // Get the lever transaction
    const [transaction] = await db.select().from(leverTransaction)
      .where(and(
        eq(leverTransaction.id, order_id),
        eq(leverTransaction.userId, userId),
        eq(leverTransaction.status, 0) // 持仓中
      ))
      .limit(1);

    if (!transaction) {
      return { type: 'error', message: 'Position not found' };
    }

    const openPrice = parseFloat(transaction.price?.toString() || '0');
    const closePrice = price;
    const number = parseFloat(transaction.number?.toString() || '0');
    const multiple = transaction.multiple;
    const type = transaction.type;

    // Calculate profit/loss
    let profitLoss: number;
    if (type === 1) {
      // 做多: profit when price goes up
      profitLoss = (closePrice - openPrice) * number * multiple;
    } else {
      // 做空: profit when price goes down
      profitLoss = (openPrice - closePrice) * number * multiple;
    }

    const margin = (openPrice * number) / multiple;
    const settlement = margin + profitLoss;

    const now = Math.floor(Date.now() / 1000);

    // Update transaction
    await db.update(leverTransaction)
      .set({
        status: 1, // 已平仓
        factProfits: profitLoss.toFixed(8),
        settled: 1
      })
      .where(eq(leverTransaction.id, order_id));

    // Get user's lever wallet
    const [leverWallet] = await db.select().from(usersWallet)
      .where(and(
        eq(usersWallet.userId, userId),
        eq(usersWallet.currency, transaction.legal)
      ))
      .limit(1);

    if (leverWallet) {
      // Return margin + profit/loss
      const newLeverBalance = (parseFloat(leverWallet.leverBalance?.toString() || '0') + settlement).toFixed(8);
      const newLockLeverBalance = (parseFloat(leverWallet.lockLeverBalance?.toString() || '0') - margin).toFixed(8);

      await db.update(usersWallet)
        .set({
          leverBalance: newLeverBalance,
          lockLeverBalance: newLockLeverBalance
        })
        .where(eq(usersWallet.id, leverWallet.id));
    }

    return {
      type: 'ok',
      message: 'Position closed successfully',
      data: {
        profit_loss: profitLoss,
        settlement
      }
    };
  }, {
    body: t.Object({
      order_id: t.Number(),
      price: t.Number()
    })
  })

  // Get positions
  .get('/positions', async ({ query, headers, jwt }) => {
    const authorization = headers.authorization;
    if (!authorization) {
      return { type: 'error', message: 'Unauthorized' };
    }

    const token = authorization.replace('Bearer ', '');
    const payload = await jwt.verify(token) as { uid: number };
    
    if (!payload) {
      return { type: 'error', message: 'Invalid token' };
    }

    const status = parseInt(query.status || '0');

    const positions = await db.select().from(leverTransaction)
      .where(and(
        eq(leverTransaction.userId, payload.uid),
        eq(leverTransaction.status, status)
      ))
      .orderBy(sql`${leverTransaction.createTime} DESC`);

    return {
      type: 'ok',
      data: positions.map(p => ({
        id: p.id,
        currency: p.currency,
        legal: p.legal,
        type: p.type,
        price: p.price,
        number: p.number,
        multiple: p.multiple,
        status: p.status,
        fact_profits: p.factProfits,
        create_time: p.createTime
      }))
    };
  }, {
    query: t.Object({
      status: t.Optional(t.String())
    })
  })

  // Get leverage config
  .get('/config', async () => {
    return {
      type: 'ok',
      data: {
        multiples: [5, 10, 20, 50, 100],
        min_margin: 10,
        max_margin: 100000,
        fee_rate: 0.0006
      }
    };
  });
