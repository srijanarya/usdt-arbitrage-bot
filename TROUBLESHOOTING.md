# 🔧 Troubleshooting Guide

## Common Issues and Solutions

### 1. WebSocket Connection Issues

#### Problem: "WebSocket connection failed"
```
❌ Failed to connect to zebpay: Connection timeout
```

**Solutions:**
1. Check internet connectivity
2. Verify WebSocket URLs are correct
3. Check if exchange is under maintenance
4. Try the enhanced WebSocket monitor:
   ```bash
   npm run monitor:health
   ```

#### Problem: "Stale price data"
```
⚠️ Stale data detected for binance_p2p: 120s old
```

**Solutions:**
```typescript
// Force reconnect
await priceMonitor.reconnectExchange('binance_p2p');

// Or restart price monitor
pm2 restart price-monitor
```

### 2. Trading Execution Errors

#### Problem: "INSUFFICIENT_BALANCE"
**Solutions:**
1. Check wallet balance:
   ```bash
   npm run check-balance
   ```
2. Reduce trade amount in config
3. Ensure funds are in spot wallet (not locked)

#### Problem: "RATE_LIMIT_EXCEEDED"
**Solutions:**
1. Reduce API call frequency
2. Check current usage:
   ```bash
   npm run monitor:health
   # Look for API Rate Limits section
   ```
3. Implement caching for repeated calls

#### Problem: "ORDER_TIMEOUT"
**Solutions:**
```typescript
// Increase timeout in AutomatedTradingService
await this.waitForOrderCompletion(orderId, pair, 120000); // 2 minutes
```

### 3. Database Issues

#### Problem: "Connection pool exhausted"
**Solutions:**
```bash
# Check connections
psql -d arbitrage_bot -c "SELECT count(*) FROM pg_stat_activity;"

# Kill idle connections
psql -d arbitrage_bot -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE state = 'idle' AND state_change < current_timestamp - INTERVAL '1 hour';"
```

#### Problem: "Slow queries"
**Solutions:**
```sql
-- Find slow queries
SELECT query, mean_exec_time, calls 
FROM pg_stat_statements 
ORDER BY mean_exec_time DESC 
LIMIT 10;

-- Add missing indexes
CREATE INDEX CONCURRENTLY idx_trades_timestamp ON trades(timestamp);
```

### 4. Mobile Access Issues

#### Problem: "Cannot access from phone"
**Solutions:**
1. Ensure phone is on same WiFi network
2. Check firewall:
   ```bash
   sudo ufw allow 3333
   ```
3. Find correct IP:
   ```bash
   ifconfig | grep "inet " | grep -v 127.0.0.1
   ```
4. Try using ngrok for testing:
   ```bash
   ngrok http 3333
   ```

#### Problem: "WebSocket disconnects on mobile"
**Solutions:**
- Keep phone screen on
- Disable battery optimization for browser
- Use "Add to Home Screen" for better performance

### 5. Risk Management Triggers

#### Problem: "Trading paused - 3 consecutive losses"
**Solutions:**
1. Review recent trades:
   ```bash
   npm run trading:report
   ```
2. Reset risk metrics (use cautiously):
   ```typescript
   riskManager.resetDailyMetrics();
   ```
3. Adjust risk parameters in config

#### Problem: "Daily loss limit reached"
**Solutions:**
- Wait for daily reset (midnight)
- Or manually reset (NOT recommended):
  ```typescript
  riskManager.updateProfile({ maxDailyLoss: 10000 });
  ```

### 6. Performance Issues

#### Problem: "High memory usage"
**Solutions:**
```bash
# Check memory
pm2 monit

# Restart with memory limit
pm2 restart arbitrage-bot --max-memory-restart 1G

# Find memory leaks
node --inspect dist/index.js
# Open chrome://inspect
```

#### Problem: "Slow arbitrage detection"
**Solutions:**
1. Reduce price update interval
2. Optimize calculations:
   ```typescript
   // Use pre-calculated values
   const FEE_CACHE = new Map();
   ```
3. Check CPU usage:
   ```bash
   top -p $(pgrep -f "node.*arbitrage")
   ```

### 7. Configuration Errors

#### Problem: "Missing environment variables"
**Solutions:**
```bash
# Check all variables
npm run check-system

# Common missing vars
export TELEGRAM_BOT_TOKEN="your-token"
export TELEGRAM_CHAT_ID="your-chat-id"
export MOBILE_PIN="secure-pin"
export JWT_SECRET="long-random-string"
```

#### Problem: "Invalid API credentials"
**Solutions:**
1. Regenerate API keys on exchange
2. Check for extra spaces in .env
3. Verify API permissions include trading

### 8. Telegram Alert Issues

#### Problem: "Telegram alerts not working"
**Solutions:**
1. Test bot connection:
   ```bash
   npm run test:telegram
   ```
2. Verify bot token with BotFather
3. Get correct chat ID:
   ```bash
   curl https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getUpdates
   ```

### 9. Emergency Procedures

#### System Crash Recovery
```bash
# 1. Stop all services
pm2 stop all

# 2. Check system resources
free -h
df -h

# 3. Check logs
pm2 logs --lines 100

# 4. Restart services one by one
pm2 start ecosystem.config.js --only price-monitor
pm2 start ecosystem.config.js --only arbitrage-bot
```

#### Data Corruption
```bash
# 1. Stop services
pm2 stop all

# 2. Backup current data
pg_dump arbitrage_bot > backup_$(date +%Y%m%d_%H%M%S).sql

# 3. Check database integrity
psql -d arbitrage_bot -c "REINDEX DATABASE arbitrage_bot;"

# 4. Restore from backup if needed
psql arbitrage_bot < backups/last_known_good.sql
```

### 10. Debug Mode

#### Enable detailed logging
```typescript
// In .env
LOG_LEVEL=debug
DEBUG=arbitrage:*

// Or temporarily
DEBUG=* npm run trading:auto
```

#### Trace specific issues
```bash
# Trace WebSocket issues
DEBUG=ws npm run monitor:integrated

# Trace trading execution
DEBUG=trading:* npm run trading:auto
```

### 11. Health Check Commands

Quick health check:
```bash
# System status
npm run monitor:health

# Test all components
npm run test:system

# Check specific service
pm2 info arbitrage-bot
```

### 12. Log Analysis

Find errors in logs:
```bash
# Recent errors
pm2 logs --err --lines 50

# Search for specific error
grep -n "ERROR" logs/*.log

# Count error types
grep "ERROR" logs/*.log | cut -d':' -f3 | sort | uniq -c
```

### 13. Common Error Codes

| Code | Meaning | Solution |
|------|---------|----------|
| `ECONNREFUSED` | Can't connect to service | Check if service is running |
| `ETIMEDOUT` | Request timeout | Increase timeout or check network |
| `INSUFFICIENT_BALANCE` | Not enough funds | Check wallet balance |
| `RATE_LIMIT` | Too many requests | Implement request throttling |
| `INVALID_API_KEY` | Wrong credentials | Regenerate API keys |
| `ORDER_NOT_FOUND` | Order doesn't exist | Check order ID and status |
| `PRICE_DEVIATION` | Price changed too much | Adjust deviation threshold |

### 14. Recovery Scripts

Create these helpful scripts:

**restart-clean.sh**
```bash
#!/bin/bash
pm2 stop all
pm2 flush
pm2 start ecosystem.config.js
pm2 logs
```

**emergency-stop.sh**
```bash
#!/bin/bash
pm2 stop arbitrage-bot
echo "Trading stopped at $(date)" >> emergency-stops.log
telegram-send "🚨 Emergency stop activated"
```

### 15. Getting Help

If issues persist:
1. Check logs thoroughly
2. Run system tests: `npm run test:system`
3. Review recent code changes
4. Check exchange status pages
5. Create detailed issue report with:
   - Error messages
   - Log excerpts
   - System info
   - Steps to reproduce

---

Remember: Most issues can be diagnosed by checking logs carefully. When in doubt, restart services one by one and monitor the logs!