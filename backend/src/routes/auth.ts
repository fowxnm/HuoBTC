import { Elysia, t } from 'elysia';
import { db, users, usersWallet } from '../db';
import { eq, or } from 'drizzle-orm';
import { hash, compare } from 'bcryptjs';
import { verifyMessage } from 'ethers';

// Generate random extension code
function generateExtensionCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Generate account number from address
function generateAccountNumber(address: string): string {
  const suffix = address.slice(-6).toUpperCase();
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `${suffix}${random}`;
}

// Initialize wallets for new user
async function initializeWallets(userId: number) {
  const currencies = [1, 2, 3]; // BTC, ETH, USDT
  const now = Math.floor(Date.now() / 1000);
  
  for (const currencyId of currencies) {
    await db.insert(usersWallet).values({
      userId,
      currency: currencyId,
      createTime: now
    });
  }
}

export const authRoutes = new Elysia({ prefix: '/user' })
  // Login
  .post('/login', async ({ body, jwt }) => {
    const { user_string, password, type, lang } = body;

    // Find user by phone or email
    const [user] = await db.select().from(users)
      .where(
        or(
          eq(users.phone, user_string),
          eq(users.email, user_string),
          eq(users.accountNumber, user_string)
        )
      )
      .limit(1);

    if (!user) {
      return { type: 'error', message: 'User not found' };
    }

    if (user.status === 1) {
      return { type: 'error', message: 'Account is locked' };
    }

    // Verify password
    const isValidPassword = await compare(password, user.password);
    if (!isValidPassword) {
      return { type: 'error', message: 'Invalid password' };
    }

    // Generate JWT token
    const token = await jwt.sign({
      uid: user.id,
      type: 'user'
    });

    return {
      type: 'ok',
      message: token,
      data: {
        user_id: user.id,
        account: user.accountNumber,
        user_level: user.userLevel
      }
    };
  }, {
    body: t.Object({
      user_string: t.String(),
      password: t.String(),
      type: t.Optional(t.Number()),
      lang: t.Optional(t.String())
    })
  })

  // Register
  .post('/register', async ({ body, jwt }) => {
    const { user_string, password, re_password, extension_code, code, type, area_code, lang } = body;

    if (password !== re_password) {
      return { type: 'error', message: 'Passwords do not match' };
    }

    // Check if user already exists
    const [existingUser] = await db.select().from(users)
      .where(
        or(
          eq(users.phone, user_string),
          eq(users.email, user_string)
        )
      )
      .limit(1);

    if (existingUser) {
      return { type: 'error', message: 'User already exists' };
    }

    // Find parent by extension code
    let parentId = 1;
    if (extension_code) {
      const [inviter] = await db.select().from(users)
        .where(eq(users.extensionCode, extension_code))
        .limit(1);
      if (inviter) {
        parentId = inviter.id;
      }
    }

    // Hash password
    const hashedPassword = await hash(password, 10);
    const now = Math.floor(Date.now() / 1000);
    const newExtensionCode = generateExtensionCode();

    // Create user
    const [newUser] = await db.insert(users).values({
      accountNumber: user_string.slice(-8),
      phone: type === 'mobile' ? user_string : '',
      email: type === 'email' ? user_string : '',
      password: hashedPassword,
      extensionCode: newExtensionCode,
      parentId,
      type: 0,
      createTime: now
    }).returning();

    // Initialize wallets
    await initializeWallets(newUser.id);

    return {
      type: 'ok',
      message: 'Registration successful'
    };
  }, {
    body: t.Object({
      user_string: t.String(),
      password: t.String(),
      re_password: t.String(),
      extension_code: t.Optional(t.String()),
      code: t.Optional(t.String()),
      type: t.String(),
      area_code: t.Optional(t.String()),
      area_code_id: t.Optional(t.Number()),
      lang: t.Optional(t.String())
    })
  })

  // Web3 Wallet Auth
  .post('/wallet', async ({ body, jwt }) => {
    const { address, signature, nonce, refCode } = body;

    // Verify signature
    const message = `Login to Exchange\nNonce: ${nonce}`;
    let recoveredAddress: string;
    
    try {
      recoveredAddress = verifyMessage(message, signature);
    } catch {
      return { type: 'error', message: 'Invalid signature' };
    }

    if (recoveredAddress.toLowerCase() !== address.toLowerCase()) {
      return { type: 'error', message: 'Signature verification failed' };
    }

    // Check if address is registered
    let [user] = await db.select().from(users)
      .where(eq(users.walletAddress, address.toLowerCase()))
      .limit(1);

    if (!user) {
      // Auto register new wallet user
      const accountNumber = generateAccountNumber(address);
      
      let parentId = 1;
      if (refCode) {
        const [inviter] = await db.select().from(users)
          .where(eq(users.extensionCode, refCode))
          .limit(1);
        if (inviter) parentId = inviter.id;
      }

      const now = Math.floor(Date.now() / 1000);
      
      [user] = await db.insert(users).values({
        accountNumber,
        walletAddress: address.toLowerCase(),
        parentId,
        extensionCode: generateExtensionCode(),
        type: 0,
        createTime: now
      }).returning();

      await initializeWallets(user.id);
    }

    // Generate token
    const token = await jwt.sign({
      uid: user.id,
      address: address.toLowerCase(),
      type: 'wallet'
    });

    return {
      type: 'ok',
      token,
      data: {
        user_id: user.id,
        account: user.accountNumber,
        address
      }
    };
  }, {
    body: t.Object({
      address: t.String(),
      signature: t.String(),
      nonce: t.String(),
      refCode: t.Optional(t.String())
    })
  })

  // Get user info
  .get('/info', async ({ headers, jwt }) => {
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
      message: {
        id: user.id,
        account_number: user.accountNumber,
        phone: user.phone,
        email: user.email,
        extension_code: user.extensionCode,
        user_level: user.userLevel,
        is_auth: user.isAuth,
        status: user.status,
        wallet_address: user.walletAddress,
        uid: user.uid ?? undefined
      }
    };
  })

  // Logout (预留接口)
  .post('/logout', async ({ headers }) => {
    // 前端清除 token 即可，后端无需处理
    return { type: 'ok', message: 'Logged out' };
  });
