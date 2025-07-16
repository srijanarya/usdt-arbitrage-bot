import { EventEmitter } from 'events';
import axios from 'axios';
import { logger } from '../../utils/logger';

interface P2POrder {
  price: number;
  minAmount: number;
  maxAmount: number;
  paymentMethods: string[];
  merchantName: string;
  completionRate: number;
  orderCount: number;
}

interface ArbitrageOpportunity {
  buyExchange: string;
  buyPrice: number;
  sellPlatform: string;
  sellPrice: number;
  grossProfit: number;
  netProfit: number;
  profitPercentage: number;
  volume: number;
}

export class P2PMonitor extends EventEmitter {
  private exchangePrices: Map<string, number> = new Map();
  private p2pPrices: Map<string, P2POrder[]> = new Map();
  private isMonitoring = false;
  
  // Indian exchanges
  private exchanges = {
    'CoinDCX': { fee: 0.001, tds: 0.01 },
    'WazirX': { fee: 0, tds: 0.01 }, // 0% fee on USDT/INR
    'Giottus': { fee: 0.002, tds: 0.01 },
    'CoinSwitch': { fee: 0.001, tds: 0.01 },
  };

  // P2P platforms
  private p2pPlatforms = ['Binance P2P', 'Bybit P2P'];

  async startMonitoring() {
    this.isMonitoring = true;
    logger.info('Starting P2P monitoring...');
    
    // Monitor every 30 seconds
    while (this.isMonitoring) {
      try {
        await this.fetchExchangePrices();
        await this.fetchP2PPrices();
        this.detectOpportunities();
      } catch (error) {
        logger.error('P2P monitoring error:', error);
      }
      
      await new Promise(resolve => setTimeout(resolve, 30000));
    }
  }

  private async fetchExchangePrices() {
    // Simulated prices - in production, use actual exchange APIs
    const basePrices = {
      'CoinDCX': 87.11,
      'WazirX': 87.50,
      'Giottus': 88.10,
      'CoinSwitch': 88.13,
    };

    for (const [exchange, basePrice] of Object.entries(basePrices)) {
      // Add slight variation
      const price = basePrice + (Math.random() - 0.5) * 0.5;
      this.exchangePrices.set(exchange, price);
      logger.debug(`${exchange} USDT/INR: ₹${price.toFixed(2)}`);
    }
  }

  private async fetchP2PPrices() {
    // Simulated P2P prices - in production, scrape actual P2P platforms
    const p2pData: { [key: string]: P2POrder[] } = {
      'Binance P2P': [
        {
          price: 89.50,
          minAmount: 1000,
          maxAmount: 100000,
          paymentMethods: ['UPI', 'IMPS', 'Bank Transfer'],
          merchantName: 'CryptoKing',
          completionRate: 99.8,
          orderCount: 5432
        },
        {
          price: 90.20,
          minAmount: 5000,
          maxAmount: 500000,
          paymentMethods: ['UPI', 'Bank Transfer'],
          merchantName: 'FastTrade',
          completionRate: 100,
          orderCount: 8765
        }
      ],
      'Bybit P2P': [
        {
          price: 89.80,
          minAmount: 2000,
          maxAmount: 200000,
          paymentMethods: ['UPI', 'IMPS'],
          merchantName: 'SecureTrader',
          completionRate: 99.5,
          orderCount: 3210
        }
      ]
    };

    for (const [platform, orders] of Object.entries(p2pData)) {
      // Add variation
      const modifiedOrders = orders.map(order => ({
        ...order,
        price: order.price + (Math.random() - 0.5) * 1
      }));
      
      this.p2pPrices.set(platform, modifiedOrders);
      logger.debug(`${platform}: ${modifiedOrders.length} orders, best: ₹${modifiedOrders[0].price.toFixed(2)}`);
    }
  }

  private detectOpportunities() {
    const opportunities: ArbitrageOpportunity[] = [];
    
    // Find best buy price (exchange)
    let bestBuyExchange = '';
    let bestBuyPrice = Infinity;
    
    for (const [exchange, price] of this.exchangePrices) {
      if (price < bestBuyPrice) {
        bestBuyPrice = price;
        bestBuyExchange = exchange;
      }
    }
    
    // Find best sell prices (P2P)
    for (const [platform, orders] of this.p2pPrices) {
      for (const order of orders) {
        // Only consider high-rated merchants
        if (order.completionRate < 99) continue;
        
        const grossProfit = order.price - bestBuyPrice;
        const grossProfitPercent = (grossProfit / bestBuyPrice) * 100;
        
        // Calculate fees
        const exchangeFee = bestBuyPrice * this.exchanges[bestBuyExchange as keyof typeof this.exchanges].fee;
        const tds = order.price > 50 ? order.price * 0.01 : 0; // TDS on amounts > 50k
        const totalFees = exchangeFee + tds;
        
        const netProfitBeforeTax = grossProfit - totalFees;
        const tax = netProfitBeforeTax * 0.30; // 30% capital gains
        const netProfit = netProfitBeforeTax - tax;
        const netProfitPercent = (netProfit / bestBuyPrice) * 100;
        
        if (netProfitPercent > 0.5) { // Only show opportunities > 0.5%
          opportunities.push({
            buyExchange: bestBuyExchange,
            buyPrice: bestBuyPrice,
            sellPlatform: `${platform} - ${order.merchantName}`,
            sellPrice: order.price,
            grossProfit: grossProfitPercent,
            netProfit: netProfitPercent,
            profitPercentage: netProfitPercent,
            volume: order.maxAmount
          });
        }
      }
    }
    
    // Sort by profit
    opportunities.sort((a, b) => b.netProfit - a.netProfit);
    
    if (opportunities.length > 0) {
      logger.info(`Found ${opportunities.length} arbitrage opportunities!`);
      this.emit('opportunity', opportunities[0]);
      
      // Send Telegram alert for best opportunity
      if (opportunities[0].netProfit > 1) {
        this.emit('alert', {
          type: 'HIGH_PROFIT',
          opportunity: opportunities[0]
        });
      }
    }
  }

  async getRecommendations() {
    return {
      buyRecommendation: {
        exchange: 'CoinDCX',
        reason: 'Lowest fees and reliable INR deposits',
        alternates: ['WazirX (0% fees)', 'Giottus']
      },
      sellRecommendation: {
        platform: 'Binance P2P',
        reason: 'Highest liquidity and merchant reliability',
        tips: [
          'Choose merchants with 99%+ completion rate',
          'Prefer 1000+ completed orders',
          'Use UPI for amounts under ₹1 lakh',
          'Keep transactions under ₹50k to avoid TDS'
        ]
      },
      riskManagement: [
        'Start with ₹10,000-25,000 test trades',
        'Complete trades within 30 minutes',
        'Screenshot all payment proofs',
        'Never mention crypto in bank remarks',
        'Maintain detailed records for tax filing'
      ]
    };
  }

  stopMonitoring() {
    this.isMonitoring = false;
    logger.info('Stopped P2P monitoring');
  }
}

// Usage
const p2pMonitor = new P2PMonitor();

p2pMonitor.on('opportunity', (opp: ArbitrageOpportunity) => {
  logger.info(`
    🎯 ARBITRAGE OPPORTUNITY
    Buy: ${opp.buyExchange} @ ₹${opp.buyPrice.toFixed(2)}
    Sell: ${opp.sellPlatform} @ ₹${opp.sellPrice.toFixed(2)}
    Net Profit: ${opp.netProfit.toFixed(2)}% after all taxes
    Volume: ₹${opp.volume.toLocaleString('en-IN')}
  `);
});

export default p2pMonitor;