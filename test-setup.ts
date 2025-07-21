import chalk from 'chalk';
import dotenv from 'dotenv';
import { ZebPayClient } from './src/services/exchanges/ZebPayClient';
import TelegramBot from 'node-telegram-bot-api';
import { Pool } from 'pg';

dotenv.config();

async function testSetup() {
  console.log(chalk.bgCyan.black('\n 🧪 Testing USDT Arbitrage Bot Setup \n'));
  
  let passedTests = 0;
  let totalTests = 0;

  // Test 1: Environment Variables
  totalTests++;
  console.log(chalk.yellow('\n1. Checking Environment Variables...'));
  const requiredVars = ['TELEGRAM_CHAT_ID', 'ZEBPAY_API_KEY', 'ZEBPAY_API_SECRET'];
  const missingVars = requiredVars.filter(v => !process.env[v]);
  
  if (missingVars.length === 0) {
    console.log(chalk.green('✅ All required environment variables present'));
    passedTests++;
  } else {
    console.log(chalk.red(`❌ Missing variables: ${missingVars.join(', ')}`));
  }

  // Test 2: ZebPay API
  totalTests++;
  console.log(chalk.yellow('\n2. Testing ZebPay API...'));
  try {
    const zebpay = new ZebPayClient(
      process.env.ZEBPAY_API_KEY!,
      process.env.ZEBPAY_API_SECRET!
    );
    const ticker = await zebpay.getUSDTINRPrice();
    console.log(chalk.green(`✅ ZebPay API: Buy ₹${ticker.buyPrice} | Sell ₹${ticker.sellPrice}`));
    passedTests++;
  } catch (error: any) {
    console.log(chalk.red(`❌ ZebPay Error: ${error.message}`));
  }

  // Test 3: Telegram Bot
  totalTests++;
  console.log(chalk.yellow('\n3. Testing Telegram Bot...'));
  try {
    const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN!, { polling: false });
    await bot.sendMessage(
      process.env.TELEGRAM_CHAT_ID!,
      '🧪 Test Message: USDT Arbitrage Bot is configured correctly!'
    );
    console.log(chalk.green('✅ Telegram message sent successfully'));
    passedTests++;
  } catch (error: any) {
    console.log(chalk.red(`❌ Telegram Error: ${error.message}`));
  }

  // Test 4: Database Connection
  totalTests++;
  console.log(chalk.yellow('\n4. Testing Database Connection...'));
  try {
    const pool = new Pool({
      host: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
    });
    
    await pool.query('SELECT NOW()');
    console.log(chalk.green('✅ Database connected successfully'));
    passedTests++;
    await pool.end();
  } catch (error: any) {
    console.log(chalk.red(`❌ Database Error: ${error.message}`));
    console.log(chalk.yellow('   Tip: Make sure PostgreSQL is running'));
  }

  // Summary
  console.log(chalk.cyan('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
  console.log(chalk.cyan(`Test Results: ${passedTests}/${totalTests} passed`));
  console.log(chalk.cyan('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));

  if (passedTests === totalTests) {
    console.log(chalk.bgGreen.black('\n ✅ All tests passed! Your bot is ready to run. \n'));
    console.log(chalk.green('Next steps:'));
    console.log(chalk.green('1. Run the integrated monitor: npm run monitor:integrated'));
    console.log(chalk.green('2. Open the dashboard: npm run dashboard (then visit http://localhost:3001)'));
    console.log(chalk.green('3. Monitor Telegram for arbitrage alerts'));
  } else {
    console.log(chalk.bgYellow.black('\n ⚠️  Some tests failed. Please fix the issues above. \n'));
  }
}

testSetup().catch(console.error);