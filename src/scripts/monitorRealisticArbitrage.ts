import chalk from 'chalk';
import axios from 'axios';
import { arbitrageCalculator } from '../services/arbitrage/USDTArbitrageCalculator';
import Table from 'cli-table3';

interface ExchangePrice {
  exchange: string;
  buyPrice: number;
  sellPrice: number;
  available: boolean;
  minQuantity: number;
  lastUpdate: Date;
}

class RealisticArbitrageMonitor {
  private prices: Map<string, ExchangePrice> = new Map();
  private updateInterval: NodeJS.Timeout | null = null;
  
  // Realistic P2P sell prices
  private readonly p2pSellPrices = {
    express: 86.17,    // IMPS Express rate
    regular: 90.00,    // Regular P2P (competitive)
    premium: 92.00     // Premium P2P (less common)
  };

  async start() {
    console.log(chalk.bgCyan.black(' 🚀 Realistic Arbitrage Monitor Started \n'));
    
    // Initial fetch
    await this.fetchAllPrices();
    
    // Display initial analysis
    this.displayDashboard();
    
    // Update every 30 seconds
    this.updateInterval = setInterval(async () => {
      await this.fetchAllPrices();
      this.displayDashboard();
    }, 30000);
  }

  async fetchAllPrices() {
    const fetchers = [
      this.fetchZebPayPrice(),
      this.fetchCoinDCXPrice(),
      this.fetchBinanceP2PBuyPrice(),
      this.fetchKuCoinPrice()
    ];
    
    await Promise.allSettled(fetchers);
  }

  async fetchZebPayPrice() {
    try {
      const response = await axios.get('https://www.zebapi.com/pro/v1/market/USDT-INR/ticker');
      this.prices.set('zebpay', {
        exchange: 'ZebPay',
        buyPrice: parseFloat(response.data.sell),
        sellPrice: parseFloat(response.data.buy),
        available: true,
        minQuantity: 10,
        lastUpdate: new Date()
      });
    } catch (error) {
      console.error(chalk.red('ZebPay fetch error'));
    }
  }

  async fetchCoinDCXPrice() {
    try {
      const response = await axios.get('https://public.coindcx.com/exchange/ticker');
      const usdtInr = response.data.find((pair: any) => pair.market === 'USDTINR');
      if (usdtInr) {
        this.prices.set('coindcx', {
          exchange: 'CoinDCX',
          buyPrice: parseFloat(usdtInr.ask),
          sellPrice: parseFloat(usdtInr.bid),
          available: false, // Withdrawals disabled
          minQuantity: 5,
          lastUpdate: new Date()
        });
      }
    } catch (error) {
      console.error(chalk.red('CoinDCX fetch error'));
    }
  }

  async fetchBinanceP2PBuyPrice() {
    try {
      const response = await axios.post(
        'https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search',
        {
          page: 1,
          rows: 10,
          asset: "USDT",
          fiat: "INR",
          tradeType: "BUY",
          transAmount: 10000
        }
      );
      
      if (response.data?.data?.length > 0) {
        // Find best legitimate seller (not too cheap)
        const legitimateSellers = response.data.data.filter((ad: any) => {
          const price = parseFloat(ad.adv.price);
          return price >= 85 && ad.advertiser.monthOrderCount > 50;
        });
        
        if (legitimateSellers.length > 0) {
          const bestPrice = parseFloat(legitimateSellers[0].adv.price);
          this.prices.set('binance_p2p', {
            exchange: 'Binance P2P',
            buyPrice: bestPrice,
            sellPrice: this.p2pSellPrices.regular,
            available: true,
            minQuantity: 1,
            lastUpdate: new Date()
          });
        }
      }
    } catch (error) {
      console.error(chalk.red('Binance P2P fetch error'));
    }
  }

  async fetchKuCoinPrice() {
    try {
      // KuCoin doesn't have direct INR pairs, so we estimate
      const response = await axios.get('https://api.kucoin.com/api/v1/market/orderbook/level1?symbol=USDT-USDC');
      if (response.data?.data) {
        const usdcPrice = parseFloat(response.data.data.price);
        const inrPrice = usdcPrice * 83.5; // Approximate USD to INR
        
        this.prices.set('kucoin', {
          exchange: 'KuCoin',
          buyPrice: inrPrice,
          sellPrice: inrPrice - 0.5,
          available: true,
          minQuantity: 1,
          lastUpdate: new Date()
        });
      }
    } catch (error) {
      console.error(chalk.red('KuCoin fetch error'));
    }
  }

  displayDashboard() {
    console.clear();
    console.log(chalk.bgCyan.black(' 💹 Realistic Arbitrage Dashboard \n'));
    console.log(chalk.gray(`Last Update: ${new Date().toLocaleTimeString()}\n`));
    
    // Display current prices
    const priceTable = new Table({
      head: ['Exchange', 'Buy Price', 'Status', 'Min Qty', 'Last Update'],
      colWidths: [15, 12, 20, 10, 15]
    });
    
    this.prices.forEach((price) => {
      const statusColor = price.available ? chalk.green : chalk.red;
      const status = price.available ? '✅ Available' : '❌ Withdrawals Off';
      
      priceTable.push([
        price.exchange,
        `₹${price.buyPrice.toFixed(2)}`,
        statusColor(status),
        `${price.minQuantity}`,
        price.lastUpdate.toLocaleTimeString()
      ]);
    });
    
    console.log(priceTable.toString());
    
    // Display arbitrage opportunities
    console.log(chalk.yellow('\n📊 Arbitrage Opportunities:\n'));
    
    const oppTable = new Table({
      head: ['Route', 'Buy', 'Sell', 'Amount', 'Net Profit', 'ROI', 'Status'],
      colWidths: [25, 10, 10, 10, 12, 8, 25]
    });
    
    // Test different sell scenarios
    const sellScenarios = [
      { name: 'P2P Express', price: this.p2pSellPrices.express },
      { name: 'Regular P2P', price: this.p2pSellPrices.regular },
      { name: 'Premium P2P', price: this.p2pSellPrices.premium }
    ];
    
    this.prices.forEach((exchangePrice) => {
      if (!exchangePrice.available) return;
      
      sellScenarios.forEach((sellScenario) => {
        const amount = 100; // Standard amount
        const analysis = arbitrageCalculator.calculateProfit(
          exchangePrice.buyPrice,
          sellScenario.price,
          amount,
          exchangePrice.exchange.toLowerCase().replace(' ', '_')
        );
        
        let status = '';
        let statusColor = chalk.red;
        
        if (!analysis.meetsMinQuantity) {
          status = '❌ Below min quantity';
        } else if (!analysis.profitable) {
          status = '❌ Not profitable';
        } else if (analysis.netProfit < 100) {
          status = '⚠️  Low profit';
          statusColor = chalk.yellow;
        } else if (analysis.netProfit < 200) {
          status = '✅ Profitable';
          statusColor = chalk.green;
        } else {
          status = '🚀 High profit!';
          statusColor = chalk.green;
        }
        
        oppTable.push([
          `${exchangePrice.exchange} → ${sellScenario.name}`,
          `₹${exchangePrice.buyPrice.toFixed(2)}`,
          `₹${sellScenario.price.toFixed(2)}`,
          `${amount}`,
          analysis.profitable ? chalk.green(`₹${analysis.netProfit.toFixed(2)}`) : chalk.red(`₹${analysis.netProfit.toFixed(2)}`),
          `${analysis.roi.toFixed(1)}%`,
          statusColor(status)
        ]);
      });
    });
    
    console.log(oppTable.toString());
    
    // Find best opportunities
    this.findBestOpportunities();
    
    // Display recommendations
    this.displayRecommendations();
    
    console.log(chalk.gray('\n⏳ Refreshing every 30 seconds... Press Ctrl+C to stop'));
  }

  findBestOpportunities() {
    console.log(chalk.bgGreen.black('\n 🎯 Best Opportunities \n'));
    
    let bestOpportunity = {
      route: '',
      profit: -Infinity,
      roi: -Infinity,
      buyPrice: 0,
      sellPrice: 0
    };
    
    this.prices.forEach((exchangePrice) => {
      if (!exchangePrice.available) return;
      
      // Check regular P2P (most realistic)
      const analysis = arbitrageCalculator.calculateProfit(
        exchangePrice.buyPrice,
        this.p2pSellPrices.regular,
        100,
        exchangePrice.exchange.toLowerCase().replace(' ', '_')
      );
      
      if (analysis.profitable && analysis.netProfit > bestOpportunity.profit) {
        bestOpportunity = {
          route: `${exchangePrice.exchange} → Regular P2P`,
          profit: analysis.netProfit,
          roi: analysis.roi,
          buyPrice: exchangePrice.buyPrice,
          sellPrice: this.p2pSellPrices.regular
        };
      }
    });
    
    if (bestOpportunity.profit > 0) {
      console.log(chalk.green(`Best Route: ${bestOpportunity.route}`));
      console.log(`Buy at: ₹${bestOpportunity.buyPrice.toFixed(2)}`);
      console.log(`Sell at: ₹${bestOpportunity.sellPrice.toFixed(2)}`);
      console.log(`Expected Profit: ₹${bestOpportunity.profit.toFixed(2)} (${bestOpportunity.roi.toFixed(2)}% ROI)`);
    } else {
      console.log(chalk.red('No profitable opportunities found with realistic prices'));
    }
  }

  displayRecommendations() {
    console.log(chalk.bgYellow.black('\n 💡 Recommendations \n'));
    
    const zebpayPrice = this.prices.get('zebpay')?.buyPrice || 0;
    const p2pBuyPrice = this.prices.get('binance_p2p')?.buyPrice || 0;
    
    if (zebpayPrice > 0 && zebpayPrice < 85) {
      console.log(chalk.green('✅ ZebPay price below ₹85 - Consider arbitrage'));
    } else if (zebpayPrice > 88) {
      console.log(chalk.red('❌ ZebPay too expensive for profitable arbitrage'));
    }
    
    if (p2pBuyPrice > 0 && p2pBuyPrice < 88) {
      console.log(chalk.green('✅ Found P2P sellers below ₹88 - Direct P2P arbitrage possible'));
    }
    
    console.log(chalk.yellow('\n📌 General Tips:'));
    console.log('• Realistic P2P sell price is ₹90 (not ₹94.75)');
    console.log('• Need buy price below ₹84-85 for good profits');
    console.log('• Consider transaction fees and minimum quantities');
    console.log('• Test with small amounts first');
  }

  stop() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      console.log(chalk.yellow('\n\nMonitor stopped'));
    }
  }
}

// Run the monitor
const monitor = new RealisticArbitrageMonitor();

// Handle graceful shutdown
process.on('SIGINT', () => {
  monitor.stop();
  process.exit(0);
});

// Start monitoring
monitor.start().catch(console.error);