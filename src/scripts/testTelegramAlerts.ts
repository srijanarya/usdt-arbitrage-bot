import chalk from 'chalk';
import { telegramAlert } from '../services/telegram/TelegramAlertService';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function testTelegramAlerts() {
  console.log(chalk.bgCyan.black(' 🤖 Testing Telegram Alert System \n'));

  // Check configuration
  if (!process.env.TELEGRAM_BOT_TOKEN || !process.env.TELEGRAM_CHAT_ID) {
    console.log(chalk.red('❌ Missing Telegram configuration!'));
    console.log(chalk.yellow('\nPlease add to your .env file:'));
    console.log('TELEGRAM_BOT_TOKEN=your_bot_token_here');
    console.log('TELEGRAM_CHAT_ID=your_chat_id_here\n');
    console.log(chalk.gray('See TELEGRAM-SETUP.md for instructions'));
    return;
  }

  console.log(chalk.green('✅ Telegram configuration found\n'));

  try {
    // Test 1: Connection test
    console.log(chalk.yellow('1. Testing connection...'));
    const connected = await telegramAlert.testConnection();
    
    if (!connected) {
      console.log(chalk.red('❌ Connection test failed'));
      return;
    }
    
    console.log(chalk.green('✅ Connection successful!\n'));
    
    // Wait a bit between messages
    await sleep(2000);

    // Test 2: Arbitrage alert
    console.log(chalk.yellow('2. Sending arbitrage alert...'));
    await telegramAlert.sendArbitrageAlert(
      'ZebPay',
      'Binance P2P',
      84.50,
      90.00,
      432.75,
      5.12,
      100
    );
    console.log(chalk.green('✅ Arbitrage alert sent\n'));
    
    await sleep(2000);

    // Test 3: Price alert
    console.log(chalk.yellow('3. Sending price alert...'));
    await telegramAlert.sendPriceAlert('ZebPay', 83.75, 85.00);
    console.log(chalk.green('✅ Price alert sent\n'));
    
    await sleep(2000);

    // Test 4: Warning alert
    console.log(chalk.yellow('4. Sending warning alert...'));
    await telegramAlert.sendSystemAlert(
      'API Rate Limit Warning',
      'Approaching rate limit for Binance API (420/500 requests)',
      'warning'
    );
    console.log(chalk.green('✅ Warning alert sent\n'));
    
    await sleep(2000);

    // Test 5: Daily summary
    console.log(chalk.yellow('5. Sending daily summary...'));
    await telegramAlert.sendDailySummary(
      23,  // Total opportunities
      832.50,  // Best profit
      2500,  // Total volume
      ['ZebPay', 'Binance P2P', 'KuCoin']
    );
    console.log(chalk.green('✅ Daily summary sent\n'));

    console.log(chalk.bgGreen.black(' 🎉 All tests completed successfully! \n'));
    console.log(chalk.cyan('Check your Telegram for the test messages'));

  } catch (error) {
    console.error(chalk.red('❌ Test failed:', error.message));
    console.log(chalk.yellow('\nTroubleshooting tips:'));
    console.log('1. Check your bot token is correct');
    console.log('2. Make sure you\'ve started a chat with your bot');
    console.log('3. Verify your chat ID is correct');
    console.log('4. Check internet connection\n');
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Run tests
testTelegramAlerts().catch(console.error);