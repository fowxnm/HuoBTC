/**
 * 在线客服聊天 API
 */
import { Elysia, t } from 'elysia';
import { jwt } from '@elysiajs/jwt';
import { db, users, supportMessages, agent } from '../db';
import { eq, desc, and, sql } from 'drizzle-orm';

const JWT_SECRET = process.env.JWT_SECRET || 'btc-exchange-jwt-secret-key-2024';

export const supportRoutes = new Elysia({ prefix: '/support' })
  .use(jwt({ name: 'jwt', secret: JWT_SECRET, exp: '7d' }))

  // 用户发送消息
  .post('/send', async ({ body, headers, jwt }) => {
    console.log('[Support] /send called, body:', JSON.stringify(body));
    const authorization = headers.authorization;
    if (!authorization) {
      console.log('[Support] No authorization header');
      return { type: 'error', message: 'Unauthorized' };
    }
    
    const token = authorization.replace('Bearer ', '');
    let payload: { uid: number } | null = null;
    try {
      payload = await jwt.verify(token) as { uid: number };
    } catch (e) {
      console.error('[Support] JWT verify failed:', e);
      return { type: 'error', message: 'Invalid token' };
    }
    if (!payload || !payload.uid) return { type: 'error', message: 'Invalid token' };

    const { content, image_url } = body as { content?: string; image_url?: string };
    if (!content?.trim() && !image_url) return { type: 'error', message: 'Content or image is required' };

    // 获取用户信息
    const [user] = await db.select().from(users).where(eq(users.id, payload.uid)).limit(1);
    if (!user) {
      console.error('[Support] User not found for uid:', payload.uid);
      return { type: 'error', message: 'User not found' };
    }

    try {
      await db.insert(supportMessages).values({
        userId: user.id,
        uid: user.uid,
        senderType: 'user',
        senderId: user.id,
        content: content?.trim() || '',
        imageUrl: image_url || null
      });
      console.log('[Support] Message saved for user:', user.id, 'uid:', user.uid);
    } catch (e) {
      console.error('[Support] Failed to save message:', e);
      return { type: 'error', message: 'Failed to save message' };
    }

    return { type: 'ok', message: 'Message sent' };
  }, {
    body: t.Object({ 
      content: t.Optional(t.String()),
      image_url: t.Optional(t.String())
    })
  })

  // 用户获取消息历史
  .get('/messages', async ({ headers, jwt }) => {
    const authorization = headers.authorization;
    if (!authorization) return { type: 'error', message: 'Unauthorized' };
    
    const token = authorization.replace('Bearer ', '');
    const payload = await jwt.verify(token) as { uid: number };
    if (!payload) return { type: 'error', message: 'Invalid token' };

    const messages = await db.select()
      .from(supportMessages)
      .where(eq(supportMessages.userId, payload.uid))
      .orderBy(supportMessages.createdAt)
      .limit(100);

    // 标记为已读
    await db.update(supportMessages)
      .set({ isRead: true })
      .where(and(
        eq(supportMessages.userId, payload.uid),
        eq(supportMessages.senderType, 'admin')
      ));

    return {
      type: 'ok',
      data: messages.map(m => ({
        id: m.id,
        sender_type: m.senderType,
        content: m.content,
        image_url: m.imageUrl,
        created_at: m.createdAt
      }))
    };
  })

  // 用户检查未读消息数
  .get('/unread', async ({ headers, jwt }) => {
    const authorization = headers.authorization;
    if (!authorization) return { type: 'error', message: 'Unauthorized' };
    
    const token = authorization.replace('Bearer ', '');
    const payload = await jwt.verify(token) as { uid: number };
    if (!payload) return { type: 'error', message: 'Invalid token' };

    const [result] = await db.select({ count: sql<number>`count(*)` })
      .from(supportMessages)
      .where(and(
        eq(supportMessages.userId, payload.uid),
        eq(supportMessages.senderType, 'admin'),
        eq(supportMessages.isRead, false)
      ));

    return { type: 'ok', data: { count: result?.count || 0 } };
  })

  // ========== Admin APIs ==========

  // 管理员获取所有会话列表
  .get('/admin/conversations', async ({ headers, jwt }) => {
    const authorization = headers.authorization;
    if (!authorization) return { type: 'error', message: 'Unauthorized' };
    
    const token = authorization.replace('Bearer ', '');
    const payload = await jwt.verify(token) as { agentId: number; type: string };
    if (!payload || payload.type !== 'agent') return { type: 'error', message: 'Admin only' };

    // 获取所有有消息的用户
    const conversations = await db.execute(sql`
      SELECT 
        sm.user_id,
        sm.uid,
        MAX(sm.created_at) as last_message_at,
        COUNT(*) FILTER (WHERE sm.sender_type = 'user' AND sm.is_read = false) as unread_count,
        (SELECT content FROM support_messages WHERE user_id = sm.user_id ORDER BY created_at DESC LIMIT 1) as last_message
      FROM support_messages sm
      GROUP BY sm.user_id, sm.uid
      ORDER BY last_message_at DESC
    `);

    // db.execute 返回的是数组
    return { type: 'ok', data: conversations };
  })

  // 管理员获取某用户的消息
  .get('/admin/messages/:userId', async ({ params, headers, jwt }) => {
    const authorization = headers.authorization;
    if (!authorization) return { type: 'error', message: 'Unauthorized' };
    
    const token = authorization.replace('Bearer ', '');
    const payload = await jwt.verify(token) as { agentId: number; type: string };
    if (!payload || payload.type !== 'agent') return { type: 'error', message: 'Admin only' };

    const userId = parseInt(params.userId);
    
    const messages = await db.select()
      .from(supportMessages)
      .where(eq(supportMessages.userId, userId))
      .orderBy(supportMessages.createdAt)
      .limit(200);

    // 标记用户消息为已读
    await db.update(supportMessages)
      .set({ isRead: true })
      .where(and(
        eq(supportMessages.userId, userId),
        eq(supportMessages.senderType, 'user')
      ));

    return {
      type: 'ok',
      data: messages.map(m => ({
        id: m.id,
        sender_type: m.senderType,
        content: m.content,
        image_url: m.imageUrl,
        created_at: m.createdAt
      }))
    };
  }, {
    params: t.Object({ userId: t.String() })
  })

  // 管理员回复消息
  .post('/admin/reply', async ({ body, headers, jwt }) => {
    const authorization = headers.authorization;
    if (!authorization) return { type: 'error', message: 'Unauthorized' };
    
    const token = authorization.replace('Bearer ', '');
    const payload = await jwt.verify(token) as { agentId: number; type: string };
    if (!payload || payload.type !== 'agent') return { type: 'error', message: 'Admin only' };

    const { user_id, content } = body as { user_id: number; content: string };
    if (!content?.trim()) return { type: 'error', message: 'Content is required' };

    // 获取用户UID
    const [user] = await db.select().from(users).where(eq(users.id, user_id)).limit(1);

    await db.insert(supportMessages).values({
      userId: user_id,
      uid: user?.uid || null,
      senderType: 'admin',
      senderId: payload.agentId,
      content: content.trim()
    });

    return { type: 'ok', message: 'Reply sent' };
  }, {
    body: t.Object({
      user_id: t.Number(),
      content: t.String()
    })
  })

  // 管理员获取未读消息总数
  .get('/admin/unread-total', async ({ headers, jwt }) => {
    const authorization = headers.authorization;
    if (!authorization) return { type: 'error', message: 'Unauthorized' };
    
    const token = authorization.replace('Bearer ', '');
    const payload = await jwt.verify(token) as { agentId: number; type: string };
    if (!payload || payload.type !== 'agent') return { type: 'error', message: 'Admin only' };

    const [result] = await db.select({ count: sql<number>`count(*)` })
      .from(supportMessages)
      .where(and(
        eq(supportMessages.senderType, 'user'),
        eq(supportMessages.isRead, false)
      ));

    return { type: 'ok', data: { count: result?.count || 0 } };
  });
