/**
 * Webhooks - deposit/withdrawal callbacks
 * Uses shadow_wallet (virtualBalance) for deposit completion
 */

import { Elysia, t } from 'elysia';
import { db } from '../db';
import { shadowWallet } from '../db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { logAdminAction } from '../middleware/rbac';

export const webhookRoutes = new Elysia()
  .post('/webhooks/deposit', async ({ body }) => {
    const { userId, chain, amount, txHash } = body;

    const [wallet] = await db
      .select()
      .from(shadowWallet)
      .where(
        and(
          eq(shadowWallet.userId, userId),
          eq(shadowWallet.chain, chain)
        )
      )
      .limit(1);

    if (!wallet) {
      return { type: 'error', message: 'Shadow wallet not found' };
    }

    await db
      .update(shadowWallet)
      .set({
        virtualBalance: sql`${shadowWallet.virtualBalance} + ${amount}`,
        lastSyncTime: Math.floor(Date.now() / 1000),
      })
      .where(eq(shadowWallet.id, wallet.id));

    await logAdminAction(0, 'DEPOSIT_WEBHOOK', '/webhooks/deposit', 'POST', {
      userId,
      chain,
      amount,
      txHash,
    });

    return { type: 'ok', message: 'Virtual balance updated' };
  }, {
    body: t.Object({
      userId: t.Number(),
      chain: t.String(),
      amount: t.String(),
      txHash: t.String(),
    }),
  });
