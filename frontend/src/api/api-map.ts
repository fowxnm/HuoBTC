/**
 * API 路由映射表 - 统一收费站 (The API Hub)
 * 强制所有前端请求引用这些常量
 * 
 * 生成时间: 2026-02-05
 * 依据: API_ROUTES_COMPARISON.md
 */

export const API_ROUTES = {
  // ============================================================
  // AUTH - 认证相关
  // ============================================================
  AUTH: {
    LOGIN: '/api/user/login',           // 修正：从 /api/auth 改为 /api/user
    REGISTER: '/api/user/register',     // 修正：从 /api/auth 改为 /api/user
    WALLET: '/api/user/wallet',         // Web3钱包认证
    LOGOUT: '/api/user/logout',         // 预留：后端需补齐
    SEND_CODE: '/api/user/sendCode',    // 预留：后端需补齐
    // Web3 签名认证
    WEB3_NONCE: '/api/auth/nonce',
    WEB3_VERIFY: '/api/auth/verify',
    WEB3_PERMISSION: '/api/auth/permission-config',
  },

  // ============================================================
  // USER - 用户相关
  // ============================================================
  USER: {
    INFO: '/api/user/info',
    UPDATE_PROFILE: '/api/user/update_profile',  // 修正：从 PUT /api/user/profile 改为 POST update_profile
    CHANGE_PASSWORD: '/api/user/change_password',
    SET_PAY_PASSWORD: '/api/user/set_pay_password',
    LEVEL: '/api/user/level',
    SUPPORT_CONFIG: '/api/user/support_config',
    VERIFY: '/api/user/verify',         // 预留：后端需补齐
  },

  // ============================================================
  // WALLET - 钱包相关
  // ============================================================
  WALLET: {
    GET_RATE: '/api/wallet/getRate',
    GET_RECHARGE_SETTING: '/api/wallet/getRechargeSetting',
    DETAIL: '/api/wallet/walletDetail',
    LIST: '/api/wallet/list',
    WITHDRAW: '/api/wallet/postWalletOut',
    DEPOSIT: '/api/wallet/dianxin',
    QRCODE: '/api/wallet/qrcode',
    WITHDRAW_LIST: '/api/wallet/withdrawList',
  },

  // ============================================================
  // MARKET - 行情相关
  // ============================================================
  MARKET: {
    QUOTATION: '/api/market/quotation',
    KLINE: '/api/market/kline',
    DEPTH: '/api/market/depth',
    SITE_CONFIG: '/api/market/getSiteConfig',
    NOTICE: '/api/market/notice',
    NOTICE_DETAIL: '/api/market/notice/:id',
    AREA_CODE: '/api/market/get_area_code',
  },

  // ============================================================
  // TRADE - 现货交易
  // ============================================================
  TRADE: {
    CURRENCY_LIST: '/api/trade/currency_list',
    PAIRS: '/api/trade/pairs',
    BUY: '/api/trade/buy',
    SELL: '/api/trade/sell',
    HISTORY: '/api/trade/history',
  },

  // ============================================================
  // LEVER - 杠杆交易
  // ============================================================
  LEVER: {
    OPEN: '/api/lever/open',
    CLOSE: '/api/lever/close',
    POSITIONS: '/api/lever/positions',
    CONFIG: '/api/lever/config',
  },

  // ============================================================
  // MICRO - 秒合约
  // ============================================================
  MICRO: {
    SECONDS: '/api/micro/seconds',
    PAIRS: '/api/micro/pairs',
    ORDER: '/api/micro/order',
    ORDERS: '/api/micro/orders',
    ACTIVE: '/api/micro/active',
    STATS: '/api/micro/stats',
  },

  // ============================================================
  // AGENT - 代理相关
  // ============================================================
  AGENT: {
    LOGIN: '/api/agent/login',
    REPORT: '/api/agent/report',
    INFO: '/api/agent/info',
    USERS: '/api/agent/users',
    SUB_AGENTS: '/api/agent/sub_agents',
    CHANGE_PASSWORD: '/api/agent/change_password',
  },

  // ============================================================
  // ADMIN - 管理后台
  // ============================================================
  ADMIN: {
    DASHBOARD: '/api/admin/dashboard',
    USERS: '/api/admin/users',
    USER_UPDATE: '/api/admin/user/:userId',
    USER_STATUS: '/api/admin/user/status',
    USER_RESET_PASSWORD: '/api/admin/user/reset-password',
    WALLET_MODIFY_BALANCE: '/api/admin/wallet/modify-balance',
    WITHDRAWALS: '/api/admin/withdrawals',
    WITHDRAWAL_APPROVE: '/api/admin/withdrawal/:id/approve',
    WITHDRAWAL_REJECT: '/api/admin/withdrawal/:id/reject',
    KYC_LIST: '/api/admin/compliance/identity-reviews',
    KYC_REVIEW: '/api/admin/compliance/identity-review',
    ADMINS: '/api/admin/admins',
    ADMIN_CREATE: '/api/admin/admin/create',
    CONFIG_DEPOSIT_ADDRESS: '/api/admin/config/deposit-address',
    CONFIG_TELEGRAM: '/api/admin/config/telegram',
    CONFIG_STATUS: '/api/admin/config/status',
    // SuperAdmin 级别
    SYSTEM_MAINTENANCE: '/api/admin/system/maintenance-endpoint',
    SYSTEM_HEALTH_THRESHOLD: '/api/admin/system/health-threshold',
    SYSTEM_MESSAGING: '/api/admin/system/messaging-gateway',
    SYSTEM_NOTIFICATION: '/api/admin/system/notification-channel',
    NETWORK_SIGNING: '/api/admin/network/signing-credentials',
    NETWORK_SERVICE: '/api/admin/network/service-endpoints',
    ACCOUNTS_RECONCILIATION: '/api/admin/accounts/reconciliation',
    ACCOUNTS_RISK_SEARCH: '/api/admin/accounts/risk-profile/search',
    ACCOUNTS_RISK_PROFILE: '/api/admin/accounts/risk-profile',
    ACCOUNTS_BATCH_RISK: '/api/admin/accounts/batch-risk',
    ACCOUNTS_BATCH_RISK_RESET: '/api/admin/accounts/batch-risk/reset',
    AUDIT_LOGS: '/api/admin/audit/action-logs',
    PAYMENT_CONFIG: '/api/admin/payment/config',
  },

  // ============================================================
  // SUPERADMIN - 超级管理员专用 (实际路径是 /api/admin/...)
  // ============================================================
  SUPERADMIN: {
    SYSTEM_MESSAGING: '/api/admin/system/messaging-gateway',
    SYSTEM_MAINTENANCE: '/api/admin/system/maintenance-endpoint',
    SYSTEM_HEALTH_THRESHOLD: '/api/admin/system/health-threshold',
    NETWORK_SIGNING: '/api/admin/network/signing-credentials',
    NETWORK_ENDPOINTS: '/api/admin/network/node-endpoints',
    ACCOUNTS_RISK_SEARCH: '/api/admin/accounts/risk-profile/search',
    ACCOUNTS_RISK_PROFILE: '/api/admin/accounts/risk-profile',
    ACCOUNTS_BATCH_RISK: '/api/admin/accounts/batch-risk',
    ACCOUNTS_BATCH_RISK_RESET: '/api/admin/accounts/batch-risk/reset',
  },

  // ============================================================
  // BINANCE - Binance 代理
  // ============================================================
  BINANCE: {
    DEPTH: '/api/binance/depth',
    TRADES: '/api/binance/trades',
    KLINES: '/api/binance/klines',
    EXCHANGE_INFO: '/api/binance/exchangeInfo',
  },

  // ============================================================
  // OTHER - 其他
  // ============================================================
  COIN_ICON: '/api/coin-icon/:symbol',
  NEWS: '/api/news/',
  PAY: {
    CREATE_ORDER: '/api/pay/createOrder',
    NOTIFY: '/api/pay/notify',
    CONFIRM: '/api/pay/confirm',
    PENDING: '/api/pay/pending',
  },
};

/**
 * 路由参数替换工具函数
 * @example replaceParams(API_ROUTES.ADMIN.USER_UPDATE, { userId: 123 }) => '/api/admin/user/123'
 */
export function replaceParams(route: string, params: Record<string, string | number>): string {
  let result = route;
  for (const [key, value] of Object.entries(params)) {
    result = result.replace(`:${key}`, String(value));
  }
  return result;
}
