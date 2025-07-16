import { EventEmitter } from 'events';
import axios from 'axios';
import { logger } from '../utils/logger';
import { PriceCalculator } from './priceCalculator';

export interface P2PMerchant {
  id: string;
  name: string;
  price: number;
  minAmount: number;
  maxAmount: number;
  completedOrders: number;
  completionRate: number;
  paymentMethods: string[];
  responseTime?: number;
  platform: string;
}

export interface P2PRate {
  platform: string;
  side: 'buy' | 'sell';
  merchants: P2PMerchant[];
  bestPrice: number;
  averagePrice: number;
  timestamp: Date;
}

export interface P2PArbitrageOpportunity {
  type: 'exchange-to-p2p' | 'p2p-to-p2p' | 'p2p-to-exchange';
  buyFrom: string;
  sellTo: string;
  buyPrice: number;
  sellPrice: number;
  profit: number;
  profitPercentage: number;
  volume: number;
  merchant?: P2PMerchant;
  estimatedTime: string;
  riskScore: number; // 1-10, lower is better
}

export interface P2PFetcherConfig {
  interval: number;
  platforms: string[];
  minCompletionRate: number;
  minOrders: number;
  maxMerchants: number;
  includeExchanges: boolean;
}

export class P2POpportunityFetcher extends EventEmitter {
  private config: P2PFetcherConfig;
  private calculator: PriceCalculator;
  private p2pRates: Map<string, P2PRate> = new Map();
  private exchangeRates: Map<string, number> = new Map();
  private fetchTimer?: NodeJS.Timer;
  private isRunning = false;

  constructor(config: Partial<P2PFetcherConfig> = {}) {
    super();
    
    this.config = {
      interval: 10000, // 10 seconds
      platforms: ['binance-p2p', 'wazirx-p2p', 'coindcx-p2p', 'local-p2p'],
      minCompletionRate: 95,
      minOrders: 100,
      maxMerchants: 10,
      includeExchanges: true,
      ...config
    };
    
    this.calculator = new PriceCalculator();
  }

  async fetchBinanceP2P(): Promise<P2PRate> {
    try {
      // Binance P2P API endpoint
      const response = await axios.post('https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search', {
        page: 1,
        rows: this.config.maxMerchants,
        asset: 'USDT',
        fiat: 'INR',
        tradeType: 'SELL', // We want to sell USDT
        publisherType: null,
        payTypes: ['UPI', 'IMPS', 'BANK_TRANSFER']
      }, {
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      const merchants: P2PMerchant[] = response.data.data.map((ad: any) => ({
        id: ad.advertiser.userNo,
        name: ad.advertiser.nickName,
        price: parseFloat(ad.adv.price),
        minAmount: parseFloat(ad.adv.minSingleTransAmount),
        maxAmount: parseFloat(ad.adv.maxSingleTransAmount),
        completedOrders: ad.advertiser.monthOrderCount,
        completionRate: parseFloat(ad.advertiser.monthFinishRate) * 100,
        paymentMethods: ad.adv.tradeMethods.map((m: any) => m.identifier),
        responseTime: ad.advertiser.avgReleaseTime,
        platform: 'binance-p2p'
      }));

      // Filter by minimum requirements
      const filteredMerchants = merchants.filter(m => 
        m.completionRate >= this.config.minCompletionRate &&
        m.completedOrders >= this.config.minOrders
      );

      const prices = filteredMerchants.map(m => m.price);
      const rate: P2PRate = {
        platform: 'binance-p2p',
        side: 'sell',
        merchants: filteredMerchants,
        bestPrice: Math.max(...prices),
        averagePrice: prices.reduce((a, b) => a + b, 0) / prices.length,
        timestamp: new Date()
      };

      return rate;
    } catch (error) {
      logger.error('Error fetching Binance P2P:', error);
      throw error;
    }
  }

  async fetchWazirXP2P(): Promise<P2PRate> {
    // Mock data for WazirX P2P
    const mockMerchants: P2PMerchant[] = [
      {
        id: 'wx001',
        name: 'CryptoTraderIN',
        price: 89.75,
        minAmount: 1000,
        maxAmount: 50000,
        completedOrders: 2500,
        completionRate: 98.5,
        paymentMethods: ['UPI', 'IMPS'],
        platform: 'wazirx-p2p'
      },
      {
        id: 'wx002',
        name: 'FastCrypto',
        price: 89.70,
        minAmount: 2000,
        maxAmount: 100000,
        completedOrders: 1800,
        completionRate: 97.8,
        paymentMethods: ['UPI', 'Bank Transfer'],
        platform: 'wazirx-p2p'
      },
      {
        id: 'wx003',
        name: 'SecureUSDT',
        price: 89.65,
        minAmount: 1000,
        maxAmount: 45000,
        completedOrders: 3200,
        completionRate: 99.1,
        paymentMethods: ['UPI'],
        platform: 'wazirx-p2p'
      }
    ];

    const prices = mockMerchants.map(m => m.price);
    return {
      platform: 'wazirx-p2p',
      side: 'sell',
      merchants: mockMerchants,
      bestPrice: Math.max(...prices),
      averagePrice: prices.reduce((a, b) => a + b, 0) / prices.length,
      timestamp: new Date()
    };
  }

  async fetchCoinDCXP2P(): Promise<P2PRate> {
    // Mock data for CoinDCX P2P
    const mockMerchants: P2PMerchant[] = [
      {
        id: 'cdx001',
        name: 'CoinMaster',
        price: 89.60,
        minAmount: 1000,
        maxAmount: 40000,
        completedOrders: 1500,
        completionRate: 97.5,
        paymentMethods: ['UPI', 'PhonePe'],
        platform: 'coindcx-p2p'
      },
      {
        id: 'cdx002',
        name: 'QuickTrade',
        price: 89.55,
        minAmount: 5000,
        maxAmount: 150000,
        completedOrders: 900,
        completionRate: 96.8,
        paymentMethods: ['IMPS', 'NEFT'],
        platform: 'coindcx-p2p'
      }
    ];

    const prices = mockMerchants.map(m => m.price);
    return {
      platform: 'coindcx-p2p',
      side: 'sell',
      merchants: mockMerchants,
      bestPrice: Math.max(...prices),
      averagePrice: prices.reduce((a, b) => a + b, 0) / prices.length,
      timestamp: new Date()
    };
  }

  async fetchLocalP2P(): Promise<P2PRate> {
    // Mock data for Local P2P platforms
    const mockMerchants: P2PMerchant[] = [
      {
        id: 'local001',
        name: 'LocalCryptoKing',
        price: 90.20,
        minAmount: 1000,
        maxAmount: 30000,
        completedOrders: 500,
        completionRate: 95.5,
        paymentMethods: ['Cash', 'UPI'],
        platform: 'local-p2p'
      },
      {
        id: 'local002',
        name: 'P2PExpress',
        price: 90.10,
        minAmount: 2000,
        maxAmount: 50000,
        completedOrders: 750,
        completionRate: 96.2,
        paymentMethods: ['UPI', 'IMPS'],
        platform: 'local-p2p'
      }
    ];

    const prices = mockMerchants.map(m => m.price);
    return {
      platform: 'local-p2p',
      side: 'sell',
      merchants: mockMerchants,
      bestPrice: Math.max(...prices),
      averagePrice: prices.reduce((a, b) => a + b, 0) / prices.length,
      timestamp: new Date()
    };
  }

  async fetchAllP2PRates() {
    const promises: Promise<P2PRate>[] = [];

    if (this.config.platforms.includes('binance-p2p')) {
      promises.push(this.fetchBinanceP2P().catch(err => {
        logger.error('Binance P2P fetch failed:', err);
        return null;
      }));
    }

    if (this.config.platforms.includes('wazirx-p2p')) {
      promises.push(this.fetchWazirXP2P().catch(err => {
        logger.error('WazirX P2P fetch failed:', err);
        return null;
      }));
    }

    if (this.config.platforms.includes('coindcx-p2p')) {
      promises.push(this.fetchCoinDCXP2P().catch(err => {
        logger.error('CoinDCX P2P fetch failed:', err);
        return null;
      }));
    }

    if (this.config.platforms.includes('local-p2p')) {
      promises.push(this.fetchLocalP2P().catch(err => {
        logger.error('Local P2P fetch failed:', err);
        return null;
      }));
    }

    const results = await Promise.all(promises);
    
    // Update rates
    results.forEach(rate => {
      if (rate) {
        this.p2pRates.set(rate.platform, rate);
        this.emit('p2pRateUpdate', rate);
      }
    });

    // Find opportunities
    this.findP2POpportunities();
  }

  updateExchangeRate(exchange: string, price: number) {
    this.exchangeRates.set(exchange, price);
  }

  findP2POpportunities() {
    const opportunities: P2PArbitrageOpportunity[] = [];
    const volume = 49900; // Under TDS limit

    // 1. Exchange to P2P opportunities
    if (this.config.includeExchanges) {
      this.exchangeRates.forEach((exchangePrice, exchangeName) => {
        this.p2pRates.forEach((p2pRate, platformName) => {
          if (p2pRate.merchants.length === 0) return;

          const bestP2PMerchant = p2pRate.merchants[0]; // Already sorted by price
          const profit = this.calculator.calculateNetProfit(
            exchangePrice,
            bestP2PMerchant.price,
            volume
          );

          if (profit.profitPercentage > 0.5) {
            opportunities.push({
              type: 'exchange-to-p2p',
              buyFrom: exchangeName,
              sellTo: platformName,
              buyPrice: exchangePrice,
              sellPrice: bestP2PMerchant.price,
              profit: profit.netProfit,
              profitPercentage: profit.profitPercentage,
              volume,
              merchant: bestP2PMerchant,
              estimatedTime: '15-20 mins',
              riskScore: this.calculateRiskScore(bestP2PMerchant)
            });
          }
        });
      });
    }

    // 2. P2P to P2P opportunities (rare but possible)
    const p2pArray = Array.from(this.p2pRates.values());
    for (let i = 0; i < p2pArray.length; i++) {
      for (let j = 0; j < p2pArray.length; j++) {
        if (i === j) continue;

        const buyP2P = p2pArray[i];
        const sellP2P = p2pArray[j];

        if (buyP2P.merchants.length === 0 || sellP2P.merchants.length === 0) continue;

        // Find cheapest buy merchant and most expensive sell merchant
        const buyMerchant = buyP2P.merchants[buyP2P.merchants.length - 1]; // Cheapest
        const sellMerchant = sellP2P.merchants[0]; // Most expensive

        const profit = this.calculator.calculateNetProfit(
          buyMerchant.price,
          sellMerchant.price,
          volume
        );

        if (profit.profitPercentage > 1.0) { // Higher threshold for P2P to P2P
          opportunities.push({
            type: 'p2p-to-p2p',
            buyFrom: buyP2P.platform,
            sellTo: sellP2P.platform,
            buyPrice: buyMerchant.price,
            sellPrice: sellMerchant.price,
            profit: profit.netProfit,
            profitPercentage: profit.profitPercentage,
            volume,
            merchant: sellMerchant,
            estimatedTime: '25-30 mins',
            riskScore: (this.calculateRiskScore(buyMerchant) + this.calculateRiskScore(sellMerchant)) / 2
          });
        }
      }
    }

    // Sort by profit percentage
    opportunities.sort((a, b) => b.profitPercentage - a.profitPercentage);

    // Emit top opportunities
    if (opportunities.length > 0) {
      this.emit('p2pOpportunitiesFound', opportunities);
      
      // Emit high profit alert
      const highProfitOpps = opportunities.filter(o => o.profitPercentage >= 2.0);
      if (highProfitOpps.length > 0) {
        this.emit('highProfitAlert', highProfitOpps[0]);
      }
    }

    return opportunities;
  }

  calculateRiskScore(merchant: P2PMerchant): number {
    let score = 5; // Base score

    // Completion rate factor
    if (merchant.completionRate >= 99) score -= 2;
    else if (merchant.completionRate >= 98) score -= 1;
    else if (merchant.completionRate < 95) score += 2;

    // Order volume factor
    if (merchant.completedOrders >= 5000) score -= 2;
    else if (merchant.completedOrders >= 1000) score -= 1;
    else if (merchant.completedOrders < 100) score += 2;

    // Response time factor
    if (merchant.responseTime && merchant.responseTime < 60) score -= 1;
    else if (merchant.responseTime && merchant.responseTime > 300) score += 1;

    // Platform factor
    if (merchant.platform === 'binance-p2p') score -= 1;
    else if (merchant.platform === 'local-p2p') score += 1;

    return Math.max(1, Math.min(10, score));
  }

  start() {
    if (this.isRunning) {
      logger.warn('P2P fetcher is already running');
      return;
    }

    this.isRunning = true;
    logger.info('Starting P2P opportunity fetcher...');

    // Initial fetch
    this.fetchAllP2PRates();

    // Start periodic fetching
    this.fetchTimer = setInterval(() => {
      this.fetchAllP2PRates();
    }, this.config.interval);

    this.emit('started');
  }

  stop() {
    if (!this.isRunning) {
      logger.warn('P2P fetcher is not running');
      return;
    }

    this.isRunning = false;
    logger.info('Stopping P2P opportunity fetcher...');

    if (this.fetchTimer) {
      clearInterval(this.fetchTimer);
      this.fetchTimer = undefined;
    }

    this.emit('stopped');
  }

  getP2PRates(): P2PRate[] {
    return Array.from(this.p2pRates.values());
  }

  getBestP2PPrice(platform?: string): number | null {
    if (platform) {
      const rate = this.p2pRates.get(platform);
      return rate ? rate.bestPrice : null;
    }

    const allPrices = Array.from(this.p2pRates.values())
      .map(r => r.bestPrice)
      .filter(p => p > 0);

    return allPrices.length > 0 ? Math.max(...allPrices) : null;
  }

  getTopMerchants(limit: number = 5): P2PMerchant[] {
    const allMerchants: P2PMerchant[] = [];
    
    this.p2pRates.forEach(rate => {
      allMerchants.push(...rate.merchants);
    });

    return allMerchants
      .sort((a, b) => b.price - a.price)
      .slice(0, limit);
  }

  getStatus() {
    return {
      isRunning: this.isRunning,
      platformsActive: this.p2pRates.size,
      totalPlatforms: this.config.platforms.length,
      lastUpdate: Array.from(this.p2pRates.values())
        .map(r => r.timestamp)
        .sort((a, b) => b.getTime() - a.getTime())[0] || null,
      totalMerchants: Array.from(this.p2pRates.values())
        .reduce((sum, rate) => sum + rate.merchants.length, 0)
    };
  }
}