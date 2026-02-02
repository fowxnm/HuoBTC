import { Elysia, t } from 'elysia';
import { db, users, usersWallet, usersWalletOut, walletLog, chargeReq, siteConfig } from '../db';
import { eq, and, sql } from 'drizzle-orm';
import { compare } from 'bcryptjs';
import QRCode from 'qrcode';

export const walletRoutes = new Elysia({ prefix: '/wallet' })
  // Get rate
  .get('/getRate', async () => {
    const [cnyConfig] = await db.select().from(siteConfig)
      .where(eq(siteConfig.key, 'cny_rate'))
      .limit(1);

    return {
      type: 'ok',
      message: 'Success',
      data: {
        cny: parseFloat(cnyConfig?.value || '7.0'),
        rate: 1.0
      }
    };
  })

  // Get recharge setting
  .get('/getRechargeSetting', async () => {
    const [minDeposit] = await db.select().from(siteConfig)
      .where(eq(siteConfig.key, 'min_deposit'))
      .limit(1);

    const [maxDeposit] = await db.select().from(siteConfig)
      .where(eq(siteConfig.key, 'max_deposit'))
      .limit(1);

    return {
      type: 'ok',
      data: {
        cny_info: {
          min: parseFloat(minDeposit?.value || '100'),
          max: parseFloat(maxDeposit?.value || '100000'),
          symbol: 'CNY'
        }
      }
    };
  })

  // Get wallet detail
  .get('/walletDetail', async ({ query, headers, jwt }) => {
    const authorization = headers.authorization;
    if (!authorization) {
      return { type: 'error', message: 'Unauthorized' };
    }

    const token = authorization.replace('Bearer ', '');
    const payload = await jwt.verify(token) as { uid: number };
    
    if (!payload) {
      return { type: 'error', message: 'Invalid token' };
    }

    const currencyId = parseInt(query.currency || '3');

    const [wallet] = await db.select().from(usersWallet)
      .where(and(
        eq(usersWallet.userId, payload.uid),
        eq(usersWallet.currency, currencyId)
      ))
      .limit(1);

    if (!wallet) {
      return { type: 'error', message: 'Wallet not found' };
    }

    return {
      type: 'ok',
      data: {
        legal_balance: wallet.legalBalance,
        change_balance: wallet.changeBalance,
        lever_balance: wallet.leverBalance,
        micro_balance: wallet.microBalance,
        lock_legal_balance: wallet.lockLegalBalance,
        lock_change_balance: wallet.lockChangeBalance,
        lock_lever_balance: wallet.lockLeverBalance,
        lock_micro_balance: wallet.lockMicroBalance,
        address: wallet.address
      }
    };
  }, {
    query: t.Object({
      currency: t.Optional(t.String())
    })
  })

  // Get all wallets
  .get('/list', async ({ headers, jwt }) => {
    const authorization = headers.authorization;
    if (!authorization) {
      return { type: 'error', message: 'Unauthorized' };
    }

    const token = authorization.replace('Bearer ', '');
    const payload = await jwt.verify(token) as { uid: number };
    
    if (!payload) {
      return { type: 'error', message: 'Invalid token' };
    }

    const wallets = await db.select().from(usersWallet)
      .where(eq(usersWallet.userId, payload.uid));

    return {
      type: 'ok',
      data: wallets.map(w => ({
        id: w.id,
        currency: w.currency,
        legal_balance: w.legalBalance,
        change_balance: w.changeBalance,
        lever_balance: w.leverBalance,
        micro_balance: w.microBalance,
        address: w.address
      }))
    };
  })

  // Submit withdrawal request
  .post('/postWalletOut', async ({ body, headers, jwt }) => {
    const authorization = headers.authorization;
    if (!authorization) {
      return { type: 'error', message: 'Unauthorized' };
    }

    const token = authorization.replace('Bearer ', '');
    const payload = await jwt.verify(token) as { uid: number };
    
    if (!payload) {
      return { type: 'error', message: 'Invalid token' };
    }

    const { currency, number, address, pay_password } = body;
    const userId = payload.uid;

    // Get user and verify pay password
    const [user] = await db.select().from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) {
      return { type: 'error', message: 'User not found' };
    }

    if (!user.payPassword) {
      return { type: 'error', message: 'Please set pay password first' };
    }

    const isValidPayPassword = await compare(pay_password, user.payPassword);
    if (!isValidPayPassword) {
      return { type: 'error', message: 'Pay password error' };
    }

    // Get wallet with lock
    const [wallet] = await db.select().from(usersWallet)
      .where(and(
        eq(usersWallet.userId, userId),
        eq(usersWallet.currency, currency)
      ))
      .limit(1);

    if (!wallet) {
      return { type: 'error', message: 'Wallet not found' };
    }

    const withdrawAmount = parseFloat(number.toString());
    const currentBalance = parseFloat(wallet.microBalance?.toString() || '0');

    if (withdrawAmount > currentBalance) {
      return { type: 'error', message: 'Insufficient balance' };
    }

    const now = Math.floor(Date.now() / 1000);

    // Create withdrawal record
    await db.insert(usersWalletOut).values({
      userId,
      currency,
      number: number.toString(),
      address,
      status: 1, // 审核中
      createTime: now
    });

    // Deduct available balance and add to locked balance
    const newBalance = (currentBalance - withdrawAmount).toFixed(8);
    const newLockBalance = (parseFloat(wallet.lockMicroBalance?.toString() || '0') + withdrawAmount).toFixed(8);

    await db.update(usersWallet)
      .set({
        microBalance: newBalance,
        lockMicroBalance: newLockBalance
      })
      .where(eq(usersWallet.id, wallet.id));

    // Log the transaction
    await db.insert(walletLog).values({
      accountLogId: 0,
      walletId: wallet.id,
      balanceType: 4, // 期权账户
      lockType: 0,
      beforeAmount: currentBalance.toFixed(8),
      changeAmount: (-withdrawAmount).toFixed(8),
      afterAmount: newBalance,
      memo: 'Withdrawal request',
      createTime: now
    });

    return { type: 'ok', message: 'Withdrawal request submitted successfully' };
  }, {
    body: t.Object({
      currency: t.Number(),
      number: t.Number(),
      address: t.String(),
      pay_password: t.String()
    })
  })

  // Wire transfer deposit
  .post('/dianxin', async ({ body, headers, jwt }) => {
    const authorization = headers.authorization;
    if (!authorization) {
      return { type: 'error', message: 'Unauthorized' };
    }

    const token = authorization.replace('Bearer ', '');
    const payload = await jwt.verify(token) as { uid: number };
    
    if (!payload) {
      return { type: 'error', message: 'Invalid token' };
    }

    const { currency_id, amount, account_number, bank_name, branch, real_name } = body;

    await db.insert(chargeReq).values({
      userId: payload.uid,
      currencyId: currency_id,
      amount: amount.toString(),
      accountNumber: account_number,
      bankName: bank_name,
      branch,
      realName: real_name,
      status: 1
    });

    return { type: 'ok', message: 'Deposit request submitted successfully' };
  }, {
    body: t.Object({
      currency_id: t.Number(),
      amount: t.Number(),
      account_number: t.String(),
      bank_name: t.String(),
      branch: t.String(),
      real_name: t.String()
    })
  })

  // Generate QR code
  .get('/qrcode', async ({ query }) => {
    const text = query.text || '';
    
    try {
      const qrDataUrl = await QRCode.toDataURL(text, {
        width: 256,
        margin: 2
      });
      
      return { type: 'ok', data: qrDataUrl };
    } catch (error) {
      return { type: 'error', message: 'Failed to generate QR code' };
    }
  }, {
    query: t.Object({
      text: t.String()
    })
  })

  // Get withdrawal records
  .get('/withdrawList', async ({ query, headers, jwt }) => {
    const authorization = headers.authorization;
    if (!authorization) {
      return { type: 'error', message: 'Unauthorized' };
    }

    const token = authorization.replace('Bearer ', '');
    const payload = await jwt.verify(token) as { uid: number };
    
    if (!payload) {
      return { type: 'error', message: 'Invalid token' };
    }

    const page = parseInt(query.page || '1');
    const limit = parseInt(query.limit || '10');
    const offset = (page - 1) * limit;

    const records = await db.select().from(usersWalletOut)
      .where(eq(usersWalletOut.userId, payload.uid))
      .limit(limit)
      .offset(offset)
      .orderBy(sql`${usersWalletOut.createTime} DESC`);

    return {
      type: 'ok',
      data: {
        list: records,
        page,
        limit
      }
    };
  }, {
    query: t.Object({
      page: t.Optional(t.String()),
      limit: t.Optional(t.String())
    })
  });
