const axios = require('axios');
const chalk = require('chalk');
const Table = require('cli-table3');
const { exec } = require('child_process');
const readline = require('readline');

class ManualP2PMonitor {
  constructor() {
    this.expressRates = {
      IMPS: 86.17,       // Your current rate
      BankTransfer: 86.17,
      UPI: 84.80
    };
    this.lastUpdate = new Date();
    this.openedDeals = new Set();
  }

  async updateExpressRates() {
    console.log(chalk.yellow('\n📝 Update P2P Express Rates (press Enter to keep current):'));
    
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    const question = (prompt, currentValue) => {
      return new Promise((resolve) => {
        rl.question(`${prompt} [current: ₹${currentValue}]: `, (answer) => {
          resolve(answer ? parseFloat(answer) : currentValue);
        });
      });
    };

    this.expressRates.IMPS = await question('IMPS rate', this.expressRates.IMPS);
    this.expressRates.BankTransfer = await question('Bank Transfer rate', this.expressRates.BankTransfer);
    this.expressRates.UPI = await question('UPI rate', this.expressRates.UPI);

    rl.close();
    this.lastUpdate = new Date();
    
    console.log(chalk.green('✓ Rates updated!'));
  }

  async fetchBuyOpportunities() {
    const opportunities = [];

    // Fetch P2P Buy rates
    try {
      const response = await axios.post(
        'https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search',
        {
          page: 1,
          rows: 20,
          payTypes: [],
          asset: "USDT",
          fiat: "INR",
          tradeType: "BUY",
          transAmount: 11.54
        }
      );

      if (response.data?.data) {
        response.data.data.forEach(ad => {
          const buyPrice = parseFloat(ad.adv.price);
          const methods = ad.adv.tradeMethods.map(m => m.identifier);
          
          // Determine best express rate
          let bestExpressRate = 0;
          let bestMethod = '';
          
          if (methods.includes('IMPS') || methods.includes('Bank Transfer')) {
            bestExpressRate = Math.max(this.expressRates.IMPS, this.expressRates.BankTransfer);
            bestMethod = 'IMPS/Bank';
          } else if (methods.includes('UPI')) {
            bestExpressRate = this.expressRates.UPI;
            bestMethod = 'UPI';
          }

          const profit = bestExpressRate - buyPrice;
          if (profit > 0) {
            opportunities.push({
              type: 'P2P',
              merchant: ad.advertiser.nickName,
              buyPrice: buyPrice,
              sellPrice: bestExpressRate,
              sellMethod: bestMethod,
              profit: profit,
              profitPercent: (profit / buyPrice * 100),
              methods: methods.join(', '),
              available: parseFloat(ad.adv.surplusAmount),
              rating: (ad.advertiser.monthFinishRate * 100).toFixed(1),
              url: `https://p2p.binance.com/en/advertiserDetail/${ad.adv.advNo}`
            });
          }
        });
      }
    } catch (error) {
      console.error(chalk.red('P2P fetch error:', error.message));
    }

    // Fetch other exchanges
    try {
      const exchanges = [
        { 
          name: 'CoinDCX', 
          url: 'https://api.coindcx.com/exchange/ticker',
          parser: (data) => {
            const ticker = data.find(t => t.market === 'USDTINR');
            return ticker ? parseFloat(ticker.bid) : null;
          }
        },
        { 
          name: 'ZebPay', 
          url: 'https://www.zebapi.com/pro/v1/market/USDT-INR/ticker',
          parser: (data) => parseFloat(data.buy)
        }
      ];

      for (const exchange of exchanges) {
        try {
          const response = await axios.get(exchange.url);
          const buyPrice = exchange.parser(response.data);
          
          if (buyPrice) {
            const bestExpressRate = this.expressRates.IMPS;
            const profit = bestExpressRate - buyPrice;
            
            if (profit > 0) {
              opportunities.push({
                type: 'Exchange',
                merchant: exchange.name,
                buyPrice: buyPrice,
                sellPrice: bestExpressRate,
                sellMethod: 'IMPS/Bank',
                profit: profit,
                profitPercent: (profit / buyPrice * 100),
                url: exchange.name === 'CoinDCX' ? 'https://coindcx.com/trade/USDTINR' : 'https://zebpay.com/'
              });
            }
          }
        } catch (e) {}
      }
    } catch (error) {
      console.error(chalk.red('Exchange fetch error:', error.message));
    }

    return opportunities.sort((a, b) => b.profit - a.profit);
  }

  displayDashboard(opportunities) {
    console.clear();
    console.log(chalk.bgCyan.black(' 💰 Manual P2P Express Monitor '));
    console.log(chalk.gray(`Last rate update: ${this.lastUpdate.toLocaleTimeString()}\n`));

    // Display current Express rates
    console.log(chalk.yellow('📊 Current P2P Express SELL Rates:'));
    const rateTable = new Table({
      head: ['Payment Method', 'Rate', 'Status'],
      colWidths: [20, 15, 20]
    });

    rateTable.push(
      ['IMPS', chalk.green(`₹${this.expressRates.IMPS}`), chalk.green('✓ Active')],
      ['Bank Transfer', chalk.green(`₹${this.expressRates.BankTransfer}`), chalk.green('✓ Active')],
      ['UPI', chalk.yellow(`₹${this.expressRates.UPI}`), chalk.yellow('Lower Rate')]
    );
    console.log(rateTable.toString());

    // Display opportunities
    if (opportunities.length > 0) {
      console.log(chalk.yellow('\n💰 Arbitrage Opportunities:'));
      const oppTable = new Table({
        head: ['Source', 'Buy', 'Sell Express', 'Profit', 'Rating', 'Action'],
        colWidths: [20, 10, 15, 18, 12, 10]
      });

      opportunities.slice(0, 10).forEach((opp, index) => {
        const profitColor = opp.profit > 0.5 ? chalk.green : opp.profit > 0.2 ? chalk.yellow : chalk.white;
        
        oppTable.push([
          `${opp.type}: ${opp.merchant.substring(0, 15)}`,
          chalk.red(`₹${opp.buyPrice.toFixed(2)}`),
          `${opp.sellMethod}\n₹${opp.sellPrice.toFixed(2)}`,
          profitColor(`₹${opp.profit.toFixed(2)}\n${opp.profitPercent.toFixed(2)}%`),
          opp.rating ? `${opp.rating}%` : '-',
          index === 0 && opp.profit > 0.3 ? chalk.bgGreen.black(' GO! ') : ''
        ]);
      });

      console.log(oppTable.toString());

      // Auto-open best opportunity
      const best = opportunities[0];
      if (best && best.profit > 0.3 && !this.openedDeals.has(best.url)) {
        console.log(chalk.bgGreen.black('\n🚀 OPENING BEST OPPORTUNITY...'));
        console.log(chalk.white(`Total profit for 11.54 USDT: ₹${(best.profit * 11.54).toFixed(2)}`));
        
        exec(`open -a "Google Chrome" "${best.url}"`);
        this.openedDeals.add(best.url);
        
        setTimeout(() => {
          this.openedDeals.delete(best.url);
        }, 300000);
      }
    } else {
      console.log(chalk.red('\n❌ No profitable opportunities found'));
    }

    console.log(chalk.gray('\n📌 Commands:'));
    console.log(chalk.gray('  U - Update Express rates'));
    console.log(chalk.gray('  R - Refresh opportunities'));
    console.log(chalk.gray('  Q - Quit'));
  }

  async start() {
    console.log(chalk.yellow('🚀 Starting Manual P2P Monitor...'));
    console.log(chalk.cyan('Using your actual Express rates\n'));

    // Initial fetch
    const opportunities = await this.fetchBuyOpportunities();
    this.displayDashboard(opportunities);

    // Set up auto-refresh
    const refreshInterval = setInterval(async () => {
      const opportunities = await this.fetchBuyOpportunities();
      this.displayDashboard(opportunities);
    }, 15000);

    // Handle keyboard input
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true);
      process.stdin.resume();
      process.stdin.on('data', async (key) => {
        const keyStr = key.toString().toLowerCase();
        
        if (keyStr === 'u') {
          clearInterval(refreshInterval);
          await this.updateExpressRates();
          const opportunities = await this.fetchBuyOpportunities();
          this.displayDashboard(opportunities);
          // Restart interval
          setInterval(async () => {
            const opportunities = await this.fetchBuyOpportunities();
            this.displayDashboard(opportunities);
          }, 15000);
        } else if (keyStr === 'r') {
          const opportunities = await this.fetchBuyOpportunities();
          this.displayDashboard(opportunities);
        } else if (keyStr === 'q') {
          console.log(chalk.yellow('\n👋 Exiting...'));
          process.exit(0);
        }
      });
    }
  }
}

// Run
if (require.main === module) {
  const monitor = new ManualP2PMonitor();
  monitor.start();
}

module.exports = ManualP2PMonitor;