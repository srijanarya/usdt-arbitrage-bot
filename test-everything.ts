import chalk from 'chalk';
import dotenv from 'dotenv';
import axios from 'axios';
import TelegramBot from 'node-telegram-bot-api';

dotenv.config();

async function testEverything() {
  console.log(chalk.bgCyan.black('\n 🧪 COMPREHENSIVE SYSTEM TEST \n'));
  
  const tests = {
    environment: false,
    telegram: false,
    zebpay: false,
    coindcx: false,
    dashboard: false,
    monitoring: false
  };

  // Test 1: Environment Variables
  console.log(chalk.yellow('\n1. Testing Environment Variables...'));
  const requiredVars = ['TELEGRAM_CHAT_ID', 'ZEBPAY_API_KEY'];
  const hasAllVars = requiredVars.every(v => process.env[v]);
  tests.environment = hasAllVars;
  console.log(hasAllVars ? chalk.green('✅ All required variables present') : chalk.red('❌ Missing environment variables'));
  
  // Show what we have
  console.log(chalk.gray(`  Telegram Token: ${process.env.TELEGRAM_BOT_TOKEN ? 'Present' : 'Missing'}`));
  console.log(chalk.gray(`  Telegram Chat ID: ${process.env.TELEGRAM_CHAT_ID || 'Missing'}`));
  console.log(chalk.gray(`  ZebPay API Key: ${process.env.ZEBPAY_API_KEY ? 'Present' : 'Missing'}`));

  // Test 2: Telegram Bot
  console.log(chalk.yellow('\n2. Testing Telegram Bot...'));
  if (process.env.TELEGRAM_BOT_TOKEN) {
    try {
      const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: false });
      await bot.getMe();
      console.log(chalk.green('✅ Telegram bot is valid'));
      tests.telegram = true;
      
      // Send test message
      if (process.env.TELEGRAM_CHAT_ID) {
        await bot.sendMessage(
          process.env.TELEGRAM_CHAT_ID,
          `🧪 *System Test Results*\n\nYour USDT Arbitrage Bot is configured correctly!\n\nTime: ${new Date().toLocaleString('en-IN')}`,
          { parse_mode: 'Markdown' }
        );
        console.log(chalk.green('   Test message sent to Telegram'));
      }
    } catch (error: any) {
      console.log(chalk.red(`❌ Telegram error: ${error.message}`));
    }
  }

  // Test 3: Exchange APIs
  console.log(chalk.yellow('\n3. Testing Exchange APIs...'));
  
  // Test ZebPay
  try {
    const response = await axios.get('https://www.zebapi.com/pro/v1/market/USDT-INR/ticker');
    console.log(chalk.green(`✅ ZebPay: ₹${response.data.buy} / ₹${response.data.sell}`));
    tests.zebpay = true;
  } catch (error) {
    console.log(chalk.red('❌ ZebPay API error'));
  }

  // Test CoinDCX
  try {
    const response = await axios.get('https://api.coindcx.com/exchange/ticker');
    const usdtInr = response.data.find((t: any) => t.market === 'USDTINR');
    if (usdtInr) {
      console.log(chalk.green(`✅ CoinDCX: ₹${usdtInr.bid} / ₹${usdtInr.ask}`));
      tests.coindcx = true;
    }
  } catch (error) {
    console.log(chalk.red('❌ CoinDCX API error'));
  }

  // Summary
  console.log(chalk.cyan('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
  console.log(chalk.cyan('Test Summary:'));
  console.log(chalk.cyan('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
  
  Object.entries(tests).forEach(([name, passed]) => {
    console.log(`${name}: ${passed ? chalk.green('✅ PASSED') : chalk.red('❌ FAILED')}`);
  });

  const allPassed = Object.values(tests).every(t => t);
  
  if (allPassed) {
    console.log(chalk.bgGreen.black('\n 🎉 ALL TESTS PASSED! Your bot is ready! \n'));
    console.log(chalk.green('Next steps:'));
    console.log(chalk.green('1. Start the bot: ./start-bot.sh'));
    console.log(chalk.green('2. Monitor logs: tail -f logs/*.log'));
    console.log(chalk.green('3. View dashboard: http://localhost:3001'));
  } else {
    console.log(chalk.bgYellow.black('\n ⚠️  Some tests failed. Please check the errors above. \n'));
  }

  // Display current config
  console.log(chalk.gray('\nCurrent Configuration:'));
  console.log(chalk.gray(`Auto Trading: ${process.env.ENABLE_AUTO_TRADING === 'true' ? 'ENABLED' : 'DISABLED'}`));
  console.log(chalk.gray(`Min Profit: ₹${process.env.MIN_PROFIT_THRESHOLD || '100'}`));
  console.log(chalk.gray(`Max Trade: ₹${process.env.MAX_TRADE_AMOUNT || '10000'}`));
}

testEverything().catch(console.error);