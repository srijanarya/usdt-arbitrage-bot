import axios from 'axios';
import { EventEmitter } from 'events';
import { logger } from '../../utils/logger';

interface P2PMerchant {
  advertiserId: string;
  nickname: string;
  price: number;
  minAmount: number;
  maxAmount: number;
  paymentMethods: string[];
  completionRate: number;
  orderCount: number;
  isOnline: boolean;
  responseTime: number; // in minutes
}

interface P2PData {
  platform: string;
  asset: 'USDT';
  fiat: 'INR';
  side: 'BUY' | 'SELL';
  merchants: P2PMerchant[];
  timestamp: Date;
}

export class P2PScraper extends EventEmitter {
  private isRunning = false;
  private scraperInterval: NodeJS.Timeout | null = null;

  // Binance P2P API endpoint (unofficial but works)
  private readonly BINANCE_P2P_API = 'https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search';
  
  async scrapeBinanceP2P(side: 'BUY' | 'SELL'): Promise<P2PMerchant[]> {
    try {
      const payload = {
        asset: 'USDT',
        fiat: 'INR',
        merchantCheck: false,
        page: 1,
        payTypes: [], // All payment methods
        publisherType: null,
        rows: 20,
        tradeType: side,
        transAmount: '10000' // 10k INR default
      };

      const response = await axios.post(this.BINANCE_P2P_API, payload, {
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      if (response.data && response.data.data) {
        return response.data.data.map((ad: any) => ({
          advertiserId: ad.advertiser.userNo,
          nickname: ad.advertiser.nickName,
          price: parseFloat(ad.adv.price),
          minAmount: parseFloat(ad.adv.minSingleTransAmount),
          maxAmount: parseFloat(ad.adv.maxSingleTransAmount),
          paymentMethods: ad.adv.tradeMethods.map((m: any) => this.mapPaymentMethod(m.identifier)),
          completionRate: ad.advertiser.monthFinishRate * 100,
          orderCount: ad.advertiser.monthOrderCount,
          isOnline: ad.advertiser.isOnline,
          responseTime: ad.advertiser.avgReleaseTime || 15
        }));
      }
      return [];
    } catch (error) {
      logger.error('Error scraping Binance P2P:', error);
      return [];
    }
  }

  private mapPaymentMethod(identifier: string): string {
    const methodMap: { [key: string]: string } = {
      'Paytm': 'Paytm',
      'UPI': 'UPI',
      'IMPS': 'IMPS',
      'BankTransfer': 'Bank Transfer',
      'PhonePe': 'PhonePe',
      'GooglePay': 'Google Pay'
    };
    return methodMap[identifier] || identifier;
  }

  async getP2PPrices(side: 'SELL' = 'SELL'): Promise<P2PData> {
    const merchants = await this.scrapeBinanceP2P(side);
    
    // Filter for high-quality merchants
    const filteredMerchants = merchants
      .filter(m => m.completionRate >= 95 && m.orderCount >= 100)
      .sort((a, b) => side === 'SELL' ? a.price - b.price : b.price - a.price)
      .slice(0, 10); // Top 10 merchants

    return {
      platform: 'Binance P2P',
      asset: 'USDT',
      fiat: 'INR',
      side,
      merchants: filteredMerchants,
      timestamp: new Date()
    };
  }

  async compareWithExchanges(): Promise<any> {
    try {
      // Get P2P sell prices (where we sell USDT)
      const p2pSellData = await this.getP2PPrices('SELL');
      
      // Get exchange prices (where we buy USDT)
      const exchangePrices = await this.getExchangePrices();
      
      // Find best opportunities
      const opportunities = [];
      
      for (const [exchange, buyPrice] of Object.entries(exchangePrices)) {
        for (const merchant of p2pSellData.merchants) {
          const grossProfit = merchant.price - buyPrice;
          const grossProfitPercent = (grossProfit / buyPrice) * 100;
          
          // Calculate fees
          const exchangeFee = buyPrice * 0.001; // 0.1% average
          const withdrawalFee = 1 * buyPrice; // 1 USDT in INR
          const tds = merchant.price > 50000 ? merchant.price * 0.01 : 0;
          
          const totalCost = buyPrice + exchangeFee + withdrawalFee;
          const netRevenue = merchant.price - tds;
          const netProfitBeforeTax = netRevenue - totalCost;
          const capitalGainsTax = netProfitBeforeTax > 0 ? netProfitBeforeTax * 0.30 : 0;
          const netProfit = netProfitBeforeTax - capitalGainsTax;
          const netProfitPercent = (netProfit / buyPrice) * 100;
          
          if (netProfitPercent > 0.5) { // Only profitable opportunities
            opportunities.push({
              buyExchange: exchange,
              buyPrice: buyPrice.toFixed(2),
              sellPlatform: 'Binance P2P',
              merchant: merchant.nickname,
              sellPrice: merchant.price.toFixed(2),
              paymentMethods: merchant.paymentMethods,
              minOrder: merchant.minAmount,
              maxOrder: merchant.maxAmount,
              merchantRating: merchant.completionRate,
              grossProfitPercent: grossProfitPercent.toFixed(2),
              netProfitPercent: netProfitPercent.toFixed(2),
              profitPer100k: (netProfit * 100000 / buyPrice).toFixed(0)
            });
          }
        }
      }
      
      // Sort by net profit
      opportunities.sort((a, b) => parseFloat(b.netProfitPercent) - parseFloat(a.netProfitPercent));
      
      return {
        timestamp: new Date(),
        bestOpportunity: opportunities[0],
        topOpportunities: opportunities.slice(0, 5),
        p2pMerchantCount: p2pSellData.merchants.length,
        averageP2PPrice: (p2pSellData.merchants.reduce((sum, m) => sum + m.price, 0) / p2pSellData.merchants.length).toFixed(2)
      };
    } catch (error) {
      logger.error('Error comparing prices:', error);
      return null;
    }
  }

  private async getExchangePrices(): Promise<{ [key: string]: number }> {
    // In production, fetch real prices from exchange APIs
    // For now, using realistic market prices
    return {
      'CoinDCX': 87.20 + (Math.random() - 0.5) * 0.5,
      'WazirX': 87.50 + (Math.random() - 0.5) * 0.5,
      'Giottus': 88.10 + (Math.random() - 0.5) * 0.5,
      'CoinSwitch': 88.13 + (Math.random() - 0.5) * 0.5,
      'ZebPay': 87.90 + (Math.random() - 0.5) * 0.5
    };
  }

  async startMonitoring(intervalMinutes: number = 5) {
    this.isRunning = true;
    logger.info(`Starting P2P price monitoring every ${intervalMinutes} minutes`);
    
    // Initial scan
    await this.runScan();
    
    // Set up interval
    this.scraperInterval = setInterval(async () => {
      if (this.isRunning) {
        await this.runScan();
      }
    }, intervalMinutes * 60 * 1000);
  }

  private async runScan() {
    logger.info('Running P2P price scan...');
    
    const comparison = await this.compareWithExchanges();
    
    if (comparison && comparison.bestOpportunity) {
      logger.info(`Best P2P Opportunity: Buy on ${comparison.bestOpportunity.buyExchange} @ ₹${comparison.bestOpportunity.buyPrice}, Sell to ${comparison.bestOpportunity.merchant} @ ₹${comparison.bestOpportunity.sellPrice}`);
      logger.info(`Net Profit: ${comparison.bestOpportunity.netProfitPercent}% (₹${comparison.bestOpportunity.profitPer100k} per ₹1,00,000)`);
      
      this.emit('opportunity', comparison.bestOpportunity);
      
      // Alert for high profit opportunities
      if (parseFloat(comparison.bestOpportunity.netProfitPercent) > 1.5) {
        this.emit('high-profit-alert', comparison.bestOpportunity);
      }
    }
    
    this.emit('scan-complete', comparison);
  }

  stopMonitoring() {
    this.isRunning = false;
    if (this.scraperInterval) {
      clearInterval(this.scraperInterval);
      this.scraperInterval = null;
    }
    logger.info('Stopped P2P monitoring');
  }

  async getRecommendedMerchants(minRating: number = 98, minOrders: number = 500): Promise<P2PMerchant[]> {
    const data = await this.getP2PPrices('SELL');
    
    return data.merchants
      .filter(m => m.completionRate >= minRating && m.orderCount >= minOrders)
      .sort((a, b) => b.completionRate - a.completionRate);
  }
}

// Export singleton instance
export const p2pScraper = new P2PScraper();