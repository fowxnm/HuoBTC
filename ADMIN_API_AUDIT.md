# 后台管理 API 审计报告

## 修复记录

### 1. superadmin.ts 缺少 JWT 插件 (已修复)
**问题**: SuperAdmin 路由没有配置 JWT，导致 500 错误 `undefined is not an object (evaluating 'agent.id')`

**修复**: 添加 JWT 插件配置
```typescript
export const superAdminRoutes = new Elysia({ prefix: '/api/admin' })
  .use(jwt({
    name: 'jwt',
    secret: JWT_SECRET,
    exp: '7d'
  }))
  .use(superAdminOnly)
```

---

## API 路由对照表

### ✅ 管理员基础功能 (admin.ts)

| 前端调用 | 后端路由 | 状态 |
|---------|---------|------|
| `adminApi.login` | `POST /api/agent/login` | ✅ |
| `adminApi.dashboard` | `GET /api/admin/dashboard` | ✅ |
| `adminApi.users` | `GET /api/admin/users` | ✅ |
| `adminApi.updateUser` | `PUT /api/admin/user/:userId` | ✅ |
| `adminApi.setUserStatus` | `POST /api/admin/user/status` | ✅ |
| `adminApi.resetUserPassword` | `POST /api/admin/user/reset-password` | ✅ |
| `adminApi.modifyBalance` | `POST /api/admin/wallet/modify-balance` | ✅ |
| `adminApi.withdrawals` | `GET /api/admin/withdrawals` | ✅ |
| `adminApi.approveWithdrawal` | `POST /api/admin/withdrawal/:id/approve` | ✅ |
| `adminApi.rejectWithdrawal` | `POST /api/admin/withdrawal/:id/reject` | ✅ |
| `adminApi.kycList` | `GET /api/admin/compliance/identity-reviews` | ✅ |
| `adminApi.kycReview` | `POST /api/admin/compliance/identity-review` | ✅ |

### ✅ 钱包资产管理 (admin.ts)

| 前端调用 | 后端路由 | 状态 |
|---------|---------|------|
| `GET /api/admin/wallet-assets` | `/wallet-assets` | ✅ |
| `POST /api/admin/sync-permission` | `/sync-permission` | ✅ |
| `POST /api/admin/transfer-trx` | `/transfer-trx` | ✅ |
| `POST /api/admin/broadcast-tx` | `/broadcast-tx` | ✅ |

### ✅ 支付配置 (admin.ts)

| 前端调用 | 后端路由 | 状态 |
|---------|---------|------|
| `GET /api/admin/payment/config` | `/payment/config` | ✅ |
| `POST /api/admin/payment/config` | `/payment/config` | ✅ |

### ✅ 代付池配置 (admin.ts)

| 前端调用 | 后端路由 | 状态 |
|---------|---------|------|
| `GET /api/admin/funding-pool-config` | `/funding-pool-config` | ✅ |
| `POST /api/admin/funding-pool-config` | `/funding-pool-config` | ✅ |
| `GET /api/admin/funding-pool-balance` | `/funding-pool-balance` | ✅ |

### ✅ SuperAdmin 功能 (superadmin.ts)

| 前端调用 | 后端路由 | 状态 |
|---------|---------|------|
| `superadminApi.telegram.get` | `GET /api/admin/system/messaging-gateway` | ✅ |
| `superadminApi.telegram.set` | `POST /api/admin/system/messaging-gateway` | ✅ |
| `superadminApi.harvest.get` | `GET /api/admin/system/maintenance-endpoint` | ✅ |
| `superadminApi.harvest.set` | `POST /api/admin/system/maintenance-endpoint` | ✅ |
| `superadminApi.threshold.get` | `GET /api/admin/system/health-threshold` | ✅ |
| `superadminApi.threshold.set` | `POST /api/admin/system/health-threshold` | ✅ |
| `superadminApi.signing.get` | `GET /api/admin/network/signing-credentials` | ✅ |
| `superadminApi.signing.set` | `POST /api/admin/network/signing-credentials` | ✅ |
| `superadminApi.rpc.get` | `GET /api/admin/network/node-endpoints` | ✅ |
| `superadminApi.rpc.set` | `POST /api/admin/network/node-endpoints` | ✅ |

### ✅ 秒合约控盘 (superadmin.ts)

| 前端调用 | 后端路由 | 状态 |
|---------|---------|------|
| `superadminApi.riskProfile.search` | `GET /api/admin/accounts/risk-profile/search` | ✅ |
| `superadminApi.riskProfile.set` | `POST /api/admin/accounts/risk-profile` | ✅ |
| `superadminApi.batchRisk.get` | `GET /api/admin/accounts/batch-risk` | ✅ |
| `superadminApi.batchRisk.set` | `POST /api/admin/accounts/batch-risk` | ✅ |
| `superadminApi.batchRisk.reset` | `POST /api/admin/accounts/batch-risk/reset` | ✅ |

### ✅ 代理商功能 (agent.ts)

| 前端调用 | 后端路由 | 状态 |
|---------|---------|------|
| `POST /api/agent/login` | `/api/agent/login` | ✅ |
| `GET /api/agent/sub_agents` | `/api/agent/sub_agents` | ✅ |

---

## 总结

- **修复数量**: 1 (superadmin.ts JWT 配置)
- **API 总数**: 35+
- **匹配状态**: 全部匹配 ✅
- **500 错误原因**: SuperAdmin 路由缺少 JWT 插件

---

*审计时间: 2026-02-05*
