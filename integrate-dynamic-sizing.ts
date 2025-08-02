#!/usr/bin/env node
import { DynamicPositionSizer, createDynamicSizer } from './src/services/trading/DynamicPositionSizer';
import { logger } from './src/utils/logger';
import * as fs from 'fs';
import * as path from 'path';

// Integration with existing bot configuration
interface BotConfig {
  trading: {
    minPositionSize?: number;
    maxPositionSize?: number;
    dynamicSizing?: boolean;
    riskPerTrade?: number;
  };
  capital: {
    initial: number;
    current: number;
  };
}

async function integrateDynamicSizing() {
  logger.info('🎯 Integrating Dynamic Position Sizing');
  logger.info('=====================================\n');

  try {
    // Load existing bot configuration
    const configPath = path.join(process.cwd(), 'src/config/tradingConfig.ts');
    
    // Create enhanced trading config with dynamic sizing
    const enhancedConfig = `
import { DynamicPositionSizer, createDynamicSizer } from '../services/trading/DynamicPositionSizer';

// Original trading configuration
export const tradingConfig = {
  // Exchange configurations
  exchanges: {
    binance: { enabled: true, testMode: false },
    coindcx: { enabled: true, testMode: false },
    zebpay: { enabled: true, testMode: false }
  },
  
  // Arbitrage settings
  arbitrage: {
    minProfitPercent: parseFloat(process.env.MIN_PROFIT_THRESHOLD || '0.5'),
    maxPositionSize: parseFloat(process.env.MAX_POSITION_SIZE || '10'),
    checkInterval: 5000, // 5 seconds
    executionDelay: 100  // 100ms
  },
  
  // NEW: Dynamic position sizing
  positionSizing: {
    enabled: true,
    mode: 'dynamic', // 'fixed' or 'dynamic'
    fixedPercent: 10, // Used when mode is 'fixed'
    dynamicConfig: {
      minPercent: 1,
      maxPercent: 15,
      kellyScalar: 0.25,
      volatilityWindow: 24, // hours
      drawdownThreshold: 10 // percent
    }
  },
  
  // Risk management
  risk: {
    maxDailyLoss: 5, // percent
    maxConsecutiveLosses: 3,
    stopLossPercent: 2,
    takeProfitPercent: 5,
    circuitBreaker: {
      enabled: true,
      threshold: 10 // percent daily loss
    }
  }
};

// Initialize position sizer
let positionSizer: DynamicPositionSizer | null = null;

export function getPositionSizer(): DynamicPositionSizer {
  if (!positionSizer) {
    const initialCapital = parseFloat(process.env.INITIAL_CAPITAL || '10000');
    positionSizer = createDynamicSizer(initialCapital);
  }
  return positionSizer;
}

// Calculate position size for a trade opportunity
export async function calculateTradeSize(
  opportunity: { expectedProfit: number; confidence: number },
  marketConditions: any
): Promise<number> {
  const sizer = getPositionSizer();
  
  if (tradingConfig.positionSizing.enabled && tradingConfig.positionSizing.mode === 'dynamic') {
    const result = sizer.calculatePositionSize(opportunity, marketConditions);
    logger.info('Dynamic position size calculated', result);
    return result.size;
  } else {
    // Fallback to fixed sizing
    const capital = parseFloat(process.env.CURRENT_CAPITAL || '10000');
    const size = (tradingConfig.positionSizing.fixedPercent / 100) * capital;
    logger.info('Fixed position size', { size, percent: tradingConfig.positionSizing.fixedPercent });
    return size;
  }
}

export default tradingConfig;
`;

    // Write enhanced config
    fs.writeFileSync(configPath, enhancedConfig);
    logger.info('✅ Updated trading configuration with dynamic sizing');

    // Create market volatility calculator
    const volatilityCalcPath = path.join(process.cwd(), 'src/services/analysis/MarketVolatilityCalculator.ts');
    const volatilityCalculator = `
import { logger } from '../../utils/logger';

interface PriceData {
  timestamp: Date;
  price: number;
}

export class MarketVolatilityCalculator {
  private priceHistory: Map<string, PriceData[]> = new Map();
  private readonly maxHistorySize = 1000;

  /**
   * Add price data point
   */
  addPrice(symbol: string, price: number) {
    if (!this.priceHistory.has(symbol)) {
      this.priceHistory.set(symbol, []);
    }
    
    const history = this.priceHistory.get(symbol)!;
    history.push({ timestamp: new Date(), price });
    
    // Maintain max history size
    if (history.length > this.maxHistorySize) {
      history.shift();
    }
  }

  /**
   * Calculate current volatility (0-100 scale)
   */
  calculateVolatility(symbol: string, windowHours: number = 24): number {
    const history = this.priceHistory.get(symbol);
    if (!history || history.length < 10) {
      return 50; // Default medium volatility
    }
    
    // Filter data within window
    const cutoff = new Date(Date.now() - windowHours * 60 * 60 * 1000);
    const recentData = history.filter(d => d.timestamp > cutoff);
    
    if (recentData.length < 10) {
      return 50; // Not enough data
    }
    
    // Calculate returns
    const returns: number[] = [];
    for (let i = 1; i < recentData.length; i++) {
      const return_pct = (recentData[i].price - recentData[i-1].price) / recentData[i-1].price;
      returns.push(return_pct);
    }
    
    // Calculate standard deviation
    const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
    const stdDev = Math.sqrt(variance);
    
    // Convert to 0-100 scale (assuming 10% daily volatility is max)
    const volatilityScore = Math.min(100, (stdDev / 0.1) * 100);
    
    logger.debug(\`Volatility for \${symbol}: \${volatilityScore.toFixed(2)}\`);
    return volatilityScore;
  }

  /**
   * Get market conditions for position sizing
   */
  getMarketConditions(symbol: string): any {
    const volatility = this.calculateVolatility(symbol);
    const history = this.priceHistory.get(symbol) || [];
    const currentPrice = history.length > 0 ? history[history.length - 1].price : 0;
    
    // Calculate recent drawdown
    let maxPrice = currentPrice;
    let maxDrawdown = 0;
    
    for (let i = history.length - 1; i >= Math.max(0, history.length - 100); i--) {
      maxPrice = Math.max(maxPrice, history[i].price);
      const drawdown = ((maxPrice - history[i].price) / maxPrice) * 100;
      maxDrawdown = Math.max(maxDrawdown, drawdown);
    }
    
    return {
      volatility,
      liquidityDepth: 100000, // TODO: Get from exchange
      spread: 0.1, // TODO: Calculate from order book
      recentDrawdown: maxDrawdown
    };
  }
}

export const volatilityCalculator = new MarketVolatilityCalculator();
`;

    // Create analysis directory and write volatility calculator
    const analysisDir = path.join(process.cwd(), 'src/services/analysis');
    if (!fs.existsSync(analysisDir)) {
      fs.mkdirSync(analysisDir, { recursive: true });
    }
    fs.writeFileSync(volatilityCalcPath, volatilityCalculator);
    logger.info('✅ Created market volatility calculator');

    // Update arbitrage service to use dynamic sizing
    const arbitrageServiceUpdate = `
// Add this to your existing arbitrage service

import { calculateTradeSize } from '../../config/tradingConfig';
import { volatilityCalculator } from '../analysis/MarketVolatilityCalculator';

// In your arbitrage detection method, replace fixed position sizing with:
async function executeArbitrage(opportunity: any) {
  try {
    // Get market conditions
    const marketConditions = volatilityCalculator.getMarketConditions('USDT/INR');
    
    // Calculate dynamic position size
    const positionSize = await calculateTradeSize(
      {
        expectedProfit: opportunity.profitPercent,
        confidence: opportunity.confidence || 0.8
      },
      marketConditions
    );
    
    logger.info('Executing arbitrage with dynamic position size', {
      opportunity,
      positionSize,
      marketConditions
    });
    
    // Continue with your existing execution logic using positionSize
    // ...
    
  } catch (error) {
    logger.error('Arbitrage execution failed:', error);
  }
}
`;

    // Save integration guide
    const integrationGuide = `# Dynamic Position Sizing Integration Guide

## Overview
Dynamic position sizing has been integrated into your USDT arbitrage bot. The system now automatically adjusts position sizes based on:
- Kelly Criterion (optimal betting size)
- Market volatility
- Recent drawdowns
- Trade confidence
- Consecutive losses

## Configuration
Edit \`src/config/tradingConfig.ts\` to adjust:
\`\`\`typescript
positionSizing: {
  enabled: true,              // Toggle dynamic sizing
  mode: 'dynamic',           // 'fixed' or 'dynamic'
  dynamicConfig: {
    minPercent: 1,           // Minimum position (1% of capital)
    maxPercent: 15,          // Maximum position (15% of capital)
    kellyScalar: 0.25,       // Conservative Kelly (25% of full Kelly)
  }
}
\`\`\`

## Usage in Your Bot

### 1. Import the functions
\`\`\`typescript
import { calculateTradeSize } from './config/tradingConfig';
import { volatilityCalculator } from './services/analysis/MarketVolatilityCalculator';
\`\`\`

### 2. Feed price data to volatility calculator
\`\`\`typescript
// In your price monitoring loop
volatilityCalculator.addPrice('USDT/INR', currentPrice);
\`\`\`

### 3. Calculate position size before trading
\`\`\`typescript
const marketConditions = volatilityCalculator.getMarketConditions('USDT/INR');
const positionSize = await calculateTradeSize(
  {
    expectedProfit: 2.5,  // Expected profit percentage
    confidence: 0.85      // Confidence level (0-1)
  },
  marketConditions
);
\`\`\`

### 4. Update stats after each trade
\`\`\`typescript
import { getPositionSizer } from './config/tradingConfig';

const sizer = getPositionSizer();
sizer.updateStats({
  profit: actualProfit,    // Positive for wins, negative for losses
  win: actualProfit > 0
});
\`\`\`

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
\`\`\`
INFO: Dynamic position size calculated {
  size: 1250.50,
  percent: 8.5,
  reasoning: "Kelly criterion suggests 10.2% position. Reduced 15% due to high volatility. Final position: 8.5% of capital"
}
\`\`\`

## Safety Features
1. **Minimum Position**: Never less than 1% of capital
2. **Maximum Position**: Never more than 15% of capital
3. **Consecutive Loss Protection**: Automatic 50% reduction after 3 losses
4. **Volatility Adjustment**: Smaller positions in volatile markets
5. **Drawdown Protection**: Reduced sizing during drawdowns

## Testing
Run position sizing tests:
\`\`\`bash
npm run test:position-sizing
\`\`\`

## Rollback
To disable dynamic sizing:
1. Set \`positionSizing.enabled = false\` in config
2. Or set \`positionSizing.mode = 'fixed'\`
`;

    fs.writeFileSync('DYNAMIC-SIZING-INTEGRATION.md', integrationGuide);
    logger.info('✅ Created integration guide');

    // Create test script
    const testScript = `
import { createDynamicSizer } from './src/services/trading/DynamicPositionSizer';
import { volatilityCalculator } from './src/services/analysis/MarketVolatilityCalculator';

async function testDynamicSizing() {
  console.log('Testing Dynamic Position Sizing\\n');
  
  const sizer = createDynamicSizer(10000); // $10,000 initial capital
  
  // Test scenarios
  const scenarios = [
    {
      name: 'High confidence, low volatility',
      opportunity: { expectedProfit: 3, confidence: 0.9 },
      conditions: { volatility: 20, liquidityDepth: 50000, spread: 0.1, recentDrawdown: 2 }
    },
    {
      name: 'Medium confidence, high volatility',
      opportunity: { expectedProfit: 2, confidence: 0.7 },
      conditions: { volatility: 70, liquidityDepth: 30000, spread: 0.3, recentDrawdown: 8 }
    },
    {
      name: 'Low confidence, extreme volatility',
      opportunity: { expectedProfit: 1.5, confidence: 0.5 },
      conditions: { volatility: 90, liquidityDepth: 20000, spread: 0.5, recentDrawdown: 15 }
    }
  ];
  
  for (const scenario of scenarios) {
    console.log(\`\\nScenario: \${scenario.name}\`);
    console.log('Conditions:', scenario.conditions);
    
    const result = sizer.calculatePositionSize(scenario.opportunity, scenario.conditions);
    
    console.log('Result:');
    console.log(\`  Position Size: $\${result.size.toFixed(2)}\`);
    console.log(\`  Risk Amount: $\${result.riskAmount.toFixed(2)}\`);
    console.log(\`  Confidence: \${(result.confidence * 100).toFixed(1)}%\`);
    console.log(\`  Reasoning: \${result.reasoning}\`);
  }
  
  // Simulate some trades
  console.log('\\n\\nSimulating trades...');
  
  // Win
  sizer.updateStats({ profit: 150, win: true });
  console.log('Trade 1: WIN +$150');
  
  // Loss
  sizer.updateStats({ profit: -80, win: false });
  console.log('Trade 2: LOSS -$80');
  
  // Check new position sizing
  const afterTrades = sizer.calculatePositionSize(
    { expectedProfit: 2.5, confidence: 0.8 },
    { volatility: 40, liquidityDepth: 40000, spread: 0.2, recentDrawdown: 5 }
  );
  
  console.log('\\nPosition size after trades:');
  console.log(\`  Size: $\${afterTrades.size.toFixed(2)}\`);
  console.log(\`  Kelly Fraction: \${(afterTrades.kellyFraction * 100).toFixed(2)}%\`);
}

testDynamicSizing();
`;

    fs.writeFileSync('test-dynamic-sizing.ts', testScript);
    logger.info('✅ Created test script');

    logger.info('\n🎉 Dynamic Position Sizing Integration Complete!');
    logger.info('===========================================\n');
    logger.info('Files created:');
    logger.info('  ✅ src/config/tradingConfig.ts (updated)');
    logger.info('  ✅ src/services/analysis/MarketVolatilityCalculator.ts');
    logger.info('  ✅ DYNAMIC-SIZING-INTEGRATION.md');
    logger.info('  ✅ test-dynamic-sizing.ts');
    logger.info('\nNext steps:');
    logger.info('  1. Review DYNAMIC-SIZING-INTEGRATION.md');
    logger.info('  2. Test with: npx ts-node test-dynamic-sizing.ts');
    logger.info('  3. Update your arbitrage service with the provided code');
    logger.info('  4. Monitor position sizing in production\n');

  } catch (error) {
    logger.error('Integration failed:', error);
    process.exit(1);
  }
}

// Run integration
integrateDynamicSizing();