# 🚀 Production Deployment Checklist

## Pre-Deployment

### 1. Environment Setup ✓
- [ ] Create production server (VPS/Cloud)
- [ ] Install Node.js 18+
- [ ] Install PostgreSQL
- [ ] Install Redis (optional, for caching)
- [ ] Configure firewall rules
- [ ] Set up domain name
- [ ] Install SSL certificate

### 2. Security Configuration
- [ ] Create non-root user for bot
- [ ] Set up SSH key authentication
- [ ] Disable password authentication
- [ ] Configure fail2ban
- [ ] Set up UFW firewall rules:
  ```bash
  sudo ufw allow 22/tcp    # SSH
  sudo ufw allow 80/tcp    # HTTP
  sudo ufw allow 443/tcp   # HTTPS
  sudo ufw allow 3333/tcp  # Mobile server (restrict to local network)
  ```

### 3. Exchange API Setup
- [ ] Create API keys with trading permissions only
- [ ] Whitelist server IP on exchanges
- [ ] Test API connectivity
- [ ] Verify rate limits

### 4. Environment Variables
- [ ] Copy `.env.example` to `.env`
- [ ] Set all required variables
- [ ] Use strong JWT_SECRET (32+ characters)
- [ ] Use secure MOBILE_PIN (not 1234!)
- [ ] Set production database credentials

## Deployment Steps

### 1. Initial Deployment
```bash
# Clone repository
git clone https://github.com/yourusername/usdt-arbitrage-bot.git
cd usdt-arbitrage-bot

# Run deployment script
./scripts/deploy-production.sh
```

### 2. Database Setup
```bash
# Create database
sudo -u postgres createdb arbitrage_bot

# Run migrations
npm run db:setup

# Verify tables created
psql -d arbitrage_bot -c "\dt"
```

### 3. Test in Production
- [ ] Start in test mode first
- [ ] Verify WebSocket connections
- [ ] Test with 1 USDT trades
- [ ] Monitor for 24 hours
- [ ] Check all logs for errors

### 4. Gradual Rollout
- [ ] Week 1: Test mode only, monitor opportunities
- [ ] Week 2: Enable with 5-10 USDT trades
- [ ] Week 3: Increase to 50 USDT trades
- [ ] Week 4: Increase to 100 USDT trades
- [ ] Monitor win rate and adjust

## Monitoring & Maintenance

### Daily Tasks
- [ ] Check system health: `npm run monitor:health`
- [ ] Review trading reports: `npm run trading:report`
- [ ] Check error logs: `pm2 logs --err`
- [ ] Monitor disk space: `df -h`

### Weekly Tasks
- [ ] Review weekly performance report
- [ ] Update risk parameters if needed
- [ ] Check for suspicious activities
- [ ] Backup database and reports
- [ ] Update dependencies: `npm audit`

### Monthly Tasks
- [ ] Full system audit
- [ ] Review and rotate API keys
- [ ] Update server packages
- [ ] Performance optimization
- [ ] Cost analysis (server, API calls)

## Emergency Procedures

### 1. Emergency Stop
```bash
# Stop all trading immediately
pm2 stop arbitrage-bot

# Or use emergency stop in mobile app
```

### 2. Rollback Procedure
```bash
# Stop services
pm2 stop all

# Rollback to previous version
git checkout <previous-commit>
npm install
npm run build
pm2 restart all
```

### 3. Data Recovery
```bash
# Restore from backup
psql arbitrage_bot < backups/20240XX/database.sql
```

## Performance Tuning

### 1. Database Optimization
```sql
-- Add indexes for frequently queried columns
CREATE INDEX idx_trades_timestamp ON trades(timestamp);
CREATE INDEX idx_opportunities_profit ON opportunities(net_profit);

-- Vacuum and analyze regularly
VACUUM ANALYZE;
```

### 2. Process Management
```javascript
// ecosystem.config.js adjustments
max_memory_restart: '1G',  // Adjust based on server
instances: 1,              // Keep at 1 for trading bot
exec_mode: 'fork',         // Not cluster mode
```

### 3. Network Optimization
- Use connection pooling for database
- Implement Redis for caching prices
- Use CDN for static assets
- Enable gzip compression

## Monitoring Metrics

### Key Metrics to Track
1. **System Health**
   - CPU usage < 80%
   - Memory usage < 80%
   - Disk usage < 90%
   - Network latency < 100ms

2. **Trading Performance**
   - Win rate > 60%
   - Daily profit positive
   - Execution time < 30s
   - Failed trades < 5%

3. **Risk Metrics**
   - Max drawdown < 10%
   - Consecutive losses < 3
   - Daily loss limit respected
   - Position sizing appropriate

## Compliance & Legal

- [ ] Understand tax obligations
- [ ] Keep detailed trade records
- [ ] Register business if required
- [ ] Comply with exchange ToS
- [ ] Implement KYC if needed

## Scaling Considerations

When ready to scale:
1. Implement load balancer
2. Use separate servers for:
   - Trading execution
   - Price monitoring
   - Mobile API
   - Database
3. Implement message queue (RabbitMQ/Redis)
4. Use distributed caching
5. Implement proper logging aggregation

## Final Checks

Before going fully live:
- [ ] All tests passing: `npm run test:system`
- [ ] Mobile access working
- [ ] Telegram alerts functional
- [ ] Emergency stop tested
- [ ] Backups automated
- [ ] Monitoring active
- [ ] Documentation complete

---

Remember: **Start small, monitor closely, scale gradually!**