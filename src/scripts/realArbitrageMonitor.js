const axios = require('axios');
const chalk = require('chalk');
const Table = require('cli-table3');
const { exec } = require('child_process');

class RealArbitrageMonitor {
  constructor() {
    // YOUR ACTUAL EXPRESS RATES
    this.expressRates = {
      SELL: {
        IMPS: 86.17,
        BankTransfer: 86.17, 
        UPI: 84.80
      },
      BUY: null // We'll fetch this
    };
    
    this.opportunities = [];
    this.lastUpdate = null;
  }

  async fetchAllRates() {
    const results = {
      p2pBuy: [],
      p2pSell: [],
      expressBuy: null,
      exchanges: []
    };

    // 1. P2P REGULAR BUY RATES (what you pay to buy USDT)
    try {
      const buyResponse = await axios.post(
        'https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search',
        {
          page: 1,
          rows: 10,
          payTypes: [],
          asset: "USDT",
          fiat: "INR", 
          tradeType: "BUY",
          transAmount: 11.54
        }
      );

      if (buyResponse.data?.data) {
        results.p2pBuy = buyResponse.data.data.map(ad => ({
          merchant: ad.advertiser.nickName,
          price: parseFloat(ad.adv.price),
          methods: ad.adv.tradeMethods.map(m => m.identifier),
          available: parseFloat(ad.adv.surplusAmount),
          minLimit: parseFloat(ad.adv.minSingleTransAmount),
          maxLimit: parseFloat(ad.adv.maxSingleTransAmount)
        }));
      }
    } catch (e) {}

    // 2. P2P REGULAR SELL RATES (what you get when selling USDT)
    try {
      const sellResponse = await axios.post(
        'https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search',
        {
          page: 1,
          rows: 10,
          payTypes: [],
          asset: "USDT",
          fiat: "INR",
          tradeType: "SELL",
          transAmount: 11.54
        }
      );

      if (sellResponse.data?.data) {
        results.p2pSell = sellResponse.data.data.map(ad => ({
          merchant: ad.advertiser.nickName,
          price: parseFloat(ad.adv.price),
          methods: ad.adv.tradeMethods.map(m => m.identifier)
        }));
      }
    } catch (e) {}

    // 3. P2P EXPRESS BUY RATE (what Express charges you to buy)
    try {
      const expressBuyResponse = await axios.post(
        'https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search',
        {
          page: 1,
          rows: 1,
          payTypes: ["IMPS"],
          asset: "USDT",
          fiat: "INR",
          tradeType: "BUY",
          transAmount: 11.54,
          publisherType: "merchant"
        }
      );

      if (expressBuyResponse.data?.data?.[0]) {
        results.expressBuy = parseFloat(expressBuyResponse.data.data[0].adv.price);
      }
    } catch (e) {}

    // 4. OTHER EXCHANGES
    try {
      const coindcx = await axios.get('https://api.coindcx.com/exchange/ticker');
      const usdtinr = coindcx.data.find(t => t.market === 'USDTINR');
      if (usdtinr) {
        results.exchanges.push({
          name: 'CoinDCX',
          buy: parseFloat(usdtinr.bid),
          sell: parseFloat(usdtinr.ask),
          spread: ((parseFloat(usdtinr.ask) - parseFloat(usdtinr.bid)) / parseFloat(usdtinr.bid) * 100).toFixed(2)
        });
      }
    } catch (e) {}

    try {
      const zebpay = await axios.get('https://www.zebapi.com/pro/v1/market/USDT-INR/ticker');
      results.exchanges.push({
        name: 'ZebPay',
        buy: parseFloat(zebpay.data.buy),
        sell: parseFloat(zebpay.data.sell),
        spread: ((parseFloat(zebpay.data.sell) - parseFloat(zebpay.data.buy)) / parseFloat(zebpay.data.buy) * 100).toFixed(2)
      });
    } catch (e) {}

    return results;
  }

  findOpportunities(data) {
    const opportunities = [];

    // OPPORTUNITY 1: Buy from exchanges/P2P → Sell via regular P2P
    const bestP2PSellPrice = data.p2pSell[0]?.price || 0;
    
    // Check exchanges
    data.exchanges.forEach(ex => {
      if (ex.buy < bestP2PSellPrice) {
        opportunities.push({
          type: 'Exchange → P2P',
          action: `Buy ${ex.name} @ ₹${ex.buy} → Sell P2P @ ₹${bestP2PSellPrice}`,
          buyPrice: ex.buy,
          sellPrice: bestP2PSellPrice,
          profit: bestP2PSellPrice - ex.buy,
          profitPercent: ((bestP2PSellPrice - ex.buy) / ex.buy * 100).toFixed(2)
        });
      }
    });

    // OPPORTUNITY 2: Buy from P2P/Exchange → Sell to P2P buyers
    const bestP2PBuyPrice = data.p2pBuy[0]?.price || 0;
    
    data.exchanges.forEach(ex => {
      if (ex.sell < bestP2PBuyPrice) {
        opportunities.push({
          type: 'Exchange Spread',
          action: `${ex.name} spread: Buy @ ₹${ex.buy} → Someone buys @ ₹${bestP2PBuyPrice}`,
          buyPrice: ex.buy,
          sellPrice: bestP2PBuyPrice,
          profit: bestP2PBuyPrice - ex.buy,
          profitPercent: ((bestP2PBuyPrice - ex.buy) / ex.buy * 100).toFixed(2)
        });
      }
    });

    // OPPORTUNITY 3: P2P Express arbitrage (your focus)
    // Can we buy anywhere cheaper than Express SELL rate?
    const expressSellRate = this.expressRates.SELL.IMPS;
    
    // Check if any P2P seller is selling below Express rate
    data.p2pBuy.forEach(seller => {
      if (seller.price < expressSellRate) {
        opportunities.push({
          type: '🔥 P2P → Express',
          action: `Buy P2P @ ₹${seller.price} → Sell Express @ ₹${expressSellRate}`,
          buyPrice: seller.price,
          sellPrice: expressSellRate,
          profit: expressSellRate - seller.price,
          profitPercent: ((expressSellRate - seller.price) / seller.price * 100).toFixed(2),
          merchant: seller.merchant
        });
      }
    });

    // Check if exchanges are cheaper than Express
    data.exchanges.forEach(ex => {
      if (ex.buy < expressSellRate) {
        opportunities.push({
          type: '🔥 Exchange → Express',
          action: `Buy ${ex.name} @ ₹${ex.buy} → Sell Express @ ₹${expressSellRate}`,
          buyPrice: ex.buy,
          sellPrice: expressSellRate,
          profit: expressSellRate - ex.buy,
          profitPercent: ((expressSellRate - ex.buy) / ex.buy * 100).toFixed(2)
        });
      }
    });

    return opportunities.sort((a, b) => b.profit - a.profit);
  }

  displayDashboard(data, opportunities) {
    console.clear();
    console.log(chalk.bgCyan.black(' 💰 REAL Arbitrage Monitor - All Opportunities '));
    console.log(chalk.gray(`Updated: ${new Date().toLocaleTimeString()}\n`));

    // Show ALL rates in one table
    console.log(chalk.yellow('📊 ALL CURRENT RATES:'));
    const ratesTable = new Table({
      head: ['Type', 'Buy (You Pay)', 'Sell (You Get)', 'Spread', 'Notes'],
      colWidths: [25, 15, 15, 12, 30]
    });

    // P2P Express
    ratesTable.push([
      chalk.bgGreen.black(' P2P EXPRESS '),
      chalk.red(`₹${data.expressBuy || '?'}`),
      chalk.green(`₹${this.expressRates.SELL.IMPS}`),
      '-',
      'Your rates: IMPS ₹86.17'
    ]);

    // Regular P2P
    if (data.p2pBuy[0] && data.p2pSell[0]) {
      const spread = ((data.p2pBuy[0].price - data.p2pSell[0].price) / data.p2pSell[0].price * 100).toFixed(2);
      ratesTable.push([
        'P2P Regular',
        chalk.red(`₹${data.p2pBuy[0].price}`),
        chalk.green(`₹${data.p2pSell[0].price}`),
        `${spread}%`,
        `Best: ${data.p2pBuy[0].merchant}`
      ]);
    }

    // Exchanges
    data.exchanges.forEach(ex => {
      ratesTable.push([
        ex.name,
        chalk.red(`₹${ex.buy}`),
        chalk.green(`₹${ex.sell}`),
        `${ex.spread}%`,
        ''
      ]);
    });

    console.log(ratesTable.toString());

    // Show opportunities
    if (opportunities.length > 0) {
      console.log(chalk.yellow('\n💰 ARBITRAGE OPPORTUNITIES:'));
      const oppTable = new Table({
        head: ['Type', 'Action', 'Profit/USDT', 'Total (11.54)', 'Status'],
        colWidths: [20, 40, 15, 15, 15]
      });

      opportunities.slice(0, 10).forEach(opp => {
        const totalProfit = (opp.profit * 11.54).toFixed(2);
        const profitColor = opp.profit > 1 ? chalk.green : opp.profit > 0.5 ? chalk.yellow : chalk.white;
        const status = opp.type.includes('🔥') ? chalk.bgRed.white(' HOT! ') : '';

        oppTable.push([
          opp.type,
          opp.action,
          profitColor(`₹${opp.profit.toFixed(2)}\n${opp.profitPercent}%`),
          profitColor(`₹${totalProfit}`),
          status
        ]);
      });

      console.log(oppTable.toString());
    } else {
      console.log(chalk.red('\n❌ NO ARBITRAGE OPPORTUNITIES'));
      console.log(chalk.gray('All buy prices are higher than sell prices'));
    }

    // Summary
    console.log(chalk.cyan('\n📈 MARKET SUMMARY:'));
    console.log(`• P2P Express Sell: ₹${this.expressRates.SELL.IMPS} (what you GET)`);
    console.log(`• Cheapest Buy: ₹${Math.min(...data.exchanges.map(e => e.buy), ...data.p2pBuy.map(p => p.price))}`);
    console.log(`• Best P2P Sell: ₹${data.p2pSell[0]?.price || 'N/A'}`);
    
    const expressGap = Math.min(...data.exchanges.map(e => e.buy), ...data.p2pBuy.map(p => p.price)) - this.expressRates.SELL.IMPS;
    console.log(chalk.red(`\n⚠️  Express Gap: ₹${expressGap.toFixed(2)} (everyone selling above Express rate)`));
  }

  async start() {
    console.log(chalk.yellow('Starting Real Arbitrage Monitor...\n'));

    const monitor = async () => {
      try {
        const data = await this.fetchAllRates();
        const opportunities = this.findOpportunities(data);
        this.displayDashboard(data, opportunities);
        this.lastUpdate = new Date();
      } catch (error) {
        console.error(chalk.red('Error:'), error.message);
      }
    };

    // Initial run
    await monitor();

    // Refresh every 15 seconds
    setInterval(monitor, 15000);

    console.log(chalk.gray('\nRefreshing every 15 seconds...'));
  }
}

// Run
if (require.main === module) {
  const monitor = new RealArbitrageMonitor();
  monitor.start();
}

module.exports = RealArbitrageMonitor;