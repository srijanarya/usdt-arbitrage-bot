import axios from 'axios';
import { logger } from '../utils/logger';
import { binanceP2PMonitor } from '../services/p2p/binanceP2PMonitor';
import { config } from 'dotenv';

config();

interface PricingStrategy {
  buyPrice: number;
  amount: number;
  targetMargin: number; // Percentage below market average
  minProfit: number; // Minimum acceptable profit
  updateInterval: number; // How often to check and update
}

class CompetitivePricingEngine {
  private strategy: PricingStrategy;
  private currentOrderId: string | null = null;
  private isRunning: boolean = false;

  constructor(strategy: PricingStrategy) {
    this.strategy = strategy;
  }

  async start() {
    logger.info('🚀 Starting competitive pricing engine');
    this.isRunning = true;
    
    // Initial pricing
    await this.updatePricing();
    
    // Set up interval for price updates
    const interval = setInterval(async () => {
      if (!this.isRunning) {
        clearInterval(interval);
        return;
      }
      await this.updatePricing();
    }, this.strategy.updateInterval);
  }

  stop() {
    this.isRunning = false;
    logger.info('🛑 Stopping competitive pricing engine');
  }

  private async getMarketData() {
    try {
      const response = await axios.post(
        'https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search',
        {
          page: 1,
          rows: 10,
          payTypes: ["UPI"],
          publisherType: null,
          tradeType: "SELL",
          asset: "USDT",
          fiat: "INR",
          merchantCheck: false
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          }
        }
      );

      const ads = response.data.data || [];
      if (ads.length === 0) return null;

      // Analyze top 5 prices
      const topPrices = ads.slice(0, 5).map(ad => parseFloat(ad.adv.price));
      const avgPrice = topPrices.reduce((a, b) => a + b, 0) / topPrices.length;
      const minPrice = Math.min(...topPrices);
      const maxPrice = Math.max(...topPrices);

      return {
        avgPrice,
        minPrice,
        maxPrice,
        topPrice: topPrices[0],
        spread: maxPrice - minPrice,
        competitors: ads.slice(0, 5).map(ad => ({
          price: parseFloat(ad.adv.price),
          advertiser: ad.advertiser.nickName,
          minOrder: parseFloat(ad.adv.minSingleTransAmount),
          maxOrder: parseFloat(ad.adv.maxSingleTransAmount || ad.adv.dynamicMaxSingleTransAmount)
        }))
      };
    } catch (error) {
      logger.error('Failed to get market data:', error);
      return null;
    }
  }

  private calculateCompetitivePrice(marketData: any): number {
    const { avgPrice, minPrice, spread } = marketData;
    
    // Strategy: Price slightly below average but above minimum
    let targetPrice = avgPrice * (1 - this.strategy.targetMargin / 100);
    
    // If spread is narrow, be more aggressive
    if (spread < 0.5) {
      targetPrice = minPrice - 0.05; // ₹0.05 below lowest
    }
    
    // Ensure minimum profit
    const minAcceptablePrice = this.strategy.buyPrice * (1 + this.strategy.minProfit / 100);
    targetPrice = Math.max(targetPrice, minAcceptablePrice);
    
    // Round to 2 decimals
    return Math.round(targetPrice * 100) / 100;
  }

  private async updatePricing() {
    try {
      const marketData = await this.getMarketData();
      if (!marketData) return;

      const competitivePrice = this.calculateCompetitivePrice(marketData);
      const profit = ((competitivePrice - this.strategy.buyPrice) / this.strategy.buyPrice) * 100;

      console.log('\n📊 MARKET ANALYSIS');
      console.log('━'.repeat(50));
      console.log(`Market Average: ₹${marketData.avgPrice.toFixed(2)}`);
      console.log(`Market Range: ₹${marketData.minPrice.toFixed(2)} - ₹${marketData.maxPrice.toFixed(2)}`);
      console.log(`Spread: ₹${marketData.spread.toFixed(2)}`);
      console.log('\n💰 COMPETITIVE PRICING');
      console.log('━'.repeat(50));
      console.log(`Our Price: ₹${competitivePrice}`);
      console.log(`Profit: ${profit.toFixed(2)}% (₹${((competitivePrice - this.strategy.buyPrice) * this.strategy.amount).toFixed(2)})`);
      console.log(`Position: ${this.getPositionDescription(competitivePrice, marketData)}`);
      console.log('━'.repeat(50));

      // Cancel existing order if any
      if (this.currentOrderId) {
        await this.cancelOrder(this.currentOrderId);
      }

      // Create new order with competitive price
      const orderId = await this.createOrder(competitivePrice);
      if (orderId) {
        this.currentOrderId = orderId;
        logger.info(`✅ Order placed at competitive price: ₹${competitivePrice}`);
      }

    } catch (error) {
      logger.error('Failed to update pricing:', error);
    }
  }

  private getPositionDescription(ourPrice: number, marketData: any): string {
    const position = marketData.competitors.filter(c => c.price < ourPrice).length + 1;
    if (position === 1) return '🥇 MOST COMPETITIVE (Top position)';
    if (position === 2) return '🥈 2nd most competitive';
    if (position === 3) return '🥉 3rd most competitive';
    return `${position}th position`;
  }

  private async cancelOrder(orderId: string): Promise<boolean> {
    try {
      const response = await axios.post('http://localhost:3001/api/p2p/cancel', {
        orderId,
        exchange: 'binance'
      });
      
      return response.data.success;
    } catch (error) {
      logger.error('Failed to cancel order:', error);
      return false;
    }
  }

  private async createOrder(price: number): Promise<string | null> {
    try {
      const response = await axios.post('http://localhost:3001/api/p2p/execute', {
        exchange: 'binance',
        amount: this.strategy.amount,
        price: price,
        type: 'sell',
        paymentMethod: 'UPI'
      });

      if (response.data.success) {
        return response.data.orderId;
      }
      return null;
    } catch (error) {
      logger.error('Failed to create order:', error);
      return null;
    }
  }
}

// Main execution
async function main() {
  const strategy: PricingStrategy = {
    buyPrice: 89,
    amount: 11.5,
    targetMargin: 0.1, // 0.1% below market average
    minProfit: 0.3, // Minimum 0.3% profit
    updateInterval: 60000 // Update every minute
  };

  console.log('💰 COMPETITIVE PRICING STRATEGY');
  console.log('━'.repeat(50));
  console.log(`Buy Price: ₹${strategy.buyPrice}`);
  console.log(`Amount: ${strategy.amount} USDT`);
  console.log(`Min Profit: ${strategy.minProfit}%`);
  console.log(`Update Interval: ${strategy.updateInterval / 1000}s`);
  console.log('━'.repeat(50));
  console.log('\nStarting aggressive pricing engine...\n');

  const engine = new CompetitivePricingEngine(strategy);
  await engine.start();

  // Handle graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n\n🛑 Shutting down...');
    engine.stop();
    process.exit(0);
  });
}

main().catch(console.error);