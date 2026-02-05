import { Elysia, t } from 'elysia';
import { jwt } from '@elysiajs/jwt';
import { createHash } from 'crypto';
import { db, agent, agentMoneyLog, users } from '../db';
import { eq, and, sql, desc } from 'drizzle-orm';
import { hash, compare } from 'bcryptjs';

const JWT_SECRET = process.env.JWT_SECRET || 'btc-exchange-jwt-secret-key-2024';

/** 支持两种存储格式：bcrypt 或 setup-production 的 salt:sha256 */
async function verifyAgentPassword(stored: string, plain: string): Promise<boolean> {
  if (!stored || !plain) return false;
  const parts = stored.split(':');
  if (parts.length === 2 && /^[a-f0-9]+$/i.test(parts[0]) && /^[a-f0-9]+$/i.test(parts[1])) {
    const [salt, expectedHash] = parts;
    const actualHash = createHash('sha256').update(plain + salt).digest('hex');
    return actualHash === expectedHash;
  }
  try {
    return await compare(plain, stored);
  } catch {
    return false;
  }
}

export const agentRoutes = new Elysia()
  .use(jwt({
    name: 'jwt',
    secret: JWT_SECRET,
    exp: '7d'
  }))
  // Agent login
  .post('/login', async ({ body, jwt, set }) => {
    try {
      const { username, password } = body;

      const [agentData] = await db.select().from(agent)
        .where(eq(agent.username, username))
        .limit(1);

      if (!agentData) {
        set.status = 401;
        return { type: 'error', message: 'Agent not found' };
      }

      if (agentData.isLock === 1) {
        set.status = 403;
        return { type: 'error', message: 'Account is locked' };
      }

      const isValidPassword = await verifyAgentPassword(agentData.password, password);
      if (!isValidPassword) {
        set.status = 401;
        return { type: 'error', message: 'Invalid password' };
      }

      const token = await jwt.sign({
        agentId: agentData.id,
        type: 'agent'
      });

      return {
        type: 'ok',
        token,
        data: {
          agent_id: agentData.id,
          username: agentData.username,
          level: agentData.level,
          is_admin: agentData.isAdmin,
          role_type: agentData.roleType
        }
      };
    } catch (err) {
      console.error('[agent/login]', err);
      set.status = 500;
      return { type: 'error', message: 'Login failed' };
    }
  }, {
    body: t.Object({
      username: t.String(),
      password: t.String(),
      verification_code: t.Optional(t.String())
    })
  })

  // Get agent report
  .get('/report', async ({ query, headers, jwt }) => {
    const authorization = headers.authorization;
    if (!authorization) {
      return { type: 'error', message: 'Unauthorized' };
    }

    const token = authorization.replace('Bearer ', '');
    const payload = await jwt.verify(token) as { agentId: number; type: string };
    
    if (!payload || payload.type !== 'agent') {
      return { type: 'error', message: 'Invalid token' };
    }

    const { start_time, end_time, type } = query;
    const agentId = payload.agentId;

    // Get money logs
    const logs = await db.select().from(agentMoneyLog)
      .where(and(
        eq(agentMoneyLog.agentId, agentId),
        type ? eq(agentMoneyLog.type, parseInt(type)) : sql`1=1`
      ))
      .orderBy(desc(agentMoneyLog.createdTime));

    // Calculate totals
    const totalProfit = logs
      .filter(l => l.type === 1)
      .reduce((sum, l) => sum + parseFloat(l.change?.toString() || '0'), 0);
    
    const totalFee = logs
      .filter(l => l.type === 2)
      .reduce((sum, l) => sum + parseFloat(l.change?.toString() || '0'), 0);

    return {
      type: 'ok',
      data: {
        total_profit: totalProfit.toFixed(2),
        total_fee: totalFee.toFixed(2),
        list: logs.map(l => ({
          date: new Date(l.createdTime * 1000).toISOString().split('T')[0],
          user_id: l.sonUserId,
          trade_id: l.relateId,
          profit: l.type === 1 ? l.change : '0',
          fee: l.type === 2 ? l.change : '0'
        }))
      }
    };
  }, {
    query: t.Object({
      start_time: t.Optional(t.String()),
      end_time: t.Optional(t.String()),
      type: t.Optional(t.String())
    })
  })

  // Get agent info
  .get('/info', async ({ headers, jwt }) => {
    const authorization = headers.authorization;
    if (!authorization) {
      return { type: 'error', message: 'Unauthorized' };
    }

    const token = authorization.replace('Bearer ', '');
    const payload = await jwt.verify(token) as { agentId: number; type: string };
    
    if (!payload || payload.type !== 'agent') {
      return { type: 'error', message: 'Invalid token' };
    }

    const [agentData] = await db.select().from(agent)
      .where(eq(agent.id, payload.agentId))
      .limit(1);

    if (!agentData) {
      return { type: 'error', message: 'Agent not found' };
    }

    return {
      type: 'ok',
      data: {
        id: agentData.id,
        username: agentData.username,
        level: agentData.level,
        pro_loss: agentData.proLoss,
        pro_ser: agentData.proSer,
        is_admin: agentData.isAdmin,
        role_type: agentData.roleType
      }
    };
  })

  // Get subordinate users
  .get('/users', async ({ query, headers, jwt }) => {
    const authorization = headers.authorization;
    if (!authorization) {
      return { type: 'error', message: 'Unauthorized' };
    }

    const token = authorization.replace('Bearer ', '');
    const payload = await jwt.verify(token) as { agentId: number; type: string };
    
    if (!payload || payload.type !== 'agent') {
      return { type: 'error', message: 'Invalid token' };
    }

    const page = parseInt(query.page || '1');
    const limit = parseInt(query.limit || '10');
    const offset = (page - 1) * limit;

    const usersList = await db.select().from(users)
      .where(eq(users.agentId, payload.agentId))
      .limit(limit)
      .offset(offset)
      .orderBy(desc(users.createTime));

    return {
      type: 'ok',
      data: {
        list: usersList.map(u => ({
          id: u.id,
          account_number: u.accountNumber,
          phone: u.phone,
          email: u.email,
          user_level: u.userLevel,
          status: u.status,
          create_time: u.createTime
        })),
        page,
        limit
      }
    };
  }, {
    query: t.Object({
      page: t.Optional(t.String()),
      limit: t.Optional(t.String())
    })
  })

  // Get subordinate agents
  .get('/sub_agents', async ({ headers, jwt }) => {
    const authorization = headers.authorization;
    if (!authorization) {
      return { type: 'error', message: 'Unauthorized' };
    }

    const token = authorization.replace('Bearer ', '');
    const payload = await jwt.verify(token) as { agentId: number; type: string };
    
    if (!payload || payload.type !== 'agent') {
      return { type: 'error', message: 'Invalid token' };
    }

    const subAgents = await db.select().from(agent)
      .where(eq(agent.parentAgentId, payload.agentId));

    return {
      type: 'ok',
      data: subAgents.map(a => ({
        id: a.id,
        username: a.username,
        level: a.level,
        pro_loss: a.proLoss,
        pro_ser: a.proSer,
        is_lock: a.isLock
      }))
    };
  })

  // Change password
  .post('/change_password', async ({ body, headers, jwt }) => {
    const authorization = headers.authorization;
    if (!authorization) {
      return { type: 'error', message: 'Unauthorized' };
    }

    const token = authorization.replace('Bearer ', '');
    const payload = await jwt.verify(token) as { agentId: number; type: string };
    
    if (!payload || payload.type !== 'agent') {
      return { type: 'error', message: 'Invalid token' };
    }

    const { old_password, new_password } = body;

    const [agentData] = await db.select().from(agent)
      .where(eq(agent.id, payload.agentId))
      .limit(1);

    if (!agentData) {
      return { type: 'error', message: 'Agent not found' };
    }

    const isValidPassword = await compare(old_password, agentData.password);
    if (!isValidPassword) {
      return { type: 'error', message: 'Current password is incorrect' };
    }

    const hashedPassword = await hash(new_password, 10);
    
    await db.update(agent)
      .set({ password: hashedPassword })
      .where(eq(agent.id, payload.agentId));

    return { type: 'ok', message: 'Password changed successfully' };
  }, {
    body: t.Object({
      old_password: t.String(),
      new_password: t.String()
    })
  });
