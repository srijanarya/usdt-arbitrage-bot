import { ComprehensiveTradingBot, BotConfig } from './bot/comprehensiveTradingBot';
import chalk from 'chalk';
import Table from 'cli-table3';
import readline from 'readline';
import dotenv from 'dotenv';

dotenv.config();

// Create readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

async function runBot() {
  console.clear();
  console.log(chalk.cyan.bold('═'.repeat(60)));
  console.log(chalk.cyan.bold('     USDT Arbitrage Bot - Comprehensive Trading System'));
  console.log(chalk.cyan.bold('═'.repeat(60)));
  console.log();

  // Bot configuration
  const config: Partial<BotConfig> = {
    minProfitPercentage: 1.0,
    maxVolumePerTrade: 49900,
    maxDailyVolume: 500000,
    enableAutoTrading: false,
    maxOpenTrades: 3,
    stopLossPercentage: 0.5,
    maxSlippage: 0.2,
    riskScore: 5,
    enableP2PTrading: true,
    minMerchantRating: 95,
    minMerchantOrders: 100,
    preferredPaymentMethods: ['UPI', 'IMPS'],
    telegramEnabled: true,
    alertThreshold: 2.0,
    scanInterval: 10000,
    enableWebSocket: true,
    enableTestMode: false
  };

  // Display configuration
  const configTable = new Table({
    head: [chalk.cyan('Setting'), chalk.cyan('Value')],
    colWidths: [30, 30]
  });

  configTable.push(
    ['Min Profit %', `${config.minProfitPercentage}%`],
    ['Max Volume/Trade', `₹${config.maxVolumePerTrade?.toLocaleString()}`],
    ['Auto Trading', config.enableAutoTrading ? chalk.green('ON') : chalk.yellow('OFF')],
    ['P2P Trading', config.enableP2PTrading ? chalk.green('ON') : chalk.yellow('OFF')],
    ['WebSocket', config.enableWebSocket ? chalk.green('ON') : chalk.yellow('OFF')],
    ['Test Mode', config.enableTestMode ? chalk.yellow('ON') : chalk.green('OFF')]
  );

  console.log(configTable.toString());
  console.log();

  // Create bot instance
  const bot = new ComprehensiveTradingBot(config);

  // Setup event handlers
  setupBotEventHandlers(bot);

  // Ask user for confirmation
  const answer = await askQuestion(chalk.yellow('Start the bot with these settings? (y/n): '));
  
  if (answer.toLowerCase() !== 'y') {
    console.log(chalk.red('Bot startup cancelled'));
    process.exit(0);
  }

  // Start the bot
  console.log(chalk.green('\n✓ Starting bot...\n'));
  await bot.start();

  // Display live stats
  let statsInterval = setInterval(() => {
    displayStats(bot);
  }, 5000);

  // Setup command interface
  console.log(chalk.cyan('\nCommands:'));
  console.log('  stats    - Show detailed statistics');
  console.log('  opp      - Show current opportunities');
  console.log('  trades   - Show recent trades');
  console.log('  config   - Update configuration');
  console.log('  pause    - Pause auto-trading');
  console.log('  resume   - Resume auto-trading');
  console.log('  stop     - Stop the bot');
  console.log('  help     - Show this help message');
  console.log();

  // Handle user commands
  rl.on('line', async (input) => {
    const command = input.trim().toLowerCase();

    switch (command) {
      case 'stats':
        displayDetailedStats(bot);
        break;

      case 'opp':
        displayOpportunities(bot);
        break;

      case 'trades':
        displayTrades(bot);
        break;

      case 'config':
        await updateConfiguration(bot);
        break;

      case 'pause':
        bot.updateConfig({ enableAutoTrading: false });
        console.log(chalk.yellow('⏸ Auto-trading paused'));
        break;

      case 'resume':
        bot.updateConfig({ enableAutoTrading: true });
        console.log(chalk.green('▶ Auto-trading resumed'));
        break;

      case 'stop':
        console.log(chalk.red('\n⏹ Stopping bot...'));
        clearInterval(statsInterval);
        await bot.stop();
        rl.close();
        process.exit(0);
        break;

      case 'help':
        displayHelp();
        break;

      default:
        console.log(chalk.red('Unknown command. Type "help" for available commands.'));
    }
  });

  // Handle process termination
  process.on('SIGINT', async () => {
    console.log(chalk.red('\n\nReceived SIGINT, shutting down gracefully...'));
    clearInterval(statsInterval);
    await bot.stop();
    rl.close();
    process.exit(0);
  });
}

function setupBotEventHandlers(bot: ComprehensiveTradingBot) {
  bot.on('started', () => {
    console.log(chalk.green('✓ Bot started successfully!'));
  });

  bot.on('opportunityFound', (opportunity) => {
    console.log(chalk.yellow(`\n💡 New opportunity: ${opportunity.buyFrom} → ${opportunity.sellTo} (${opportunity.profitPercentage.toFixed(2)}%)`));
  });

  bot.on('tradeStarted', (trade) => {
    console.log(chalk.cyan(`\n📈 Trade started: ${trade.buyFrom} → ${trade.sellTo}`));
  });

  bot.on('tradeCompleted', (trade) => {
    console.log(chalk.green(`\n✅ Trade completed! Profit: ₹${trade.profit.toFixed(2)}`));
  });

  bot.on('tradeFailed', ({ opportunity, error }) => {
    console.log(chalk.red(`\n❌ Trade failed: ${error}`));
  });

  bot.on('exchangeConnected', (exchange) => {
    console.log(chalk.green(`✓ ${exchange} connected`));
  });

  bot.on('exchangeDisconnected', (exchange) => {
    console.log(chalk.yellow(`⚠ ${exchange} disconnected`));
  });
}

function displayStats(bot: ComprehensiveTradingBot) {
  const stats = bot.getStats();
  const config = bot.getConfig();

  console.clear();
  console.log(chalk.cyan.bold('Bot Statistics'));
  console.log(chalk.gray('━'.repeat(60)));

  const table = new Table({
    colWidths: [20, 15, 20, 15]
  });

  table.push(
    [
      chalk.gray('Uptime'), 
      formatDuration(stats.uptime),
      chalk.gray('Scans'), 
      stats.totalScans
    ],
    [
      chalk.gray('Opportunities'), 
      stats.opportunitiesFound,
      chalk.gray('Trades'), 
      `${stats.tradesSuccessful}/${stats.tradesExecuted}`
    ],
    [
      chalk.gray('Total Profit'), 
      chalk.green(`₹${stats.totalProfit.toFixed(2)}`),
      chalk.gray('Daily Volume'), 
      `₹${stats.totalVolume.toLocaleString()}`
    ],
    [
      chalk.gray('Success Rate'), 
      stats.tradesExecuted > 0 
        ? `${((stats.tradesSuccessful / stats.tradesExecuted) * 100).toFixed(1)}%`
        : 'N/A',
      chalk.gray('Auto Trading'), 
      config.enableAutoTrading ? chalk.green('ON') : chalk.yellow('OFF')
    ]
  );

  console.log(table.toString());
  console.log(chalk.gray('━'.repeat(60)));
  console.log(chalk.gray('Type a command or "help" for options'));
}

function displayDetailedStats(bot: ComprehensiveTradingBot) {
  const stats = bot.getStats();
  
  console.log(chalk.cyan.bold('\nDetailed Statistics'));
  console.log(chalk.gray('━'.repeat(60)));

  const table = new Table({
    head: [chalk.cyan('Metric'), chalk.cyan('Value')],
    colWidths: [30, 30]
  });

  table.push(
    ['Start Time', stats.startTime.toLocaleString()],
    ['Uptime', formatDuration(stats.uptime)],
    ['Total Scans', stats.totalScans],
    ['Opportunities Found', stats.opportunitiesFound],
    ['Trades Executed', stats.tradesExecuted],
    ['Successful Trades', stats.tradesSuccessful],
    ['Failed Trades', stats.tradesFailed],
    ['Success Rate', stats.tradesExecuted > 0 
      ? `${((stats.tradesSuccessful / stats.tradesExecuted) * 100).toFixed(1)}%`
      : 'N/A'],
    ['Total Profit', chalk.green(`₹${stats.totalProfit.toFixed(2)}`)],
    ['Average Profit/Trade', `₹${stats.averageProfit.toFixed(2)}`],
    ['Total Volume', `₹${stats.totalVolume.toLocaleString()}`],
    ['Last Scan', stats.lastScanTime.toLocaleTimeString()]
  );

  if (stats.bestTrade) {
    table.push([
      'Best Trade', 
      `${stats.bestTrade.buyFrom} → ${stats.bestTrade.sellTo} (₹${stats.bestTrade.profit.toFixed(2)})`
    ]);
  }

  console.log(table.toString());
}

function displayOpportunities(bot: ComprehensiveTradingBot) {
  const opportunities = bot.getOpportunities();
  
  console.log(chalk.cyan.bold('\nCurrent Opportunities'));
  console.log(chalk.gray('━'.repeat(80)));

  if (opportunities.length === 0) {
    console.log(chalk.yellow('No opportunities available at the moment'));
    return;
  }

  const table = new Table({
    head: [
      chalk.cyan('Route'),
      chalk.cyan('Type'),
      chalk.cyan('Profit %'),
      chalk.cyan('Profit ₹'),
      chalk.cyan('Risk'),
      chalk.cyan('Status')
    ],
    colWidths: [25, 10, 10, 12, 8, 12]
  });

  opportunities.slice(0, 10).forEach(opp => {
    table.push([
      `${opp.buyFrom} → ${opp.sellTo}`,
      opp.type,
      chalk.green(`${opp.profitPercentage.toFixed(2)}%`),
      `₹${opp.profit.toFixed(2)}`,
      `${opp.riskScore}/10`,
      opp.status === 'pending' ? chalk.yellow(opp.status) :
      opp.status === 'executing' ? chalk.cyan(opp.status) :
      opp.status === 'completed' ? chalk.green(opp.status) :
      chalk.red(opp.status)
    ]);
  });

  console.log(table.toString());

  if (opportunities.length > 10) {
    console.log(chalk.gray(`... and ${opportunities.length - 10} more opportunities`));
  }
}

function displayTrades(bot: ComprehensiveTradingBot) {
  const trades = bot.getExecutingTrades();
  
  console.log(chalk.cyan.bold('\nExecuting Trades'));
  console.log(chalk.gray('━'.repeat(60)));

  if (trades.length === 0) {
    console.log(chalk.yellow('No trades currently executing'));
    return;
  }

  const table = new Table({
    head: [
      chalk.cyan('ID'),
      chalk.cyan('Route'),
      chalk.cyan('Volume'),
      chalk.cyan('Expected Profit'),
      chalk.cyan('Status')
    ],
    colWidths: [15, 25, 12, 15, 15]
  });

  trades.forEach(trade => {
    table.push([
      trade.id.substring(0, 13),
      `${trade.buyFrom} → ${trade.sellTo}`,
      `₹${trade.volume.toLocaleString()}`,
      `₹${trade.profit.toFixed(2)}`,
      chalk.cyan('Executing...')
    ]);
  });

  console.log(table.toString());
}

async function updateConfiguration(bot: ComprehensiveTradingBot) {
  const currentConfig = bot.getConfig();
  
  console.log(chalk.cyan.bold('\nUpdate Configuration'));
  console.log(chalk.gray('Press Enter to keep current value'));
  console.log();

  const minProfit = await askQuestion(
    `Min Profit % (current: ${currentConfig.minProfitPercentage}): `
  );
  
  const maxVolume = await askQuestion(
    `Max Volume/Trade (current: ${currentConfig.maxVolumePerTrade}): `
  );
  
  const enableAuto = await askQuestion(
    `Enable Auto Trading? y/n (current: ${currentConfig.enableAutoTrading ? 'y' : 'n'}): `
  );

  const updates: Partial<BotConfig> = {};
  
  if (minProfit) updates.minProfitPercentage = parseFloat(minProfit);
  if (maxVolume) updates.maxVolumePerTrade = parseFloat(maxVolume);
  if (enableAuto) updates.enableAutoTrading = enableAuto.toLowerCase() === 'y';

  if (Object.keys(updates).length > 0) {
    bot.updateConfig(updates);
    console.log(chalk.green('✓ Configuration updated'));
  } else {
    console.log(chalk.yellow('No changes made'));
  }
}

function displayHelp() {
  console.log(chalk.cyan.bold('\nAvailable Commands:'));
  console.log(chalk.gray('━'.repeat(40)));
  console.log('  stats    - Show detailed statistics');
  console.log('  opp      - Show current opportunities');
  console.log('  trades   - Show recent trades');
  console.log('  config   - Update configuration');
  console.log('  pause    - Pause auto-trading');
  console.log('  resume   - Resume auto-trading');
  console.log('  stop     - Stop the bot');
  console.log('  help     - Show this help message');
  console.log(chalk.gray('━'.repeat(40)));
}

function formatDuration(ms: number): string {
  const hours = Math.floor(ms / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  return `${hours}h ${minutes}m ${seconds}s`;
}

function askQuestion(question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, resolve);
  });
}

// Run the bot
runBot().catch(console.error);