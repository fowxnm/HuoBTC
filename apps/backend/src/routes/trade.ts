import { Elysia, t } from 'elysia';
import { db, usersWallet, currency, spotOrder } from '../db';
import { eq, and, desc, sql, inArray } from 'drizzle-orm';

export const tradeRoutes = new Elysia({ prefix: '/trade' })
  // Get currency list
  .get('/currency_list', async () => {
    const currencies = await db.select().from(currency)
      .where(eq(currency.isDisplay, 1));

    return {
      type: 'ok',
      data: currencies.map(c => ({
        id: c.id,
        name: c.name,
        logo: c.logo,
        is_lever: c.isLever,
        is_legal: c.isLegal,
        is_match: c.isMatch,
        min_number: c.minNumber,
        rate: c.rate
      }))
    };
  })

  // Get currency pairs（含外汇/股票/贵金属，legal 取 USDT 或首个法币）
  .get('/pairs', async ({ query }) => {
    const legalIdParam = query.legal_id;
    let legalId = legalIdParam ? parseInt(legalIdParam) : 0;
    if (!legalId) {
      const [usdtRow] = await db.select({ id: currency.id }).from(currency)
        .where(eq(currency.name, 'USDT')).limit(1);
      legalId = usdtRow?.id ?? 3;
    }

    const currencies = await db.select().from(currency)
      .where(and(
        eq(currency.isDisplay, 1),
        eq(currency.isMatch, 1)
      ));

    return {
      type: 'ok',
      data: currencies.map(c => ({
        currency_id: c.id,
        currency_name: c.name,
        legal_id: legalId,
        legal_name: 'USDT',
        logo: c.logo,
        asset_type: (c.type || 'crypto').toLowerCase()
      }))
    };
  }, {
    query: t.Object({
      legal_id: t.Optional(t.String())
    })
  })

  // Submit buy order
  .post('/buy', async ({ body, headers, jwt }) => {
    const authorization = headers.authorization;
    if (!authorization) {
      return { type: 'error', message: 'Unauthorized' };
    }

    const token = authorization.replace('Bearer ', '');
    const payload = await jwt.verify(token) as { uid: number };
    
    if (!payload) {
      return { type: 'error', message: 'Invalid token' };
    }

    const { currency_id, legal_id, price, number, type } = body;
    const userId = payload.uid;

    // Get user's legal currency wallet
    const [legalWallet] = await db.select().from(usersWallet)
      .where(and(
        eq(usersWallet.userId, userId),
        eq(usersWallet.currency, legal_id)
      ))
      .limit(1);

    if (!legalWallet) {
      return { type: 'error', message: 'Legal wallet not found' };
    }

    const totalCost = price * number;
    const availableBalance = parseFloat(legalWallet.legalBalance?.toString() || '0');

    if (totalCost > availableBalance) {
      return { type: 'error', message: 'Insufficient balance' };
    }

    const now = Math.floor(Date.now() / 1000);
    try {
      await db.transaction(async (tx) => {
        await tx.update(usersWallet)
          .set({
            legalBalance: sql`${usersWallet.legalBalance} - ${totalCost}`,
          })
          .where(and(
            eq(usersWallet.userId, userId),
            eq(usersWallet.currency, legal_id)
          ));
        const [currencyWallet] = await tx.select().from(usersWallet)
          .where(and(
            eq(usersWallet.userId, userId),
            eq(usersWallet.currency, currency_id)
          ))
          .limit(1);
        if (currencyWallet) {
          await tx.update(usersWallet)
            .set({
              changeBalance: sql`${usersWallet.changeBalance} + ${number}`,
            })
            .where(and(
              eq(usersWallet.userId, userId),
              eq(usersWallet.currency, currency_id)
            ));
        } else {
          await tx.insert(usersWallet).values({
            userId,
            currency: currency_id,
            legalBalance: '0',
            lockLegalBalance: '0',
            changeBalance: String(number),
            lockChangeBalance: '0',
            leverBalance: '0',
            lockLeverBalance: '0',
            microBalance: '0',
            lockMicroBalance: '0',
            createTime: now,
          });
        }
        const [order] = await tx.insert(spotOrder).values({
          userId,
          currencyId: currency_id,
          legalId: legal_id,
          price: String(price),
          number: String(number),
          type,
          side: 'buy',
          status: 2,
          dealNumber: String(number),
          dealMoney: String(totalCost),
          createTime: now,
        }).returning();
        return order;
      });
    } catch (err) {
      console.error('Trade buy error:', err);
      return { type: 'error', message: 'Order failed' };
    }

    return {
      type: 'ok',
      message: 'Order placed successfully',
      data: {
        order_id: Date.now()
      }
    };
  }, {
    body: t.Object({
      currency_id: t.Number(),
      legal_id: t.Number(),
      price: t.Number(),
      number: t.Number(),
      type: t.Number() // 1=limit, 2=market
    })
  })

  // Submit sell order
  .post('/sell', async ({ body, headers, jwt }) => {
    const authorization = headers.authorization;
    if (!authorization) {
      return { type: 'error', message: 'Unauthorized' };
    }

    const token = authorization.replace('Bearer ', '');
    const payload = await jwt.verify(token) as { uid: number };
    
    if (!payload) {
      return { type: 'error', message: 'Invalid token' };
    }

    const { currency_id, legal_id, price, number, type } = body;
    const userId = payload.uid;

    // Get user's currency wallet
    const [currencyWallet] = await db.select().from(usersWallet)
      .where(and(
        eq(usersWallet.userId, userId),
        eq(usersWallet.currency, currency_id)
      ))
      .limit(1);

    if (!currencyWallet) {
      return { type: 'error', message: 'Currency wallet not found' };
    }

    const availableBalance = parseFloat(currencyWallet.changeBalance?.toString() || '0');

    if (number > availableBalance) {
      return { type: 'error', message: 'Insufficient balance' };
    }

    const totalAmount = price * number;
    const now = Math.floor(Date.now() / 1000);
    try {
      await db.transaction(async (tx) => {
        await tx.update(usersWallet)
          .set({
            changeBalance: sql`${usersWallet.changeBalance} - ${number}`,
          })
          .where(and(
            eq(usersWallet.userId, userId),
            eq(usersWallet.currency, currency_id)
          ));
        const [legalWallet] = await tx.select().from(usersWallet)
          .where(and(
            eq(usersWallet.userId, userId),
            eq(usersWallet.currency, legal_id)
          ))
          .limit(1);
        if (!legalWallet) {
          await tx.insert(usersWallet).values({
            userId,
            currency: legal_id,
            legalBalance: String(totalAmount),
            lockLegalBalance: '0',
            changeBalance: '0',
            lockChangeBalance: '0',
            leverBalance: '0',
            lockLeverBalance: '0',
            microBalance: '0',
            lockMicroBalance: '0',
            createTime: now,
          });
        } else {
          await tx.update(usersWallet)
            .set({
              legalBalance: sql`${usersWallet.legalBalance} + ${totalAmount}`,
            })
            .where(and(
              eq(usersWallet.userId, userId),
              eq(usersWallet.currency, legal_id)
            ));
        }
        await tx.insert(spotOrder).values({
          userId,
          currencyId: currency_id,
          legalId: legal_id,
          price: String(price),
          number: String(number),
          type,
          side: 'sell',
          status: 2,
          dealNumber: String(number),
          dealMoney: String(totalAmount),
          createTime: now,
        });
      });
    } catch (err) {
      console.error('Trade sell error:', err);
      return { type: 'error', message: 'Order failed' };
    }

    return {
      type: 'ok',
      message: 'Order placed successfully',
      data: {
        order_id: Date.now()
      }
    };
  }, {
    body: t.Object({
      currency_id: t.Number(),
      legal_id: t.Number(),
      price: t.Number(),
      number: t.Number(),
      type: t.Number()
    })
  })

  // Get order history
  .get('/history', async ({ query, headers, jwt }) => {
    const authorization = headers.authorization;
    if (!authorization) {
      return { type: 'error', message: 'Unauthorized' };
    }

    const token = authorization.replace('Bearer ', '');
    const payload = await jwt.verify(token) as { uid: number };
    
    if (!payload) {
      return { type: 'error', message: 'Invalid token' };
    }

    const page = Math.max(1, parseInt(query.page || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(query.limit || '20')));
    const offset = (page - 1) * limit;

    const orders = await db.select({
      id: spotOrder.id,
      create_time: spotOrder.createTime,
      currency_id: spotOrder.currencyId,
      legal_id: spotOrder.legalId,
      type: spotOrder.type,
      side: spotOrder.side,
      price: spotOrder.price,
      number: spotOrder.number,
      deal_number: spotOrder.dealNumber,
      deal_money: spotOrder.dealMoney,
      status: spotOrder.status,
    })
      .from(spotOrder)
      .where(eq(spotOrder.userId, payload.uid))
      .orderBy(desc(spotOrder.createTime))
      .limit(limit)
      .offset(offset);

    const allIds = [...new Set(orders.flatMap(o => [o.currency_id, o.legal_id]))];
    const currencies = allIds.length ? await db.select({ id: currency.id, name: currency.name }).from(currency)
      .where(inArray(currency.id, allIds)) : [];
    const nameMap = Object.fromEntries(currencies.map(c => [c.id, c.name]));

    const list = orders.map(o => ({
      id: o.id,
      create_time: o.create_time,
      pair: `${nameMap[o.currency_id] || ''}-${nameMap[o.legal_id] || ''}`,
      type: o.type,
      side: o.side,
      price: parseFloat(o.price?.toString() || '0'),
      number: parseFloat(o.number?.toString() || '0'),
      deal_number: parseFloat(o.deal_number?.toString() || '0'),
      deal_money: parseFloat(o.deal_money?.toString() || '0'),
      status: o.status,
    }));

    return {
      type: 'ok',
      data: {
        list,
        page,
        limit
      }
    };
  }, {
    query: t.Object({
      page: t.Optional(t.String()),
      limit: t.Optional(t.String()),
      status: t.Optional(t.String())
    })
  });
