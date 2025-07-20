const axios = require('axios');
const chalk = require('chalk');
const Table = require('cli-table3');
const { exec } = require('child_process');

class AccurateP2PExpress {
  constructor() {
    // Based on your screenshot, these are the ACTUAL Express rates
    this.actualExpressRates = {
      IMPS: 86.56,
      BankTransfer: 86.56,
      UPI: 84.80
    };
    
    this.lastUpdate = null;
    this.openedDeals = new Set();
    this.refreshInterval = 10000; // 10 seconds
  }

  // Fetch current P2P ads (not Express, but regular P2P)
  async fetchP2PBuyRates() {
    try {
      const response = await axios.post(
        'https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search',
        {
          page: 1,
          rows: 20,
          payTypes: [],
          countries: [],
          asset: "USDT",
          fiat: "INR",
          tradeType: "BUY",
          merchantCheck: false
        },
        {
          headers: {
            'User-Agent': 'Mozilla/5.0',
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.data?.data) {
        return response.data.data.map(ad => ({
          price: parseFloat(ad.adv.price),
          merchant: ad.advertiser.nickName,
          methods: ad.adv.tradeMethods.map(m => m.identifier),
          minLimit: parseFloat(ad.adv.minSingleTransAmount),
          maxLimit: parseFloat(ad.adv.maxSingleTransAmount),
          available: parseFloat(ad.adv.surplusAmount),
          advertId: ad.adv.advNo
        }));
      }
    } catch (error) {
      console.error('Error fetching P2P rates:', error.message);
    }
    return [];
  }

  // Fetch from other exchanges
  async fetchOtherExchanges() {
    const results = [];

    // CoinDCX
    try {
      const coindcx = await axios.get('https://api.coindcx.com/exchange/ticker');
      const usdtinr = coindcx.data.find(t => t.market === 'USDTINR');
      if (usdtinr) {
        results.push({
          exchange: 'CoinDCX',
          buyPrice: parseFloat(usdtinr.bid),
          sellPrice: parseFloat(usdtinr.ask),
          url: 'https://coindcx.com/trade/USDTINR'
        });
      }
    } catch (e) {}

    // ZebPay
    try {
      const zebpay = await axios.get('https://www.zebapi.com/pro/v1/market/USDT-INR/ticker');
      results.push({
        exchange: 'ZebPay',
        buyPrice: parseFloat(zebpay.data.buy),
        sellPrice: parseFloat(zebpay.data.sell),
        url: 'https://zebpay.com/'
      });
    } catch (e) {}

    return results;
  }

  displayDashboard(p2pBuyRates, otherExchanges) {
    console.clear();
    console.log(chalk.bgCyan.black(' 💰 Accurate P2P Express Arbitrage Monitor '));
    console.log(chalk.gray(`Based on ACTUAL Express rates from Binance\n`));

    // Display Express SELL rates (what you showed me)
    console.log(chalk.yellow('📊 P2P Express SELL Rates (What You Receive):'));
    const sellTable = new Table({
      head: ['Payment Method', 'Rate', 'vs Market'],
      colWidths: [20, 12, 15]
    });

    sellTable.push(
      ['IMPS', chalk.green(`₹${this.actualExpressRates.IMPS}`), chalk.green('Best Rate')],
      ['Bank Transfer', chalk.green(`₹${this.actualExpressRates.BankTransfer}`), chalk.green('Best Rate')],
      ['UPI', chalk.yellow(`₹${this.actualExpressRates.UPI}`), chalk.yellow('Lower Rate')]
    );
    console.log(sellTable.toString());

    // Find arbitrage opportunities
    const opportunities = [];

    // Check P2P buy rates
    p2pBuyRates.forEach(ad => {
      // Determine best Express rate for this ad
      let bestExpressRate = 0;
      let bestMethod = '';
      
      if (ad.methods.includes('IMPS') || ad.methods.includes('Bank Transfer')) {
        bestExpressRate = this.actualExpressRates.IMPS;
        bestMethod = 'IMPS/Bank';
      } else if (ad.methods.includes('UPI')) {
        bestExpressRate = this.actualExpressRates.UPI;
        bestMethod = 'UPI';
      }

      if (bestExpressRate > 0 && ad.price < bestExpressRate) {
        const profit = bestExpressRate - ad.price;
        opportunities.push({
          type: 'P2P',
          buyPrice: ad.price,
          sellPrice: bestExpressRate,
          profit: profit,
          profitPercent: (profit / ad.price * 100),
          merchant: ad.merchant,
          methods: ad.methods.join(', '),
          sellMethod: bestMethod,
          available: ad.available,
          minLimit: ad.minLimit,
          maxLimit: ad.maxLimit,
          url: `https://p2p.binance.com/en/advertiserDetail/${ad.advertId}`
        });
      }
    });

    // Check other exchanges
    otherExchanges.forEach(ex => {
      const bestExpressRate = this.actualExpressRates.IMPS; // Use best rate for comparison
      const profit = bestExpressRate - ex.buyPrice;
      
      if (profit > 0) {
        opportunities.push({
          type: 'Exchange',
          exchange: ex.exchange,
          buyPrice: ex.buyPrice,
          sellPrice: bestExpressRate,
          profit: profit,
          profitPercent: (profit / ex.buyPrice * 100),
          sellMethod: 'IMPS/Bank',
          url: ex.url
        });
      }
    });

    // Sort by profit
    opportunities.sort((a, b) => b.profit - a.profit);

    // Display opportunities
    if (opportunities.length > 0) {
      console.log(chalk.bgRed.white('\n🚨 ARBITRAGE OPPORTUNITIES DETECTED:'));
      
      const oppTable = new Table({
        head: ['Source', 'Buy', 'Sell Express', 'Profit', 'Action'],
        colWidths: [25, 10, 15, 20, 15]
      });

      opportunities.slice(0, 10).forEach((opp, index) => {
        const profitColor = opp.profit > 1 ? chalk.green : opp.profit > 0.5 ? chalk.yellow : chalk.white;
        
        oppTable.push([
          opp.type === 'P2P' ? `P2P: ${opp.merchant.substring(0, 20)}` : opp.exchange,
          chalk.red(`₹${opp.buyPrice.toFixed(2)}`),
          `${opp.sellMethod}\n₹${opp.sellPrice.toFixed(2)}`,
          profitColor(`₹${opp.profit.toFixed(2)}\n${opp.profitPercent.toFixed(2)}%`),
          index === 0 && opp.profit > 0.5 ? chalk.bgGreen.black(' BUY! ') : ''
        ]);
      });
      
      console.log(oppTable.toString());

      // Auto-open best opportunity
      const best = opportunities[0];
      if (best && best.profit > 0.5 && !this.openedDeals.has(best.url)) {
        console.log(chalk.bgYellow.black('\n💸 AUTO-OPENING BEST OPPORTUNITY...'));
        console.log(chalk.white(`Buy at ₹${best.buyPrice} → Sell Express at ₹${best.sellPrice}`));
        console.log(chalk.green(`Profit: ₹${best.profit.toFixed(2)} per USDT (${best.profitPercent.toFixed(2)}%)`));
        
        this.openBuyPage(best.url);
        this.openedDeals.add(best.url);
        
        setTimeout(() => {
          this.openedDeals.delete(best.url);
        }, 300000);
      }

      // Profit calculator for your amount (11.54 USDT)
      if (best) {
        console.log(chalk.cyan('\n💰 Profit for your 11.54 USDT:'));
        const totalProfit = best.profit * 11.54;
        const investment = best.buyPrice * 11.54;
        const returns = best.sellPrice * 11.54;
        console.log(`Investment: ₹${investment.toFixed(2)} → Returns: ₹${returns.toFixed(2)}`);
        console.log(chalk.green(`Net Profit: ₹${totalProfit.toFixed(2)}`));
      }
    } else {
      console.log(chalk.red('\n❌ No profitable opportunities found'));
      console.log(chalk.gray('All buy rates are higher than Express sell rates'));
    }

    console.log(chalk.gray(`\n⏰ Last updated: ${new Date().toLocaleTimeString()}`));
    console.log(chalk.gray(`🔄 Refreshing every ${this.refreshInterval/1000} seconds`));
  }

  openBuyPage(url) {
    exec(`open -a "Google Chrome" "${url}"`, (error) => {
      if (!error) {
        console.log(chalk.green('✓ Opened in Chrome'));
      }
    });
  }

  async start() {
    console.log(chalk.yellow('🚀 Starting Accurate P2P Express Monitor...'));
    console.log(chalk.cyan('Using ACTUAL Express rates: IMPS ₹86.56, UPI ₹84.80\n'));

    const monitor = async () => {
      try {
        const p2pBuyRates = await this.fetchP2PBuyRates();
        const otherExchanges = await this.fetchOtherExchanges();
        
        this.displayDashboard(p2pBuyRates, otherExchanges);
      } catch (error) {
        console.error(chalk.red('Error:'), error.message);
      }
    };

    // Initial run
    await monitor();

    // Refresh every 10 seconds
    setInterval(monitor, this.refreshInterval);
  }
}

// Run the monitor
if (require.main === module) {
  const monitor = new AccurateP2PExpress();
  monitor.start();
}

module.exports = AccurateP2PExpress;