const axios = require('axios');
const chalk = require('chalk');
const { exec } = require('child_process');
const Table = require('cli-table3');
const notifier = require('node-notifier');

class P2PExpressArbitrage {
  constructor() {
    this.expressRates = {
      IMPS: { rate: 0, lastUpdate: null },
      BankTransfer: { rate: 0, lastUpdate: null },
      UPI: { rate: 0, lastUpdate: null }
    };
    this.lastAlert = 0;
    this.alertCooldown = 60000; // 1 minute
    this.openedDeals = new Set();
    this.rateHistory = [];
  }

  async fetchP2PExpressSellRates() {
    // Fetch current P2P Express SELL rates
    try {
      // Fetch for each payment method separately for accuracy
      const paymentTypes = [
        { methods: ["IMPS"], name: "IMPS" },
        { methods: ["Bank Transfer"], name: "BankTransfer" },
        { methods: ["UPI"], name: "UPI" }
      ];

      for (const payType of paymentTypes) {
        try {
          const response = await axios.post(
            'https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search',
            {
              page: 1,
              rows: 1,
              payTypes: payType.methods,
              countries: [],
              proMerchantAds: false,
              asset: "USDT",
              fiat: "INR",
              tradeType: "SELL",
              merchantCheck: false,
              publisherType: "merchant"  // Express usually from merchants
            },
            {
              headers: {
                'User-Agent': 'Mozilla/5.0',
                'Content-Type': 'application/json'
              }
            }
          );

          if (response.data?.data?.[0]) {
            const rate = parseFloat(response.data.data[0].adv.price);
            const oldRate = this.expressRates[payType.name].rate;
            
            this.expressRates[payType.name] = {
              rate: rate,
              lastUpdate: new Date(),
              change: oldRate ? rate - oldRate : 0
            };
          }
        } catch (error) {
          // Keep existing rate if fetch fails
        }
      }

      // Record history
      this.rateHistory.push({
        time: new Date(),
        rates: { ...this.expressRates }
      });

      // Keep only last 50 entries
      if (this.rateHistory.length > 50) {
        this.rateHistory.shift();
      }

      return this.expressRates;
    } catch (error) {
      console.error('Error fetching express rates:', error.message);
      return this.expressRates;
    }
  }

  async findCheaperBuyRates() {
    const opportunities = [];

    // 1. Binance P2P BUY rates
    try {
      const response = await axios.post(
        'https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search',
        {
          page: 1,
          rows: 20,
          payTypes: [],  // All payment methods
          countries: [],
          proMerchantAds: false,
          asset: "USDT",
          fiat: "INR",
          tradeType: "BUY",
          merchantCheck: false
        }
      );

      if (response.data?.data) {
        response.data.data.forEach(ad => {
          const buyPrice = parseFloat(ad.adv.price);
          const methods = ad.adv.tradeMethods.map(m => m.identifier);
          
          // Find best sell rate for this ad's payment methods
          let bestSellRate = 0;
          let bestSellMethod = '';
          
          methods.forEach(method => {
            if (method === 'UPI' && this.expressRates.UPI.rate > bestSellRate) {
              bestSellRate = this.expressRates.UPI.rate;
              bestSellMethod = 'UPI';
            } else if ((method === 'IMPS' || method === 'Bank Transfer') && this.expressRates.IMPS.rate > bestSellRate) {
              bestSellRate = this.expressRates.IMPS.rate;
              bestSellMethod = 'IMPS/Bank';
            }
          });

          if (bestSellRate > 0) {
            const profit = bestSellRate - buyPrice;
            const profitPercent = (profit / buyPrice * 100);

            if (profit > 0) {
              opportunities.push({
                source: 'Binance P2P',
                buyPrice: buyPrice,
                sellPrice: bestSellRate,
                sellMethod: bestSellMethod,
                profit: profit,
                profitPercent: profitPercent,
                merchant: ad.advertiser.nickName,
                paymentMethods: methods.join(', '),
                advertId: ad.adv.advNo,
                available: parseFloat(ad.adv.surplusAmount),
                minLimit: parseFloat(ad.adv.minSingleTransAmount),
                maxLimit: parseFloat(ad.adv.maxSingleTransAmount),
                completionRate: ad.advertiser.monthFinishRate * 100,
                url: `https://p2p.binance.com/en/advertiserDetail/${ad.adv.advNo}`
              });
            }
          }
        });
      }
    } catch (error) {
      console.error('P2P error:', error.message);
    }

    // 2. Other exchanges
    const otherExchanges = [
      {
        name: 'WazirX',
        url: 'https://api.wazirx.com/api/v2/tickers/usdtinr',
        parser: (data) => parseFloat(data.ticker.buy),
        tradeUrl: 'https://wazirx.com/exchange/USDT-INR'
      },
      {
        name: 'CoinDCX',
        url: 'https://api.coindcx.com/exchange/ticker',
        parser: (data) => {
          const ticker = data.find(t => t.market === 'USDTINR');
          return ticker ? parseFloat(ticker.bid) : 0;
        },
        tradeUrl: 'https://coindcx.com/trade/USDTINR'
      },
      {
        name: 'ZebPay',
        url: 'https://www.zebapi.com/pro/v1/market/USDT-INR/ticker',
        parser: (data) => parseFloat(data.buy),
        tradeUrl: 'https://zebpay.com/'
      }
    ];

    for (const exchange of otherExchanges) {
      try {
        const response = await axios.get(exchange.url, { timeout: 5000 });
        const buyPrice = exchange.parser(response.data);
        
        if (buyPrice > 80 && buyPrice < 95) { // Sanity check
          const sellRate = this.expressRates.IMPS.rate;
          const profit = sellRate - buyPrice;

          if (profit > 0) {
            opportunities.push({
              source: exchange.name,
              buyPrice: buyPrice,
              sellPrice: sellRate,
              sellMethod: 'IMPS/Bank',
              profit: profit,
              profitPercent: (profit / buyPrice * 100),
              paymentMethods: 'All',
              url: exchange.tradeUrl
            });
          }
        }
      } catch (error) {
        // Skip failed exchanges
      }
    }

    // Sort by profit
    opportunities.sort((a, b) => b.profit - a.profit);
    return opportunities;
  }

  displayDashboard(opportunities) {
    console.clear();
    console.log(chalk.bgCyan.black(' 💰 P2P Express Sell Rate Monitor & Arbitrage Finder '));
    console.log(chalk.gray(`Last updated: ${new Date().toLocaleTimeString()}\n`));

    // Display current P2P Express SELL rates with changes
    console.log(chalk.yellow('📊 Live P2P Express SELL Rates (What You Receive):'));
    const sellTable = new Table({
      head: ['Payment Method', 'Current Rate', 'Change', 'Last Update'],
      colWidths: [20, 15, 12, 20]
    });

    Object.entries(this.expressRates).forEach(([method, data]) => {
      if (data.rate > 0) {
        const changeColor = data.change > 0 ? chalk.green : data.change < 0 ? chalk.red : chalk.gray;
        const changeText = data.change !== 0 ? changeColor(`${data.change > 0 ? '+' : ''}${data.change.toFixed(2)}`) : chalk.gray('-');
        
        sellTable.push([
          method,
          chalk.green(`₹${data.rate.toFixed(2)}`),
          changeText,
          data.lastUpdate ? new Date(data.lastUpdate).toLocaleTimeString() : 'Loading...'
        ]);
      }
    });
    console.log(sellTable.toString());

    // Rate trend
    if (this.rateHistory.length > 5) {
      console.log(chalk.gray('\n📈 Rate Trend (Last 5 updates):'));
      const trend = this.rateHistory.slice(-5).map(h => 
        `IMPS: ₹${h.rates.IMPS.rate.toFixed(2)}`
      ).join(' → ');
      console.log(chalk.gray(`   ${trend}`));
    }

    // Display opportunities
    if (opportunities.length > 0) {
      console.log(chalk.bgGreen.black('\n🎯 ARBITRAGE OPPORTUNITIES (Buy Low → Sell High via Express):'));
      
      const oppTable = new Table({
        head: ['Source', 'Buy Price', 'Sell Express', 'Profit/USDT', 'Amount', 'Action'],
        colWidths: [18, 10, 13, 13, 15, 15]
      });

      opportunities.slice(0, 10).forEach((opp, index) => {
        const profitColor = opp.profit > 0.5 ? chalk.green : opp.profit > 0.2 ? chalk.yellow : chalk.white;
        
        oppTable.push([
          opp.source + (opp.merchant ? `\n${chalk.gray(opp.merchant.substring(0, 15))}` : ''),
          chalk.red(`₹${opp.buyPrice.toFixed(2)}`),
          `${opp.sellMethod}\n₹${opp.sellPrice.toFixed(2)}`,
          profitColor(`₹${opp.profit.toFixed(2)}\n${opp.profitPercent.toFixed(2)}%`),
          opp.available ? `${opp.available.toFixed(0)} USDT\n₹${opp.minLimit}-${opp.maxLimit}` : 'Market',
          index === 0 && opp.profit > 0.30 ? chalk.bgYellow.black(' AUTO-OPEN ') : ''
        ]);
      });
      console.log(oppTable.toString());

      // Auto-open best opportunity if profitable enough
      const best = opportunities[0];
      if (best.profit > 0.30 && !this.openedDeals.has(best.url)) {
        console.log(chalk.bgRed.white('\n🚨 PROFITABLE DEAL DETECTED! AUTO-OPENING...'));
        console.log(chalk.white(`   Strategy: Buy at ₹${best.buyPrice} → Sell Express at ₹${best.sellPrice}`));
        console.log(chalk.green(`   Profit: ₹${best.profit.toFixed(2)} per USDT (${best.profitPercent.toFixed(2)}%)\n`));
        
        this.openBuyPage(best.url);
        this.openedDeals.add(best.url);
        
        // Send notification
        if (Date.now() - this.lastAlert > this.alertCooldown) {
          notifier.notify({
            title: '💰 P2P Arbitrage Alert!',
            message: `${best.profitPercent.toFixed(2)}% profit found!\nBuy: ₹${best.buyPrice} → Sell: ₹${best.sellPrice}`,
            sound: true
          });
          this.lastAlert = Date.now();
        }

        // Clear after 5 minutes
        setTimeout(() => {
          this.openedDeals.delete(best.url);
        }, 300000);
      }

      // Quick profit calculator
      if (best.profit > 0) {
        console.log(chalk.cyan('\n💰 Quick Profit Calculator (Best Deal):'));
        const amounts = [100, 500, 1000, 5000];
        const calcTable = new Table({
          head: ['Amount', 'Investment', 'Return', 'Profit'],
          colWidths: [10, 15, 15, 15]
        });

        amounts.forEach(amount => {
          const investment = best.buyPrice * amount;
          const returns = best.sellPrice * amount;
          const profit = best.profit * amount;
          
          calcTable.push([
            `${amount} USDT`,
            `₹${investment.toFixed(0)}`,
            `₹${returns.toFixed(0)}`,
            chalk.green(`₹${profit.toFixed(0)}`)
          ]);
        });
        console.log(calcTable.toString());
      }

    } else {
      console.log(chalk.red('\n❌ No profitable opportunities at the moment'));
      console.log(chalk.gray('   All buy rates are higher than P2P Express sell rates'));
    }

    console.log(chalk.gray('\n📌 Settings: Auto-open >₹0.30 | Refresh: 10s | Alert cooldown: 60s'));
    console.log(chalk.gray('💡 Best rates: IMPS/Bank Transfer > UPI for selling'));
  }

  openBuyPage(url) {
    exec(`open -a "Google Chrome" "${url}"`, (error) => {
      if (!error) {
        console.log(chalk.green('✓ Opened in Chrome'));
      }
    });
  }

  async start() {
    console.log(chalk.yellow('🚀 Starting P2P Express Rate Monitor...\n'));
    console.log(chalk.cyan('Monitoring P2P Express sell rates and finding arbitrage opportunities\n'));

    const monitor = async () => {
      try {
        // Fetch latest express sell rates
        await this.fetchP2PExpressSellRates();
        
        // Find cheaper buy opportunities
        const opportunities = await this.findCheaperBuyRates();
        
        // Display dashboard
        this.displayDashboard(opportunities);
      } catch (error) {
        console.error(chalk.red('Error:'), error.message);
      }
    };

    // Initial run
    await monitor();

    // Refresh every 10 seconds
    setInterval(monitor, 10000);
  }
}

// Run the monitor
if (require.main === module) {
  const monitor = new P2PExpressArbitrage();
  monitor.start();
}

module.exports = P2PExpressArbitrage;