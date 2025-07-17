import { EventEmitter } from 'events';
import axios from 'axios';
import { logger } from '../../utils/logger';
import { config } from 'dotenv';

config();

interface P2PAdvert {
  advertiser: {
    nickName: string;
    monthOrderCount: number;
    monthFinishRate: number;
    positiveRate: number;
  };
  adv: {
    advNo: string;
    price: string;
    surplusAmount: string;
    minSingleTransAmount: string;
    maxSingleTransAmount: string;
    dynamicMaxSingleTransAmount: string;
    tradeMethods: Array<{
      identifier: string;
      tradeMethodName: string;
    }>;
  };
}

interface P2POpportunity {
  price: number;
  amount: number;
  advertiserName: string;
  minAmount: number;
  maxAmount: number;
  paymentMethods: string[];
  completionRate: number;
  monthlyOrders: number;
}

export class BinanceP2PMonitor extends EventEmitter {
  private isMonitoring: boolean = false;
  private checkInterval: NodeJS.Timeout | null = null;
  private lastPrices: Map<string, number> = new Map();
  private targetProfit: number = 1.5; // 1.5% minimum profit
  private checkIntervalMs: number = 30000; // 30 seconds
  private aggressiveMode: boolean = false;
  private minProfit: number = 0.5; // Minimum 0.5% profit in aggressive mode
  private quickSellThreshold: number = 0.8; // 0.8% for quick sells
  private priceHistory: number[] = [];
  private maxPriceHistory: number = 20;

  constructor() {
    super();
  }

  async start(buyPrice?: number) {
    logger.info('🚀 Starting Binance P2P sell monitoring...');
    this.isMonitoring = true;
    
    if (buyPrice) {
      logger.info(`📊 Your buy price: ₹${buyPrice}`);
      logger.info(`🎯 Target sell price: ₹${(buyPrice * (1 + this.targetProfit / 100)).toFixed(2)} (${this.targetProfit}% profit)`);
    }

    // Initial check
    await this.checkP2PSellPrices(buyPrice);

    // Set up periodic monitoring
    this.checkInterval = setInterval(async () => {
      if (this.isMonitoring) {
        await this.checkP2PSellPrices(buyPrice);
      }
    }, this.checkIntervalMs);
  }

  stop() {
    logger.info('🛑 Stopping P2P monitoring...');
    this.isMonitoring = false;
    
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  setTargetProfit(percentage: number) {
    this.targetProfit = percentage;
    logger.info(`🎯 Target profit updated to ${percentage}%`);
  }

  enableAggressiveMode(enable: boolean = true) {
    this.aggressiveMode = enable;
    if (enable) {
      this.checkIntervalMs = 10000; // 10 seconds in aggressive mode
      this.minProfit = 0.3; // Accept 0.3% profit minimum
      logger.info('🚀 AGGRESSIVE MODE ENABLED - Fast monitoring, lower profit margins');
      
      // Restart monitoring with new interval
      if (this.isMonitoring) {
        this.stop();
        this.start();
      }
    } else {
      this.checkIntervalMs = 30000; // Back to 30 seconds
      this.minProfit = 0.5;
      logger.info('🔄 Aggressive mode DISABLED');
    }
  }

  setMinProfit(minProfit: number) {
    this.minProfit = minProfit;
    logger.info(`💰 Minimum profit set to ${minProfit}%`);
  }

  getMarketTrend(): 'rising' | 'falling' | 'stable' {
    if (this.priceHistory.length < 3) return 'stable';
    
    const recent = this.priceHistory.slice(-5);
    const avg = recent.reduce((a, b) => a + b, 0) / recent.length;
    const current = this.priceHistory[this.priceHistory.length - 1];
    
    const change = ((current - avg) / avg) * 100;
    
    if (change > 0.5) return 'rising';
    if (change < -0.5) return 'falling';
    return 'stable';
  }

  private async checkP2PSellPrices(buyPrice?: number) {
    try {
      const sellAds = await this.fetchP2PSellAds();
      
      if (sellAds.length === 0) {
        logger.warn('No P2P sell ads found');
        return;
      }

      // Get top 5 prices
      const topPrices = sellAds.slice(0, 5).map(ad => ({
        price: parseFloat(ad.adv.price),
        min: parseFloat(ad.adv.minSingleTransAmount),
        max: parseFloat(ad.adv.maxSingleTransAmount || ad.adv.dynamicMaxSingleTransAmount),
        advertiser: ad.advertiser.nickName,
        completionRate: ad.advertiser.monthFinishRate,
        methods: ad.adv.tradeMethods.map(m => m.tradeMethodName)
      }));

      const avgPrice = topPrices.reduce((sum, p) => sum + p.price, 0) / topPrices.length;
      const bestPrice = topPrices[0].price;

      logger.info(`📈 P2P Sell Prices - Best: ₹${bestPrice}, Avg Top 5: ₹${avgPrice.toFixed(2)}`);

      // Track price history for trend analysis
      this.priceHistory.push(bestPrice);
      if (this.priceHistory.length > this.maxPriceHistory) {
        this.priceHistory.shift();
      }

      // Check for profitable opportunities
      if (buyPrice) {
        const profit = ((bestPrice - buyPrice) / buyPrice) * 100;
        const profitThreshold = this.aggressiveMode ? this.minProfit : this.targetProfit;
        const trend = this.getMarketTrend();
        
        // In aggressive mode, consider market trend
        let shouldAlert = false;
        if (this.aggressiveMode) {
          if (trend === 'falling' && profit >= this.minProfit) {
            // Sell quickly in falling market
            shouldAlert = true;
            logger.info(`📉 FALLING MARKET - Quick sell opportunity at ${profit.toFixed(2)}% profit`);
          } else if (trend === 'rising' && profit >= this.quickSellThreshold) {
            // Wait for better price in rising market
            shouldAlert = profit >= this.targetProfit;
          } else if (profit >= profitThreshold) {
            shouldAlert = true;
          }
        } else {
          shouldAlert = profit >= this.targetProfit;
        }
        
        if (shouldAlert) {
          logger.info(`💰 ${this.aggressiveMode ? 'QUICK SELL' : 'PROFITABLE'} OPPORTUNITY FOUND!`);
          logger.info(`   Buy Price: ₹${buyPrice}`);
          logger.info(`   Sell Price: ₹${bestPrice}`);
          logger.info(`   Profit: ${profit.toFixed(2)}% (₹${(bestPrice - buyPrice).toFixed(2)} per USDT)`);
          
          const opportunity: P2POpportunity = {
            price: bestPrice,
            amount: 0, // Will be set based on user's balance
            advertiserName: topPrices[0].advertiser,
            minAmount: topPrices[0].min,
            maxAmount: topPrices[0].max,
            paymentMethods: topPrices[0].methods,
            completionRate: topPrices[0].completionRate,
            monthlyOrders: 0
          };

          this.emit('profitableOpportunity', opportunity);
        } else if (profit > 0) {
          logger.info(`📊 Current profit: ${profit.toFixed(2)}% (Below target of ${this.targetProfit}%)`);
        } else {
          logger.warn(`⚠️ Loss warning: ${profit.toFixed(2)}% (Sell price below buy price)`);
        }
      }

      // Price trend detection
      const lastPrice = this.lastPrices.get('binance') || 0;
      if (lastPrice > 0) {
        const priceChange = ((bestPrice - lastPrice) / lastPrice) * 100;
        if (Math.abs(priceChange) > 0.5) {
          const direction = priceChange > 0 ? '📈 UP' : '📉 DOWN';
          logger.info(`${direction} ${Math.abs(priceChange).toFixed(2)}% - Price moved from ₹${lastPrice} to ₹${bestPrice}`);
          
          this.emit('priceChange', {
            exchange: 'binance',
            oldPrice: lastPrice,
            newPrice: bestPrice,
            change: priceChange
          });
        }
      }
      
      this.lastPrices.set('binance', bestPrice);

      // Emit current market data
      this.emit('marketUpdate', {
        exchange: 'binance',
        bestPrice,
        avgPrice,
        topAds: topPrices,
        timestamp: new Date()
      });

    } catch (error) {
      logger.error('Error checking P2P prices:', error);
      this.emit('error', error);
    }
  }

  private async fetchP2PSellAds(): Promise<P2PAdvert[]> {
    try {
      const response = await axios.post(
        'https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search',
        {
          page: 1,
          rows: this.aggressiveMode ? 10 : 20, // Fetch less in aggressive mode for speed
          payTypes: ["UPI"], // Focus on UPI payments
          publisherType: null,
          tradeType: "SELL", // We want to sell USDT
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

      return response.data.data || [];
    } catch (error) {
      logger.error('Failed to fetch P2P ads:', error);
      return [];
    }
  }

  async getMyP2PBalance(): Promise<number> {
    try {
      // This would use Binance API to get P2P wallet balance
      // For now, return the known balance
      return 11.5; // Your current USDT balance
    } catch (error) {
      logger.error('Failed to get P2P balance:', error);
      return 0;
    }
  }

  async createSellOrder(price: number, amount: number): Promise<boolean> {
    try {
      logger.info(`📝 Creating P2P sell order: ${amount} USDT @ ₹${price}`);
      
      // This would use the P2P order creation API
      // For now, we'll use the existing order manager
      
      this.emit('orderCreated', {
        price,
        amount,
        type: 'sell',
        exchange: 'binance'
      });

      return true;
    } catch (error) {
      logger.error('Failed to create sell order:', error);
      return false;
    }
  }
}

// Export singleton instance
export const binanceP2PMonitor = new BinanceP2PMonitor();