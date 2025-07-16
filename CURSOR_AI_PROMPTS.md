# 🤖 Cursor AI Power Prompts - Week 1

## Copy & Paste These Directly into Cursor (Cmd+K)

### 🏗️ Project Setup Prompts

#### Complete Project Structure
```
Create a production-ready TypeScript project structure for a crypto arbitrage trading bot with proper separation of concerns, including API clients, services, models, config, utils, and comprehensive error handling
```

#### Environment Configuration
```
Create a robust configuration system that loads environment variables with validation, default values, and type safety for database connections, API keys, and trading parameters
```

### 🔌 API Integration Prompts

#### CoinDCX WebSocket Client
```
Implement a CoinDCX WebSocket client that:
1. Connects to wss://stream.coindcx.com
2. Subscribes to USDTINR@orderbook stream
3. Handles automatic reconnection with exponential backoff
4. Implements heartbeat/ping-pong to keep connection alive
5. Parses orderbook updates and emits price events
6. Includes HMAC authentication for private endpoints
7. Respects rate limits (10 requests/second)
8. Has methods for placing orders and checking balances
```

#### ZebPay REST Client
```
Create a ZebPay API client that:
1. Polls https://www.zebapi.com/api/v1/market/USDT-INR/ticker every 2 seconds
2. Implements proper authentication with API key and signature
3. Handles rate limiting (5 requests/second)
4. Has methods for getTicker, getOrderBook, createOrder, getBalance
5. Includes comprehensive error handling and retry logic
6. Falls back gracefully when WebSocket is unavailable
```

### 💰 Arbitrage Logic Prompts

#### Fee Calculator
```
Create a comprehensive fee calculator that:
1. Calculates maker/taker fees for each exchange
2. Includes network/withdrawal fees
3. Adds 1% TDS (Tax Deducted at Source) for Indian regulations
4. Factors in slippage based on order book depth
5. Returns gross profit, total fees, net profit, and ROI percentage
```

#### Arbitrage Scanner
```
Build an arbitrage opportunity scanner that:
1. Monitors real-time prices from multiple exchanges
2. Detects opportunities when sell_price - buy_price > total_fees
3. Filters by minimum profit threshold (configurable)
4. Calculates accurate profit considering actual order book liquidity
5. Stores opportunities in PostgreSQL with all relevant data
6. Emits events for notifications (Telegram, dashboard)
7. Tracks opportunity lifecycle (detected → executed → completed)
```

### 🗄️ Database Prompts

#### Schema Creation
```
Create PostgreSQL schema with these tables:
1. exchanges (id, name, active, created_at)
2. price_history (id, exchange_id, symbol, bid, ask, volume, timestamp) with indexes
3. arbitrage_opportunities (id, buy_exchange, sell_exchange, symbol, prices, profit, status, timestamps)
4. trades (id, opportunity_id, exchange_id, side, symbol, price, quantity, fees, status, order_id, timestamps)
5. Include proper foreign keys, indexes on timestamp and symbol, and constraints
```

#### Database Service
```
Create a database service layer with:
1. Connection pooling with configurable size
2. Transaction support with rollback on error
3. Query builder helpers for common operations
4. Methods: savePriceData(), saveOpportunity(), getTrade(), updateTradeStatus()
5. Automatic timestamp handling (created_at, updated_at)
6. Query logging in development mode
7. Connection retry logic
```

### 🔔 Notification Prompts

#### Telegram Bot Integration
```
Create Telegram notification service that:
1. Sends formatted alerts for arbitrage opportunities
2. Includes profit amount, percentage, and exchanges
3. Has commands: /start, /status, /opportunities, /stop
4. Sends alerts only for opportunities above threshold
5. Includes rate limiting to prevent spam
6. Formats messages with emoji and markdown
```

### 🧪 Testing Prompts

#### Unit Test Suite
```
Generate comprehensive unit tests for:
1. Fee calculation with various scenarios
2. Arbitrage detection logic with mock data
3. API client connection and error handling
4. Database operations with transaction rollback
5. Use Jest with proper mocking and assertions
6. Include edge cases and error scenarios
```

#### Integration Tests
```
Create integration tests that:
1. Test real API connections (with test keys)
2. Verify database operations
3. Test arbitrage detection with live data
4. Validate notification sending
5. Include setup and teardown helpers
```

### 📊 Dashboard Prompts

#### Real-time Dashboard
```
Create a web dashboard with:
1. WebSocket connection for real-time updates
2. Current prices from all exchanges
3. Recent arbitrage opportunities list
4. Profit/loss tracking
5. Active trades status
6. Simple HTML/CSS/JS, no framework needed
7. Auto-refresh every second
```

### 🚀 Performance Optimization Prompts

#### Caching Layer
```
Implement caching system that:
1. Caches price data with TTL
2. Uses Redis or in-memory cache
3. Invalidates on new price updates
4. Reduces database queries
5. Includes cache warming on startup
```

#### Rate Limiter
```
Create a rate limiter that:
1. Tracks API calls per exchange
2. Implements token bucket algorithm
3. Queues requests when limit reached
4. Has different limits per endpoint
5. Includes bypass for critical operations
```

## 💡 Pro Tip: Chain Prompts

After generating code, use follow-up prompts:
- "Add comprehensive error handling to this"
- "Add detailed logging with log levels"
- "Make this more performant"
- "Add TypeScript types and interfaces"
- "Add JSDoc documentation"
- "Create unit tests for this"

## 🎯 Quick Wins

1. **Generate Everything First**: Use all prompts to create base code
2. **Then Refine**: Use Cmd+K to improve specific parts
3. **Fix Errors**: Right-click errors → "Fix with AI"
4. **Ask Questions**: Use Cmd+L for clarification
5. **Test Immediately**: Run code as you build

Start with the first prompt and work your way down! 🚀
