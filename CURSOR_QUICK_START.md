# 🚀 CURSOR QUICK START - Copy & Paste Commands

## Step 1: Open Terminal in Cursor (Ctrl+`)
```bash
npm init -y
```

## Step 2: Install All Dependencies (Copy this entire block)
```bash
npm install express axios ws pg dotenv cors helmet compression
npm install --save-dev typescript @types/node @types/express @types/ws @types/pg @types/cors nodemon ts-node jest @types/jest tsx
```

## Step 3: Create tsconfig.json
Press Cmd+K and paste:
```
Create a comprehensive tsconfig.json for a Node.js TypeScript project with strict mode, ES2020 target, and proper module resolution for a crypto trading bot
```

## Step 4: Create Project Structure
In Terminal:
```bash
mkdir -p src/{api/exchanges,services/priceScanner,config,models,utils,types,scripts}
mkdir -p tests logs
touch .env .env.example .gitignore
```

## Step 5: Generate Core Files with Cursor AI

### For src/index.ts:
Create the file and press Cmd+K:
```
Create a production-ready Express + WebSocket server for crypto arbitrage trading with:
- Health check endpoints
- WebSocket connection handling
- Graceful shutdown
- Environment variable configuration
- Comprehensive error handling
- Integration with a PriceScanner service
```

### For src/config/database.ts:
Create the file and press Cmd+K:
```
Create PostgreSQL database configuration with:
- Connection pooling
- Tables for: exchanges, price_history, arbitrage_opportunities, trades
- All necessary indexes
- Migration support
- Transaction helpers
- Query logging
```

### For src/api/exchanges/coinDCX.ts:
Create the file and press Cmd+K:
```
Create CoinDCX exchange client with:
- WebSocket connection for real-time USDT/INR prices
- HMAC authentication for private endpoints
- Auto-reconnection logic
- Rate limiting (10 requests/second)
- Methods: connect(), getBalance(), createOrder(), getOrderStatus()
- Error handling and logging
```

### For src/api/exchanges/zebPay.ts:
Create the file and press Cmd+K:
```
Create ZebPay exchange client with:
- REST API with polling for USDT/INR prices
- Authentication with API key and signature
- Rate limiting (5 requests/second)
- Methods: getTicker(), getBalance(), createOrder(), getOrderStatus()
- Fallback handling
```

### For src/services/priceScanner/index.ts:
Create the file and press Cmd+K:
```
Create arbitrage scanner service that:
- Monitors prices from multiple exchanges
- Detects profitable opportunities after fees (including 1% TDS)
- Emits events for opportunities
- Stores data in PostgreSQL
- Handles minimum profit thresholds
- Calculates accurate profit percentages
```

## Step 6: Quick Environment Setup
Create .env file:
```bash
# Copy this to .env and fill in your values
DB_HOST=localhost
DB_PORT=5432
DB_NAME=arbitrage_bot
DB_USER=postgres
DB_PASSWORD=your_password

# Exchange APIs (get from exchange websites)
COINDCX_API_KEY=
COINDCX_API_SECRET=

ZEBPAY_API_KEY=
ZEBPAY_API_SECRET=

# Trading Config
MIN_PROFIT_THRESHOLD=100
MAX_TRADE_AMOUNT=10000
NODE_ENV=development
PORT=3000
```

## Step 7: Database Setup Script
Create src/scripts/setupDatabase.ts and press Cmd+K:
```
Create a database setup script that connects to PostgreSQL and creates all necessary tables with proper indexes and constraints
```

## Step 8: Add NPM Scripts
In package.json, press Cmd+K on the scripts section:
```
Add these npm scripts: dev with nodemon and ts-node, build with tsc, start for production, test with jest, db:setup to run the database script
```

## Step 9: Start Development
```bash
npm run db:setup  # Setup database
npm run dev      # Start development server
```

## 🎯 Cursor Pro Tips:

1. **Multi-file Generation**: Select multiple files in explorer, then Cmd+K to generate related code
2. **Fix Errors Fast**: Red squiggly? Right-click → "Fix with AI"
3. **Refactor**: Select code → Cmd+K → "Refactor this to use async/await"
4. **Generate Tests**: Select a function → Cmd+K → "Create unit tests for this"
5. **Documentation**: Select code → Cmd+K → "Add JSDoc comments"

## 📊 Progress Checklist:
- [ ] Project initialized with npm
- [ ] All dependencies installed
- [ ] TypeScript configured
- [ ] Folder structure created
- [ ] Database configuration ready
- [ ] Exchange API clients created
- [ ] Price scanner implemented
- [ ] Environment variables set
- [ ] Database tables created
- [ ] Development server running

Ready? Start with Step 1 in Cursor's terminal! 🚀
