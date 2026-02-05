import { Elysia } from 'elysia';
import { db, users } from '../db';
import { eq } from 'drizzle-orm';

export const authMiddleware = new Elysia({ name: 'auth-middleware' })
  .derive(async ({ jwt, headers, set }) => {
    const authorization = headers.authorization;
    
    if (!authorization) {
      set.status = 401;
      return { user: null, error: 'No authorization header' };
    }

    const token = authorization.replace('Bearer ', '');
    
    try {
      const payload = await jwt.verify(token) as { uid: number; address?: string; type?: string };
      
      if (!payload || !payload.uid) {
        set.status = 401;
        return { user: null, error: 'Invalid token' };
      }

      const [user] = await db.select().from(users).where(eq(users.id, payload.uid)).limit(1);
      
      if (!user) {
        set.status = 401;
        return { user: null, error: 'User not found' };
      }

      if (user.status === 1) {
        set.status = 403;
        return { user: null, error: 'Account is locked' };
      }

      return { user, error: null };
    } catch (error) {
      set.status = 401;
      return { user: null, error: 'Token verification failed' };
    }
  });

export const requireAuth = new Elysia({ name: 'require-auth' })
  .use(authMiddleware)
  .onBeforeHandle(({ user, error, set }) => {
    if (!user || error) {
      set.status = 401;
      return { type: 'error', message: error || 'Unauthorized' };
    }
  });
