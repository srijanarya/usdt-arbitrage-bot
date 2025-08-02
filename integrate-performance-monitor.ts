import { performanceMonitor } from './src/services/monitoring/PerformanceMonitorAPI';
import { logger } from './src/utils/logger';

// Integration helper for existing bot

export class PerformanceIntegration {
  private static apiLatencyTracker = new Map<string, number>();
  
  /**
   * Start performance monitoring
   */
  static async initialize() {
    try {
      await performanceMonitor.start();
      logger.info('Performance monitoring initialized');
    } catch (error) {
      logger.error('Failed to start performance monitor:', error);
    }
  }
  
  /**
   * Track API call latency
   */
  static trackApiCall(exchange: string, startTime: number) {
    const latency = Date.now() - startTime;
    performanceMonitor.updateApiLatency(latency);
    
    // Store for exchange-specific tracking
    if (!this.apiLatencyTracker.has(exchange)) {
      this.apiLatencyTracker.set(exchange, 0);
    }
    const current = this.apiLatencyTracker.get(exchange)!;
    this.apiLatencyTracker.set(exchange, (current + latency) / 2);
  }
  
  /**
   * Record trade execution
   */
  static recordTrade(trade: {
    pair: string;
    type: 'buy' | 'sell';
    amount: number;
    price: number;
    profit: number;
  }) {
    performanceMonitor.recordTrade({
      pair: trade.pair,
      type: trade.type,
      profit: trade.profit
    });
  }
  
  /**
   * Update active positions
   */
  static updatePositions(positions: number) {
    performanceMonitor.updateMetric('activePositions', positions);
  }
  
  /**
   * Get exchange latencies
   */
  static getExchangeLatencies() {
    const result: Record<string, number> = {};
    this.apiLatencyTracker.forEach((latency, exchange) => {
      result[exchange] = Math.round(latency);
    });
    return result;
  }
}

// Example integration in your bot:
/*
// In your main bot file:
import { PerformanceIntegration } from './integrate-performance-monitor';

// On startup:
await PerformanceIntegration.initialize();

// When making API calls:
const startTime = Date.now();
const data = await binanceClient.fetchTicker('USDT/INR');
PerformanceIntegration.trackApiCall('binance', startTime);

// After executing trades:
PerformanceIntegration.recordTrade({
  pair: 'USDT/INR',
  type: 'buy',
  amount: 100,
  price: 88.5,
  profit: 250
});

// Update positions:
PerformanceIntegration.updatePositions(activeOrders.length);
*/
