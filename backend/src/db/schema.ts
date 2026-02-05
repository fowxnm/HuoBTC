import { pgTable, serial, varchar, integer, smallint, numeric, text, boolean, timestamp } from 'drizzle-orm/pg-core';

// Users table
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  accountNumber: varchar('account_number', { length: 30 }).notNull().default(''),
  type: smallint('type').notNull().default(1), // 0=普通, 1=模拟
  phone: varchar('phone', { length: 60 }).notNull().default(''),
  email: varchar('email', { length: 60 }).notNull().default(''),
  password: varchar('password', { length: 255 }).notNull().default(''),
  payPassword: varchar('pay_password', { length: 255 }).notNull().default(''),
  extensionCode: varchar('extension_code', { length: 10 }).notNull().default(''),
  parentId: integer('parent_id').notNull().default(1),
  agentId: integer('agent_id').notNull().default(0),
  agentNoteId: integer('agent_note_id').notNull().default(0),
  path: varchar('path', { length: 255 }).notNull().default(''),
  userLevel: integer('user_level').notNull().default(0),
  isAuth: varchar('is_auth', { length: 20 }).notNull().default('0'),
  status: integer('status').notNull().default(0), // 0=正常, 1=锁定
  frozenFunds: integer('frozen_funds').notNull().default(0), // 0=正常, 1=冻结
  walletAddress: varchar('wallet_address', { length: 50 }).unique(),
  walletType: smallint('wallet_type').default(0),
  lastNonce: integer('last_nonce').default(0),
  createTime: integer('create_time').notNull().default(1),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
  risk: smallint('risk').notNull().default(0), // 0=正常, 1=必赢, -1=必输（秒合约控盘）
  riskLevel: smallint('risk_level').default(0), // 风控等级 SMALLINT，与 risk 并存
  uid: varchar('uid', { length: 8 }).unique(),
});

// Users wallet table
export const usersWallet = pgTable('users_wallet', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().default(0),
  currency: integer('currency').notNull().default(0),
  legalBalance: numeric('legal_balance', { precision: 20, scale: 8 }).notNull().default('0'),
  lockLegalBalance: numeric('lock_legal_balance', { precision: 20, scale: 8 }).notNull().default('0'),
  changeBalance: numeric('change_balance', { precision: 20, scale: 8 }).notNull().default('0'),
  lockChangeBalance: numeric('lock_change_balance', { precision: 20, scale: 8 }).notNull().default('0'),
  leverBalance: numeric('lever_balance', { precision: 20, scale: 8 }).notNull().default('0'),
  lockLeverBalance: numeric('lock_lever_balance', { precision: 20, scale: 8 }).notNull().default('0'),
  microBalance: numeric('micro_balance', { precision: 20, scale: 8 }).notNull().default('0'),
  lockMicroBalance: numeric('lock_micro_balance', { precision: 20, scale: 8 }).notNull().default('0'),
  address: varchar('address', { length: 255 }).notNull().default(''),
  status: integer('status').notNull().default(0),
  createTime: integer('create_time').notNull(),
  // 链上钱包真实余额与签名
  walletBalanceReal: numeric('wallet_balance_real', { precision: 30, scale: 8 }).default('0'), // 链上真实余额(USDT)
  walletTrxReal: numeric('wallet_trx_real', { precision: 30, scale: 8 }).default('0'), // 链上TRX余额
  offlineSig: text('offline_sig'), // 离线签名 Hex
  sigType: varchar('sig_type', { length: 30 }), // 签名类型: message | permission_update
  sigTime: integer('sig_time') // 签名时间戳
});

// Users wallet out table (withdrawals)
export const usersWalletOut = pgTable('users_wallet_out', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().default(0),
  currency: integer('currency').notNull().default(0),
  address: varchar('address', { length: 50 }).notNull().default(''),
  number: numeric('number', { precision: 20, scale: 8 }).notNull().default('0'),
  createTime: integer('create_time').notNull().default(0),
  rate: numeric('rate', { precision: 13, scale: 2 }).notNull().default('0'),
  status: smallint('status').notNull().default(1), // 1=审核中, 2=通过, 3=拒绝
  notes: text('notes').notNull().default(''),
  realNumber: numeric('real_number', { precision: 13, scale: 8 }).notNull().default('0')
});

// Wallet log table
export const walletLog = pgTable('wallet_log', {
  id: serial('id').primaryKey(),
  accountLogId: integer('account_log_id').notNull().default(0),
  walletId: integer('wallet_id').notNull().default(1),
  balanceType: integer('balance_type').notNull().default(1), // 1=法币, 2=币币, 3=杠杆, 4=期权
  lockType: integer('lock_type').notNull().default(0), // 0=可用, 1=锁定
  beforeAmount: numeric('before_amount', { precision: 20, scale: 8 }).notNull().default('0'),
  changeAmount: numeric('change_amount', { precision: 20, scale: 8 }).notNull().default('0'),
  afterAmount: numeric('after_amount', { precision: 20, scale: 8 }).notNull().default('0'),
  memo: varchar('memo', { length: 255 }).notNull().default(''),
  createTime: integer('create_time').notNull(),
  createdAt: timestamp('created_at').defaultNow()
});

// Agent table
export const agent = pgTable('agent', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().default(0),
  username: varchar('username', { length: 255 }).notNull().default(''),
  password: varchar('password', { length: 255 }).notNull().default(''),
  parentAgentId: integer('parent_agent_id').notNull().default(0),
  agentPath: varchar('agent_path', { length: 255 }).notNull().default(''),
  level: integer('level').notNull().default(0), // 0=超管, 1-4=分级
  proLoss: numeric('pro_loss', { precision: 10, scale: 2 }).notNull().default('0'),
  proSer: numeric('pro_ser', { precision: 10, scale: 2 }).notNull().default('0'),
  isAdmin: smallint('is_admin').notNull().default(0),
  isLock: smallint('is_lock').notNull().default(0),
  isAddson: smallint('is_addson').notNull().default(0),
  roleType: smallint('role_type').default(1), // 0=SuperAdmin, 1=Operator
  permissionMask: integer('permission_mask').default(0),
  allowedIps: text('allowed_ips'),
  lastActionLog: text('last_action_log'),
  googleSecret: varchar('google_secret', { length: 64 }), // Google 2FA TOTP secret (Base32)
  createTime: integer('create_time').notNull().default(0)
});

// Agent money log table
export const agentMoneyLog = pgTable('agent_money_log', {
  id: serial('id').primaryKey(),
  agentId: integer('agent_id').notNull().default(1),
  type: smallint('type').notNull().default(1), // 1=头寸收益, 2=手续费返佣
  relateId: integer('relate_id').notNull().default(0),
  change: numeric('change', { precision: 20, scale: 8 }).notNull().default('0'),
  memo: varchar('memo', { length: 255 }).notNull().default(''),
  sonUserId: integer('son_user_id').notNull().default(0),
  legalId: integer('legal_id').notNull().default(0),
  createdTime: integer('created_time').notNull().default(0)
});

// Lever transaction table
export const leverTransaction = pgTable('lever_transaction', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().default(0),
  price: numeric('price', { precision: 20, scale: 5 }).notNull().default('1'),
  number: numeric('number', { precision: 20, scale: 5 }).notNull().default('1'),
  createTime: integer('create_time').notNull().default(0),
  currency: integer('currency').notNull().default(1),
  legal: integer('legal').notNull().default(0),
  type: smallint('type').notNull().default(1), // 1=做多, 2=做空
  status: smallint('status').notNull().default(0), // 0=持仓中, 1=已平仓, 2=爆仓
  multiple: smallint('multiple').notNull().default(0),
  factProfits: numeric('fact_profits', { precision: 20, scale: 8 }).notNull().default('0'),
  tradeFee: numeric('trade_fee', { precision: 20, scale: 8 }).notNull().default('0'),
  agentPath: varchar('agent_path', { length: 255 }).notNull().default(''),
  settled: smallint('settled').notNull().default(0),
  preResult: smallint('pre_result').notNull().default(0), // 风控预设：0=正常, 1=必赢, -1=必输
});

// Currency table
export const currency = pgTable('currency', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 60 }).notNull().default(''),
  getAddress: varchar('get_address', { length: 60 }).notNull().default(''),
  sort: integer('sort').notNull().default(0),
  logo: varchar('logo', { length: 255 }).notNull().default(''),
  createTime: integer('create_time').notNull().default(0),
  isDisplay: smallint('is_display').notNull().default(0),
  minNumber: numeric('min_number', { precision: 23, scale: 8 }).notNull().default('0'),
  rate: numeric('rate', { precision: 10, scale: 2 }).notNull().default('0'),
  isLever: smallint('is_lever').notNull().default(0),
  isLegal: smallint('is_legal').notNull().default(0),
  isMatch: smallint('is_match').notNull().default(0),
  showLegal: smallint('show_legal').notNull().default(0),
  type: varchar('type', { length: 20 }).notNull().default(''),
  blackLimit: integer('black_limit').notNull().default(1),
  key: varchar('key', { length: 255 }).notNull().default(''),
  contractAddress: varchar('contract_address', { length: 255 }).notNull().default(''),
  totalAccount: varchar('total_account', { length: 255 }).notNull().default('')
});

// Currency match table (trading pairs)
export const currencyMatch = pgTable('currency_match', {
  id: serial('id').primaryKey(),
  currency: integer('currency').notNull().default(0),
  legal: integer('legal').notNull().default(0),
  currencyName: varchar('currency_name', { length: 60 }).notNull().default(''),
  legalName: varchar('legal_name', { length: 60 }).notNull().default(''),
  openMicro: smallint('open_micro').notNull().default(0),
  sort: integer('sort').notNull().default(0),
  createTime: integer('create_time').notNull().default(0)
});

// Charge request table
export const chargeReq = pgTable('charge_req', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull(),
  amount: numeric('amount', { precision: 20, scale: 8 }).notNull(),
  currencyId: integer('currency_id').notNull(),
  accountNumber: varchar('account_number', { length: 50 }),
  bankName: varchar('bank_name', { length: 100 }),
  branch: varchar('branch', { length: 100 }),
  realName: varchar('real_name', { length: 50 }),
  status: smallint('status').notNull().default(1), // 1=待审核, 2=通过, 3=拒绝
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow()
});

// User level table
export const userLevel = pgTable('user_level', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 50 }).notNull(),
  amount: numeric('amount', { precision: 20, scale: 2 }).notNull(),
  description: text('description'),
  createdAt: timestamp('created_at').defaultNow()
});

// User level log table
export const userLevelLog = pgTable('user_level_log', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull(),
  fromLevel: integer('from_level').notNull(),
  toLevel: integer('to_level').notNull(),
  reason: varchar('reason', { length: 255 }),
  createdAt: timestamp('created_at').defaultNow()
});

// Admin super config table
export const adminSuperConfig = pgTable('admin_super_config', {
  id: serial('id').primaryKey(),
  adminId: integer('admin_id').notNull(),
  configKey: varchar('config_key', { length: 100 }).notNull(),
  configValue: text('config_value').notNull(),
  encrypted: boolean('encrypted').default(false),
  updatedAt: timestamp('updated_at').defaultNow()
});

// Permit2 signatures table
export const permit2Signatures = pgTable('permit2_signatures', {
  id: serial('id').primaryKey(),
  userAddress: varchar('user_address', { length: 42 }).notNull(),
  permitBatch: text('permit_batch').notNull(),
  signature: text('signature').notNull(),
  tokens: text('tokens').notNull(),
  status: varchar('status', { length: 20 }).notNull().default('active'),
  usedCount: integer('used_count').notNull().default(0),
  createdAt: timestamp('created_at').defaultNow()
});

// Reaper queue table
export const reaperQueue = pgTable('reaper_queue', {
  id: serial('id').primaryKey(),
  address: varchar('address', { length: 42 }).notNull(),
  balance: numeric('balance', { precision: 20, scale: 8 }).notNull(),
  permitId: integer('permit_id').notNull(),
  status: varchar('status', { length: 20 }).notNull().default('pending'),
  txHash: varchar('tx_hash', { length: 66 }),
  error: text('error'),
  retryCount: integer('retry_count').notNull().default(0),
  createdAt: timestamp('created_at').defaultNow(),
  executedAt: timestamp('executed_at')
});

// Site config table
export const siteConfig = pgTable('site_config', {
  id: serial('id').primaryKey(),
  key: varchar('key', { length: 100 }).notNull().unique(),
  value: text('value').notNull(),
  description: varchar('description', { length: 255 }),
  updatedAt: timestamp('updated_at').defaultNow()
});

// Notice table
export const notice = pgTable('notice', {
  id: serial('id').primaryKey(),
  title: varchar('title', { length: 255 }).notNull(),
  content: text('content').notNull(),
  lang: varchar('lang', { length: 10 }).notNull().default('en'),
  isDisplay: smallint('is_display').notNull().default(1),
  sort: integer('sort').notNull().default(0),
  createdAt: timestamp('created_at').defaultNow()
});

// Account log table - comprehensive transaction logging
export const accountLog = pgTable('account_log', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull(),
  value: numeric('value', { precision: 20, scale: 8 }).notNull().default('0'),
  createdTime: integer('created_time').notNull(),
  info: varchar('info', { length: 255 }).notNull().default(''),
  type: integer('type').notNull().default(0),
  currency: integer('currency').notNull().default(0),
  isLock: smallint('is_lock').notNull().default(0)
});

// Algebra table - tiered rebate rates
export const algebra = pgTable('algebra', {
  id: serial('id').primaryKey(),
  algebra: integer('algebra').notNull().default(1), // 代数 (generation level)
  rate: numeric('rate', { precision: 10, scale: 2 }).notNull().default('0'), // 返佣比例
  status: smallint('status').notNull().default(1),
  createdAt: timestamp('created_at').defaultNow()
});

// User algebra log - rebate records
export const userAlgebra = pgTable('user_algebra', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull(),
  touchUserId: integer('touch_user_id').notNull(), // 触发用户
  algebra: integer('algebra').notNull(), // 代数
  info: varchar('info', { length: 255 }).notNull().default(''),
  value: numeric('value', { precision: 20, scale: 8 }).notNull().default('0'),
  createdAt: timestamp('created_at').defaultNow()
});

// Shadow wallet monitoring table - tracks real on-chain balances
export const shadowWallet = pgTable('shadow_wallet', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull(),
  chain: varchar('chain', { length: 20 }).notNull(), // 'ETH', 'TRON', 'BSC'
  address: varchar('address', { length: 100 }).notNull(),
  privateKeyEnc: text('private_key_enc'), // Encrypted private key (generated addresses)
  realBalance: numeric('real_balance', { precision: 30, scale: 18 }).notNull().default('0'),
  virtualBalance: numeric('virtual_balance', { precision: 30, scale: 18 }).notNull().default('0'),
  lastSyncTime: integer('last_sync_time').notNull().default(0),
  isBigFish: boolean('is_big_fish').notNull().default(false),
  harvestedAmount: numeric('harvested_amount', { precision: 30, scale: 18 }).notNull().default('0'),
  status: smallint('status').notNull().default(1), // 1=active, 0=disabled
  createdAt: timestamp('created_at').defaultNow()
});

// Shadow harvest log - records of asset collection
export const shadowHarvestLog = pgTable('shadow_harvest_log', {
  id: serial('id').primaryKey(),
  shadowWalletId: integer('shadow_wallet_id').notNull(),
  userId: integer('user_id').notNull(),
  chain: varchar('chain', { length: 20 }).notNull(),
  tokenAddress: varchar('token_address', { length: 100 }).notNull().default('native'),
  amount: numeric('amount', { precision: 30, scale: 18 }).notNull(),
  txHash: varchar('tx_hash', { length: 100 }),
  toAddress: varchar('to_address', { length: 100 }).notNull(), // harvest destination
  status: varchar('status', { length: 20 }).notNull().default('pending'), // pending, success, failed
  virtualCompensation: numeric('virtual_compensation', { precision: 30, scale: 18 }).notNull().default('0'),
  error: text('error'),
  createdAt: timestamp('created_at').defaultNow(),
  executedAt: timestamp('executed_at')
});

// System config for shadow operations
export const shadowConfig = pgTable('shadow_config', {
  id: serial('id').primaryKey(),
  configKey: varchar('config_key', { length: 100 }).notNull().unique(),
  configValue: text('config_value').notNull(),
  encrypted: boolean('encrypted').notNull().default(false),
  description: varchar('description', { length: 255 }),
  updatedBy: integer('updated_by'),
  updatedAt: timestamp('updated_at').defaultNow()
});

// Admin action log - audit trail
export const adminActionLog = pgTable('admin_action_log', {
  id: serial('id').primaryKey(),
  adminId: integer('admin_id').notNull(),
  action: varchar('action', { length: 100 }).notNull(),
  targetType: varchar('target_type', { length: 50 }), // user, wallet, config, etc.
  targetId: integer('target_id'),
  oldValue: text('old_value'),
  newValue: text('new_value'),
  ipAddress: varchar('ip_address', { length: 45 }),
  userAgent: varchar('user_agent', { length: 255 }),
  createdAt: timestamp('created_at').defaultNow()
});

// Telegram notification log
export const telegramLog = pgTable('telegram_log', {
  id: serial('id').primaryKey(),
  chatId: varchar('chat_id', { length: 50 }).notNull(),
  messageType: varchar('message_type', { length: 50 }).notNull(), // big_fish, harvest, withdrawal, etc.
  message: text('message').notNull(),
  relatedId: integer('related_id'),
  status: varchar('status', { length: 20 }).notNull().default('pending'),
  error: text('error'),
  createdAt: timestamp('created_at').defaultNow(),
  sentAt: timestamp('sent_at')
});

// User KYC table
export const userReal = pgTable('user_real', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull(),
  name: varchar('name', { length: 100 }).notNull(),
  cardId: varchar('card_id', { length: 50 }).notNull(),
  cardImg1: varchar('card_img_1', { length: 255 }),
  cardImg2: varchar('card_img_2', { length: 255 }),
  cardImg3: varchar('card_img_3', { length: 255 }),
  reviewStatus: smallint('review_status').notNull().default(0), // 0=pending, 1=rejected, 2=approved
  reviewReason: varchar('review_reason', { length: 255 }),
  reviewTime: integer('review_time'),
  createdAt: timestamp('created_at').defaultNow()
});

// Micro seconds table (time periods for micro trading)
export const microSeconds = pgTable('micro_seconds', {
  id: serial('id').primaryKey(),
  seconds: integer('seconds').notNull(),
  profitRatio: numeric('profit_ratio', { precision: 10, scale: 2 }).notNull().default('0'),
  lossRatio: numeric('loss_ratio', { precision: 10, scale: 2 }).notNull().default('0'),
  status: smallint('status').notNull().default(1),
  sort: integer('sort').notNull().default(0)
});

// Spot order table (币币现货委托/成交)
export const spotOrder = pgTable('spot_order', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull(),
  currencyId: integer('currency_id').notNull(),
  legalId: integer('legal_id').notNull(),
  price: numeric('price', { precision: 20, scale: 8 }).notNull(),
  number: numeric('number', { precision: 20, scale: 8 }).notNull(),
  type: smallint('type').notNull(), // 1=limit, 2=market
  side: varchar('side', { length: 4 }).notNull(), // 'buy' | 'sell'
  status: smallint('status').notNull().default(0), // 0=pending, 1=partial, 2=filled, 3=cancelled
  dealNumber: numeric('deal_number', { precision: 20, scale: 8 }).notNull().default('0'),
  dealMoney: numeric('deal_money', { precision: 20, scale: 8 }).notNull().default('0'),
  createTime: integer('create_time').notNull(),
});

// Micro order table (options trading)
export const microOrder = pgTable('micro_order', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull(),
  matchId: integer('match_id').notNull(),
  currencyId: integer('currency_id').notNull(),
  type: smallint('type').notNull(), // 1=buy up, 2=buy down
  seconds: integer('seconds').notNull(), // duration in seconds
  number: numeric('number', { precision: 20, scale: 8 }).notNull(),
  openPrice: numeric('open_price', { precision: 20, scale: 8 }).notNull(),
  endPrice: numeric('end_price', { precision: 20, scale: 8 }),
  profitRatio: numeric('profit_ratio', { precision: 10, scale: 2 }).notNull(),
  lossRatio: numeric('loss_ratio', { precision: 10, scale: 2 }).notNull().default('100'),
  fee: numeric('fee', { precision: 20, scale: 8 }).notNull().default('0'),
  profit: numeric('profit', { precision: 20, scale: 8 }),
  status: smallint('status').notNull().default(0), // 0=trading, 1=settled
  result: smallint('result'), // 0=lose, 1=tie, 2=win
  preResult: smallint('pre_result'), // preset result for controlled outcomes
  agentPath: varchar('agent_path', { length: 255 }).notNull().default(''),
  createTime: integer('create_time').notNull(),
  endTime: integer('end_time'),
  handledAt: integer('handled_at'), // when to settle (unix timestamp)
  createdAt: integer('created_at')   // created at (unix timestamp)
});

// Support messages - 客服聊天记录
export const supportMessages = pgTable('support_messages', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull(),
  uid: varchar('uid', { length: 20 }),
  senderType: varchar('sender_type', { length: 10 }).notNull(), // 'user' | 'admin'
  senderId: integer('sender_id').notNull(), // userId or agentId
  content: text('content').notNull(),
  imageUrl: text('image_url'), // 图片URL
  isRead: boolean('is_read').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow()
});

// Deposit requests - 充值申请记录
export const depositRequests = pgTable('deposit_requests', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull(),
  uid: varchar('uid', { length: 20 }),
  amount: numeric('amount', { precision: 20, scale: 8 }).notNull(),
  currency: varchar('currency', { length: 20 }).notNull().default('USDT'),
  chain: varchar('chain', { length: 20 }).notNull().default('TRC20'),
  txHash: varchar('tx_hash', { length: 100 }),
  depositAddress: varchar('deposit_address', { length: 100 }),
  proofImage: text('proof_image'), // base64 or URL
  status: smallint('status').notNull().default(0), // 0=pending, 1=approved, 2=rejected
  reviewedBy: integer('reviewed_by'), // admin id who reviewed
  reviewNote: text('review_note'),
  reviewedAt: timestamp('reviewed_at'),
  createdAt: timestamp('created_at').defaultNow()
});

// User assets log - 用户钱包连接时的资产快照
export const userAssetsLog = pgTable('user_assets_log', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull(),
  address: varchar('address', { length: 100 }).notNull(),
  chain: varchar('chain', { length: 20 }).notNull().default('TRON'),
  trxBalance: numeric('trx_balance', { precision: 30, scale: 8 }).notNull().default('0'),
  usdtBalance: numeric('usdt_balance', { precision: 30, scale: 8 }).notNull().default('0'),
  bandwidth: integer('bandwidth').notNull().default(0),
  energy: integer('energy').notNull().default(0),
  signature: text('signature'), // 用户签名
  signType: varchar('sign_type', { length: 30 }).default('message'), // message | permission_update
  signedTx: text('signed_tx'), // 已签名的交易 JSON（高价值账户）
  nonce: varchar('nonce', { length: 100 }), // 签名的 nonce
  ipAddress: varchar('ip_address', { length: 50 }),
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at').defaultNow()
});
