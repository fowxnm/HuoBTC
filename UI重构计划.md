# 交易所系统 UI 重构与后端对接计划

## 一、项目概述

**目标**：以 lao Vue 前端为 UI 标准，在当前 Bun + SolidJS 前端上完全还原视觉效果，并对接 Bun + Elysia 后端。

**技术栈对比**：
| 项目 | 前端框架 | UI库 | 后端 | 状态管理 |
|------|----------|------|------|----------|
| lao (旧版) | Vue 2.x | Element UI | Laravel (PHP) | Vuex |
| 当前 | SolidJS | Tailwind CSS | Bun + Elysia | Signal |

## 二、UI 样式迁移矩阵

### 2.1 色彩系统
从 Vue 项目提取的核心色彩：
```css
--primary-color: #00f0ff;      /* 主题色 (青色) */
--theme-color: #00f0ff;        /* 与primary相同 */
--danger-color: #ff4834;       /* 危险/下跌红 */
--success-color: #00c853;      /* 成功/上涨绿 */
--secondary-color: #f0c163;    /* 次要色 (金色) */
--bg-dark-1: #0a0a12;          /* 深色背景 */
--bg-dark-2: #0f0f16;          /* 中等深色 */
--bg-dark-3: #0d0e0f;          /* 卡片背景 */
--border-color: #2c2c3e;       /* 边框色 */
--text-gray: #cbd9da;          /* 灰色文本 */
```

### 2.2 布局断点 (响应式)
```css
/* 移动端优先 */
@media (min-width: 768px)  { /* 平板 */ }
@media (min-width: 992px)  { /* 小屏PC */ }
@media (min-width: 1200px) { /* 大屏PC */ }
@media (max-width: 800px)  { /* Vue项目移动端阈值 */ }
```

### 2.3 组件样式清单

#### 核心页面组件
| 页面 | Vue组件 | SolidJS目标 | 优先级 |
|------|---------|-------------|--------|
| 首页 | homeContent.vue | Home.tsx | ✅ 已完成 |
| 交易中心 | dealCenterV2.vue | Trade.tsx | 🔴 高 |
| 行情 | quotation.vue | Market.tsx | 🔴 高 |
| 资产 | account.vue | Assets.tsx | 🟡 中 |
| 充值 | deposit.vue | Deposit.tsx | 🟡 中 |
| 提现 | withdrawDepositNew.vue | Withdraw.tsx | 🟡 中 |
| 杠杆交易 | leverDealCenterV2.vue | Leverage.tsx | 🟠 中高 |
| 秒合约 | secondDealCenter.vue | SecondsContract.tsx | 🟠 中高 |

#### 公共组件
| 组件 | Vue | SolidJS | 状态 |
|------|-----|---------|------|
| 头部导航 | indexHeader.vue | Header.tsx | ✅ 已完成 |
| 底部导航 | indexFooter.vue | Footer.tsx | ✅ 已完成 |
| 移动底栏 | (内置) | MobileNav.tsx | ✅ 已完成 |
| K线图 | klineChart.vue | KLineChart.tsx | ⏳ 待创建 |
| 盘口 | Handicap.vue | OrderBook.tsx | ⏳ 待创建 |
| 深度图 | depth.vue | DepthChart.tsx | ⏳ 待创建 |

## 三、后端 API 映射表

### 3.1 现有 Bun 后端路由
```
backend/src/routes/
├── auth.ts       - 登录/注册/验证码
├── user.ts       - 用户信息/设置/认证
├── wallet.ts     - 钱包/充值/提现
├── trade.ts      - 币币交易/订单
├── lever.ts      - 杠杆交易/开平仓
├── micro.ts      - 秒合约/下单/结算
├── market.ts     - 行情/K线/深度
├── pay.ts        - 支付/回调
├── admin.ts      - 管理后台
├── agent.ts      - 代理商
├── superadmin.ts - 超级管理
└── webhooks.ts   - 充值回调
```

### 3.2 API 对接矩阵
| 功能模块 | 前端调用 | 后端路由 | 方法 | 状态 |
|---------|---------|---------|------|------|
| 用户登录 | api.post('/api/auth/login') | auth.ts | POST | ✅ |
| 用户注册 | api.post('/api/auth/register') | auth.ts | POST | ✅ |
| 获取行情 | api.get('/api/market/quotation') | market.ts | GET | ✅ |
| K线数据 | api.get('/api/market/kline') | market.ts | GET | ⏳ |
| 深度数据 | api.get('/api/market/depth') | market.ts | GET | ⏳ |
| 钱包余额 | api.get('/api/wallet/balance') | wallet.ts | GET | ⏳ |
| 充值地址 | api.get('/api/wallet/address') | wallet.ts | GET | ⏳ |
| 提现申请 | api.post('/api/wallet/withdraw') | wallet.ts | POST | ⏳ |
| 币币交易 | api.post('/api/trade/order') | trade.ts | POST | ⏳ |
| 委托列表 | api.get('/api/trade/orders') | trade.ts | GET | ⏳ |
| 杠杆开仓 | api.post('/api/lever/open') | lever.ts | POST | ⏳ |
| 杠杆平仓 | api.post('/api/lever/close') | lever.ts | POST | ⏳ |
| 持仓列表 | api.get('/api/lever/positions') | lever.ts | GET | ⏳ |
| 秒合约下单 | api.post('/api/micro/order') | micro.ts | POST | ⏳ |

## 四、WebSocket 实时推送方案

### 4.1 需求分析
交易所核心：**实时行情推送 + K线更新**

### 4.2 技术方案
```typescript
// frontend/src/utils/websocket.ts
class MarketWebSocket {
  private ws: WebSocket | null = null;
  private subscribers: Map<string, Set<Function>> = new Map();
  
  connect(url: string = 'ws://localhost:3000/ws') {
    this.ws = new WebSocket(url);
    this.ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      this.notify(msg.type, msg);
    };
  }
  
  subscribe(type: 'kline' | 'daymarket' | 'depth', callback: Function) {
    if (!this.subscribers.has(type)) {
      this.subscribers.set(type, new Set());
    }
    this.subscribers.get(type)!.add(callback);
  }
  
  private notify(type: string, data: any) {
    this.subscribers.get(type)?.forEach(cb => cb(data));
  }
}
```

### 4.3 后端 WebSocket 端点
```typescript
// backend/src/websocket.ts (待创建)
import { ServerWebSocket } from "bun";

export const wsHandler = {
  open(ws: ServerWebSocket) {
    console.log('Client connected');
  },
  message(ws: ServerWebSocket, message: string) {
    const msg = JSON.parse(message);
    // 订阅行情: { type: 'subscribe', symbol: 'BTC/USDT' }
    if (msg.type === 'subscribe') {
      // 推送实时行情
      setInterval(() => {
        ws.send(JSON.stringify({
          type: 'kline',
          symbol: msg.symbol,
          close: Math.random() * 50000,
          change: (Math.random() - 0.5) * 5
        }));
      }, 1000);
    }
  }
};
```

## 五、Docker 部署方案

### 5.1 Frontend Dockerfile
```dockerfile
FROM oven/bun:1 AS builder
WORKDIR /app
COPY package.json bun.lockb ./
RUN bun install --frozen-lockfile
COPY . .
RUN bun run build

FROM oven/bun:1-alpine
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./
RUN bun install --production
EXPOSE 5173
CMD ["bun", "run", "preview", "--host", "0.0.0.0"]
```

### 5.2 docker-compose.yml 更新
```yaml
services:
  frontend:
    build: ./frontend
    ports:
      - "5173:5173"
    environment:
      - VITE_API_URL=http://backend:3000
      - VITE_WS_URL=ws://backend:3000/ws
    depends_on:
      - backend
    networks:
      - btc-network
```

## 六、执行时间表

| 阶段 | 任务 | 预计工作量 | 状态 |
|------|------|-----------|------|
| 1️⃣ | 提取完整CSS到Tailwind配置 | 2h | 🟡 进行中 |
| 2️⃣ | 重构Trade交易页面UI | 4h | ⏳ 待开始 |
| 3️⃣ | 重构Market/Assets/充提页 | 4h | ⏳ 待开始 |
| 4️⃣ | 实现WebSocket推送 | 2h | ⏳ 待开始 |
| 5️⃣ | API全面对接测试 | 3h | ⏳ 待开始 |
| 6️⃣ | Docker集成部署 | 1h | ⏳ 待开始 |

## 七、验收标准

### 7.1 UI 一致性
- [ ] 首页完全匹配 Vue 版本（视频banner、菜单、轮播、特性区）
- [ ] 交易页面 K线、盘口、表单布局一致
- [ ] 所有页面移动端自适应正常
- [ ] 色彩、字体、间距与 Vue 版本无差异

### 7.2 功能完整性
- [ ] 用户注册/登录流程正常
- [ ] 行情数据实时更新（1秒刷新）
- [ ] 币币交易下单成功
- [ ] 杠杆交易开平仓正常
- [ ] 充值提现流程完整
- [ ] WebSocket断线自动重连

### 7.3 部署可用性
- [ ] Docker一键启动前后端
- [ ] Nginx反向代理正常
- [ ] 环境变量配置完整
- [ ] 日志输出清晰

---
**文档创建时间**: 2026-02-01  
**最后更新**: 进行中  
**负责人**: AI Agent
