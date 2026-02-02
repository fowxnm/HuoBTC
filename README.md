# BTC Exchange - Reconstructed System

A complete cryptocurrency exchange platform built with modern technologies.

## Tech Stack

### Frontend
- **Framework**: SolidJS
- **Bundler**: Vite
- **Styling**: TailwindCSS
- **Routing**: @solidjs/router
- **Runtime**: Bun

### Backend
- **Framework**: Elysia (Bun)
- **Database**: PostgreSQL
- **ORM**: Drizzle
- **Authentication**: JWT
- **Runtime**: Bun

### Admin Panel (Planned)
- **Framework**: SolidJS
- **RBAC**: Role-based access control

## Project Structure

```
BTC/
├── backend/
│   ├── src/
│   │   ├── db/
│   │   │   ├── schema.ts      # Database schema definitions
│   │   │   └── index.ts       # Database connection
│   │   ├── middleware/
│   │   │   ├── auth.ts        # JWT authentication
│   │   │   └── rbac.ts        # Role-based access control
│   │   ├── routes/
│   │   │   ├── auth.ts        # Login/Register/Web3
│   │   │   ├── user.ts        # User management
│   │   │   ├── wallet.ts      # Wallet operations
│   │   │   ├── trade.ts       # Spot trading
│   │   │   ├── lever.ts       # Leverage trading
│   │   │   ├── agent.ts       # Agent system
│   │   │   ├── admin.ts       # Admin operations
│   │   │   ├── market.ts      # Market data
│   │   │   └── pay.ts         # Payment system
│   │   └── index.ts           # Server entry point
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Header.tsx     # Navigation header
│   │   │   └── MobileNav.tsx  # Mobile navigation
│   │   ├── contexts/
│   │   │   ├── AuthContext.tsx # Auth state management
│   │   │   └── I18nContext.tsx # Internationalization
│   │   ├── lang/
│   │   │   ├── en.ts          # English translations
│   │   │   ├── zh.ts          # Chinese translations
│   │   │   └── index.ts       # Language exports
│   │   ├── pages/
│   │   │   ├── Home.tsx       # Landing page
│   │   │   ├── Login.tsx      # User login
│   │   │   ├── Register.tsx   # User registration
│   │   │   ├── Market.tsx     # Market overview
│   │   │   ├── Trade.tsx      # Spot trading
│   │   │   ├── Leverage.tsx   # Leverage trading
│   │   │   ├── Assets.tsx     # User assets
│   │   │   ├── Deposit.tsx    # Deposit funds
│   │   │   ├── Withdraw.tsx   # Withdraw funds
│   │   │   ├── Account.tsx    # Account settings
│   │   │   └── Invitation.tsx # Referral system
│   │   ├── utils/
│   │   │   └── api.ts         # API client & helpers
│   │   ├── styles/
│   │   │   └── index.css      # Global styles
│   │   ├── App.tsx            # Main app component
│   │   └── index.tsx          # Entry point
│   ├── index.html
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   ├── tsconfig.json
│   └── package.json
└── admin/                      # (Planned)
```

## Getting Started

### Prerequisites

- [Bun](https://bun.sh/) >= 1.0
- PostgreSQL database

### Backend Setup

1. Navigate to backend directory:
```bash
cd BTC/backend
```

2. Install dependencies:
```bash
bun install
```

3. Set up environment variables:
```bash
# Create .env file
DATABASE_URL=postgres://user:password@localhost:5432/btc_exchange
JWT_SECRET=your-secret-key
```

4. Run database migrations (when implemented):
```bash
bun run db:migrate
```

5. Start the server:
```bash
bun run dev
```

The backend will start on http://localhost:3000

### Frontend Setup

1. Navigate to frontend directory:
```bash
cd BTC/frontend
```

2. Install dependencies:
```bash
bun install
```

3. Start development server:
```bash
bun run dev
```

The frontend will start on http://localhost:5173

## API Endpoints

### Authentication
- `POST /api/user/login` - User login
- `POST /api/user/register` - User registration
- `POST /api/user/wallet` - Web3 wallet login
- `GET /api/user/info` - Get user info

### User
- `POST /api/user/change-password` - Change password
- `POST /api/user/set-pay-password` - Set pay password
- `POST /api/user/update-profile` - Update profile

### Wallet
- `GET /api/wallet/list` - Get all wallets
- `GET /api/wallet/:currency` - Get specific wallet
- `POST /api/wallet/postWalletOut` - Submit withdrawal
- `GET /api/wallet/withdraw-history` - Withdrawal history

### Trade
- `GET /api/trade/currencies` - Get currency list
- `GET /api/trade/pairs` - Get trading pairs
- `POST /api/trade/buy` - Place buy order
- `POST /api/trade/sell` - Place sell order

### Leverage
- `POST /api/lever/open` - Open position
- `POST /api/lever/close` - Close position
- `GET /api/lever/position` - Get positions
- `GET /api/lever/config` - Get leverage config

### Market
- `GET /api/market/quotation` - Get market quotes
- `GET /api/market/kline` - Get kline data
- `GET /api/market/depth` - Get order book

## Features

- **Multi-language Support**: English and Chinese
- **Responsive Design**: Mobile-first approach
- **Dark Theme**: Modern dark UI
- **Real-time Data**: WebSocket support (planned)
- **Web3 Integration**: Wallet connect support
- **Agent System**: Multi-level agent hierarchy
- **RBAC Admin**: Role-based admin panel

## Development

### Code Style
- TypeScript for type safety
- ESLint for linting
- Prettier for formatting

### Building for Production

Backend:
```bash
cd BTC/backend
bun run build
```

Frontend:
```bash
cd BTC/frontend
bun run build
```

## Docker 部署

### 前置条件

- 已安装并**已启动** [Docker Desktop](https://www.docker.com/products/docker-desktop/)（Windows/Mac）
- 或已安装 Docker Engine + Docker Compose（Linux）

### 一键部署

在项目根目录执行：

**Windows (PowerShell / CMD):**
```powershell
cd c:\Users\AM\Desktop\BTC
docker-compose up --build -d
```

**或双击运行:** `deploy-docker.bat`

### 服务与端口

| 服务     | 端口 | 说明 |
|----------|------|------|
| 前端     | 80   | 浏览器访问 http://localhost |
| 后端 API | 8000 | http://localhost:8000/health, /docs |
| WebSocket | 8001 | 行情等 |
| PostgreSQL | 5432 | 数据库 |
| Redis    | 6379 | 缓存 |

### 首次启动说明

1. 启动后 backend 会自动执行 `drizzle-kit push` 同步数据库表结构（依赖 `DATABASE_URL` 与 `drizzle.config.ts`）。
2. 管理员登录：访问 http://localhost/admin/login ，使用 Agent 账号（需先在库中创建或通过 `bun run db:seed:admins` 初始化）。
3. 环境变量：`backend/.env` 会由 docker-compose 的 `env_file` 注入；可复制 `backend/.env.example` 为 `.env` 后按需修改。

### 常用命令

```bash
# 查看运行状态
docker-compose ps

# 查看 backend 日志
docker-compose logs -f backend

# 停止并删除容器
docker-compose down

# 停止并删除容器及数据卷
docker-compose down -v
```

## License

Private - All rights reserved
