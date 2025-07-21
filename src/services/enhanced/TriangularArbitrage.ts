import { logger } from '../../utils/logger';

interface TriangularOpportunity {
  path: string[];
  profit: number;
  profitPercent: number;
  volume: number;
  fees: number;
  exchange: string;
  timestamp: Date;
}

interface PriceData {
  [pair: string]: {
    bid: number;
    ask: number;
    volume: number;
  };
}

export class TriangularArbitrageEngine {
  private minProfit: number;

  constructor(minProfit: number = 0.5) {
    this.minProfit = minProfit;
  }

  /**
   * Find triangular arbitrage opportunities
   * Example: USDT -> BTC -> ETH -> USDT
   */
  findOpportunities(priceData: PriceData, exchange: string): TriangularOpportunity[] {
    const opportunities: TriangularOpportunity[] = [];
    
    // Common triangular paths for USDT
    const paths = [
      ['USDT', 'BTC', 'ETH', 'USDT'],
      ['USDT', 'ETH', 'BTC', 'USDT'],
      ['USDT', 'BNB', 'BTC', 'USDT'],
      ['USDT', 'BTC', 'BNB', 'USDT'],
      ['USDT', 'ETH', 'BNB', 'USDT'],
      ['USDT', 'BNB', 'ETH', 'USDT'],
    ];

    for (const path of paths) {
      const opportunity = this.calculateTriangularProfit(path, priceData, exchange);
      if (opportunity && opportunity.profitPercent > this.minProfit) {
        opportunities.push(opportunity);
      }
    }

    return opportunities.sort((a, b) => b.profitPercent - a.profitPercent);
  }

  private calculateTriangularProfit(
    path: string[],
    priceData: PriceData,
    exchange: string
  ): TriangularOpportunity | null {
    try {
      let amount = 1000; // Start with ₹1000 worth
      const fees = 0.1; // 0.1% per trade
      let totalFees = 0;

      // Execute trades along the path
      for (let i = 0; i < path.length - 1; i++) {
        const from = path[i];
        const to = path[i + 1];
        const pair = this.getPairSymbol(from, to, priceData);
        
        if (!pair || !priceData[pair]) {
          return null; // Path not available
        }

        const price = priceData[pair];
        
        // Calculate trade
        if (pair.startsWith(from)) {
          // Selling 'from' to get 'to'
          amount = amount * price.bid;
        } else {
          // Buying 'to' with 'from'
          amount = amount / price.ask;
        }

        // Apply fees
        const tradeFee = amount * (fees / 100);
        amount -= tradeFee;
        totalFees += fees;
      }

      const profit = amount - 1000;
      const profitPercent = (profit / 1000) * 100;

      if (profitPercent > 0) {
        return {
          path,
          profit,
          profitPercent,
          volume: this.calculateOptimalVolume(path, priceData),
          fees: totalFees,
          exchange,
          timestamp: new Date(),
        };
      }

      return null;
    } catch (error) {
      logger.error('Error calculating triangular profit:', error);
      return null;
    }
  }

  private getPairSymbol(from: string, to: string, priceData: PriceData): string | null {
    // Check direct pair
    const direct = `${from}/${to}`;
    if (priceData[direct]) return direct;

    // Check reverse pair
    const reverse = `${to}/${from}`;
    if (priceData[reverse]) return reverse;

    return null;
  }

  private calculateOptimalVolume(path: string[], priceData: PriceData): number {
    // Calculate the maximum volume we can trade based on liquidity
    let minVolume = Infinity;

    for (let i = 0; i < path.length - 1; i++) {
      const pair = this.getPairSymbol(path[i], path[i + 1], priceData);
      if (pair && priceData[pair]) {
        minVolume = Math.min(minVolume, priceData[pair].volume * 0.05); // Use 5% of volume
      }
    }

    // Cap at reasonable amounts
    return Math.min(minVolume, 50000); // Max ₹50,000 per triangular trade
  }

  /**
   * Execute triangular arbitrage
   * WARNING: This is simplified - real execution is complex
   */
  async executeTriangularArbitrage(
    opportunity: TriangularOpportunity,
    exchange: any,
    amount: number
  ): Promise<any> {
    const results = [];
    let currentAmount = amount;

    try {
      for (let i = 0; i < opportunity.path.length - 1; i++) {
        const from = opportunity.path[i];
        const to = opportunity.path[i + 1];
        const pair = `${from}/${to}`;

        logger.info(`Executing ${from} -> ${to} with ${currentAmount}`);

        // Execute market order
        const order = await exchange.createMarketOrder(
          pair,
          'buy', // Simplified - should determine buy/sell
          currentAmount
        );

        results.push(order);
        
        // Update amount for next leg
        currentAmount = order.filled * order.price * 0.999; // Account for fees
      }

      return {
        success: true,
        orders: results,
        finalAmount: currentAmount,
        profit: currentAmount - amount,
      };

    } catch (error) {
      logger.error('Triangular arbitrage execution failed:', error);
      
      // TODO: Implement rollback logic
      throw error;
    }
  }
}