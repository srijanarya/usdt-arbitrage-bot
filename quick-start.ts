#!/usr/bin/env node
import chalk from 'chalk';
import { spawn } from 'child_process';
import axios from 'axios';

console.log(chalk.bgCyan.black('\n 🚀 USDT ARBITRAGE BOT - QUICK START \n'));

// Manually set the token since dotenv seems to have issues
process.env.TELEGRAM_BOT_TOKEN = '8070785411:AAFuGOlbn7UmB4B53mJQZey-EGaNMVKaeF0';
process.env.TELEGRAM_CHAT_ID = '1271429958';

async function checkServices() {
  console.log(chalk.yellow('Checking services...\n'));
  
  // Check if dashboard is running
  try {
    await axios.get('http://localhost:3001');
    console.log(chalk.green('✅ Dashboard is running at http://localhost:3001'));
  } catch {
    console.log(chalk.red('❌ Dashboard is not running'));
    console.log(chalk.yellow('   Starting dashboard...'));
    
    // Start dashboard
    const dashboard = spawn('npm', ['run', 'dashboard'], {
      detached: true,
      stdio: 'ignore'
    });
    dashboard.unref();
    
    // Wait for it to start
    await new Promise(resolve => setTimeout(resolve, 5000));
  }
  
  // Check exchanges
  console.log(chalk.yellow('\nChecking exchange connections...'));
  
  try {
    const zebpay = await axios.get('https://www.zebapi.com/pro/v1/market/USDT-INR/ticker');
    console.log(chalk.green(`✅ ZebPay: Buy ₹${zebpay.data.buy} / Sell ₹${zebpay.data.sell}`));
  } catch {
    console.log(chalk.red('❌ ZebPay connection failed'));
  }
  
  try {
    const coindcx = await axios.get('https://api.coindcx.com/exchange/ticker');
    const usdt = coindcx.data.find((t: any) => t.market === 'USDTINR');
    console.log(chalk.green(`✅ CoinDCX: Buy ₹${usdt.bid} / Sell ₹${usdt.ask}`));
  } catch {
    console.log(chalk.red('❌ CoinDCX connection failed'));
  }
}

async function startMonitoring() {
  console.log(chalk.yellow('\n🚀 Starting monitoring system...'));
  console.log(chalk.gray('This will monitor prices and send Telegram alerts\n'));
  
  // Import and start the monitor
  const { exec } = require('child_process');
  
  const monitor = exec('npm run monitor:integrated', (error, stdout, stderr) => {
    if (error) {
      console.error(chalk.red(`Error: ${error.message}`));
      return;
    }
  });
  
  monitor.stdout?.on('data', (data) => {
    console.log(data);
  });
  
  monitor.stderr?.on('data', (data) => {
    if (!data.includes('DeprecationWarning')) {
      console.error(chalk.red(data));
    }
  });
}

// Main execution
(async () => {
  try {
    await checkServices();
    
    console.log(chalk.bgGreen.black('\n ✅ SYSTEM READY! \n'));
    console.log(chalk.cyan('Dashboard: http://localhost:3001'));
    console.log(chalk.cyan('Telegram: Alerts configured'));
    console.log(chalk.cyan('Monitoring: Starting...\n'));
    
    // Start monitoring
    await startMonitoring();
    
  } catch (error) {
    console.error(chalk.red('Failed to start:'), error);
  }
})();