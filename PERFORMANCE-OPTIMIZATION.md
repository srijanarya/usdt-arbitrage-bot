# ⚡ Performance Optimization Guide

## Overview
This guide helps you optimize your USDT arbitrage bot for maximum performance and profitability.

## 1. System Performance

### Memory Optimization
```javascript
// In ecosystem.config.js
{
  max_memory_restart: '1G',  // Restart if memory exceeds 1GB
  min_uptime: '10s',        // Minimum uptime before restart
  max_restarts: 10,         // Max restart attempts
}
```

### Database Optimization
```sql
-- Add indexes for faster queries
CREATE INDEX idx_trades_timestamp ON trades(timestamp);
CREATE INDEX idx_trades_exchange ON trades(buy_exchange, sell_exchange);
CREATE INDEX idx_opportunities_created ON opportunities(created_at);
CREATE INDEX idx_opportunities_profit ON opportunities(net_profit DESC);

-- Partition tables by date (for large datasets)
CREATE TABLE trades_2024_01 PARTITION OF trades
  FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');

-- Regular maintenance
VACUUM ANALYZE trades;
VACUUM ANALYZE opportunities;
```

### Redis Caching (Optional)
```typescript
// Cache price data to reduce API calls
import Redis from 'ioredis';

const redis = new Redis();

// Cache prices for 5 seconds
async function getCachedPrice(exchange: string): Promise<number | null> {
  const cached = await redis.get(`price:${exchange}`);
  return cached ? parseFloat(cached) : null;
}

async function setCachedPrice(exchange: string, price: number) {
  await redis.setex(`price:${exchange}`, 5, price.toString());
}
```

## 2. Trading Performance

### Execution Speed Optimization
```typescript
// Parallel order execution
async function executeArbitrageFast(buy: Order, sell: Order) {
  // Execute both orders simultaneously
  const [buyResult, sellResult] = await Promise.all([
    this.executeBuyOrder(buy),
    this.executeSellOrder(sell)
  ]);
  
  return { buyResult, sellResult };
}

// Pre-calculate common values
const FEE_MULTIPLIERS = {
  zebpay: 1.0025,      // Pre-calculated: 1 + 0.0025
  binance: 1.001,      // Pre-calculated: 1 + 0.001
  tds: 0.99           // Pre-calculated: 1 - 0.01
};
```

### WebSocket Optimization
```typescript
// Batch price updates
class OptimizedPriceMonitor {
  private priceBatch: Map<string, PriceData> = new Map();
  private batchTimer: NodeJS.Timeout;
  
  private queuePriceUpdate(exchange: string, data: PriceData) {
    this.priceBatch.set(exchange, data);
    
    if (!this.batchTimer) {
      this.batchTimer = setTimeout(() => {
        this.processBatch();
      }, 50); // Process every 50ms
    }
  }
  
  private processBatch() {
    if (this.priceBatch.size > 0) {
      // Process all price updates at once
      this.checkArbitrageOpportunities(this.priceBatch);
      this.priceBatch.clear();
    }
    this.batchTimer = null;
  }
}
```

### Opportunity Filtering
```typescript
// Early rejection to save processing
function quickProfitCheck(buyPrice: number, sellPrice: number): boolean {
  // Quick check before detailed calculation
  const roughProfit = (sellPrice * 0.99) - (buyPrice * 1.003);
  return roughProfit > 100; // Minimum ₹100 profit
}

// Implement opportunity cache to avoid duplicates
const recentOpportunities = new Map();

function isDuplicateOpportunity(key: string): boolean {
  const now = Date.now();
  const lastSeen = recentOpportunities.get(key);
  
  // Clean old entries
  for (const [k, time] of recentOpportunities) {
    if (now - time > 60000) recentOpportunities.delete(k);
  }
  
  if (lastSeen && now - lastSeen < 5000) {
    return true; // Seen in last 5 seconds
  }
  
  recentOpportunities.set(key, now);
  return false;
}
```

## 3. Network Optimization

### Connection Pooling
```typescript
// Reuse HTTP connections
import { Agent } from 'https';

const httpsAgent = new Agent({
  keepAlive: true,
  keepAliveMsecs: 3000,
  maxSockets: 50,
  maxFreeSockets: 10
});

// Use in axios
const client = axios.create({
  httpsAgent,
  timeout: 5000,
  headers: {
    'Connection': 'keep-alive'
  }
});
```

### DNS Caching
```bash
# Install systemd-resolved for DNS caching
sudo apt install systemd-resolved

# Or use dnsmasq
sudo apt install dnsmasq
```

### CDN for Static Assets
```nginx
# Nginx config for static files
location /static/ {
  expires 1y;
  add_header Cache-Control "public, immutable";
  gzip_static on;
}
```

## 4. Code Optimization

### Algorithm Optimization
```typescript
// Use Map instead of Object for frequent lookups
const priceMap = new Map<string, number>();
// 2-3x faster than object property access

// Pre-compile regular expressions
const PRICE_REGEX = /^\d+(\.\d{1,2})?$/;
// Reuse instead of creating new RegExp

// Use typed arrays for numerical data
const priceHistory = new Float32Array(1000);
// More memory efficient for numbers
```

### Async Optimization
```typescript
// Limit concurrent operations
import pLimit from 'p-limit';

const limit = pLimit(5); // Max 5 concurrent

async function processOpportunities(opportunities: Opportunity[]) {
  return Promise.all(
    opportunities.map(opp => 
      limit(() => evaluateOpportunity(opp))
    )
  );
}
```

## 5. Monitoring & Metrics

### Performance Metrics to Track
```typescript
class PerformanceMonitor {
  private metrics = {
    avgExecutionTime: 0,
    avgApiLatency: 0,
    opportunitiesPerMinute: 0,
    profitPerHour: 0,
    cpuUsage: 0,
    memoryUsage: 0
  };
  
  trackExecution(startTime: number) {
    const duration = Date.now() - startTime;
    this.metrics.avgExecutionTime = 
      (this.metrics.avgExecutionTime * 0.9) + (duration * 0.1);
  }
  
  getMetrics() {
    return {
      ...this.metrics,
      cpuUsage: process.cpuUsage().user / 1000000,
      memoryUsage: process.memoryUsage().heapUsed / 1024 / 1024
    };
  }
}
```

### Grafana Dashboard Setup
```yaml
# docker-compose.yml for monitoring
version: '3'
services:
  prometheus:
    image: prom/prometheus
    ports:
      - 9090:9090
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
      
  grafana:
    image: grafana/grafana
    ports:
      - 3000:3000
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
```

## 6. Profitability Optimization

### Dynamic Spread Analysis
```typescript
class SpreadAnalyzer {
  private spreadHistory: Map<string, number[]> = new Map();
  
  updateSpread(route: string, spread: number) {
    const history = this.spreadHistory.get(route) || [];
    history.push(spread);
    
    // Keep last 100 spreads
    if (history.length > 100) history.shift();
    
    this.spreadHistory.set(route, history);
  }
  
  getAverageSpread(route: string): number {
    const history = this.spreadHistory.get(route) || [];
    if (history.length === 0) return 0;
    
    return history.reduce((a, b) => a + b) / history.length;
  }
  
  getBestTradingTimes(route: string): string[] {
    // Analyze when spreads are highest
    // Return best hours for trading
  }
}
```

### Fee Optimization
```typescript
// Route selection based on total fees
function selectOptimalRoute(opportunities: Opportunity[]) {
  return opportunities.sort((a, b) => {
    const aNetProfit = a.profit - a.totalFees;
    const bNetProfit = b.profit - b.totalFees;
    return bNetProfit - aNetProfit;
  })[0];
}
```

## 7. Scaling Strategies

### Horizontal Scaling
```javascript
// PM2 cluster mode for API servers
{
  name: 'api-server',
  script: './dist/server.js',
  instances: 'max',     // Use all CPU cores
  exec_mode: 'cluster'
}
```

### Microservices Architecture
```
┌─────────────────┐     ┌──────────────────┐
│ Price Monitor   │────▶│ Message Queue    │
└─────────────────┘     │ (Redis/RabbitMQ) │
                        └──────────────────┘
                                 │
                                 ▼
┌─────────────────┐     ┌──────────────────┐
│ Trade Executor  │◀────│ Arbitrage Finder │
└─────────────────┘     └──────────────────┘
```

## 8. Optimization Checklist

### Daily Optimizations
- [ ] Check and clear old logs: `pm2 flush`
- [ ] Vacuum database: `VACUUM ANALYZE`
- [ ] Review slow queries
- [ ] Check API rate limit usage

### Weekly Optimizations
- [ ] Analyze trading patterns
- [ ] Adjust risk parameters
- [ ] Review and optimize fee routes
- [ ] Update spread thresholds

### Monthly Optimizations
- [ ] Full database optimization
- [ ] Review and update indexes
- [ ] Analyze profit trends
- [ ] Architecture review

## 9. Common Bottlenecks

### API Rate Limits
- Solution: Implement request queuing and caching
- Use WebSocket streams instead of REST where possible

### Database Queries
- Solution: Add appropriate indexes
- Use connection pooling
- Consider read replicas

### Memory Leaks
- Solution: Regular restarts with PM2
- Profile with `node --inspect`
- Clear unused objects

### Network Latency
- Solution: Use servers closer to exchanges
- Implement connection keep-alive
- Use HTTP/2 where supported

## 10. Performance Testing

### Load Testing
```bash
# Test API endpoints
npm install -g artillery
artillery quick --count 100 --num 10 http://localhost:3000/api/status
```

### Profiling
```bash
# CPU profiling
node --prof dist/index.js
node --prof-process isolate-0xnnnnnnnnnnnn-v8.log > processed.txt

# Memory profiling
node --expose-gc --inspect dist/index.js
```

---

Remember: Optimize based on metrics, not assumptions. Always measure before and after changes!