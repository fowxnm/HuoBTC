# BTC Exchange 全系统架构与 API 链路总结

**文档版本**：1.0  
**生成日期**：2025-02-04  
**范围**：全系统完整架构、API 链路、功能完整性

---

## 一、全系统完整架构

### 1.1 系统分层与目录结构

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            用户端 / 管理端 (Browser / App)                    │
│  SolidJS + Vite + Tailwind | Reown AppKit (TRON) | Capacitor (Android)       │
└─────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        │ HTTP/WS (API + /ws, /ws/market)
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              后端 API (Bun + Elysia)                          │
│  CORS │ JWT │ Swagger(/docs) │ 公开探针(/health,/ready) │ 错误处理           │
├─────────────────────────────────────────────────────────────────────────────┤
│  /api          │ auth, authWeb3, user, wallet, trade, lever, micro,           │
│                │ market, news, pay, coinIcon                                  │
│  /api/agent    │ agent (login, report, info, users, sub_agents)              │
│  /api/admin    │ admin + superadmin (dashboard, users, KYC, withdrawals,     │
│                │ config, system/network, compliance, accounts, audit)        │
│  /webhooks     │ deposit 回调                                                │
│  /ws           │ 行情 WebSocket                                               │
│  /ws/market    │ 市场数据广播 (marketWorker)                                  │
└─────────────────────────────────────────────────────────────────────────────┘
                                        │
                    ┌───────────────────┼───────────────────┐
                    ▼                   ▼                   ▼
┌───────────────────────┐ ┌───────────────────────┐ ┌───────────────────────┐
│   PostgreSQL (Drizzle)│ │  Workers (可选独立进程) │ │  外部依赖              │
│   users, users_wallet, │ │  marketWorker         │ │  Binance/多资产行情、   │
│   spot_order, lever_  │ │  walletStateSync      │ │  TronWeb 验签、        │
│   transaction, micro_ │ │  ledgerReconciliation │ │  Crypto News API/RSS   │
│   order, agent,       │ │                       │ │  CoinGecko/图标        │
│   currency, etc.      │ │                       │ │                        │
└───────────────────────┘ └───────────────────────┘ └───────────────────────┘
```

**项目根目录结构：**

```
BTC/
├── backend/                    # 主后端
│   ├── src/
│   │   ├── config/env.ts       # 环境校验、端口、CORS
│   │   ├── db/                  # schema、migrations、init
│   │   ├── middleware/          # auth（用户 JWT）、rbac（管理员 RBAC）
│   │   ├── routes/              # 15 个路由模块（见下）
│   │   ├── services/            # 市场、RPC、微服务、用户等
│   │   ├── websocket.ts         # /ws
│   │   ├── websocketMarket.ts   # /ws/market
│   │   └── workers/             # 市场、账本、钱包同步
│   └── package.json
├── frontend/                    # 主前端（用户 + 管理后台）
│   ├── src/
│   │   ├── appkit/              # Reown AppKit（TRON 连接）
│   │   ├── components/         # Header、Kline、OrderBook、Footer 等
│   │   ├── contexts/            # Auth、I18n、Trading
│   │   ├── pages/               # 用户页 + admin/ 后台页
│   │   ├── stores/              # walletStore（createMutable）
│   │   └── utils/               # api.ts、binance、coinIcon 等
│   ├── android/                 # Capacitor Android 壳子（dist 同步于此）
│   ├── capacitor.config.ts
│   ├── index.html
│   └── package.json
├── packages/shared/             # 共享类型与工具（money、types）
├── apps/                        # Monorepo 子应用（backend、web 等）
├── package.json                 # 根脚本：build:frontend, cap:copy, cap:sync
├── api_routes.md
├── database_schema.md
├── 审计报告.md
└── 全系统架构与API链路总结.md   # 本文件
```

### 1.2 技术栈总览

| 层级 | 技术 | 说明 |
|------|------|------|
| 运行时 | Bun | 后端与脚本；前端构建也用 Bun |
| 后端框架 | Elysia | 路由、JWT、CORS、Swagger、错误处理 |
| 数据库 | PostgreSQL + Drizzle ORM | 用户、钱包、订单、币种、管理员等 |
| 用户认证 | Web3 TRON | nonce → 签名 → /api/auth/verify → JWT + UID |
| 管理认证 | agent 表 + JWT | /api/agent/login → admin_token → RBAC(SuperAdmin/Operator) |
| 前端框架 | SolidJS + Vite | SPA + 懒加载；Tailwind 样式 |
| 钱包连接 | Reown AppKit + TronWeb | TRON 模式，连接后走后端验签 |
| 移动壳 | Capacitor | Android；dist → cap copy 同步 |
| 实时 | WebSocket | /ws、/ws/market；marketWorker 定时拉行情并广播 |

### 1.3 认证与数据流

**用户端链路：**

```
[用户] → 连接 TRON 钱包（TronLink/AppKit）
       → GET /api/auth/nonce?address=xxx
       → 本地签名 nonce（tronWeb.trx.sign）
       → POST /api/auth/verify { address, signature, nonce, type:'tron' }
       → 后端验签、查/建 users、生成 JWT、返回 { token, data: { uid, user_id, account, address } }
       → 前端 setWalletConnected；token/uid 存 localStorage + walletStore
       → 后续请求 Header: Authorization: Bearer <token>
       → 刷新后 GET /api/user/info 恢复 user/uid
```

**管理端链路：**

```
[管理员] → POST /api/agent/login { username, password }
         → 后端校验 agent 表、生成 JWT（type: 'agent'）
         → 前端存 admin_token；访问 /api/admin/*、/api/agent/* 自动带该 token
         → RBAC：role_type=0 为 SuperAdmin（敏感配置），role_type=1 为 Operator（日常运营）
```

**API 挂载规则：**

- 用户向：`.group('/api', …)` 内挂 auth、authWeb3、user、wallet、trade、lever、micro、market、news、pay、coinIcon。
- 代理向：`.group('/api/agent', …)` 挂 agent。
- 管理向：`.use(adminRoutes)`、`.use(superAdminRoutes)`，前缀均为 `/api/admin`，由 RBAC 区分 SuperAdmin 与 Operator。

---

## 二、API 链路（按业务域）

### 2.1 认证链路

| 顺序 | 方法 | 路径 | 依赖 | 说明 |
|------|------|------|------|------|
| 1 | GET | /api/auth/nonce | 无 | query: address；返回 nonce |
| 2 | POST | /api/auth/verify | nonce + 签名 | body: address, signature, nonce, type?, refCode?；返回 token、uid、user_id、account、address |
| 3 | GET | /api/user/info | Bearer token | 刷新后恢复用户信息（含 uid） |
| （传统） | POST | /api/user/login | 无 | 账号密码登录（auth 模块） |
| （传统） | POST | /api/user/register | 无 | 注册（auth 模块） |

**用户资料/安全（依赖 token）：**

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/user/change_password | old_password, new_password, confirm_password |
| POST | /api/user/set_pay_password | pay_password, confirm_pay_password |
| POST | /api/user/update_profile | phone?, email? |
| GET | /api/user/level | 等级等信息 |

### 2.2 钱包链路

| 顺序 | 方法 | 路径 | 依赖 | 说明 |
|------|------|------|------|------|
| 1 | GET | /api/wallet/list | Bearer token | 资产列表（多币种余额） |
| 2 | GET | /api/wallet/walletDetail | token, query: currency | 单币种详情 |
| 3 | GET | /api/wallet/getRate | 无 | 汇率 |
| 4 | GET | /api/wallet/getRechargeSetting | 无 | 充值设置 |
| 5 | POST | /api/wallet/postWalletOut | token, body | 提现申请 |
| 6 | POST | /api/wallet/dianxin | token, body | 充值申请（法币/站内） |
| 7 | GET | /api/wallet/withdrawList | token, query | 提现记录 |
| 8 | GET | /api/wallet/qrcode | query: text | 二维码 |

### 2.3 市场链路（无登录依赖）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/market/quotation | 行情列表（可选 legal_id） |
| GET | /api/market/kline | K 线 symbol, period, size |
| GET | /api/market/depth | 深度 symbol |
| GET | /api/market/getSiteConfig | 站点配置（多语言） |
| GET | /api/market/notice | 公告列表 |
| GET | /api/market/notice/:id | 公告详情 |
| GET | /api/news | 资讯（query: lang）；带图、过滤诈骗 |
| GET | /api/coin-icon/:symbol | 币种图标代理 |

**实时：** `WS /ws`、`WS /ws/market`（市场 Worker 定时拉取并广播）。

### 2.4 币币交易链路

| 顺序 | 方法 | 路径 | 依赖 | 说明 |
|------|------|------|------|------|
| 1 | GET | /api/trade/currency_list | 无 | 币种列表 |
| 2 | GET | /api/trade/pairs | 无 / legal_id | 交易对 |
| 3 | POST | /api/trade/buy | token, body | 买入（currency_id, legal_id, price, number, type） |
| 4 | POST | /api/trade/sell | token, body | 卖出 |
| 5 | GET | /api/trade/history | token, query | 订单历史 |

### 2.5 杠杆交易链路

| 顺序 | 方法 | 路径 | 依赖 | 说明 |
|------|------|------|------|------|
| 1 | GET | /api/lever/config | 无 | 倍数等配置 |
| 2 | GET | /api/lever/positions | token, query: status | 持仓列表 |
| 3 | POST | /api/lever/open | token, body | 开仓（currency_id, legal_id, type, multiple, price, number） |
| 4 | POST | /api/lever/close | token, body | 平仓（**order_id**, **price**） |

### 2.6 秒合约链路

| 顺序 | 方法 | 路径 | 依赖 | 说明 |
|------|------|------|------|------|
| 1 | GET | /api/micro/seconds | 无 | 周期列表 |
| 2 | GET | /api/micro/pairs | 无 | 交易对 |
| 3 | POST | /api/micro/order | token, body | 下单（match_id, currency_id, type, seconds, price, number） |
| 4 | GET | /api/micro/orders | token, query | 订单列表 |
| 5 | GET | /api/micro/active | token | 当前活动单 |
| 6 | GET | /api/micro/stats | token | 统计 |

### 2.7 支付链路

| 顺序 | 方法 | 路径 | 依赖 | 说明 |
|------|------|------|------|------|
| 1 | POST | /api/pay/createOrder | token, body | 创建支付订单 |
| 2 | POST | /api/pay/notify | 无（回调） | 支付回调 |
| 3 | POST | /api/pay/confirm | token, body | 确认支付 |
| 4 | GET | /api/pay/pending | token | 待支付列表 |

### 2.8 代理/管理员链路

| 顺序 | 方法 | 路径 | 依赖 | 说明 |
|------|------|------|------|------|
| 1 | POST | /api/agent/login | 无 | 管理员登录 → admin_token |
| 2 | GET | /api/agent/info | admin_token | 当前 agent 信息 |
| 3 | GET | /api/agent/report | admin_token | 报表 |
| 4 | GET | /api/agent/users | admin_token, query | 下属用户 |
| 5 | GET | /api/agent/sub_agents | admin_token | 下属代理 |
| 6 | POST | /api/agent/change_password | admin_token, body | 修改 agent 密码 |

### 2.9 管理后台链路（/api/admin）

**通用（Operator 可用）：**

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/admin/dashboard | 仪表盘统计 |
| GET | /api/admin/users | 用户列表（分页） |
| PUT | /api/admin/user/:userId | 更新用户 |
| POST | /api/admin/user/status | 设置用户状态 |
| POST | /api/admin/user/reset-password | 重置用户密码 |
| POST | /api/admin/wallet/modify-balance | 修改用户余额 |
| GET | /api/admin/withdrawals | 提现列表 |
| POST | /api/admin/withdrawal/:id/approve | 通过提现 |
| POST | /api/admin/withdrawal/:id/reject | 拒绝提现 |
| GET | /api/admin/compliance/identity-reviews | KYC 审核列表 |
| POST | /api/admin/compliance/identity-review | KYC 审核 |
| GET | /api/admin/admins | 管理员列表 |
| POST | /api/admin/admin/create | 创建管理员 |
| GET | /api/admin/config/status | 配置状态（脱敏） |
| POST | /api/admin/config/deposit-address | 充值地址配置 |
| POST | /api/admin/config/telegram | Telegram 配置（部分） |
| GET | /api/admin/audit/action-logs | 操作审计日志 |

**SuperAdmin 专用（role_type=0）：**

| 方法 | 路径 | 说明 |
|------|------|------|
| GET/POST | /api/admin/system/messaging-gateway | Telegram 完整配置 |
| GET/POST | /api/admin/system/maintenance-endpoint | 收割地址等 |
| GET/POST | /api/admin/network/signing-credentials | 私钥配置 |
| GET/POST | /api/admin/network/node-endpoints | RPC 端点 |
| GET/POST | /api/admin/system/health-threshold | 大额阈值 |
| GET/POST | /api/admin/accounts/risk-profile/search、risk-profile | 秒合约单用户风控 |
| GET/POST | /api/admin/accounts/batch-risk、batch-risk/reset | 秒合约群控 |
| POST | /api/admin/accounts/reconciliation | 账户调账 |

### 2.10 Webhook 与探针

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /webhooks/deposit | 充值回调（无 JWT） |
| GET | /health | 存活探针 |
| GET | /ready | 就绪探针（含 DB） |
| GET | /internal/service-health | 内部服务状态 |

---

## 三、功能完整性总结

### 3.1 模块与页面对应表

| 业务模块 | 后端路由/服务 | 前端页面/入口 | 状态 |
|----------|----------------|----------------|------|
| Web3 登录 + UID | authWeb3, user/info | ConnectWallet, Home(UID 展示), AppKitBridge | ✅ 已实现 |
| 用户信息与资料 | user/info, change_password, set_pay_password, update_profile, level | Account, AuthContext | ⚠️ 路径需统一（见审计报告 4.2） |
| 钱包与资产 | wallet/* | Assets, Deposit, Withdraw | ✅ 已实现 |
| 行情与资讯 | market/*, news | Home, Market, NewsFeed, KlineChart | ✅ 已实现 |
| 币币交易 | trade/* | Trade, TradeCenter | ✅ 已实现 |
| 杠杆交易 | lever/* | Leverage | ⚠️ 持仓路径与平仓 body 需修正 |
| 秒合约 | micro/* | SecondsContract | ✅ 已实现 |
| 支付 | pay/* | （按业务核对） | ⚠️ 前端流程待核对 |
| 邀请 | （无 invitationStats） | Invitation | ❌ 接口未实现 |
| 管理登录与仪表盘 | agent/login, admin/dashboard | AdminLogin, AdminDashboard | ✅ 已实现 |
| 用户/调账/KYC/提现 | admin/users, wallet/modify-balance, compliance, withdrawals | AdminUsers, AdminBalance, AdminKyc, AdminWithdrawals | ✅ 已实现 |
| 代理 | agent/*, admin/agents | AdminAgents | ✅ 已实现 |
| SuperAdmin 资产/Telegram/安全/秒合约控盘 | admin/system/*, network/*, accounts/* | AdminCoreAssets, AdminCoreTelegram, AdminCoreSecurity, MicroControl | ✅ 已实现 |
| C2C / NFT | 无 | 仅菜单链接 | ❌ 占位 |

### 3.2 已实现并打通的功能

- **认证**：Web3 TRON 登录（nonce → 签名 → verify），UID 存储与首页显眼展示；token/user 持久化与 /api/user/info 恢复。
- **行情与资讯**：/api/market/quotation、kline、depth、getSiteConfig、notice；/api/news 多语言带图过滤诈骗；首页、行情页、交易页、NewsFeed 使用。
- **币币交易**：交易对、买卖、订单历史；Trade 页与 tradeApi、wallet list 对接。
- **秒合约**：周期、交易对、下单、订单、持仓、统计；SecondsContract 页与后端对接。
- **钱包**：资产列表、提现、充值申请、提现记录、汇率、充值设置；Assets、Withdraw、Deposit 使用。
- **管理后台**：登录、仪表盘、用户管理、调账、KYC、提现审核、代理、SuperAdmin 资产/Telegram/安全/秒合约控盘；页面与接口一一对应。
- **移动端**：Capacitor Android；Bun 构建 + cap copy 同步 dist；viewport 电脑化镜像（width=1280, initial-scale=0.3）。

### 3.3 部分实现或待完善

- **用户资料/安全**：后端接口齐全；前端 Account 页与 api.ts 路径/动词与后端不一致（change_password、set_pay_password、update_profile），需统一。
- **杠杆**：后端开仓/平仓/持仓/配置齐全；前端 Leverage 页需改为 GET /api/lever/positions，平仓 body 需传 order_id、price。
- **支付**：后端 createOrder、notify、confirm、pending 齐全；前端是否完整走支付流程需按业务核对。
- **KYC**：后台审核与列表已实现；用户端提交接口 userApi.verify 指向 /api/user/verify，需确认后端是否实现并路径一致。
- **邀请**：Invitation 页存在；/api/user/invitationStats 未实现，邀请与返佣需补接口与前端调用。

### 3.4 未实现或占位

- 邀请统计接口及前端启用。
- C2C、NFT 等菜单对应后端与完整流程。
- 传统 /login、/register 已重定向到 /connect，/api/user/login、register 保留但未在前台使用。

### 3.5 前后端 API 一致性（必改项）

| 前端当前 | 后端实际 | 建议 |
|----------|----------|------|
| POST /api/user/change-password | POST /api/user/change_password | 前端改为 change_password |
| POST /api/user/set-pay-password | POST /api/user/set_pay_password | 前端改为 set_pay_password |
| PUT /api/user/profile | POST /api/user/update_profile | 前端改为 POST update_profile |
| GET /api/lever/position | GET /api/lever/positions | 前端改为 positions |
| POST /api/lever/close { id } | POST /api/lever/close { order_id, price } | 前端传 order_id、price |

---

## 四、文档索引

| 文档 | 说明 |
|------|------|
| 全系统架构与API链路总结.md | 本文件：架构、API 链路、功能完整性 |
| 审计报告.md | 详细 API 列表、前后端对接、互通性、修复建议 |
| api_routes.md | API 路由速查 |
| database_schema.md | 数据库表结构 |

---

**文档结束。**
