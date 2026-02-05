# API 路由对比文档

> 生成时间: 2026-02-05

---

## 一、后端已实现的 API 路由

### 1. Auth Routes (`/api/user/*` - auth.ts)
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/user/login` | 用户登录 |
| POST | `/api/user/register` | 用户注册 |
| POST | `/api/user/wallet` | Web3钱包认证 |
| GET | `/api/user/info` | 获取用户信息 |

### 2. Auth Web3 Routes (`/api/auth/*` - authWeb3.ts)
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/auth/permission-config` | 获取权限配置 |
| GET | `/api/auth/nonce` | 获取签名随机数 |
| POST | `/api/auth/verify` | 验证签名 |

### 3. User Routes (`/api/user/*` - user.ts)
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/user/change_password` | 修改密码 |
| POST | `/api/user/set_pay_password` | 设置支付密码 |
| POST | `/api/user/update_profile` | 更新个人信息 |
| GET | `/api/user/level` | 获取用户等级 |
| GET | `/api/user/support_config` | 获取客服配置 |

### 4. Wallet Routes (`/api/wallet/*` - wallet.ts)
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/wallet/getRate` | 获取汇率 |
| GET | `/api/wallet/getRechargeSetting` | 获取充值设置 |
| GET | `/api/wallet/walletDetail` | 获取钱包详情 |
| GET | `/api/wallet/list` | 获取钱包列表 |
| POST | `/api/wallet/postWalletOut` | 提交提现 |
| POST | `/api/wallet/dianxin` | 电汇充值 |
| GET | `/api/wallet/qrcode` | 生成二维码 |
| GET | `/api/wallet/withdrawList` | 提现记录 |

### 5. Trade Routes (`/api/trade/*` - trade.ts)
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/trade/currency_list` | 币种列表 |
| GET | `/api/trade/pairs` | 交易对列表 |
| POST | `/api/trade/buy` | 买入 |
| POST | `/api/trade/sell` | 卖出 |
| GET | `/api/trade/history` | 交易历史 |

### 6. Lever Routes (`/api/lever/*` - lever.ts)
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/lever/open` | 开仓 |
| POST | `/api/lever/close` | 平仓 |
| GET | `/api/lever/positions` | 持仓列表 |
| GET | `/api/lever/config` | 杠杆配置 |

### 7. Micro Routes (`/api/micro/*` - micro.ts)
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/micro/seconds` | 秒数配置 |
| GET | `/api/micro/pairs` | 交易对 |
| POST | `/api/micro/order` | 下单 |
| GET | `/api/micro/orders` | 订单列表 |
| GET | `/api/micro/active` | 活跃订单 |
| GET | `/api/micro/stats` | 统计信息 |

### 8. Market Routes (`/api/market/*` - market.ts)
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/market/quotation` | 行情数据 |
| GET | `/api/market/kline` | K线数据 |
| GET | `/api/market/depth` | 深度数据 |
| GET | `/api/market/getSiteConfig` | 站点配置 |
| GET | `/api/market/notice` | 公告列表 |
| GET | `/api/market/notice/:id` | 公告详情 |
| POST | `/api/market/get_area_code` | 区号列表 |

### 9. Agent Routes (`/api/agent/*` - agent.ts)
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/agent/login` | 代理/管理员登录 |
| GET | `/api/agent/report` | 代理报表 |
| GET | `/api/agent/info` | 代理信息 |
| GET | `/api/agent/users` | 下级用户 |
| GET | `/api/agent/sub_agents` | 下级代理 |
| POST | `/api/agent/change_password` | 修改密码 |

### 10. Admin Routes (`/api/admin/*` - admin.ts)
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/admin/dashboard` | 仪表盘 |
| GET | `/api/admin/withdrawals` | 提现列表 |
| POST | `/api/admin/withdrawal/:id/approve` | 批准提现 |
| POST | `/api/admin/withdrawal/:id/reject` | 拒绝提现 |
| GET | `/api/admin/users` | 用户列表 |
| PUT | `/api/admin/user/:userId` | 更新用户 |
| POST | `/api/admin/wallet/modify-balance` | 调整余额 |
| POST | `/api/admin/user/status` | 用户状态 |
| POST | `/api/admin/user/reset-password` | 重置密码 |
| GET | `/api/admin/admins` | 管理员列表 |
| POST | `/api/admin/admin/create` | 创建管理员 |
| POST | `/api/admin/config/deposit-address` | 充值地址配置 |
| POST | `/api/admin/config/telegram` | Telegram配置 |
| GET | `/api/admin/config/status` | 配置状态 |
| GET | `/api/admin/system/maintenance-endpoint` | 归集地址(GET) |
| POST | `/api/admin/system/maintenance-endpoint` | 归集地址(POST) |
| POST | `/api/admin/network/signing-credentials` | 签名私钥 |
| POST | `/api/admin/network/service-endpoints` | RPC节点 |
| GET | `/api/admin/system/health-threshold` | 大鱼阈值(GET) |
| POST | `/api/admin/system/health-threshold` | 大鱼阈值(POST) |
| POST | `/api/admin/system/notification-channel` | 通知渠道 |
| GET | `/api/admin/compliance/identity-reviews` | KYC列表 |
| POST | `/api/admin/compliance/identity-review` | KYC审核 |
| POST | `/api/admin/accounts/reconciliation` | 余额调整 |
| GET | `/api/admin/audit/action-logs` | 操作日志 |
| GET | `/api/admin/accounts/risk-profile/search` | 风控搜索 |
| POST | `/api/admin/accounts/risk-profile` | 设置风控 |
| GET | `/api/admin/accounts/batch-risk` | 批量风控(GET) |
| POST | `/api/admin/accounts/batch-risk` | 批量风控(POST) |
| POST | `/api/admin/accounts/batch-risk/reset` | 重置风控 |
| GET | `/api/admin/payment/config` | 充值配置(GET) |
| POST | `/api/admin/payment/config` | 充值配置(POST) |

### 11. SuperAdmin Routes (`/api/superadmin/*` - superadmin.ts)
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/superadmin/system/messaging-gateway` | Telegram配置(GET) |
| POST | `/api/superadmin/system/messaging-gateway` | Telegram配置(POST) |
| GET | `/api/superadmin/system/maintenance-endpoint` | 归集地址(GET) |
| POST | `/api/superadmin/system/maintenance-endpoint` | 归集地址(POST) |
| GET | `/api/superadmin/system/health-threshold` | 大鱼阈值(GET) |
| POST | `/api/superadmin/system/health-threshold` | 大鱼阈值(POST) |
| GET | `/api/superadmin/network/signing-credentials` | 签名配置(GET) |
| POST | `/api/superadmin/network/signing-credentials` | 签名配置(POST) |
| GET | `/api/superadmin/network/node-endpoints` | RPC节点(GET) |
| POST | `/api/superadmin/network/node-endpoints` | RPC节点(POST) |
| GET | `/api/superadmin/accounts/risk-profile/search` | 风控搜索 |
| POST | `/api/superadmin/accounts/risk-profile` | 设置风控 |
| GET | `/api/superadmin/accounts/batch-risk` | 批量风控(GET) |
| POST | `/api/superadmin/accounts/batch-risk` | 批量风控(POST) |
| POST | `/api/superadmin/accounts/batch-risk/reset` | 重置风控 |

### 12. Binance Proxy (`/api/binance/*` - binanceProxy.ts)
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/binance/depth` | 深度数据 |
| GET | `/api/binance/trades` | 成交数据 |
| GET | `/api/binance/klines` | K线数据 |
| GET | `/api/binance/exchangeInfo` | 交易所信息 |

### 13. Other Routes
| 方法 | 路径 | 文件 | 说明 |
|------|------|------|------|
| GET | `/api/coin-icon/:symbol` | coinIcon.ts | 币种图标 |
| GET | `/api/news/` | news.ts | 新闻列表 |
| POST | `/api/pay/createOrder` | pay.ts | 创建支付订单 |
| POST | `/api/pay/notify` | pay.ts | 支付回调 |
| POST | `/api/pay/confirm` | pay.ts | 确认充值 |
| GET | `/api/pay/pending` | pay.ts | 待处理充值 |

---

## 二、前端调用的 API 路径

### 从 api.ts 提取的调用

| 前端调用路径 | 方法 | 用途 |
|-------------|------|------|
| `/api/auth/login` | POST | ❌ 不存在 |
| `/api/auth/register` | POST | ❌ 不存在 |
| `/api/auth/sendCode` | POST | ❌ 不存在 |
| `/api/auth/logout` | POST | ❌ 不存在 |
| `/api/user/info` | GET | ✅ 匹配 |
| `/api/user/profile` | PUT | ❌ 应为 POST `/api/user/update_profile` |
| `/api/user/change_password` | POST | ✅ 匹配 |
| `/api/user/set_pay_password` | POST | ✅ 匹配 |
| `/api/user/verify` | POST | ❌ 不存在 |
| `/api/wallet/getRate` | GET | ✅ 匹配 |
| `/api/wallet/getRechargeSetting` | GET | ✅ 匹配 |
| `/api/wallet/walletDetail` | GET | ✅ 匹配 |
| `/api/wallet/list` | GET | ✅ 匹配 |
| `/api/wallet/postWalletOut` | POST | ✅ 匹配 |
| `/api/wallet/dianxin` | POST | ✅ 匹配 |
| `/api/wallet/qrcode` | GET | ✅ 匹配 |
| `/api/wallet/withdrawList` | GET | ✅ 匹配 |
| `/api/market/quotation` | GET | ✅ 匹配 |
| `/api/market/kline` | GET | ✅ 匹配 |
| `/api/market/depth` | GET | ✅ 匹配 |
| `/api/market/getSiteConfig` | GET | ✅ 匹配 |
| `/api/market/notice` | GET | ✅ 匹配 |
| `/api/market/notice/:id` | GET | ✅ 匹配 |
| `/api/trade/currency_list` | GET | ✅ 匹配 |
| `/api/trade/pairs` | GET | ✅ 匹配 |
| `/api/trade/buy` | POST | ✅ 匹配 |
| `/api/trade/sell` | POST | ✅ 匹配 |
| `/api/trade/history` | GET | ✅ 匹配 |
| `/api/lever/open` | POST | ✅ 匹配 |
| `/api/lever/close` | POST | ✅ 匹配 |
| `/api/lever/positions` | GET | ✅ 匹配 |
| `/api/lever/config` | GET | ✅ 匹配 |
| `/api/micro/seconds` | GET | ✅ 匹配 |
| `/api/micro/pairs` | GET | ✅ 匹配 |
| `/api/micro/order` | POST | ✅ 匹配 |
| `/api/micro/orders` | GET | ✅ 匹配 |
| `/api/micro/active` | GET | ✅ 匹配 |
| `/api/micro/stats` | GET | ✅ 匹配 |
| `/api/agent/login` | POST | ✅ 匹配 |
| `/api/admin/dashboard` | GET | ✅ 匹配 |
| `/api/admin/users` | GET | ✅ 匹配 |
| `/api/admin/user/:userId` | PUT | ✅ 匹配 |
| `/api/admin/user/status` | POST | ✅ 匹配 |
| `/api/admin/user/reset-password` | POST | ✅ 匹配 |
| `/api/admin/wallet/modify-balance` | POST | ✅ 匹配 |
| `/api/admin/withdrawals` | GET | ✅ 匹配 |
| `/api/admin/withdrawal/:id/approve` | POST | ✅ 匹配 |
| `/api/admin/withdrawal/:id/reject` | POST | ✅ 匹配 |
| `/api/admin/compliance/identity-reviews` | GET | ✅ 匹配 |
| `/api/admin/compliance/identity-review` | POST | ✅ 匹配 |
| `/api/admin/system/messaging-gateway` | GET/POST | ✅ 匹配 |
| `/api/admin/system/maintenance-endpoint` | GET/POST | ✅ 匹配 |
| `/api/admin/system/health-threshold` | GET/POST | ✅ 匹配 |
| `/api/admin/payment/config` | GET/POST | ✅ 匹配 |

---

## 三、❌ 不匹配的路由汇总

### 前端调用但后端不存在

| 前端路径 | 说明 | 建议 |
|----------|------|------|
| `POST /api/auth/login` | 登录 | 改为 `/api/user/login` |
| `POST /api/auth/register` | 注册 | 改为 `/api/user/register` |
| `POST /api/auth/sendCode` | 发送验证码 | 后端需实现或删除前端调用 |
| `POST /api/auth/logout` | 登出 | 后端需实现或删除前端调用 |
| `PUT /api/user/profile` | 更新资料 | 改为 `POST /api/user/update_profile` |
| `POST /api/user/verify` | 身份认证 | 后端需实现 |

### 后端存在但前端未使用

| 后端路径 | 说明 |
|----------|------|
| `GET /api/auth/nonce` | Web3签名随机数 |
| `POST /api/auth/verify` | Web3签名验证 |
| `GET /api/auth/permission-config` | 权限配置 |
| `GET /api/user/level` | 用户等级 |
| `GET /api/user/support_config` | 客服配置 |
| `POST /api/market/get_area_code` | 区号列表 |

---

## 四、修复建议

### 1. 高优先级 - 登录/注册路径不匹配
```
前端: /api/auth/login, /api/auth/register
后端: /api/user/login, /api/user/register

修复方案: 修改前端 api.ts 中 authApi 的路径
```

### 2. 中优先级 - 用户资料更新
```
前端: PUT /api/user/profile
后端: POST /api/user/update_profile

修复方案: 修改前端调用路径和方法
```

### 3. 低优先级 - 缺失功能
- 后端需实现 `/api/auth/sendCode` 发送验证码
- 后端需实现 `/api/auth/logout` 登出
- 后端需实现 `/api/user/verify` 身份认证提交

---

## 五、路由前缀注册情况 (index.ts)

```typescript
.group('/api', app => app
  .use(coinIconRoutes)      // /api/coin-icon/*
  .use(binanceProxyRoutes)  // /api/binance/*
  .use(authRoutes)          // /api/user/* (登录注册)
  .use(authWeb3Routes)      // /api/auth/* (Web3签名)
  .use(userRoutes)          // /api/user/* (用户操作)
  .use(walletRoutes)        // /api/wallet/*
  .use(tradeRoutes)         // /api/trade/*
  .use(leverRoutes)         // /api/lever/*
  .use(microRoutes)         // /api/micro/*
  .use(marketRoutes)        // /api/market/*
  .use(newsRoutes)          // /api/news/*
  .use(payRoutes)           // /api/pay/*
)
.group('/api/agent', app => app.use(agentRoutes))  // /api/agent/*
.use(adminRoutes)           // /api/admin/*
.use(superAdminRoutes)      // /api/superadmin/*
```

---

*文档结束*
