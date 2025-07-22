# USDT Exchange Rate Monitor with Alerts

A comprehensive monitoring system that tracks USDT prices across Indian exchanges and alerts you when prices drop below your threshold.

## Features

- **Real-time Exchange Monitoring**: Tracks USDT rates on ZebPay, WazirX, CoinDCX, and Binance
- **Price Drop Alerts**: Get notified when USDT price drops below your threshold
- **P2P Rate Comparison**: Compare exchange rates with Binance P2P rates
- **Arbitrage Detection**: Automatically finds profitable exchange-to-P2P opportunities
- **Multiple Alert Types**:
  - Console alerts with color coding
  - Sound alerts (customizable)
  - Email notifications (optional)
  - Trend alerts for rapid price changes
- **Web Dashboard**: Beautiful real-time dashboard accessible from anywhere
- **WebSocket Support**: Real-time updates from WazirX

## Quick Start

### 1. Local Terminal Monitor

```bash
# Basic usage
node exchange-rate-monitor.js

# With custom settings
node exchange-rate-monitor.js --amount 13.78 --price 87.0 --alert 86.5

# Without sound
node exchange-rate-monitor.js --nosound
```

### 2. Web Dashboard

Open `exchange-monitor-dashboard.html` in your browser for a visual interface.

### 3. Deploy to Oracle Cloud

```bash
# SSH to your Oracle Cloud instance
ssh ubuntu@150.230.235.0

# Copy and run the deployment script
./deploy-monitor.sh
```

## Configuration

### Monitor Settings

```javascript
{
  amount: 13.78,        // Your USDT amount
  buyPrice: 87.0,       // Your average buy price
  alertThreshold: 86.5, // Alert when price drops below this
  profitThreshold: 0.5, // Minimum profit % for opportunities
  refreshInterval: 30000 // Refresh every 30 seconds
}
```

### Email Alerts (Optional)

To enable email alerts, add this configuration:

```javascript
{
  email: {
    enabled: true,
    from: 'your-email@gmail.com',
    password: 'your-app-password',
    to: 'recipient@gmail.com'
  }
}
```

## Alert Types

### 1. Price Drop Alert
Triggers when exchange price drops below your threshold (₹86.5 by default).

### 2. Trend Alert
Triggers when price drops more than 1% within 5 updates.

### 3. Profit Alert
Triggers when arbitrage opportunity exceeds 1% profit.

## API Endpoints (When deployed)

- `GET /api/rates` - Get current exchange and P2P rates
- `GET /api/opportunities` - Get arbitrage opportunities
- `GET /api/config` - Get current configuration
- `POST /api/config` - Update configuration

## Monitoring Output

The terminal monitor displays:
- Live exchange rates with buy/sell prices
- Top P2P rates with profit calculations
- Arbitrage opportunities sorted by profit
- Visual indicators for cheap prices and opportunities

## Tips

1. **Set Realistic Thresholds**: Set your alert threshold slightly below normal market rates
2. **Monitor During Volatility**: Best opportunities appear during high volatility
3. **Check P2P Limits**: Ensure your order amount fits merchant limits
4. **Use Multiple Payment Methods**: More payment options = more opportunities

## Troubleshooting

### No Exchange Data
- Check internet connection
- Verify exchange APIs are accessible
- Some exchanges may have rate limits

### No Sound Alerts
- Install sound dependencies: `npm install sound-play`
- Use `--nosound` flag to disable
- Check system audio settings

### CORS Issues (Web Dashboard)
- Use the provided server deployment
- Or use a local server: `python -m http.server 8000`

## Example Alert Scenarios

1. **ZebPay drops to ₹86.0**:
   - Console shows yellow alert
   - Sound plays (if enabled)
   - Email sent (if configured)
   - Dashboard highlights exchange in green

2. **P2P opportunity at 2% profit**:
   - Shows in opportunities table
   - Highlights best exchange-merchant pair
   - Displays exact profit in INR

## Safety Notes

- This is a monitoring tool only
- Always verify rates before trading
- Check merchant reputation on P2P
- Consider fees in profit calculations
- Start with small amounts

## Future Enhancements

- [ ] Telegram bot integration
- [ ] Historical price charts
- [ ] Auto-trading capabilities
- [ ] Mobile app
- [ ] More exchange integrations

---

For issues or suggestions, please check the logs:
```bash
# PM2 logs (if deployed)
pm2 logs exchange-monitor

# Or check console output when running locally
```