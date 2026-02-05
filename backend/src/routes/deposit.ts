/**
 * 充值相关 API
 */
import { Elysia, t } from 'elysia';
import { jwt } from '@elysiajs/jwt';
import { db } from '../db';
import { depositRequests, users, usersWallet } from '../db/schema';
import { eq, desc, sql } from 'drizzle-orm';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-key';

export const depositRoutes = new Elysia({ prefix: '/api/deposit' })
  .use(jwt({ name: 'jwt', secret: JWT_SECRET, exp: '7d' }))
  
  // 提交充值申请
  .post('/submit', async ({ body, headers, jwt }) => {
    const authorization = headers.authorization;
    if (!authorization) {
      return { type: 'error', message: '请先登录' };
    }

    const token = authorization.replace('Bearer ', '');
    const payload = await jwt.verify(token) as { userId: number } | null;
    if (!payload?.userId) {
      return { type: 'error', message: '登录已过期，请重新登录' };
    }

    const { amount, chain, currency, txHash, proofImage, depositAddress } = body as {
      amount: number;
      chain: string;
      currency: string;
      txHash?: string;
      proofImage: string;
      depositAddress?: string;
    };

    if (!amount || amount <= 0) {
      return { type: 'error', message: '请输入有效的充值金额' };
    }

    if (!proofImage) {
      return { type: 'error', message: '请上传转账截图' };
    }

    try {
      // 获取用户 UID
      const [user] = await db.select({ uid: users.uid }).from(users).where(eq(users.id, payload.userId)).limit(1);

      // 创建充值申请
      await db.insert(depositRequests).values({
        userId: payload.userId,
        uid: user?.uid || null,
        amount: amount.toString(),
        currency: currency || 'USDT',
        chain: chain || 'TRC20',
        txHash: txHash || null,
        depositAddress: depositAddress || null,
        proofImage,
        status: 0, // pending
      });

      console.log(`[Deposit] New deposit request: userId=${payload.userId}, amount=${amount} ${currency}`);

      return { type: 'ok', message: '充值申请已提交，请等待审核' };
    } catch (error) {
      console.error('[Deposit] Failed to submit deposit request:', error);
      return { type: 'error', message: '提交失败，请稍后重试' };
    }
  })

  // 获取用户的充值记录
  .get('/history', async ({ headers, jwt, query }) => {
    const authorization = headers.authorization;
    if (!authorization) {
      return { type: 'error', message: 'Unauthorized' };
    }

    const token = authorization.replace('Bearer ', '');
    const payload = await jwt.verify(token) as { userId: number } | null;
    if (!payload?.userId) {
      return { type: 'error', message: 'Invalid token' };
    }

    const page = parseInt(query.page || '1');
    const limit = parseInt(query.limit || '20');
    const offset = (page - 1) * limit;

    try {
      const records = await db.select()
        .from(depositRequests)
        .where(eq(depositRequests.userId, payload.userId))
        .orderBy(desc(depositRequests.createdAt))
        .limit(limit)
        .offset(offset);

      const [{ count }] = await db.select({ count: sql<number>`count(*)` })
        .from(depositRequests)
        .where(eq(depositRequests.userId, payload.userId));

      return {
        type: 'ok',
        data: {
          list: records.map(r => ({
            id: r.id,
            amount: r.amount,
            currency: r.currency,
            chain: r.chain,
            status: r.status, // 0=pending, 1=approved, 2=rejected
            statusText: r.status === 0 ? '审核中' : r.status === 1 ? '已通过' : '已拒绝',
            reviewNote: r.reviewNote,
            createdAt: r.createdAt,
            reviewedAt: r.reviewedAt,
          })),
          total: Number(count),
          page,
          limit,
        }
      };
    } catch (error) {
      console.error('[Deposit] Failed to fetch history:', error);
      return { type: 'error', message: 'Failed to fetch deposit history' };
    }
  });
