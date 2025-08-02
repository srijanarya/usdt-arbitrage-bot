
import { DynamicPositionSizer, createDynamicSizer } from '../services/trading/DynamicPositionSizer';
import { logger } from '../utils/logger';

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
