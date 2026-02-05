import { Elysia, t } from 'elysia';
import { jwt } from '@elysiajs/jwt';
import { db, chargeReq, usersWallet, walletLog } from '../db';

const JWT_SECRET = process.env.JWT_SECRET || 'btc-exchange-jwt-secret-key-2024';
import { eq, and } from 'drizzle-orm';
import crypto from 'crypto';

export const payRoutes = new Elysia({ prefix: '/pay' })
  .use(jwt({ name: 'jwt', secret: JWT_SECRET, exp: '7d' }))
  // Create payment order
  .post('/createOrder', async ({ body, headers, jwt }) => {
    const authorization = headers.authorization;
    if (!authorization) {
      return { type: 'error', message: 'Unauthorized' };
    }

    const token = authorization.replace('Bearer ', '');
    const payload = await jwt.verify(token) as { uid: number };
    
    if (!payload) {
      return { type: 'error', message: 'Invalid token' };
    }

    const { amount, currency_id } = body;
    const userId = payload.uid;

    // Generate order number
    const orderNo = `ORDER_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    // Create charge request
    await db.insert(chargeReq).values({
      userId,
      currencyId: currency_id,
      amount: amount.toString(),
      status: 1 // Pending
    });

    // In production, integrate with actual payment gateway
    // For now, return mock data
    const signStr = `merchantNo=mock&merchantOrderNo=${orderNo}&amount=${amount}`;
    const sign = crypto.createHash('md5').update(signStr).digest('hex');

    return {
      type: 'ok',
      data: {
        order_no: orderNo,
        pay_url: `https://pay.example.com/checkout?order=${orderNo}`,
        sign
      }
    };
  }, {
    body: t.Object({
      amount: t.Number(),
      currency_id: t.Number()
    })
  })

  // Payment callback/notify
  .post('/notify', async ({ body }) => {
    const { merchantNo, merchantOrderNo, paymentStatus, sign, amount } = body;

    // In production, verify signature with public key
    // For now, just process the payment

    if (paymentStatus !== 'SUCCESS') {
      return { type: 'error', message: 'Payment not successful' };
    }

    // Find and update the charge request
    // In production, you'd look up by order number
    // This is simplified for demo

    return {
      type: 'ok',
      message: 'Payment processed'
    };
  }, {
    body: t.Object({
      merchantNo: t.String(),
      merchantOrderNo: t.String(),
      paymentStatus: t.String(),
      sign: t.String(),
      amount: t.Optional(t.Number())
    })
  })

  // Manual deposit confirmation (for admin)
  .post('/confirm', async ({ body, headers, jwt }) => {
    const authorization = headers.authorization;
    if (!authorization) {
      return { type: 'error', message: 'Unauthorized' };
    }

    const token = authorization.replace('Bearer ', '');
    const payload = await jwt.verify(token) as { agentId: number; type: string };
    
    if (!payload || payload.type !== 'agent') {
      return { type: 'error', message: 'Admin only' };
    }

    const { charge_id, status } = body;

    const [chargeRequest] = await db.select().from(chargeReq)
      .where(eq(chargeReq.id, charge_id))
      .limit(1);

    if (!chargeRequest) {
      return { type: 'error', message: 'Charge request not found' };
    }

    if (chargeRequest.status !== 1) {
      return { type: 'error', message: 'Request already processed' };
    }

    // Update status
    await db.update(chargeReq)
      .set({ status })
      .where(eq(chargeReq.id, charge_id));

    // If approved, add balance
    if (status === 2) {
      const [wallet] = await db.select().from(usersWallet)
        .where(and(
          eq(usersWallet.userId, chargeRequest.userId),
          eq(usersWallet.currency, chargeRequest.currencyId)
        ))
        .limit(1);

      if (wallet) {
        const currentBalance = parseFloat(wallet.legalBalance?.toString() || '0');
        const addAmount = parseFloat(chargeRequest.amount?.toString() || '0');
        const newBalance = (currentBalance + addAmount).toFixed(8);

        await db.update(usersWallet)
          .set({ legalBalance: newBalance })
          .where(eq(usersWallet.id, wallet.id));

        // Log the transaction
        const now = Math.floor(Date.now() / 1000);
        await db.insert(walletLog).values({
          accountLogId: 0,
          walletId: wallet.id,
          balanceType: 1,
          lockType: 0,
          beforeAmount: currentBalance.toFixed(8),
          changeAmount: addAmount.toFixed(8),
          afterAmount: newBalance,
          memo: 'Deposit approved',
          createTime: now
        });
      }
    }

    return { 
      type: 'ok', 
      message: status === 2 ? 'Deposit approved' : 'Deposit rejected' 
    };
  }, {
    body: t.Object({
      charge_id: t.Number(),
      status: t.Number() // 2=approved, 3=rejected
    })
  })

  // Get pending deposits (for admin)
  .get('/pending', async ({ headers, jwt }) => {
    const authorization = headers.authorization;
    if (!authorization) {
      return { type: 'error', message: 'Unauthorized' };
    }

    const token = authorization.replace('Bearer ', '');
    const payload = await jwt.verify(token) as { agentId: number; type: string };
    
    if (!payload || payload.type !== 'agent') {
      return { type: 'error', message: 'Admin only' };
    }

    const pendingCharges = await db.select().from(chargeReq)
      .where(eq(chargeReq.status, 1));

    return {
      type: 'ok',
      data: pendingCharges.map(c => ({
        id: c.id,
        user_id: c.userId,
        amount: c.amount,
        currency_id: c.currencyId,
        bank_name: c.bankName,
        account_number: c.accountNumber,
        created_at: c.createdAt
      }))
    };
  });
