/**
 * 企业级环境变量校验 - 启动时校验，失败即退出，避免运行时才暴露问题
 */
const NODE_ENV = process.env.NODE_ENV || 'development';
const isProduction = NODE_ENV === 'production';

const DEFAULT_JWT = 'change-this-in-production-32chars!';

export function validateEnv(): void {
  const errors: string[] = [];

  if (!process.env.DATABASE_URL?.trim()) {
    errors.push('DATABASE_URL is required');
  } else if (!/^postgres(ql)?:\/\//i.test(process.env.DATABASE_URL)) {
    errors.push('DATABASE_URL must be a valid PostgreSQL connection string');
  }

  const jwtSecret = process.env.JWT_SECRET?.trim() || DEFAULT_JWT;
  if (isProduction && (jwtSecret === DEFAULT_JWT || jwtSecret.length < 32)) {
    errors.push('JWT_SECRET must be set and at least 32 characters in production');
  }

  if (errors.length > 0) {
    console.error('[FATAL] Environment validation failed:\n' + errors.map(e => '  - ' + e).join('\n'));
    process.exit(1);
  }

  if (isProduction && jwtSecret === DEFAULT_JWT) {
    console.warn('[WARN] JWT_SECRET is using default value; set a strong secret in production');
  }
}

export function getPort(): number {
  const port = parseInt(process.env.PORT || '8000', 10);
  if (isNaN(port) || port < 1 || port > 65535) {
    console.error('[FATAL] Invalid PORT');
    process.exit(1);
  }
  return port;
}

export function getAllowedOrigins(): string[] {
  const raw = process.env.ALLOWED_ORIGINS || 'http://localhost:3000,http://localhost:5173';
  return raw.split(',').map(o => o.trim()).filter(Boolean);
}
