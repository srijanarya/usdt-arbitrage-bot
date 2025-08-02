
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
    
    logger.debug(`Volatility for ${symbol}: ${volatilityScore.toFixed(2)}`);
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
