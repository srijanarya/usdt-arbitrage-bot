# Deployment Checklist for Optimized Bot

## Pre-deployment
- [ ] All tests passing
- [ ] Credentials encrypted
- [ ] Gmail authentication working
- [ ] Redis server installed and running
- [ ] Sufficient disk space (>2GB free)
- [ ] Node.js 16+ installed

## Deployment Steps
1. [ ] Run health check: `./health-check.sh`
2. [ ] Install PM2: `npm install -g pm2`
3. [ ] Start with PM2: `pm2 start ecosystem.config.js`
4. [ ] Monitor logs: `pm2 logs`
5. [ ] Check dashboard: http://localhost:3001

## Post-deployment
- [ ] Verify bot is running: `pm2 status`
- [ ] Check performance metrics
- [ ] Monitor first few trades
- [ ] Set up alerts for errors
- [ ] Schedule regular health checks

## Rollback Plan
1. Stop current version: `pm2 stop usdt-arbitrage-bot`
2. Checkout previous version: `git checkout [previous-commit]`
3. Restart: `pm2 restart usdt-arbitrage-bot`

## Monitoring Commands
- View logs: `pm2 logs usdt-arbitrage-bot`
- Monitor CPU/Memory: `pm2 monit`
- View metrics: `curl http://localhost:3001/metrics`
- Health check: `./health-check.sh`
