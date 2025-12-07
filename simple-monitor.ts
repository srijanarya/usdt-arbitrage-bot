import chalk from 'chalk';
import axios from 'axios';
import TelegramBot from 'node-telegram-bot-api';
import dotenv from 'dotenv';

dotenv.config();

// Load credentials from environment variables
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
  console.error(chalk.red('❌ Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID in .env file'));
  process.exit(1);
}

class SimpleArbitrageMonitor {
  private bot: TelegramBot;
  private lastAlert: { [key: string]: number } = {};
  private alertCooldown = 60000; // 1 minute between similar alerts

  constructor() {
    this.bot = new TelegramBot(TELEGRAM_BOT_TOKEN, { polling: false });
    console.log(chalk.green('✅ Telegram bot initialized'));
  }

  async start() {
    console.log(chalk.bgCyan.black('\n 🚀 SIMPLE ARBITRAGE MONITOR STARTED \n'));
    
    // Send startup message
    try {
      await this.bot.sendMessage(
        TELEGRAM_CHAT_ID,
        '🚀 *Arbitrage Bot Started*\n\nMonitoring USDT prices across exchanges...',
        { parse_mode: 'Markdown' }
      );
    } catch (error) {
      console.log(chalk.yellow('⚠️ Could not send Telegram message'));
    }

    // Start monitoring
    this.monitor();
    setInterval(() => this.monitor(), 30000); // Check every 30 seconds
  }

  async monitor() {
    try {
      console.log(chalk.yellow(`\n📊 Checking prices at ${new Date().toLocaleTimeString()}...`));
      
      // Fetch prices
      const prices = await this.fetchPrices();
      
      // Display prices
      this.displayPrices(prices);
      
      // Check for arbitrage
      this.checkArbitrage(prices);
      
    } catch (error) {
      console.error(chalk.red('Monitor error:'), error);
    }
  }

  async fetchPrices() {
    const prices: any = {};

    // ZebPay
    try {
      const response = await axios.get('https://www.zebapi.com/pro/v1/market/USDT-INR/ticker');
      prices.zebpay = {
        buy: parseFloat(response.data.sell), // Their sell is our buy
        sell: parseFloat(response.data.buy), // Their buy is our sell
        exchange: 'ZebPay'
      };
    } catch (error) {
      console.log(chalk.red('❌ ZebPay error'));
    }

    // CoinDCX
    try {
      const response = await axios.get('https://api.coindcx.com/exchange/ticker');
      const usdtInr = response.data.find((t: any) => t.market === 'USDTINR');
      if (usdtInr) {
        prices.coindcx = {
          buy: parseFloat(usdtInr.ask),
          sell: parseFloat(usdtInr.bid),
          exchange: 'CoinDCX'
        };
      }
    } catch (error) {
      console.log(chalk.red('❌ CoinDCX error'));
    }

    // P2P (simulated realistic rate)
    prices.p2p = {
      buy: 90.00,
      sell: 94.00,
      exchange: 'P2P Market'
    };

    return prices;
  }

  displayPrices(prices: any) {
    console.log(chalk.cyan('\n💹 Current Prices:'));
    Object.entries(prices).forEach(([key, data]: [string, any]) => {
      console.log(`${data.exchange}: Buy ₹${data.buy.toFixed(2)} | Sell ₹${data.sell.toFixed(2)}`);
    });
  }

  async checkArbitrage(prices: any) {
    const opportunities = [];
    const minProfit = 100; // ₹100 minimum profit
    const tradeAmount = 10000; // ₹10,000 trade size

    // Check all possible pairs
    const exchanges = Object.keys(prices);
    
    for (let i = 0; i < exchanges.length; i++) {
      for (let j = 0; j < exchanges.length; j++) {
        if (i !== j) {
          const buy = prices[exchanges[i]];
          const sell = prices[exchanges[j]];
          
          const usdtAmount = tradeAmount / buy.buy;
          const sellAmount = usdtAmount * sell.sell;
          
          // Calculate profit considering fees
          const buyFee = tradeAmount * 0.002; // 0.2% fee
          const sellFee = sellAmount * 0.002; // 0.2% fee
          const profit = sellAmount - tradeAmount - buyFee - sellFee;
          const profitPercent = (profit / tradeAmount) * 100;
          
          if (profit > minProfit) {
            opportunities.push({
              buyExchange: buy.exchange,
              sellExchange: sell.exchange,
              buyPrice: buy.buy,
              sellPrice: sell.sell,
              profit: profit,
              profitPercent: profitPercent,
              usdtAmount: usdtAmount
            });
          }
        }
      }
    }

    // Alert on opportunities
    if (opportunities.length > 0) {
      console.log(chalk.bgGreen.black('\n 💰 ARBITRAGE OPPORTUNITIES FOUND! \n'));
      
      for (const opp of opportunities) {
        console.log(chalk.green(`${opp.buyExchange} → ${opp.sellExchange}`));
        console.log(chalk.green(`Buy at ₹${opp.buyPrice.toFixed(2)}, Sell at ₹${opp.sellPrice.toFixed(2)}`));
        console.log(chalk.green(`Profit: ₹${opp.profit.toFixed(2)} (${opp.profitPercent.toFixed(2)}%)`));
        console.log(chalk.green(`USDT Amount: ${opp.usdtAmount.toFixed(2)}\n`));
        
        // Send Telegram alert (with cooldown)
        const alertKey = `${opp.buyExchange}-${opp.sellExchange}`;
        const now = Date.now();
        
        if (!this.lastAlert[alertKey] || now - this.lastAlert[alertKey] > this.alertCooldown) {
          this.lastAlert[alertKey] = now;
          
          const message = `💰 *Arbitrage Opportunity!*\n\n` +
            `Route: ${opp.buyExchange} → ${opp.sellExchange}\n` +
            `Buy Price: ₹${opp.buyPrice.toFixed(2)}\n` +
            `Sell Price: ₹${opp.sellPrice.toFixed(2)}\n` +
            `Profit: ₹${opp.profit.toFixed(2)} (${opp.profitPercent.toFixed(2)}%)\n` +
            `Amount: ${opp.usdtAmount.toFixed(2)} USDT\n\n` +
            `⏰ ${new Date().toLocaleTimeString('en-IN')}`;
          
          try {
            await this.bot.sendMessage(TELEGRAM_CHAT_ID, message, { parse_mode: 'Markdown' });
          } catch (error) {
            console.log(chalk.yellow('⚠️ Could not send Telegram alert'));
          }
        }
      }
    } else {
      console.log(chalk.yellow('\n📊 No profitable opportunities at the moment'));
    }
  }
}

// Start the monitor
const monitor = new SimpleArbitrageMonitor();
monitor.start().catch(console.error);

// Handle shutdown
process.on('SIGINT', async () => {
  console.log(chalk.yellow('\n\n🛑 Shutting down...'));
  try {
    await monitor.bot.sendMessage(
      TELEGRAM_CHAT_ID,
      '🛑 *Bot Stopped*\n\nArbitrage monitoring has been stopped.',
      { parse_mode: 'Markdown' }
    );
  } catch (error) {
    // Ignore errors during shutdown
  }
  process.exit(0);
});