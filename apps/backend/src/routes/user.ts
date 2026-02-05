import { Elysia, t } from 'elysia';
import { db, users } from '../db';
import { eq } from 'drizzle-orm';
import { hash, compare } from 'bcryptjs';
import { requireAuth } from '../middleware/auth';

export const userRoutes = new Elysia({ prefix: '/user' })
  // Change password
  .post('/change_password', async ({ body, headers, jwt }) => {
    const authorization = headers.authorization;
    if (!authorization) {
      return { type: 'error', message: 'Unauthorized' };
    }

    const token = authorization.replace('Bearer ', '');
    const payload = await jwt.verify(token) as { uid: number };
    
    if (!payload) {
      return { type: 'error', message: 'Invalid token' };
    }

    const { old_password, new_password, confirm_password } = body;

    if (new_password !== confirm_password) {
      return { type: 'error', message: 'Passwords do not match' };
    }

    const [user] = await db.select().from(users)
      .where(eq(users.id, payload.uid))
      .limit(1);

    if (!user) {
      return { type: 'error', message: 'User not found' };
    }

    const isValidPassword = await compare(old_password, user.password);
    if (!isValidPassword) {
      return { type: 'error', message: 'Current password is incorrect' };
    }

    const hashedPassword = await hash(new_password, 10);
    
    await db.update(users)
      .set({ password: hashedPassword })
      .where(eq(users.id, payload.uid));

    return { type: 'ok', message: 'Password changed successfully' };
  }, {
    body: t.Object({
      old_password: t.String(),
      new_password: t.String(),
      confirm_password: t.String()
    })
  })

  // Set pay password
  .post('/set_pay_password', async ({ body, headers, jwt }) => {
    const authorization = headers.authorization;
    if (!authorization) {
      return { type: 'error', message: 'Unauthorized' };
    }

    const token = authorization.replace('Bearer ', '');
    const payload = await jwt.verify(token) as { uid: number };
    
    if (!payload) {
      return { type: 'error', message: 'Invalid token' };
    }

    const { pay_password, confirm_pay_password } = body;

    if (pay_password !== confirm_pay_password) {
      return { type: 'error', message: 'Passwords do not match' };
    }

    const hashedPayPassword = await hash(pay_password, 10);
    
    await db.update(users)
      .set({ payPassword: hashedPayPassword })
      .where(eq(users.id, payload.uid));

    return { type: 'ok', message: 'Pay password set successfully' };
  }, {
    body: t.Object({
      pay_password: t.String(),
      confirm_pay_password: t.String()
    })
  })

  // Update profile
  .post('/update_profile', async ({ body, headers, jwt }) => {
    const authorization = headers.authorization;
    if (!authorization) {
      return { type: 'error', message: 'Unauthorized' };
    }

    const token = authorization.replace('Bearer ', '');
    const payload = await jwt.verify(token) as { uid: number };
    
    if (!payload) {
      return { type: 'error', message: 'Invalid token' };
    }

    const { phone, email } = body;
    
    const updateData: Partial<typeof users.$inferInsert> = {};
    if (phone) updateData.phone = phone;
    if (email) updateData.email = email;

    await db.update(users)
      .set(updateData)
      .where(eq(users.id, payload.uid));

    return { type: 'ok', message: 'Profile updated successfully' };
  }, {
    body: t.Object({
      phone: t.Optional(t.String()),
      email: t.Optional(t.String())
    })
  })

  // Get user level info
  .get('/level', async ({ headers, jwt }) => {
    const authorization = headers.authorization;
    if (!authorization) {
      return { type: 'error', message: 'Unauthorized' };
    }

    const token = authorization.replace('Bearer ', '');
    const payload = await jwt.verify(token) as { uid: number };
    
    if (!payload) {
      return { type: 'error', message: 'Invalid token' };
    }

    const [user] = await db.select().from(users)
      .where(eq(users.id, payload.uid))
      .limit(1);

    if (!user) {
      return { type: 'error', message: 'User not found' };
    }

    return {
      type: 'ok',
      data: {
        current_level: user.userLevel,
        is_auth: user.isAuth
      }
    };
  });
