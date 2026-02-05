<p align="center">
  <img src="https://img.shields.io/badge/Bun-1.0+-black?style=for-the-badge&logo=bun" alt="Bun">
  <img src="https://img.shields.io/badge/TypeScript-5.0+-blue?style=for-the-badge&logo=typescript" alt="TypeScript">
  <img src="https://img.shields.io/badge/SolidJS-1.8+-blue?style=for-the-badge&logo=solid" alt="SolidJS">
  <img src="https://img.shields.io/badge/PostgreSQL-15+-blue?style=for-the-badge&logo=postgresql" alt="PostgreSQL">
  <img src="https://img.shields.io/badge/Redis-7+-red?style=for-the-badge&logo=redis" alt="Redis">
</p>

<h1 align="center">🔥 HuoBTC Exchange</h1>

<p align="center">
  <strong>A Modern Cryptocurrency Exchange Platform</strong><br>
  <em>High-performance, Multi-language, Mobile-ready Trading System</em>
</p>

<p align="center">
  <a href="#features">Features</a> •
  <a href="#tech-stack">Tech Stack</a> •
  <a href="#quick-start">Quick Start</a> •
  <a href="#deployment">Deployment</a> •
  <a href="#screenshots">Screenshots</a>
</p>

---

## ✨ Features

### 🏦 Core Trading
- **Spot Trading** - Real-time order book with depth chart
- **Leverage Trading** - Up to 100x leverage support
- **Seconds Contract** - Quick options trading (30s/60s/120s)
- **Real-time K-Line** - TradingView-style charts with multiple timeframes

### 💳 Wallet & Assets
- **Multi-Wallet Support** - TronLink, TokenPocket, BitKeep, OKX Wallet
- **Web3 Authentication** - Secure wallet signature login
- **Multi-Chain Deposit** - TRC20, ERC20, BEP20 support
- **Instant Withdrawal** - Automated & manual review system

### 🌍 Internationalization
- 🇺🇸 English
- 🇨🇳 简体中文
- 🇹🇼 繁體中文
- 🇯🇵 日本語
- 🇰🇷 한국어

### 💬 Customer Service
- **Real-time Chat** - WebSocket-powered live support
- **Image Upload** - Send screenshots in chat
- **Admin Dashboard** - Unified support management

### 📱 Mobile Ready
- **Responsive Design** - Perfect on all devices
- **Android APK** - Capacitor-based native app
- **PWA Support** - Install as mobile app

### 🔧 Admin System
- **User Management** - Full user control & KYC
- **Risk Control** - Win rate & profit management
- **Payment Config** - Multi-chain deposit addresses
- **Withdrawal Review** - Manual approval system
- **Telegram Alerts** - Real-time notifications

---

## 🛠️ Tech Stack

### Frontend
| Technology | Purpose |
|------------|---------|
| **SolidJS** | Reactive UI Framework |
| **TypeScript** | Type Safety |
| **TailwindCSS** | Styling |
| **Vite** | Build Tool |
| **Capacitor** | Mobile App |

### Backend
| Technology | Purpose |
|------------|---------|
| **Bun** | JavaScript Runtime |
| **Elysia** | Web Framework |
| **Drizzle ORM** | Database ORM |
| **PostgreSQL** | Primary Database |
| **Redis** | Caching & Sessions |

### Infrastructure
| Technology | Purpose |
|------------|---------|
| **Nginx** | Reverse Proxy |
| **PM2** | Process Manager |
| **WebSocket** | Real-time Data |

---

## 🚀 Quick Start

### Prerequisites
- [Bun](https://bun.sh/) >= 1.0
- PostgreSQL >= 15
- Redis >= 7

### Installation

```bash
# Clone repository
git clone https://github.com/fowxnm/HuoBTC.git
cd HuoBTC

# Install backend dependencies
cd backend && bun install

# Install frontend dependencies
cd ../frontend && bun install
```

### Configuration

```bash
# Backend environment
cd backend
cp .env.example .env
# Edit .env with your database credentials
```

### Database Setup

```bash
cd backend
bun run db:push
```

### Development

```bash
# Terminal 1 - Backend
cd backend && bun run dev

# Terminal 2 - Frontend
cd frontend && bun run dev
```

---

## 🌐 Deployment

### Ubuntu 22.04 LTS (Recommended)

```bash
# Install dependencies
sudo apt update && sudo apt install -y postgresql redis-server nginx
curl -fsSL https://bun.sh/install | bash

# Clone and setup
git clone https://github.com/fowxnm/HuoBTC.git
cd HuoBTC

# Backend
cd backend && bun install
bun run db:push
pm2 start "bun run src/index.ts" --name huobtc-api

# Frontend
cd ../frontend && bun install && bun run build

# Configure Nginx for your domain
```

### Server Requirements
| Tier | CPU | RAM | Storage |
|------|-----|-----|---------|
| **Minimum** | 2 cores | 4GB | 50GB SSD |
| **Recommended** | 4 cores | 8GB | 100GB SSD |
| **Production** | 8+ cores | 16GB+ | 200GB NVMe |

---

## 📸 Screenshots

<details>
<summary>Click to expand</summary>

### Home Page
Modern landing page with real-time market data

### Trading Interface
Professional trading view with K-line charts

### Admin Dashboard
Comprehensive management system

</details>

---

## 📁 Project Structure

```
HuoBTC/
├── backend/                 # Elysia API Server
│   ├── src/
│   │   ├── routes/         # API Routes
│   │   ├── db/             # Database Schema
│   │   ├── services/       # Business Logic
│   │   └── websocket.ts    # WebSocket Handler
│   └── package.json
├── frontend/               # SolidJS Frontend
│   ├── src/
│   │   ├── pages/          # Page Components
│   │   ├── components/     # UI Components
│   │   ├── contexts/       # Global State
│   │   ├── lang/           # i18n Translations
│   │   └── utils/          # Utilities
│   ├── android/            # Capacitor Android
│   └── package.json
└── README.md
```

---

## 🔐 Security Features

- ✅ JWT Authentication
- ✅ Web3 Wallet Signature Verification
- ✅ Rate Limiting
- ✅ SQL Injection Prevention (Drizzle ORM)
- ✅ XSS Protection
- ✅ CORS Configuration
- ✅ Admin IP Whitelist Support

---

## 📄 License

This project is proprietary software. All rights reserved.

---

<p align="center">
  <strong>Built with ❤️ by a passionate developer</strong>
</p>

<p align="center">
  <sub>⭐ Star this repo if you find it useful!</sub>
</p>
