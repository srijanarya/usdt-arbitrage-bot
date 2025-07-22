#!/usr/bin/env node
const axios = require('axios');
const chalk = require('chalk');
const Table = require('cli-table3');
const sound = require('sound-play');
const nodemailer = require('nodemailer');
const WebSocket = require('ws');
const { EventEmitter } = require('events');

class ExchangeRateMonitor extends EventEmitter {
  constructor(config = {}) {
    super();
    
    // Configuration
    this.config = {
      amount: config.amount || 13.78,
      buyPrice: config.buyPrice || 87.0,
      alertThreshold: config.alertThreshold || 86.5, // Alert when price drops below this
      profitThreshold: config.profitThreshold || 0.5, // 0.5% profit threshold
      refreshInterval: config.refreshInterval || 30000, // 30 seconds
      email: config.email || null,
      telegram: config.telegram || null,
      soundEnabled: config.soundEnabled !== false,
      ...config
    };
    
    // State
    this.exchangeRates = new Map();
    this.p2pRates = [];
    this.lastAlertTime = new Map();
    this.priceHistory = new Map();
    this.isRunning = false;
    
    // Initialize email if configured
    if (this.config.email && this.config.email.enabled) {
      this.emailTransporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: this.config.email.from,
          pass: this.config.email.password
        }
      });
    }
  }

  async fetchZebpayRates() {
    try {
      const response = await axios.get('https://www.zebpay.com/api/v2/market-ticker', {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        timeout: 5000
      });
      
      const usdtInr = response.data.find(pair => pair.pair === 'USDT-INR');
      if (usdtInr) {
        return {
          exchange: 'ZebPay',
          buyPrice: parseFloat(usdtInr.buy),
          sellPrice: parseFloat(usdtInr.sell),
          spread: parseFloat(usdtInr.sell) - parseFloat(usdtInr.buy),
          volume24h: parseFloat(usdtInr.volume),
          lastUpdate: new Date()
        };
      }
    } catch (error) {
      console.error(chalk.red('ZebPay fetch error:'), error.message);
    }
    return null;
  }

  async fetchWazirXRates() {
    try {
      const response = await axios.get('https://api.wazirx.com/sapi/v1/ticker/24hr', {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        timeout: 5000
      });
      
      const usdtInr = response.data.find(pair => pair.symbol === 'usdtinr');
      if (usdtInr) {
        return {
          exchange: 'WazirX',
          buyPrice: parseFloat(usdtInr.bidPrice),
          sellPrice: parseFloat(usdtInr.askPrice),
          spread: parseFloat(usdtInr.askPrice) - parseFloat(usdtInr.bidPrice),
          volume24h: parseFloat(usdtInr.volume),
          lastUpdate: new Date()
        };
      }
    } catch (error) {
      console.error(chalk.red('WazirX fetch error:'), error.message);
    }
    return null;
  }

  async fetchCoinDCXRates() {
    try {
      const response = await axios.get('https://api.coindcx.com/exchange/ticker', {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        timeout: 5000
      });
      
      const usdtInr = response.data.find(pair => pair.market === 'USDTINR');
      if (usdtInr) {
        return {
          exchange: 'CoinDCX',
          buyPrice: parseFloat(usdtInr.bid),
          sellPrice: parseFloat(usdtInr.ask),
          spread: parseFloat(usdtInr.ask) - parseFloat(usdtInr.bid),
          volume24h: parseFloat(usdtInr.volume),
          lastUpdate: new Date()
        };
      }
    } catch (error) {
      console.error(chalk.red('CoinDCX fetch error:'), error.message);
    }
    return null;
  }

  async fetchBinanceSpotRates() {
    try {
      const [orderBook, ticker24h] = await Promise.all([
        axios.get('https://api.binance.com/api/v3/ticker/bookTicker?symbol=USDTINR', { timeout: 5000 }),
        axios.get('https://api.binance.com/api/v3/ticker/24hr?symbol=USDTINR', { timeout: 5000 })
      ]);
      
      return {
        exchange: 'Binance',
        buyPrice: parseFloat(orderBook.data.bidPrice),
        sellPrice: parseFloat(orderBook.data.askPrice),
        spread: parseFloat(orderBook.data.askPrice) - parseFloat(orderBook.data.bidPrice),
        volume24h: parseFloat(ticker24h.data.volume),
        lastUpdate: new Date()
      };
    } catch (error) {
      console.error(chalk.red('Binance fetch error:'), error.message);
    }
    return null;
  }

  async fetchP2PRates() {
    try {
      const response = await axios.post(
        'https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search',
        {
          page: 1,
          rows: 20,
          asset: 'USDT',
          fiat: 'INR',
          tradeType: 'BUY', // Merchants buying USDT (we sell to them)
          payTypes: []
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'Mozilla/5.0'
          },
          timeout: 5000
        }
      );

      if (response.data && response.data.data) {
        this.p2pRates = response.data.data.map(ad => ({
          merchant: ad.advertiser.nickName,
          price: parseFloat(ad.adv.price),
          minLimit: parseFloat(ad.adv.minSingleTransAmount),
          maxLimit: parseFloat(ad.adv.maxSingleTransAmount),
          paymentMethods: ad.adv.tradeMethods.map(m => m.payType),
          completionRate: ad.advertiser.monthFinishRate * 100
        }));
      }
    } catch (error) {
      console.error(chalk.red('P2P fetch error:'), error.message);
    }
  }

  async fetchAllRates() {
    console.log(chalk.gray(`⏰ Updating rates at ${new Date().toLocaleTimeString()}...`));
    
    // Fetch all exchange rates in parallel
    const [zebpay, wazirx, coindcx, binance] = await Promise.allSettled([
      this.fetchZebpayRates(),
      this.fetchWazirXRates(),
      this.fetchCoinDCXRates(),
      this.fetchBinanceSpotRates()
    ]);

    // Update exchange rates
    if (zebpay.status === 'fulfilled' && zebpay.value) {
      this.exchangeRates.set('zebpay', zebpay.value);
    }
    if (wazirx.status === 'fulfilled' && wazirx.value) {
      this.exchangeRates.set('wazirx', wazirx.value);
    }
    if (coindcx.status === 'fulfilled' && coindcx.value) {
      this.exchangeRates.set('coindcx', coindcx.value);
    }
    if (binance.status === 'fulfilled' && binance.value) {
      this.exchangeRates.set('binance', binance.value);
    }

    // Fetch P2P rates
    await this.fetchP2PRates();

    // Check for alerts
    this.checkPriceAlerts();
    this.findArbitrageOpportunities();
  }

  checkPriceAlerts() {
    for (const [exchangeName, rate] of this.exchangeRates) {
      // Check if price is below alert threshold
      if (rate.sellPrice <= this.config.alertThreshold) {
        this.sendPriceAlert(exchangeName, rate.sellPrice);
      }

      // Track price history for trend detection
      if (!this.priceHistory.has(exchangeName)) {
        this.priceHistory.set(exchangeName, []);
      }
      const history = this.priceHistory.get(exchangeName);
      history.push({ price: rate.sellPrice, time: new Date() });
      
      // Keep last 10 prices
      if (history.length > 10) history.shift();
      
      // Check for rapid price drop (more than 1% in last 5 updates)
      if (history.length >= 5) {
        const recent = history.slice(-5);
        const priceChange = ((recent[4].price - recent[0].price) / recent[0].price) * 100;
        if (priceChange < -1) {
          this.sendTrendAlert(exchangeName, priceChange, recent[0].price, recent[4].price);
        }
      }
    }
  }

  async sendPriceAlert(exchange, currentPrice) {
    const lastAlert = this.lastAlertTime.get(`price-${exchange}`);
    const now = new Date();
    
    // Prevent spam - only alert once per hour
    if (lastAlert && (now - lastAlert) < 3600000) return;
    
    this.lastAlertTime.set(`price-${exchange}`, now);

    const message = `🚨 PRICE ALERT: USDT is cheap on ${exchange}!
Current Price: ₹${currentPrice.toFixed(2)}
Target Price: ₹${this.config.alertThreshold.toFixed(2)}
Opportunity: Buy now and sell on P2P for profit!`;

    // Console alert
    console.log(chalk.yellow.bold('\n' + '='.repeat(50)));
    console.log(chalk.yellow.bold(message));
    console.log(chalk.yellow.bold('='.repeat(50) + '\n'));

    // Sound alert
    if (this.config.soundEnabled) {
      try {
        await sound.play('./sounds/alert.mp3').catch(() => {});
      } catch (error) {}
    }

    // Email alert
    if (this.emailTransporter && this.config.email.to) {
      try {
        await this.emailTransporter.sendMail({
          from: this.config.email.from,
          to: this.config.email.to,
          subject: `USDT Price Alert - ${exchange}`,
          text: message,
          html: `<h2>🚨 USDT Price Alert</h2><pre>${message}</pre>`
        });
      } catch (error) {
        console.error('Email send error:', error.message);
      }
    }

    this.emit('priceAlert', { exchange, currentPrice, threshold: this.config.alertThreshold });
  }

  async sendTrendAlert(exchange, changePercent, oldPrice, newPrice) {
    const lastAlert = this.lastAlertTime.get(`trend-${exchange}`);
    const now = new Date();
    
    if (lastAlert && (now - lastAlert) < 1800000) return; // 30 min cooldown
    
    this.lastAlertTime.set(`trend-${exchange}`, now);

    const message = `📉 PRICE DROP ALERT on ${exchange}!
Price dropped ${Math.abs(changePercent).toFixed(2)}% rapidly
From: ₹${oldPrice.toFixed(2)} → ₹${newPrice.toFixed(2)}`;

    console.log(chalk.red.bold('\n' + message + '\n'));
    
    this.emit('trendAlert', { exchange, changePercent, oldPrice, newPrice });
  }

  findArbitrageOpportunities() {
    const opportunities = [];
    
    // Check exchange to P2P opportunities
    for (const [exchangeName, exchangeRate] of this.exchangeRates) {
      for (const p2pRate of this.p2pRates.slice(0, 5)) { // Top 5 P2P rates
        const buyPrice = exchangeRate.sellPrice; // Price to buy from exchange
        const sellPrice = p2pRate.price; // Price to sell on P2P
        const profit = (sellPrice - buyPrice) * this.config.amount;
        const profitPercent = ((sellPrice - buyPrice) / buyPrice) * 100;
        
        // Check if order amount fits P2P limits
        const orderAmount = sellPrice * this.config.amount;
        const fitsLimits = orderAmount >= p2pRate.minLimit && orderAmount <= p2pRate.maxLimit;

        if (profit > 0 && profitPercent >= this.config.profitThreshold && fitsLimits) {
          opportunities.push({
            type: 'exchange-to-p2p',
            buyFrom: exchangeName,
            sellTo: p2pRate.merchant,
            buyPrice,
            sellPrice,
            profit,
            profitPercent,
            volume: this.config.amount,
            paymentMethods: p2pRate.paymentMethods
          });
        }
      }
    }

    // Sort by profit
    opportunities.sort((a, b) => b.profit - a.profit);

    if (opportunities.length > 0 && opportunities[0].profitPercent > 1) {
      this.sendProfitAlert(opportunities[0]);
    }

    return opportunities;
  }

  async sendProfitAlert(opportunity) {
    const message = `💰 HIGH PROFIT OPPORTUNITY!
Buy from: ${opportunity.buyFrom} @ ₹${opportunity.buyPrice.toFixed(2)}
Sell to: ${opportunity.sellTo} @ ₹${opportunity.sellPrice.toFixed(2)}
Profit: ₹${opportunity.profit.toFixed(2)} (${opportunity.profitPercent.toFixed(2)}%)
Amount: ${opportunity.volume} USDT
Payment: ${opportunity.paymentMethods.join(', ')}`;

    console.log(chalk.green.bold('\n' + '💰'.repeat(25)));
    console.log(chalk.green.bold(message));
    console.log(chalk.green.bold('💰'.repeat(25) + '\n'));

    if (this.config.soundEnabled) {
      try {
        await sound.play('./sounds/profit.mp3').catch(() => {});
      } catch (error) {}
    }

    this.emit('profitOpportunity', opportunity);
  }

  displayResults() {
    console.clear();
    
    // Header
    console.log(chalk.blue.bold('🚀 USDT Exchange Rate Monitor'));
    console.log(chalk.gray(`Position: ${this.config.amount} USDT | Buy Price: ₹${this.config.buyPrice}`));
    console.log(chalk.gray(`Alert Threshold: < ₹${this.config.alertThreshold} | Last Update: ${new Date().toLocaleTimeString()}`));
    console.log(chalk.gray('─'.repeat(80)));

    // Exchange Rates Table
    console.log(chalk.cyan('\n💱 Live Exchange Rates:'));
    const exchangeTable = new Table({
      head: ['Exchange', 'Buy Price', 'Sell Price', 'Spread', '24h Volume', 'Status'],
      colWidths: [12, 12, 12, 10, 15, 20]
    });

    for (const [name, rate] of this.exchangeRates) {
      const isCheap = rate.sellPrice <= this.config.alertThreshold;
      const status = isCheap ? chalk.green('🔥 CHEAP!') : '';
      
      exchangeTable.push([
        name,
        chalk.green(`₹${rate.buyPrice.toFixed(2)}`),
        chalk.red(`₹${rate.sellPrice.toFixed(2)}`),
        `₹${rate.spread.toFixed(2)}`,
        `${(rate.volume24h / 1000000).toFixed(2)}M`,
        status
      ]);
    }
    console.log(exchangeTable.toString());

    // P2P Rates Table
    if (this.p2pRates.length > 0) {
      console.log(chalk.cyan('\n📊 Top P2P Buy Rates:'));
      const p2pTable = new Table({
        head: ['Merchant', 'Price', 'Profit', 'Min-Max', 'Payment'],
        colWidths: [20, 12, 15, 20, 25]
      });

      this.p2pRates.slice(0, 5).forEach(rate => {
        const profit = (rate.price - this.config.buyPrice) * this.config.amount;
        const profitPercent = ((rate.price - this.config.buyPrice) / this.config.buyPrice) * 100;
        const profitColor = profit > 0 ? chalk.green : chalk.red;
        
        p2pTable.push([
          rate.merchant,
          `₹${rate.price.toFixed(2)}`,
          profitColor(`₹${profit.toFixed(2)} (${profitPercent.toFixed(1)}%)`),
          `₹${rate.minLimit}-${rate.maxLimit}`,
          rate.paymentMethods.slice(0, 2).join(', ')
        ]);
      });
      console.log(p2pTable.toString());
    }

    // Arbitrage Opportunities
    const opportunities = this.findArbitrageOpportunities();
    if (opportunities.length > 0) {
      console.log(chalk.yellow.bold('\n🎯 ARBITRAGE OPPORTUNITIES:'));
      const oppTable = new Table({
        head: ['Buy From', 'Sell To', 'Buy', 'Sell', 'Profit', 'ROI'],
        colWidths: [12, 20, 10, 10, 15, 10]
      });

      opportunities.slice(0, 3).forEach(opp => {
        oppTable.push([
          opp.buyFrom,
          opp.sellTo,
          `₹${opp.buyPrice.toFixed(2)}`,
          `₹${opp.sellPrice.toFixed(2)}`,
          chalk.green.bold(`₹${opp.profit.toFixed(2)}`),
          chalk.green(`${opp.profitPercent.toFixed(2)}%`)
        ]);
      });
      console.log(oppTable.toString());
    }

    // Status line
    console.log(chalk.gray('\n─'.repeat(80)));
    console.log(chalk.gray('Press Ctrl+C to stop | Refreshing every 30 seconds...'));
  }

  setupWebSocketConnections() {
    // WazirX WebSocket for real-time updates
    try {
      const ws = new WebSocket('wss://stream.wazirx.com/stream');
      
      ws.on('open', () => {
        ws.send(JSON.stringify({
          event: 'subscribe',
          streams: ['usdtinr@ticker']
        }));
        console.log(chalk.green('✓ WazirX WebSocket connected'));
      });
      
      ws.on('message', (data) => {
        try {
          const parsed = JSON.parse(data.toString());
          if (parsed.stream === 'usdtinr@ticker' && parsed.data) {
            const rate = this.exchangeRates.get('wazirx');
            if (rate) {
              rate.buyPrice = parseFloat(parsed.data.b);
              rate.sellPrice = parseFloat(parsed.data.a);
              rate.lastUpdate = new Date();
              
              // Check for alerts on real-time update
              if (rate.sellPrice <= this.config.alertThreshold) {
                this.sendPriceAlert('WazirX', rate.sellPrice);
              }
            }
          }
        } catch (error) {}
      });

      ws.on('error', (error) => {
        console.error(chalk.red('WazirX WebSocket error:'), error.message);
      });

      ws.on('close', () => {
        console.log(chalk.yellow('WazirX WebSocket disconnected, reconnecting...'));
        setTimeout(() => this.setupWebSocketConnections(), 5000);
      });
    } catch (error) {
      console.error(chalk.red('WebSocket setup error:'), error.message);
    }
  }

  async start() {
    console.log(chalk.blue.bold('\n🚀 Starting USDT Exchange Rate Monitor...\n'));
    this.isRunning = true;

    // Setup WebSocket for real-time updates
    this.setupWebSocketConnections();

    // Initial fetch
    await this.fetchAllRates();
    this.displayResults();

    // Set up periodic updates
    this.updateInterval = setInterval(async () => {
      if (this.isRunning) {
        await this.fetchAllRates();
        this.displayResults();
      }
    }, this.config.refreshInterval);

    // Handle graceful shutdown
    process.on('SIGINT', () => {
      console.log(chalk.red('\n\n👋 Shutting down monitor...'));
      this.stop();
      process.exit(0);
    });
  }

  stop() {
    this.isRunning = false;
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }
  }
}

// Command line usage
if (require.main === module) {
  const args = process.argv.slice(2);
  const config = {
    amount: 13.78,
    buyPrice: 87.0,
    alertThreshold: 86.5,
    soundEnabled: true
  };

  // Parse command line arguments
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i].replace('--', '');
    const value = args[i + 1];
    
    if (key === 'amount') config.amount = parseFloat(value);
    else if (key === 'price') config.buyPrice = parseFloat(value);
    else if (key === 'alert') config.alertThreshold = parseFloat(value);
    else if (key === 'nosound') config.soundEnabled = false;
  }

  console.log(chalk.gray('Usage: node exchange-rate-monitor.js [--amount 13.78] [--price 87.0] [--alert 86.5] [--nosound]'));
  console.log(chalk.gray(`Config: Amount=${config.amount} USDT, Buy Price=₹${config.buyPrice}, Alert<₹${config.alertThreshold}\n`));

  const monitor = new ExchangeRateMonitor(config);
  monitor.start();
}

module.exports = ExchangeRateMonitor;