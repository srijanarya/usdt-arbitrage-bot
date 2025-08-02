# Dynamic Position Sizing Integration Guide

## Overview
Dynamic position sizing has been integrated into your USDT arbitrage bot. The system now automatically adjusts position sizes based on:
- Kelly Criterion (optimal betting size)
- Market volatility
- Recent drawdowns
- Trade confidence
- Consecutive losses

## Configuration
Edit `src/config/tradingConfig.ts` to adjust:
```typescript
positionSizing: {
  enabled: true,              // Toggle dynamic sizing
  mode: 'dynamic',           // 'fixed' or 'dynamic'
  dynamicConfig: {
    minPercent: 1,           // Minimum position (1% of capital)
    maxPercent: 15,          // Maximum position (15% of capital)
    kellyScalar: 0.25,       // Conservative Kelly (25% of full Kelly)
  }
}
```

## Usage in Your Bot

### 1. Import the functions
```typescript
import { calculateTradeSize } from './config/tradingConfig';
import { volatilityCalculator } from './services/analysis/MarketVolatilityCalculator';
```

### 2. Feed price data to volatility calculator
```typescript
// In your price monitoring loop
volatilityCalculator.addPrice('USDT/INR', currentPrice);
```

### 3. Calculate position size before trading
```typescript
const marketConditions = volatilityCalculator.getMarketConditions('USDT/INR');
const positionSize = await calculateTradeSize(
  {
    expectedProfit: 2.5,  // Expected profit percentage
    confidence: 0.85      // Confidence level (0-1)
  },
  marketConditions
);
```

### 4. Update stats after each trade
```typescript
import { getPositionSizer } from './config/tradingConfig';

const sizer = getPositionSizer();
sizer.updateStats({
  profit: actualProfit,    // Positive for wins, negative for losses
  win: actualProfit > 0
});
```

## Position Size Examples

### High Confidence, Low Volatility
- Expected Profit: 3%
- Confidence: 0.9
- Volatility: 20
- Result: 12-15% of capital

### Medium Confidence, High Volatility
- Expected Profit: 2%
- Confidence: 0.7
- Volatility: 70
- Result: 4-6% of capital

### After 3 Consecutive Losses
- Any conditions
- Result: 50% reduction in position size

## Monitoring
The position sizer logs detailed reasoning for each calculation:
```
INFO: Dynamic position size calculated {
  size: 1250.50,
  percent: 8.5,
  reasoning: "Kelly criterion suggests 10.2% position. Reduced 15% due to high volatility. Final position: 8.5% of capital"
}
```

## Safety Features
1. **Minimum Position**: Never less than 1% of capital
2. **Maximum Position**: Never more than 15% of capital
3. **Consecutive Loss Protection**: Automatic 50% reduction after 3 losses
4. **Volatility Adjustment**: Smaller positions in volatile markets
5. **Drawdown Protection**: Reduced sizing during drawdowns

## Testing
Run position sizing tests:
```bash
npm run test:position-sizing
```

## Rollback
To disable dynamic sizing:
1. Set `positionSizing.enabled = false` in config
2. Or set `positionSizing.mode = 'fixed'`
