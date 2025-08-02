# Performance Monitoring Dashboard Guide

## Overview
The performance monitoring dashboard provides real-time insights into your USDT arbitrage bot's performance, including:
- Profit tracking and visualization
- Dynamic position sizing information
- Risk indicators and drawdown monitoring
- API latency tracking
- Trade history and win rate
- Emergency stop functionality

## Features

### 1. Real-time Metrics
- **Total Profit**: 24-hour cumulative profit
- **Current Capital**: Live capital tracking
- **Win Rate**: Percentage of profitable trades
- **Active Positions**: Current open positions
- **API Latency**: Average API response time
- **System Uptime**: Bot operational time

### 2. Risk Management
- **Current Drawdown**: Real-time drawdown calculation
- **Market Volatility**: 0-100 scale volatility indicator
- **Liquidity Status**: Market liquidity assessment
- **Position Sizing**: Dynamic sizing parameters

### 3. Visualizations
- **Profit Chart**: 24-hour profit trend
- **Trade Log**: Recent trade history
- **Risk Indicators**: Visual risk warnings

### 4. Controls
- **Auto-refresh**: Toggle live updates
- **Export Data**: Download performance data
- **Emergency Stop**: Immediate bot shutdown

## Integration Steps

### 1. Import Dependencies
```typescript
import { performanceMonitor } from './src/services/monitoring/PerformanceMonitorAPI';
import { PerformanceIntegration } from './integrate-performance-monitor';
```

### 2. Initialize on Bot Startup
```typescript
await PerformanceIntegration.initialize();
```

### 3. Track API Calls
```typescript
const startTime = Date.now();
const data = await exchange.fetchData();
PerformanceIntegration.trackApiCall('exchange-name', startTime);
```

### 4. Record Trades
```typescript
PerformanceIntegration.recordTrade({
  pair: 'USDT/INR',
  type: 'buy',
  amount: 100,
  price: 88.5,
  profit: calculatedProfit
});
```

### 5. Update Positions
```typescript
PerformanceIntegration.updatePositions(activePositions.length);
```

## Running the Dashboard

### Development Mode
```bash
# Test with simulated data
./test-performance-dashboard.sh
```

### Production Mode
```bash
# Add to your bot startup script
await PerformanceIntegration.initialize();

# Dashboard runs on http://localhost:3001
```

### With PM2
```javascript
// In ecosystem.config.js
apps: [{
  name: 'usdt-bot-dashboard',
  script: 'npx',
  args: 'ts-node bot-with-monitoring.ts',
  // ... other config
}]
```

## Dashboard URL
- Local: http://localhost:3001
- Network: http://[your-ip]:3001

## API Endpoints

### GET /api/metrics
Returns current performance metrics

### GET /api/export
Downloads performance data as JSON

### POST /api/emergency-stop
Triggers emergency bot shutdown

### POST /api/update-trade
Updates trade information

### POST /api/update-api-latency
Updates API latency metrics

## Customization

### Change Port
```typescript
const performanceMonitor = new PerformanceMonitorAPI(3002); // Custom port
```

### Add Custom Metrics
```typescript
performanceMonitor.updateMetric('customMetric', value);
```

### Modify Dashboard
Edit `src/dashboard/performance-monitor.html` for UI changes

## Security Considerations

1. **Access Control**: Dashboard is publicly accessible on the port
2. **Production Use**: Implement authentication for production
3. **Emergency Stop**: Requires confirmation dialog
4. **Data Export**: Contains sensitive trading data

## Troubleshooting

### Dashboard Not Loading
- Check if port 3001 is available
- Verify bot is running
- Check firewall settings

### No Data Showing
- Ensure integration code is added
- Check browser console for errors
- Verify API endpoints are responding

### High Latency Warnings
- Check network connection
- Verify exchange API status
- Consider rate limiting

## Performance Impact
- Minimal CPU usage (<1%)
- Memory: ~20MB
- Network: Negligible
- Storage: Logs rotate automatically
