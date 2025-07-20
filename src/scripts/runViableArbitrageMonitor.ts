import chalk from 'chalk';
import { priceMonitor } from '../services/websocket/SimpleWebSocketMonitor';
import { arbitrageCalculator } from '../services/arbitrage/USDTArbitrageCalculator';
import { canWithdraw, exchangeStatus } from '../services/exchanges/exchangeStatus';
import axios from 'axios';

async function runViableArbitrageMonitor() {
  console.log(chalk.bgCyan.black(' 🚀 Viable Arbitrage Monitor (Only Working Exchanges) \n'));
  
  const config = {
    defaultAmount: 100,
    minProfit: 100,
    checkInterval: 10000  // 10 seconds
  };

  // Override the price monitor to exclude non-working exchanges
  const originalStart = priceMonitor.start.bind(priceMonitor);
  priceMonitor.start = async function() {
    console.log(chalk.yellow('🔍 Monitoring only exchanges with withdrawals enabled...\n'));
    this.isRunning = true;
    
    // Only monitor working exchanges
    if (canWithdraw('zebpay')) {
      startZebPayMonitoring();
    }
    if (canWithdraw('kucoin')) {
      startKuCoinMonitoring();
    }
    startBinanceP2PMonitoring();
    checkNiyoGlobalRoute();
  };

  async function startZebPayMonitoring() {
    const fetchPrice = async () => {
      try {
        const response = await axios.get('https://www.zebapi.com/pro/v1/market/USDT-INR/ticker');
        const priceUpdate = {
          exchange: 'zebpay',
          symbol: 'USDT/INR',
          bid: parseFloat(response.data.buy),
          ask: parseFloat(response.data.sell),
          timestamp: new Date()
        };
        
        priceMonitor['updatePrice'](priceUpdate);
        checkViableArbitrage(priceUpdate);
        
      } catch (error) {
        console.error(chalk.red('ZebPay error:', error.message));
      }
    };
    
    fetchPrice();
    setInterval(fetchPrice, 10000);
  }

  async function startKuCoinMonitoring() {
    const fetchPrice = async () => {
      try {
        // KuCoin doesn't have direct INR pairs, check USDT/USDC
        const response = await axios.get('https://api.kucoin.com/api/v1/market/orderbook/level1?symbol=USDT-USDC');
        if (response.data?.data) {
          const usdcPrice = parseFloat(response.data.data.price);
          // Convert to INR equivalent (assuming 1 USDC = 83.5 INR)
          const inrEquivalent = usdcPrice * 83.5;
          
          console.log(chalk.gray(`KuCoin USDT/USDC: ${usdcPrice} (≈ ₹${inrEquivalent})`));
        }
      } catch (error) {
        console.error(chalk.red('KuCoin error:', error.message));
      }
    };
    
    fetchPrice();
    setInterval(fetchPrice, 15000);
  }

  async function startBinanceP2PMonitoring() {
    const fetchPrice = async () => {
      try {
        const response = await axios.post(
          'https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search',
          {
            page: 1,
            rows: 5,
            asset: "USDT",
            fiat: "INR",
            tradeType: "SELL"
          }
        );
        
        if (response.data?.data?.[0]) {
          const bestPrice = parseFloat(response.data.data[0].adv.price);
          const priceUpdate = {
            exchange: 'binance_p2p',
            symbol: 'USDT/INR',
            bid: bestPrice,
            ask: bestPrice,
            timestamp: new Date()
          };
          
          priceMonitor['updatePrice'](priceUpdate);
        }
      } catch (error) {
        console.error(chalk.red('P2P error:', error.message));
      }
    };
    
    fetchPrice();
    setInterval(fetchPrice, 15000);
  }

  async function checkNiyoGlobalRoute() {
    console.log(chalk.cyan('\n💳 Checking Niyo Global card routes...\n'));
    
    // Check international P2P markets for Niyo
    const markets = ['USD', 'EUR', 'SGD', 'AED'];
    
    for (const fiat of markets) {
      try {
        const response = await axios.post(
          'https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search',
          {
            page: 1,
            rows: 3,
            asset: "USDT",
            fiat: fiat,
            tradeType: "BUY"
          }
        );
        
        if (response.data?.data?.[0]) {
          const price = parseFloat(response.data.data[0].adv.price);
          const forexRates = { USD: 83.5, EUR: 90.95, SGD: 61.85, AED: 22.75 };
          const inrPrice = price * (forexRates[fiat] || 83.5);
          
          console.log(chalk.yellow(`${fiat} P2P: ${price} ${fiat} = ₹${inrPrice.toFixed(2)}`));
        }
      } catch (e) {}
    }
  }

  async function checkViableArbitrage(priceUpdate: any) {
    const prices = priceMonitor.getCurrentPrices();
    const p2pPrice = prices.get('binance_p2p_USDT/INR');
    
    if (!p2pPrice || !canWithdraw(priceUpdate.exchange)) return;
    
    const analysis = arbitrageCalculator.calculateProfit(
      priceUpdate.ask,
      p2pPrice.bid,
      config.defaultAmount
    );
    
    if (analysis.profitable && analysis.netProfit >= config.minProfit) {
      console.log(chalk.bgGreen.black('\n 💰 VIABLE ARBITRAGE OPPORTUNITY! '));
      console.log(chalk.yellow(`Buy ${priceUpdate.exchange}: ₹${priceUpdate.ask.toFixed(2)}`));
      console.log(chalk.green(`Sell P2P: ₹${p2pPrice.bid.toFixed(2)}`));
      console.log(chalk.cyan(`Net Profit: ₹${analysis.netProfit.toFixed(2)} (${analysis.roi.toFixed(2)}%)`));
      console.log(chalk.white(`✅ Withdrawals available on ${priceUpdate.exchange}`));
    }
  }

  // Start monitoring
  priceMonitor.start();

  // Display dashboard
  const displayInterval = setInterval(() => {
    console.clear();
    console.log(chalk.bgCyan.black(' 💹 Viable Arbitrage Opportunities Only \n'));
    
    // Show exchange status
    console.log(chalk.yellow('🏦 Exchange Status:'));
    console.log(chalk.gray('─'.repeat(60)));
    
    Object.entries(exchangeStatus).forEach(([exchange, status]) => {
      const color = status.withdrawalsEnabled ? chalk.green : chalk.red;
      const icon = status.withdrawalsEnabled ? '✅' : '❌';
      console.log(
        `${icon} ${exchange.padEnd(12)} | ` +
        color(`Withdrawals: ${status.withdrawalsEnabled ? 'ENABLED' : 'DISABLED'}`) +
        ` | ${status.reason}`
      );
    });
    
    console.log(chalk.gray('─'.repeat(60)));
    
    // Show viable opportunities
    const prices = priceMonitor.getCurrentPrices();
    const p2pPrice = prices.get('binance_p2p_USDT/INR');
    
    console.log(chalk.yellow('\n💰 Viable Arbitrage Routes:'));
    
    // Check ZebPay
    const zebpayPrice = prices.get('zebpay_USDT/INR');
    if (zebpayPrice && p2pPrice) {
      const analysis = arbitrageCalculator.calculateProfit(
        zebpayPrice.ask,
        p2pPrice.bid,
        config.defaultAmount
      );
      
      console.log(chalk.cyan('\n1. ZebPay → Binance P2P:'));
      console.log(`   Buy: ₹${zebpayPrice.ask.toFixed(2)} | Sell: ₹${p2pPrice.bid.toFixed(2)}`);
      console.log(`   Profit: ${analysis.profitable ? chalk.green(`₹${analysis.netProfit.toFixed(2)} (${analysis.roi.toFixed(2)}%)`) : chalk.red('Not profitable')}`);
    }
    
    // Alternative routes
    console.log(chalk.yellow('\n🌍 International Routes (with Niyo Global):'));
    console.log(chalk.gray('1. Buy USDT with Niyo on international P2P'));
    console.log(chalk.gray('2. Transfer to Binance'));
    console.log(chalk.gray('3. Sell on INR P2P'));
    
    console.log(chalk.gray('\n⏳ Refreshing every 10 seconds...'));
    console.log(chalk.gray('Press Ctrl+C to stop'));
    
  }, 10000);

  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log(chalk.yellow('\n\nShutting down...'));
    clearInterval(displayInterval);
    process.exit(0);
  });
}

// Run the monitor
runViableArbitrageMonitor().catch(console.error);