import chalk from 'chalk';
import { priceMonitor } from '../services/websocket/SimpleWebSocketMonitor';
import { autoTrader } from '../services/trading/AutomatedTradingService';
import { telegramAlert } from '../services/telegram/TelegramAlertService';
import { arbitrageCalculator } from '../services/arbitrage/USDTArbitrageCalculator';
import { riskManager } from '../services/trading/RiskManagementService';
import { profitTracker } from '../services/reporting/ProfitTrackingService';
import dotenv from 'dotenv';
import readline from 'readline';

// Load environment variables
dotenv.config();

// Create readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

class AutoTradingMonitor {
  private config = {
    enabled: false, // Start in disabled mode for safety
    minProfit: 200,
    minROI: 2,
    maxAmountPerTrade: 100,
    dailyLimit: 10000,
    testMode: true // Start in test mode
  };

  private stats = {
    opportunitiesFound: 0,
    opportunitiesExecuted: 0,
    totalProfit: 0,
    startTime: new Date()
  };

  async start() {
    console.log(chalk.bgCyan.black(' 🤖 Automated Trading Monitor \n'));
    
    // Show initial config
    this.displayConfig();
    
    // Setup trading service
    autoTrader.updateConfig(this.config);
    
    // Setup event listeners
    this.setupEventListeners();
    
    // Start price monitoring
    await priceMonitor.start();
    
    // Show commands
    this.showCommands();
    
    // Start command listener
    this.listenForCommands();
    
    // Start stats display
    this.startStatsDisplay();
  }

  private setupEventListeners() {
    // Listen for arbitrage opportunities
    priceMonitor.on('arbitrageFound', async (opportunity) => {
      this.stats.opportunitiesFound++;
      
      console.log(chalk.yellow(`\n🔍 Opportunity found: ${opportunity.buyExchange} → ${opportunity.sellExchange}`));
      console.log(chalk.gray(`Buy: ₹${opportunity.buyPrice.toFixed(2)}, Sell: ₹${opportunity.sellPrice.toFixed(2)}`));
      console.log(chalk.gray(`Expected profit: ₹${opportunity.netProfit.toFixed(2)} (${opportunity.roi.toFixed(2)}%)`));
      
      // Evaluate for automated execution
      if (this.config.enabled && !this.config.testMode) {
        const shouldExecute = await autoTrader.evaluateOpportunity(
          opportunity.buyExchange,
          opportunity.sellExchange,
          opportunity.buyPrice,
          opportunity.sellPrice,
          100
        );
        
        if (shouldExecute) {
          this.stats.opportunitiesExecuted++;
          console.log(chalk.green('✅ Trade executed automatically'));
        }
      } else if (this.config.testMode) {
        console.log(chalk.gray('[TEST MODE] Would execute this trade'));
      } else {
        console.log(chalk.gray('[DISABLED] Auto-trading is off'));
      }
    });

    // Listen for trading events
    autoTrader.on('executionStarted', (execution) => {
      console.log(chalk.bgGreen.black(`\n 🚀 Trade Execution Started #${execution.id} \n`));
    });

    autoTrader.on('executionCompleted', async (execution) => {
      this.stats.totalProfit += execution.actualProfit || 0;
      console.log(chalk.bgGreen.black(`\n ✅ Trade Completed! Profit: ₹${execution.actualProfit?.toFixed(2)} \n`));
      
      // Record trade in profit tracker
      await profitTracker.recordTrade({
        id: execution.id,
        buyExchange: execution.buyTrade.exchange,
        sellExchange: execution.sellTrade.exchange,
        buyPrice: execution.buyTrade.price,
        sellPrice: execution.sellTrade.price,
        amount: execution.buyTrade.amount,
        expectedProfit: execution.expectedProfit,
        actualProfit: execution.actualProfit || 0,
        fees: (execution.buyTrade.price * execution.buyTrade.amount * 0.0025) + 
              (execution.sellTrade.price * execution.sellTrade.amount * 0.01), // TDS
        executionTime: execution.endTime ? 
          (execution.endTime.getTime() - execution.startTime.getTime()) / 1000 : 0,
        status: 'completed'
      });
    });

    autoTrader.on('executionFailed', async (execution, error) => {
      console.log(chalk.bgRed.white(`\n ❌ Trade Failed: ${error.message} \n`));
      
      // Record failed trade
      await profitTracker.recordTrade({
        id: execution.id,
        buyExchange: execution.buyTrade.exchange,
        sellExchange: execution.sellTrade.exchange,
        buyPrice: execution.buyTrade.price,
        sellPrice: execution.sellTrade.price,
        amount: execution.buyTrade.amount,
        expectedProfit: execution.expectedProfit,
        actualProfit: 0,
        fees: 0,
        executionTime: 0,
        status: 'failed'
      });
    });
  }

  private showCommands() {
    console.log(chalk.yellow('\n📋 Commands:'));
    console.log('  enable    - Enable auto-trading');
    console.log('  disable   - Disable auto-trading');
    console.log('  test      - Toggle test mode');
    console.log('  config    - Show current configuration');
    console.log('  stats     - Show trading statistics');
    console.log('  risk      - Show risk management report');
    console.log('  profit    - Show profit tracking report');
    console.log('  weekly    - Generate weekly summary');
    console.log('  limits    - Update trading limits');
    console.log('  calc      - Calculate arbitrage');
    console.log('  help      - Show this help');
    console.log('  quit      - Exit the program\n');
  }

  private listenForCommands() {
    rl.on('line', async (input) => {
      const command = input.trim().toLowerCase();
      
      switch (command) {
        case 'enable':
          if (this.config.testMode) {
            console.log(chalk.yellow('⚠️  Cannot enable trading while in test mode'));
            console.log('Use "test" command to disable test mode first');
          } else {
            this.config.enabled = true;
            autoTrader.updateConfig({ enabled: true });
            await autoTrader.start();
            console.log(chalk.green('✅ Auto-trading ENABLED'));
          }
          break;
          
        case 'disable':
          this.config.enabled = false;
          autoTrader.updateConfig({ enabled: false });
          await autoTrader.stop();
          console.log(chalk.red('🛑 Auto-trading DISABLED'));
          break;
          
        case 'test':
          this.config.testMode = !this.config.testMode;
          console.log(chalk.yellow(`Test mode: ${this.config.testMode ? 'ON' : 'OFF'}`));
          if (!this.config.testMode) {
            console.log(chalk.red('⚠️  WARNING: Real trading mode active!'));
          }
          break;
          
        case 'config':
          this.displayConfig();
          break;
          
        case 'stats':
          this.displayStats();
          break;
          
        case 'risk':
          console.log(riskManager.generateRiskReport());
          break;
          
        case 'profit':
          const dailyReport = await profitTracker.generateDailyReport();
          console.log(chalk.cyan('\n📊 Daily Profit Report:'));
          console.log(chalk.gray('─'.repeat(40)));
          console.log(`Total Trades: ${dailyReport.totalTrades}`);
          console.log(`Successful: ${dailyReport.successfulTrades}`);
          console.log(`Failed: ${dailyReport.failedTrades}`);
          console.log(`Volume: ₹${dailyReport.totalVolume.toFixed(2)}`);
          console.log(`Gross Profit: ₹${dailyReport.grossProfit.toFixed(2)}`);
          console.log(`Fees: ₹${dailyReport.totalFees.toFixed(2)}`);
          console.log(`Net Profit: ₹${dailyReport.netProfit.toFixed(2)}`);
          console.log(chalk.gray('─'.repeat(40)));
          break;
          
        case 'weekly':
          const weeklySummary = await profitTracker.generateWeeklySummary();
          console.log(weeklySummary);
          break;
          
        case 'limits':
          await this.updateLimits();
          break;
          
        case 'calc':
          await this.calculateArbitrage();
          break;
          
        case 'help':
          this.showCommands();
          break;
          
        case 'quit':
        case 'exit':
          await this.shutdown();
          break;
          
        default:
          console.log(chalk.red('Unknown command. Type "help" for available commands.'));
      }
    });
  }

  private displayConfig() {
    console.log(chalk.cyan('\n📊 Current Configuration:'));
    console.log(chalk.gray('─'.repeat(40)));
    console.log(`Status: ${this.config.enabled ? chalk.green('ENABLED') : chalk.red('DISABLED')}`);
    console.log(`Mode: ${this.config.testMode ? chalk.yellow('TEST MODE') : chalk.red('LIVE TRADING')}`);
    console.log(`Min Profit: ₹${this.config.minProfit}`);
    console.log(`Min ROI: ${this.config.minROI}%`);
    console.log(`Max per trade: ${this.config.maxAmountPerTrade} USDT`);
    console.log(`Daily limit: ₹${this.config.dailyLimit}`);
    console.log(chalk.gray('─'.repeat(40)));
  }

  private displayStats() {
    const runtime = Math.floor((Date.now() - this.stats.startTime.getTime()) / 1000 / 60);
    const tradingStats = autoTrader.getStats();
    
    console.log(chalk.cyan('\n📈 Trading Statistics:'));
    console.log(chalk.gray('─'.repeat(40)));
    console.log(`Runtime: ${runtime} minutes`);
    console.log(`Opportunities found: ${this.stats.opportunitiesFound}`);
    console.log(`Trades executed: ${this.stats.opportunitiesExecuted}`);
    console.log(`Total profit: ₹${this.stats.totalProfit.toFixed(2)}`);
    console.log(`Daily volume: ₹${tradingStats.dailyVolume.toFixed(2)} / ₹${tradingStats.dailyLimit}`);
    console.log(`Active trades: ${tradingStats.activeExecutions}`);
    console.log(chalk.gray('─'.repeat(40)));
  }

  private async updateLimits() {
    const askQuestion = (question: string): Promise<string> => {
      return new Promise((resolve) => {
        rl.question(chalk.yellow(question), resolve);
      });
    };

    console.log(chalk.cyan('\n📝 Update Trading Limits:'));
    
    const minProfit = await askQuestion(`Min profit (current: ₹${this.config.minProfit}): `);
    if (minProfit) this.config.minProfit = parseFloat(minProfit);
    
    const minROI = await askQuestion(`Min ROI % (current: ${this.config.minROI}%): `);
    if (minROI) this.config.minROI = parseFloat(minROI);
    
    const maxAmount = await askQuestion(`Max per trade USDT (current: ${this.config.maxAmountPerTrade}): `);
    if (maxAmount) this.config.maxAmountPerTrade = parseFloat(maxAmount);
    
    const dailyLimit = await askQuestion(`Daily limit ₹ (current: ₹${this.config.dailyLimit}): `);
    if (dailyLimit) this.config.dailyLimit = parseFloat(dailyLimit);
    
    autoTrader.updateConfig(this.config);
    console.log(chalk.green('✅ Limits updated'));
    this.displayConfig();
  }

  private async calculateArbitrage() {
    const askQuestion = (question: string): Promise<string> => {
      return new Promise((resolve) => {
        rl.question(chalk.yellow(question), resolve);
      });
    };

    const buyPrice = await askQuestion('Buy price (₹): ');
    const sellPrice = await askQuestion('Sell price (₹): ');
    const amount = await askQuestion('Amount (USDT) [100]: ') || '100';
    
    if (buyPrice && sellPrice) {
      const analysis = arbitrageCalculator.calculateProfit(
        parseFloat(buyPrice),
        parseFloat(sellPrice),
        parseFloat(amount)
      );
      
      arbitrageCalculator.displayAnalysis(analysis);
    }
  }

  private startStatsDisplay() {
    // Update stats every 30 seconds
    setInterval(() => {
      const tradingStats = autoTrader.getStats();
      if (tradingStats.isRunning && tradingStats.activeExecutions > 0) {
        console.log(chalk.gray(`\n[${new Date().toLocaleTimeString()}] Active trades: ${tradingStats.activeExecutions}, Daily P&L: ₹${tradingStats.dailyProfit.toFixed(2)}`));
      }
    }, 30000);
  }

  private async shutdown() {
    console.log(chalk.yellow('\n🛑 Shutting down...'));
    
    // Stop auto trader
    await autoTrader.stop();
    
    // Stop price monitor
    priceMonitor.stop();
    
    // Display final stats
    this.displayStats();
    
    // Generate final reports
    const dailyReport = await profitTracker.generateDailyReport();
    
    // Send comprehensive summary to Telegram
    if (this.stats.opportunitiesExecuted > 0) {
      await telegramAlert.sendSystemAlert(
        'Trading Session Summary',
        `Runtime: ${Math.floor((Date.now() - this.stats.startTime.getTime()) / 1000 / 60)} minutes\n` +
        `Opportunities: ${this.stats.opportunitiesFound}\n` +
        `Executed: ${this.stats.opportunitiesExecuted}\n` +
        `Total Profit: ₹${this.stats.totalProfit.toFixed(2)}\n` +
        `Win Rate: ${riskManager.getMetrics().totalTrades > 0 ? 
          ((riskManager.getMetrics().winningTrades / riskManager.getMetrics().totalTrades) * 100).toFixed(2) : '0'}%\n` +
        `Daily Volume: ₹${dailyReport.totalVolume.toFixed(2)}`
      );
    }
    
    rl.close();
    process.exit(0);
  }
}

// Safety warning
console.log(chalk.bgRed.white('\n ⚠️  AUTOMATED TRADING WARNING ⚠️  \n'));
console.log(chalk.yellow('This system can execute real trades with real money.'));
console.log(chalk.yellow('Always start in TEST MODE and verify behavior.'));
console.log(chalk.yellow('Use at your own risk!\n'));

// Check if user wants to proceed
const monitor = new AutoTradingMonitor();

rl.question(chalk.cyan('Do you want to proceed? (yes/no): '), (answer) => {
  if (answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y') {
    monitor.start().catch(console.error);
  } else {
    console.log(chalk.yellow('Exiting...'));
    rl.close();
    process.exit(0);
  }
});

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log(chalk.yellow('\n\nReceived interrupt signal...'));
  await monitor['shutdown']();
});