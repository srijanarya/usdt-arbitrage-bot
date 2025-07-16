<<<<<<< HEAD
# usdt-arbitrage-bot
=======
# USDT Arbitrage Bot - Quick Start Guide

## 🚀 Project Setup Complete!

Your USDT arbitrage bot project structure has been created at:
`/Users/srijan/Desktop/usdt-arbitrage-bot`

## 📋 Next Steps

### 1. Install Prerequisites (5 minutes)
Open Terminal and run:
```bash
cd /Users/srijan/Desktop/usdt-arbitrage-bot
./setup.sh
```

This will install:
- Homebrew (if not installed)
- Node.js 18+
- PostgreSQL
- Git

### 2. Initialize Project (2 minutes)
After setup.sh completes, run:
```bash
source ~/.zshrc
./init-project.sh
```

This will:
- Create the project structure
- Install all npm dependencies
- Set up TypeScript configuration
- Initialize Git repository

### 3. Configure API Keys (5 minutes)
1. Copy the environment file:
   ```bash
   cp .env.example .env
   ```

2. Edit `.env` and add your API keys:
   - Get CoinDCX API keys from: https://coindcx.com/api-dashboard
   - Get ZebPay API keys from: https://www.zebpay.com/api

### 4. Set Up Database (2 minutes)
```bash
npm run db:setup
```

### 5. Start Development (Week 1, Day 1)
```bash
npm run dev
```

## 📁 Project Structure Created

```
usdt-arbitrage-bot/
├── src/
│   ├── index.ts                 # Main application entry
│   ├── config/
│   │   ├── database.ts         # Database configuration
│   │   └── exchanges.ts        # Exchange configs & fee calculations
│   ├── api/exchanges/
│   │   ├── coinDCX.ts         # CoinDCX API client
│   │   └── zebPay.ts          # ZebPay API client
│   ├── services/priceScanner/
│   │   └── index.ts           # Price monitoring & arbitrage detection
│   ├── utils/
│   │   └── logger.ts          # Logging utility
│   └── scripts/
│       └── setupDatabase.ts   # Database initialization
├── tests/                      # Test files
├── logs/                       # Application logs
├── .env.example               # Environment variables template
├── tsconfig.json              # TypeScript configuration
├── package.json               # Node.js dependencies
└── .gitignore                 # Git ignore rules
```

## 🎯 Week 1 Goals

By the end of Week 1, you should have:
- ✅ Working price monitor
- ✅ Basic arbitrage detection
- ✅ Telegram alerts
- ✅ 99% price data accuracy
- ✅ <1 second alert latency
- ✅ 10+ opportunities detected daily

## 💻 Available Commands

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build TypeScript to JavaScript
- `npm start` - Run production build
- `npm test` - Run tests
- `npm run db:setup` - Initialize database

## 🔍 Current Implementation Status

### ✅ Completed (Day 1)
- Project structure setup
- TypeScript configuration
- Database configuration (PostgreSQL)
- Logger utility
- Exchange configuration with fee calculations
- Basic price scanner service
- CoinDCX API client (with WebSocket support)
- ZebPay API client (with REST polling)

### 📝 Next Tasks (Day 2-4)
- Complete WebSocket integration testing
- Add error handling and retry logic
- Implement rate limiting
- Add unit tests
- Create Telegram bot integration

## ⚠️ Important Notes

1. **API Keys**: Never commit your `.env` file with real API keys
2. **Testing**: Always test with small amounts first
3. **Fees**: The system includes 1% TDS calculation for Indian exchanges
4. **Safety**: Manual trading is implemented in Week 2, automation in Week 3

## 🆘 Troubleshooting

If you encounter issues:

1. **Node.js not found**: Make sure to run `source ~/.zshrc` after setup
2. **PostgreSQL connection error**: Check if PostgreSQL is running with `brew services list`
3. **TypeScript errors**: Run `npm install` again to ensure all dependencies are installed

## 📞 Support

For questions about the implementation, refer to:
- The detailed project instructions in `usdt_arbitrage_instructions.md`
- Exchange API documentation
- TypeScript/Node.js documentation

Ready to start? Run `./setup.sh` now! 🚀

## 🎯 **QUICK START (No API Keys Required)**

For immediate testing without any setup:

```bash
# Start the simple monitor (works immediately)
./start-simple.sh
```

This will start a working arbitrage monitor at `http://localhost:3000` using public APIs only.

## 🔧 **Full Setup (With API Keys)**

For complete functionality with real trading capabilities:

```bash
# 1. Install dependencies
npm install

# 2. Copy environment file
cp .env.example .env

# 3. Edit .env with your API keys (optional)

# 4. Start full system
npm run dev
```

## ✅ **What's Working:**

- ✅ Real-time price monitoring from Binance, CoinGecko
- ✅ Arbitrage opportunity detection
- ✅ Web dashboard with live updates
- ✅ REST API endpoints
- ✅ USDT/USDC spread analysis
- ✅ Fee calculations (0.1% + 1% TDS for Indian exchanges)
- ✅ Multi-exchange support (CoinDCX, ZebPay, Binance, KuCoin, CoinSwitch)

>>>>>>> 57ec8c0 (Initial commit: Automated project setup)
