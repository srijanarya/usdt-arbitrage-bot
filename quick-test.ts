import chalk from 'chalk';
import dotenv from 'dotenv';

dotenv.config();

async function quickTest() {
  console.log(chalk.bgCyan.black('\n 🚀 USDT Arbitrage Bot Quick Test \n'));

  // Test 1: Check Telegram Config
  console.log(chalk.yellow('\n1. Telegram Configuration:'));
  if (process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID) {
    console.log(chalk.green('✅ Telegram configured'));
    console.log(`   Bot Token: ${process.env.TELEGRAM_BOT_TOKEN.substring(0, 10)}...`);
    console.log(`   Chat ID: ${process.env.TELEGRAM_CHAT_ID}`);
  } else {
    console.log(chalk.red('❌ Telegram not configured'));
  }

  // Test 2: Run the integrated monitor
  console.log(chalk.yellow('\n2. Starting Integrated Monitor...'));
  console.log(chalk.cyan('This will monitor prices and send alerts to Telegram'));
  console.log(chalk.cyan('Press Ctrl+C to stop\n'));

  // Import and run the monitor
  const { IntegratedArbitrageMonitor } = await import('./src/monitorIntegrated');
  const monitor = new IntegratedArbitrageMonitor();
  await monitor.start();
}

quickTest().catch(console.error);