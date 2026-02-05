import { db } from '../db';
import { agent, agentMoneyLog, users, leverTransaction } from '../db/schema';
import { eq, and, sql, inArray } from 'drizzle-orm';

/**
 * Agent service - ported from PHP Agent model
 * Handles agent hierarchy, rebate calculations, and settlement
 */

/**
 * Get agent by ID
 */
export async function getAgentById(agentId: number) {
  if (agentId === 0) return null;
  const result = await db.select().from(agent).where(eq(agent.id, agentId)).limit(1);
  return result.length ? result[0] : null;
}

/**
 * Get agent by username
 */
export async function getAgentByUsername(username: string) {
  if (!username) return null;
  const result = await db.select().from(agent).where(eq(agent.username, username)).limit(1);
  return result.length ? result[0] : null;
}

/**
 * Get all child agents recursively using agent_path
 */
export async function getAllChildAgents(agentId: number) {
  const result = await db.execute(sql`
    SELECT * FROM agent 
    WHERE FIND_IN_SET(${agentId}, agent_path) > 0
  `);
  return result.rows;
}

/**
 * Get user's parent agent hierarchy
 * Returns array of agents from immediate parent up to top level
 */
export async function getUserParentAgentHierarchy(userId: number) {
  const user = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user.length || user[0].agentNoteId === 0) return [];
  
  const hierarchy: any[] = [];
  let currentAgentId = user[0].agentNoteId;
  
  while (currentAgentId > 0) {
    const agentRecord = await getAgentById(currentAgentId);
    if (!agentRecord || agentRecord.isAdmin === 1) break;
    
    hierarchy.push({
      agentId: agentRecord.id,
      userId: agentRecord.userId,
      isAdmin: agentRecord.isAdmin,
      level: agentRecord.level,
      proLoss: parseFloat(agentRecord.proLoss),
      proSer: parseFloat(agentRecord.proSer)
    });
    
    currentAgentId = agentRecord.parentAgentId;
  }
  
  return hierarchy;
}

/**
 * Change agent money and log the transaction
 * Ported from PHP Agent::change_agent_money
 */
export async function changeAgentMoney(
  agentId: number,
  type: number, // 1=头寸收益, 2=手续费收益
  change: number,
  relateId: number,
  memo: string,
  sonUserId: number,
  legalId: number
): Promise<void> {
  await db.insert(agentMoneyLog).values({
    agentId,
    type,
    relateId,
    change: change.toFixed(8),
    memo,
    sonUserId,
    legalId,
    createdTime: Math.floor(Date.now() / 1000)
  });
}

/**
 * Calculate and distribute agent rebates for a closed position
 * Ported from PHP Agent::dojie - 极差返佣 (tiered commission)
 */
export async function settleAgentRebates(tradeId: number): Promise<boolean> {
  try {
    // Get the trade
    const trade = await db.select().from(leverTransaction)
      .where(and(
        eq(leverTransaction.id, tradeId),
        eq(leverTransaction.status, 1), // CLOSED
        eq(leverTransaction.settled, 0)
      ))
      .limit(1);
    
    if (!trade.length) return false;
    
    const t = trade[0];
    const agentPath = t.agentPath;
    
    if (!agentPath) {
      // No agent hierarchy, mark as settled
      await db.update(leverTransaction)
        .set({ settled: 1 })
        .where(eq(leverTransaction.id, tradeId));
      return true;
    }
    
    const agentIds = agentPath.split(',').filter(id => id).map(Number);
    if (!agentIds.length) {
      await db.update(leverTransaction)
        .set({ settled: 1 })
        .where(eq(leverTransaction.id, tradeId));
      return true;
    }
    
    // Build agent data array with commission rates
    const agentData: Array<{
      agentId: number;
      proLoss: number;
      proSer: number;
    }> = [];
    
    for (const agentId of agentIds) {
      const agentRecord = await getAgentById(agentId);
      if (agentRecord) {
        agentData.push({
          agentId,
          proLoss: parseFloat(agentRecord.proLoss),
          proSer: parseFloat(agentRecord.proSer)
        });
      }
    }
    
    // Calculate tiered rebates (极差收益)
    for (let i = 0; i < agentData.length; i++) {
      const currentAgent = agentData[i];
      let proLoss: number;
      let proSer: number;
      
      if (i === 0) {
        // First level agent gets their full rate
        proLoss = currentAgent.proLoss;
        proSer = currentAgent.proSer;
      } else {
        // Subsequent levels get the difference (极差)
        const prevAgent = agentData[i - 1];
        proLoss = currentAgent.proLoss - prevAgent.proLoss;
        proSer = currentAgent.proSer - prevAgent.proSer;
      }
      
      // 头寸收益 (Position P&L rebate)
      // Note: Position profit is inverted - agent earns when user loses
      if (proLoss > 0) {
        const baseMoney = -parseFloat(t.factProfits); // Invert user's P&L
        const positionRebate = baseMoney * (proLoss / 100);
        
        await changeAgentMoney(
          currentAgent.agentId,
          1, // Position rebate type
          positionRebate,
          t.id,
          `您的下级用户${t.userId}的订单产生的头寸收益为${positionRebate.toFixed(8)}。订单编号为${t.id}`,
          t.userId,
          t.legal
        );
      }
      
      // 手续费收益 (Trading fee rebate)
      if (proSer > 0) {
        const feeRebate = parseFloat(t.tradeFee) * (proSer / 100);
        
        await changeAgentMoney(
          currentAgent.agentId,
          2, // Fee rebate type
          feeRebate,
          t.id,
          `您的下级用户${t.userId}的订单产生的手续费收益为${feeRebate.toFixed(8)}。订单编号为${t.id}`,
          t.userId,
          t.legal
        );
      }
    }
    
    // Mark trade as settled
    await db.update(leverTransaction)
      .set({ settled: 1 })
      .where(eq(leverTransaction.id, tradeId));
    
    return true;
  } catch (error) {
    console.error('settleAgentRebates error:', error);
    return false;
  }
}

/**
 * Batch settle all unsettled closed positions
 */
export async function batchSettleAgentRebates(batchSize: number = 100): Promise<number> {
  let settledCount = 0;
  
  // Get unsettled closed trades
  const unsettledTrades = await db.select({ id: leverTransaction.id })
    .from(leverTransaction)
    .where(and(
      eq(leverTransaction.status, 1), // CLOSED
      eq(leverTransaction.settled, 0)
    ))
    .limit(batchSize);
  
  for (const trade of unsettledTrades) {
    const success = await settleAgentRebates(trade.id);
    if (success) settledCount++;
  }
  
  return settledCount;
}

/**
 * Get agent report data
 */
export async function getAgentReport(agentId: number, startDate?: string, endDate?: string) {
  const agentRecord = await getAgentById(agentId);
  if (!agentRecord) return null;
  
  // Get all child agents
  const childAgents = await getAllChildAgents(agentId);
  const childAgentIds = childAgents.map((a: any) => a.id);
  
  // Get users under this agent tree
  let userQuery = db.select().from(users).where(eq(users.agentNoteId, agentId));
  
  const directUsers = await userQuery;
  
  // Calculate totals from money logs
  let moneyLogQuery = sql`
    SELECT 
      SUM(CASE WHEN type = 1 THEN change ELSE 0 END) as total_position_rebate,
      SUM(CASE WHEN type = 2 THEN change ELSE 0 END) as total_fee_rebate
    FROM agent_money_log
    WHERE agent_id = ${agentId}
  `;
  
  if (startDate) {
    const startTs = Math.floor(new Date(startDate).getTime() / 1000);
    moneyLogQuery = sql`${moneyLogQuery} AND created_time >= ${startTs}`;
  }
  if (endDate) {
    const endTs = Math.floor(new Date(endDate).getTime() / 1000);
    moneyLogQuery = sql`${moneyLogQuery} AND created_time <= ${endTs}`;
  }
  
  const moneyStats = await db.execute(moneyLogQuery);
  
  return {
    agent: agentRecord,
    childAgentCount: childAgents.length,
    directUserCount: directUsers.length,
    stats: moneyStats.rows[0] || { total_position_rebate: 0, total_fee_rebate: 0 }
  };
}

/**
 * Create a new agent
 */
export async function createAgent(
  userId: number,
  username: string,
  password: string,
  parentAgentId: number,
  level: number,
  proLoss: number,
  proSer: number
): Promise<number> {
  // Get parent agent path
  let agentPath = '';
  if (parentAgentId > 0) {
    const parentAgent = await getAgentById(parentAgentId);
    if (parentAgent) {
      agentPath = parentAgent.agentPath ? `${parentAgent.agentPath},${parentAgentId}` : String(parentAgentId);
    }
  }
  
  const hashedPassword = await Bun.password.hash(password);
  
  const [newAgent] = await db.insert(agent).values({
    userId,
    username,
    password: hashedPassword,
    parentAgentId,
    agentPath,
    level,
    proLoss: proLoss.toFixed(2),
    proSer: proSer.toFixed(2),
    isAdmin: 0,
    createTime: Math.floor(Date.now() / 1000)
  }).returning();
  
  // Update user's agent_id
  if (userId > 0) {
    await db.update(users)
      .set({ agentId: newAgent.id })
      .where(eq(users.id, userId));
  }
  
  return newAgent.id;
}
