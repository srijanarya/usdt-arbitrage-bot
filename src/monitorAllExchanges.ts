import { ZebPayClient } from './api/exchanges/zebPay';
import { KuCoinClient } from './api/exchanges/kucoin';
import { BinanceClient } from './api/exchanges/binance';
import { CoinSwitchClient } from './api/exchanges/coinSwitch';
import dotenv from 'dotenv';
import Table from 'cli-table3';
import chalk from 'chalk';

dotenv.config();

interface ExchangePrice {
  exchange: string;
  price: number;
  bid: number;
  ask: number;
  volume?: number;
  timestamp: Date;
}

class MultiExchangeMonitor {
  private exchanges: Map<string, any> = new Map();
  private prices: Map<string, ExchangePrice> = new Map();
  private isRunning = false;
  
  constructor() {
    // Initialize exchanges with API credentials
    this.initializeExchanges();
  }
  
  private initializeExchanges() {
    console.log(chalk.cyan('Initializing exchanges with your API credentials...\n'));
    
    // Binance
    if (process.env.BINANCE_API_KEY && process.env.BINANCE_API_KEY !== 'pending') {
      this.exchanges.set('Binance', new BinanceClient({
        apiKey: process.env.BINANCE_API_KEY,
        apiSecret: process.env.BINANCE_API_SECRET!
      }));
      console.log(chalk.green('✓ Binance initialized'));
    }
    
    // ZebPay
    if (process.env.ZEBPAY_API_KEY && process.env.ZEBPAY_API_KEY !== 'pending') {
      this.exchanges.set('ZebPay', new ZebPayClient());
      console.log(chalk.green('✓ ZebPay initialized'));
    }
    
    // KuCoin
    if (process.env.KUCOIN_API_KEY && process.env.KUCOIN_API_KEY !== 'pending') {
      this.exchanges.set('KuCoin', new KuCoinClient({
        apiKey: process.env.KUCOIN_API_KEY,
        apiSecret: process.env.KUCOIN_API_SECRET!,
        passphrase: process.env.KUCOIN_PASSPHRASE!
      }));
      console.log(chalk.green('✓ KuCoin initialized'));
    }
    
    // CoinSwitch
    if (process.env.COINSWITCH_API_KEY && process.env.COINSWITCH_API_KEY !== 'pending') {
      this.exchanges.set('CoinSwitch', new CoinSwitchClient({
        apiKey: process.env.COINSWITCH_API_KEY,
        apiSecret: process.env.COINSWITCH_API_SECRET!
      }));
      console.log(chalk.green('✓ CoinSwitch initialized'));
    }
    
    console.log(chalk.cyan(`\nTotal exchanges configured: ${this.exchanges.size}\n`));
  }
  
  async fetchPrices() {
    const promises = Array.from(this.exchanges.entries()).map(async ([name, client]) => {
      try {
        let price, bid, ask, volume;
        
        switch (name) {
          case 'Binance':
            // Binance doesn't have direct USDT/INR, using USDT/BUSD as proxy
            const binanceTicker = await client.getTicker('USDTBUSD');
            const inrRate = 87.5; // Approximate INR conversion
            price = parseFloat(binanceTicker.lastPrice) * inrRate;
            bid = parseFloat(binanceTicker.bidPrice) * inrRate;
            ask = parseFloat(binanceTicker.askPrice) * inrRate;
            volume = parseFloat(binanceTicker.volume);
            break;
            
          case 'ZebPay':
            const zebpayData = await client.getTicker('USDT-INR');
            price = zebpayData.last;
            bid = zebpayData.buy;
            ask = zebpayData.sell;
            volume = zebpayData.volume;
            break;
            
          case 'KuCoin':
            const kucoinTicker = await client.getTicker('USDT-INR');
            price = parseFloat(kucoinTicker.price);
            bid = parseFloat(kucoinTicker.bestBid);
            ask = parseFloat(kucoinTicker.bestAsk);
            break;
            
          case 'CoinSwitch':
            const coinswitchTicker = await client.getTicker('USDT_INR');
            price = parseFloat(coinswitchTicker.last);
            bid = parseFloat(coinswitchTicker.bid);
            ask = parseFloat(coinswitchTicker.ask);
            volume = parseFloat(coinswitchTicker.volume);
            break;
        }
        
        this.prices.set(name, {
          exchange: name,
          price: price!,
          bid: bid!,
          ask: ask!,
          volume,
          timestamp: new Date()
        });
        
      } catch (error: any) {
        console.error(chalk.red(`${name} error: ${error.message}`));
      }
    });
    
    await Promise.all(promises);
  }
  
  displayPrices() {
    console.clear();
    console.log(chalk.cyan.bold('Multi-Exchange USDT/INR Monitor'));
    console.log(chalk.gray('━'.repeat(80)));
    console.log(chalk.yellow(`Last Update: ${new Date().toLocaleString()}\n`));
    
    // Create price table
    const table = new Table({
      head: [
        chalk.cyan('Exchange'),
        chalk.cyan('Bid (Buy)'),
        chalk.cyan('Ask (Sell)'),
        chalk.cyan('Last Price'),
        chalk.cyan('Spread %'),
        chalk.cyan('Volume')
      ],
      colWidths: [15, 12, 12, 12, 10, 15]
    });
    
    const priceArray = Array.from(this.prices.values());
    
    priceArray.forEach(data => {
      const spread = ((data.ask - data.bid) / data.bid * 100).toFixed(3);
      table.push([
        chalk.white(data.exchange),
        chalk.green(`₹${data.bid.toFixed(2)}`),
        chalk.red(`₹${data.ask.toFixed(2)}`),
        chalk.yellow(`₹${data.price.toFixed(2)}`),
        chalk.magenta(`${spread}%`),
        data.volume ? chalk.gray(`${(data.volume / 1000).toFixed(0)}K`) : chalk.gray('N/A')
      ]);
    });
    
    console.log(table.toString());
    
    // Find arbitrage opportunities
    this.findArbitrage();
  }
  
  findArbitrage() {
    const priceArray = Array.from(this.prices.values());
    if (priceArray.length < 2) return;
    
    console.log(chalk.cyan.bold('\nArbitrage Opportunities:'));
    console.log(chalk.gray('━'.repeat(80)));
    
    const opportunities: any[] = [];
    
    for (let i = 0; i < priceArray.length; i++) {
      for (let j = 0; j < priceArray.length; j++) {
        if (i === j) continue;
        
        const buy = priceArray[i];
        const sell = priceArray[j];
        
        const profit = ((sell.bid - buy.ask) / buy.ask) * 100;
        
        if (profit > 0.1) {
          opportunities.push({
            buyExchange: buy.exchange,
            sellExchange: sell.exchange,
            buyPrice: buy.ask,
            sellPrice: sell.bid,
            profit: profit
          });
        }
      }
    }
    
    if (opportunities.length === 0) {
      console.log(chalk.yellow('No profitable opportunities found at the moment.'));
    } else {
      opportunities
        .sort((a, b) => b.profit - a.profit)
        .slice(0, 5)
        .forEach(opp => {
          console.log(
            chalk.green(`${opp.buyExchange} → ${opp.sellExchange}: `) +
            chalk.white(`Buy at ₹${opp.buyPrice.toFixed(2)}, Sell at ₹${opp.sellPrice.toFixed(2)} `) +
            chalk.yellow.bold(`(${opp.profit.toFixed(2)}% profit)`)
          );
        });
    }
    
    // Best prices summary
    console.log(chalk.cyan.bold('\nBest Prices:'));
    console.log(chalk.gray('━'.repeat(80)));
    
    const bestBuy = priceArray.reduce((min, curr) => curr.ask < min.ask ? curr : min);
    const bestSell = priceArray.reduce((max, curr) => curr.bid > max.bid ? curr : max);
    
    console.log(chalk.green(`Best Buy: ${bestBuy.exchange} @ ₹${bestBuy.ask.toFixed(2)}`));
    console.log(chalk.red(`Best Sell: ${bestSell.exchange} @ ₹${bestSell.bid.toFixed(2)}`));
    console.log(chalk.yellow(`Max Spread: ₹${(bestSell.bid - bestBuy.ask).toFixed(2)} (${((bestSell.bid - bestBuy.ask) / bestBuy.ask * 100).toFixed(2)}%)`));
  }
  
  async start() {
    this.isRunning = true;
    
    console.log(chalk.cyan('Starting multi-exchange monitor...\n'));
    console.log(chalk.yellow('Press Ctrl+C to stop\n'));
    
    while (this.isRunning) {
      await this.fetchPrices();
      this.displayPrices();
      
      // Wait 5 seconds before next update
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
  
  stop() {
    this.isRunning = false;
  }
}

// Run the monitor
const monitor = new MultiExchangeMonitor();

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log(chalk.red('\n\nStopping monitor...'));
  monitor.stop();
  process.exit(0);
});

// Start monitoring
monitor.start().catch(console.error);