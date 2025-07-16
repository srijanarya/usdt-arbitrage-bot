#!/usr/bin/env node

const axios = require('axios');
const chalk = require('chalk');
const Table = require('cli-table3');

// Configuration
const CONFIG = {
  BINANCE_P2P_API: 'https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search',
  UPDATE_INTERVAL: 60000, // 1 minute
  MIN_MERCHANT_RATING: 95,
  MIN_ORDER_COUNT: 100
};

// Exchange prices (simulated - replace with real API calls)
const EXCHANGE_PRICES = {
  'CoinDCX': 87.20,
  'WazirX': 87.50,
  'Giottus': 88.10,
  'CoinSwitch': 88.13,
  'ZebPay': 87.90
};

class P2PLiveScraper {
  constructor() {
    this.isRunning = false;
    this.lastUpdate = null;
    this.opportunities = [];
  }

  async fetchBinanceP2P(side = 'SELL', amount = '10000') {
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
        transAmount: amount
      };

      const response = await axios.post(CONFIG.BINANCE_P2P_API, payload, {
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
        },
        timeout: 10000
      });

      if (response.data && response.data.data) {
        return response.data.data.map(ad => ({
          merchant: ad.advertiser.nickName,
          price: parseFloat(ad.adv.price),
          minAmount: parseFloat(ad.adv.minSingleTransAmount),
          maxAmount: parseFloat(ad.adv.maxSingleTransAmount),
          completionRate: (ad.advertiser.monthFinishRate * 100).toFixed(1),
          orderCount: ad.advertiser.monthOrderCount,
          paymentMethods: ad.adv.tradeMethods.map(m => this.mapPaymentMethod(m.identifier)).join(', '),
          isOnline: ad.advertiser.isOnline,
          responseTime: ad.advertiser.avgReleaseTime || 15
        }));
      }
      return [];
    } catch (error) {
      console.error(chalk.red('Error fetching Binance P2P data:'), error.message);
      return [];
    }
  }

  mapPaymentMethod(identifier) {
    const methods = {
      'Paytm': 'Paytm',
      'UPI': 'UPI',
      'IMPS': 'IMPS',
      'BankTransfer': 'Bank',
      'PhonePe': 'PhonePe',
      'GooglePay': 'GPay'
    };
    return methods[identifier] || identifier;
  }

  calculateProfit(buyPrice, sellPrice, amount = 100000) {
    // Fees
    const exchangeFee = amount * 0.001; // 0.1%
    const withdrawalFee = 1 * buyPrice; // 1 USDT
    const tds = amount > 50000 ? amount * 0.01 : 0; // 1% TDS
    
    // Calculate USDT amount after fees
    const usdtBought = (amount - exchangeFee) / buyPrice;
    const usdtAfterWithdrawal = usdtBought - 1; // 1 USDT withdrawal fee
    
    // Revenue from P2P sale
    const grossRevenue = usdtAfterWithdrawal * sellPrice;
    const netRevenue = grossRevenue - tds;
    
    // Profit calculation
    const grossProfit = netRevenue - amount;
    const capitalGainsTax = grossProfit > 0 ? grossProfit * 0.30 : 0;
    const netProfit = grossProfit - capitalGainsTax;
    const netProfitPercent = (netProfit / amount) * 100;
    
    return {
      netProfit: netProfit.toFixed(2),
      netProfitPercent: netProfitPercent.toFixed(2),
      effectiveBuyPrice: (amount / usdtAfterWithdrawal).toFixed(2)
    };
  }

  async analyzeOpportunities() {
    console.log(chalk.yellow('\n🔄 Fetching live P2P prices...'));
    
    const p2pSellers = await this.fetchBinanceP2P('SELL');
    
    // Filter quality merchants
    const qualityMerchants = p2pSellers.filter(m => 
      parseFloat(m.completionRate) >= CONFIG.MIN_MERCHANT_RATING && 
      m.orderCount >= CONFIG.MIN_ORDER_COUNT &&
      m.isOnline
    );

    console.log(chalk.green(`✅ Found ${qualityMerchants.length} quality merchants\n`));

    // Calculate opportunities
    this.opportunities = [];
    
    for (const [exchange, buyPrice] of Object.entries(EXCHANGE_PRICES)) {
      // Add some price variation
      const currentBuyPrice = buyPrice + (Math.random() - 0.5) * 0.3;
      
      for (const merchant of qualityMerchants.slice(0, 5)) { // Top 5 merchants
        const profit = this.calculateProfit(currentBuyPrice, merchant.price);
        
        if (parseFloat(profit.netProfitPercent) > 0) {
          this.opportunities.push({
            exchange,
            buyPrice: currentBuyPrice.toFixed(2),
            merchant: merchant.merchant,
            sellPrice: merchant.price.toFixed(2),
            paymentMethods: merchant.paymentMethods,
            merchantRating: merchant.completionRate,
            minOrder: merchant.minAmount,
            maxOrder: merchant.maxAmount,
            netProfit: profit.netProfit,
            netProfitPercent: profit.netProfitPercent,
            effectiveBuyPrice: profit.effectiveBuyPrice
          });
        }
      }
    }

    // Sort by profit
    this.opportunities.sort((a, b) => parseFloat(b.netProfitPercent) - parseFloat(a.netProfitPercent));
    this.lastUpdate = new Date();
  }

  displayResults() {
    console.clear();
    console.log(chalk.bold.cyan('\n🚀 Live P2P Arbitrage Monitor - India'));
    console.log(chalk.gray(`Last updated: ${this.lastUpdate?.toLocaleTimeString() || 'Never'}\n`));

    if (this.opportunities.length === 0) {
      console.log(chalk.red('❌ No profitable opportunities found at the moment.'));
      return;
    }

    // Best opportunity
    const best = this.opportunities[0];
    console.log(chalk.green.bold('🎯 BEST OPPORTUNITY:'));
    console.log(chalk.white(`Buy on ${chalk.cyan(best.exchange)} @ ${chalk.yellow(`₹${best.buyPrice}`)}`));
    console.log(chalk.white(`Sell to ${chalk.magenta(best.merchant)} @ ${chalk.yellow(`₹${best.sellPrice}`)}`));
    console.log(chalk.green(`Net Profit: ${best.netProfitPercent}% (₹${best.netProfit} per ₹1,00,000)\n`));

    // Top opportunities table
    console.log(chalk.yellow('📊 Top Arbitrage Opportunities:'));
    const table = new Table({
      head: ['Buy From', 'Price', 'Sell To', 'Price', 'Payment', 'Net Profit'],
      colWidths: [12, 10, 20, 10, 20, 15]
    });

    this.opportunities.slice(0, 10).forEach(opp => {
      const profitColor = parseFloat(opp.netProfitPercent) > 1.5 ? chalk.green : chalk.yellow;
      table.push([
        chalk.cyan(opp.exchange),
        `₹${opp.buyPrice}`,
        chalk.magenta(opp.merchant.substring(0, 18)),
        `₹${opp.sellPrice}`,
        opp.paymentMethods.substring(0, 18),
        profitColor(`${opp.netProfitPercent}%`)
      ]);
    });

    console.log(table.toString());

    // Statistics
    const avgProfit = (this.opportunities.reduce((sum, opp) => sum + parseFloat(opp.netProfitPercent), 0) / this.opportunities.length).toFixed(2);
    const profitableCount = this.opportunities.filter(opp => parseFloat(opp.netProfitPercent) > 1).length;
    
    console.log(chalk.cyan('\n📈 Statistics:'));
    console.log(`• Average Net Profit: ${avgProfit}%`);
    console.log(`• Opportunities > 1%: ${profitableCount}`);
    console.log(`• Total Opportunities: ${this.opportunities.length}`);

    // Quick guide
    console.log(chalk.green('\n💡 Quick Execution Guide:'));
    console.log('1. Buy USDT on exchange using UPI/Bank Transfer');
    console.log('2. Withdraw to Binance (1 USDT fee)');
    console.log('3. Create P2P sell order matching merchant price');
    console.log('4. Complete trade with verified buyer');
    console.log('5. Keep transaction under ₹50k to avoid TDS');

    console.log(chalk.dim('\n↻ Refreshing every minute... Press Ctrl+C to exit'));
  }

  async start() {
    this.isRunning = true;
    
    // Initial fetch
    await this.analyzeOpportunities();
    this.displayResults();

    // Update loop
    setInterval(async () => {
      if (this.isRunning) {
        await this.analyzeOpportunities();
        this.displayResults();
        
        // Alert for high profit
        const highProfit = this.opportunities.find(opp => parseFloat(opp.netProfitPercent) > 2);
        if (highProfit) {
          console.log('\n' + chalk.bgGreen.black.bold(' 🚨 HIGH PROFIT ALERT! '));
          console.log(chalk.green(`${highProfit.exchange} → ${highProfit.merchant}: ${highProfit.netProfitPercent}% profit!`));
        }
      }
    }, CONFIG.UPDATE_INTERVAL);
  }

  stop() {
    this.isRunning = false;
  }
}

// Handle errors gracefully
process.on('unhandledRejection', (error) => {
  console.error(chalk.red('Error:'), error.message);
});

// Start the scraper
const scraper = new P2PLiveScraper();
scraper.start();

// Graceful shutdown
process.on('SIGINT', () => {
  console.log(chalk.yellow('\n\nShutting down...'));
  scraper.stop();
  process.exit(0);
});