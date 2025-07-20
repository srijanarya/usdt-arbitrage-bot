const axios = require('axios');
const Table = require('cli-table3');
const chalk = require('chalk');
const { exec } = require('child_process');

class IndianExchangeComparator {
  constructor() {
    this.lastAlertTime = 0;
    this.alertCooldown = 60000; // 1 minute between alerts
    this.profitThreshold = 0.3; // Alert when profit > 0.3%
    this.openedDeals = new Set();
    this.binanceExpressSellRate = 0;
  }

  async fetchBinanceExpressSellRate() {
    try {
      // Fetch P2P Express SELL rate (what you receive when selling)
      const response = await axios.post(
        'https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search',
        {
          page: 1,
          rows: 1,
          payTypes: ["IMPS", "Bank Transfer"],
          countries: [],
          proMerchantAds: false,
          asset: "USDT",
          fiat: "INR",
          tradeType: "SELL",
          merchantCheck: false
        },
        {
          headers: {
            'User-Agent': 'Mozilla/5.0',
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.data?.data?.[0]) {
        this.binanceExpressSellRate = parseFloat(response.data.data[0].adv.price);
        return this.binanceExpressSellRate;
      }
    } catch (error) {
      console.error('Error fetching Binance Express rate:', error.message);
    }
    return this.binanceExpressSellRate || 90.5; // Fallback
  }

  async fetchPrice(exchange) {
    try {
      const config = {
        timeout: 5000,
        headers: {
          'User-Agent': 'Mozilla/5.0',
          'Accept': 'application/json'
        }
      };

      let response;
      if (exchange.method === 'POST') {
        response = await axios.post(exchange.url, exchange.data, config);
      } else {
        response = await axios.get(exchange.url, config);
      }

      const data = exchange.parser(response.data);
      return data ? { ...data, name: exchange.name, status: 'online' } : null;
    } catch (error) {
      return { name: exchange.name, status: 'offline', error: error.message };
    }
  }

  async fetchAllPrices() {
    console.log(chalk.cyan('\n📊 Fetching prices from all exchanges...\n'));
    
    // First get Binance Express sell rate
    await this.fetchBinanceExpressSellRate();
    
    // Exchange list without WazirX
    this.exchanges = [
      {
        name: 'CoinDCX',
        url: 'https://api.coindcx.com/exchange/ticker',
        parser: (data) => {
          const ticker = data.find(t => t.market === 'USDTINR');
          return ticker ? {
            buy: parseFloat(ticker.bid),
            sell: parseFloat(ticker.ask),
            last: parseFloat(ticker.last_price),
            volume: parseFloat(ticker.volume),
            url: 'https://coindcx.com/trade/USDTINR'
          } : null;
        }
      },
      {
        name: 'ZebPay',
        url: 'https://www.zebapi.com/pro/v1/market/USDT-INR/ticker',
        parser: (data) => ({
          buy: parseFloat(data.buy),
          sell: parseFloat(data.sell),
          last: parseFloat(data.market),
          volume: parseFloat(data.volume),
          url: 'https://www.zebpay.com/'
        })
      },
      {
        name: 'Binance P2P Buy',
        url: 'https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search',
        method: 'POST',
        data: {
          page: 1,
          rows: 5,
          payTypes: ["UPI", "IMPS", "Bank Transfer"],
          countries: [],
          proMerchantAds: false,
          asset: "USDT",
          fiat: "INR",
          tradeType: "BUY"
        },
        parser: (response) => {
          if (response.data && response.data.length > 0) {
            const prices = response.data.map(ad => parseFloat(ad.adv.price));
            const bestAd = response.data[0];
            return {
              buy: Math.min(...prices),
              sell: Math.max(...prices),
              last: prices[0],
              volume: 0,
              merchant: bestAd.advertiser.nickName,
              advertId: bestAd.adv.advNo,
              url: `https://p2p.binance.com/en/express/buy/USDT/INR`
            };
          }
          return null;
        }
      }
    ];

    const promises = this.exchanges.map(exchange => this.fetchPrice(exchange));
    const results = await Promise.all(promises);
    
    return results.filter(r => r && r.status === 'online');
  }

  openBuyPage(url) {
    exec(`open -a "Google Chrome" "${url}"`, (error) => {
      if (!error) {
        console.log(chalk.green('✓ Chrome opened with buy page'));
      }
    });
  }

  displayResults(prices) {
    if (prices.length === 0) {
      console.log(chalk.red('❌ No exchanges responded'));
      return;
    }

    // Create comparison table
    const table = new Table({
      head: [
        chalk.white('Exchange'),
        chalk.green('Buy Rate'),
        chalk.yellow('Express Sell'),
        chalk.blue('Profit/USDT'),
        chalk.cyan('Profit %'),
        chalk.magenta('Action')
      ],
      colWidths: [20, 12, 15, 15, 12, 20]
    });

    // Sort by buy price (ascending - cheaper is better)
    prices.sort((a, b) => a.buy - b.buy);

    let bestOpportunity = null;

    prices.forEach(price => {
      const profit = this.binanceExpressSellRate - price.buy;
      const profitPercent = (profit / price.buy * 100);
      
      const profitColor = profit > 0.5 ? chalk.green : profit > 0 ? chalk.yellow : chalk.red;
      const actionText = profit > 0.3 ? chalk.bgGreen.black(' BUY NOW! ') : '';

      // Track best opportunity
      if (profit > 0.3 && !bestOpportunity) {
        bestOpportunity = {
          ...price,
          profit,
          profitPercent
        };
      }

      table.push([
        price.name + (price.merchant ? `\n${chalk.gray(price.merchant)}` : ''),
        chalk.green(`₹${price.buy.toFixed(2)}`),
        chalk.yellow(`₹${this.binanceExpressSellRate.toFixed(2)}`),
        profitColor(`₹${profit.toFixed(2)}`),
        profitColor(`${profitPercent.toFixed(2)}%`),
        actionText
      ]);
    });

    console.log(table.toString());

    // Auto-open best opportunity
    if (bestOpportunity && bestOpportunity.url && !this.openedDeals.has(bestOpportunity.url)) {
      console.log(chalk.bgGreen.black('\n🎯 ARBITRAGE OPPORTUNITY DETECTED!'));
      console.log(chalk.white(`   Buy on ${chalk.yellow(bestOpportunity.name)} at ${chalk.green(`₹${bestOpportunity.buy.toFixed(2)}`)}`));
      console.log(chalk.white(`   Sell on ${chalk.yellow('Binance P2P Express')} at ${chalk.red(`₹${this.binanceExpressSellRate.toFixed(2)}`)}`));
      console.log(chalk.white(`   Profit: ${chalk.green(`₹${bestOpportunity.profit.toFixed(2)}`)} per USDT (${chalk.green(`${bestOpportunity.profitPercent.toFixed(2)}%`)})`));
      
      // Auto-open the pages
      console.log(chalk.bgYellow.black('\n🚨 AUTO-OPENING PAGES...'));
      
      // Open buy page based on source
      if (bestOpportunity.name === 'Binance P2P Buy') {
        // For Binance P2P, open Express buy page
        this.openBuyPage('https://p2p.binance.com/en/express/buy/USDT/INR');
        console.log(chalk.gray('Opening P2P Express Buy page...'));
      } else {
        // For other exchanges, open their trading page
        this.openBuyPage(bestOpportunity.url);
      }
      
      // Also open sell page for reference
      setTimeout(() => {
        this.openBuyPage('https://p2p.binance.com/en/express/sell/USDT/INR?step=2');
        console.log(chalk.gray('Opening P2P Express Sell page for comparison...'));
      }, 2000);
      
      this.openedDeals.add(bestOpportunity.url);
      
      // Clear after 5 minutes
      setTimeout(() => {
        this.openedDeals.delete(bestOpportunity.url);
      }, 300000);

      // Calculate for different amounts
      console.log(chalk.cyan('\n💰 Profit Calculator:'));
      const amounts = [100, 500, 1000, 5000];
      amounts.forEach(amount => {
        const totalProfit = bestOpportunity.profit * amount;
        const investment = bestOpportunity.buy * amount;
        console.log(`   ${amount} USDT: Invest ₹${investment.toFixed(0)} → Profit ${chalk.green(`₹${totalProfit.toFixed(0)}`)}`);
      });
    }

    console.log(chalk.gray(`\n⏰ Last updated: ${new Date().toLocaleTimeString()}`));
    console.log(chalk.bgBlue.white(` P2P Express Sell Rate: ₹${this.binanceExpressSellRate.toFixed(2)} `));
  }

  async startMonitoring(interval = 15000) {
    console.clear();
    console.log(chalk.bgCyan.black(' 🚀 Indian Exchange USDT Arbitrage Monitor '));
    console.log(chalk.gray('Comparing buy rates with Binance P2P Express sell rate\n'));

    // Initial fetch
    await this.compare();

    // Set up interval
    setInterval(async () => {
      console.clear();
      console.log(chalk.bgCyan.black(' 🚀 Indian Exchange USDT Arbitrage Monitor '));
      console.log(chalk.gray('Comparing buy rates with Binance P2P Express sell rate\n'));
      await this.compare();
    }, interval);

    console.log(chalk.gray(`\nRefreshing every ${interval/1000} seconds. Press Ctrl+C to stop.`));
  }

  async compare() {
    const prices = await this.fetchAllPrices();
    this.displayResults(prices);
  }
}

// Export for use in other scripts
module.exports = IndianExchangeComparator;

// Run if called directly
if (require.main === module) {
  const comparator = new IndianExchangeComparator();
  
  const args = process.argv.slice(2);
  if (args.includes('--monitor') || args.includes('-m')) {
    // Continuous monitoring mode
    comparator.startMonitoring(15000);
  } else {
    // Single run
    comparator.compare()
      .then(() => process.exit(0))
      .catch(error => {
        console.error('Error:', error);
        process.exit(1);
      });
  }
}