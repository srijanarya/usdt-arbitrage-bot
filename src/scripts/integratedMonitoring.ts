import chalk from 'chalk';
import { priceMonitor } from '../services/websocket/SimpleWebSocketMonitor';
import { telegramAlert } from '../services/telegram/TelegramAlertService';
import { autoTrader } from '../services/trading/AutomatedTradingService';
import { riskManager } from '../services/trading/RiskManagementService';
import { profitTracker } from '../services/reporting/ProfitTrackingService';
import { arbitrageCalculator } from '../services/arbitrage/USDTArbitrageCalculator';
import { EventEmitter } from 'events';
import Table from 'cli-table3';
import dotenv from 'dotenv';

dotenv.config();

interface MonitoringConfig {
  autoTrading: boolean;
  alertsEnabled: boolean;
  minProfit: number;
  minROI: number;
  updateInterval: number;
  displayMode: 'simple' | 'detailed' | 'compact';
}

class IntegratedMonitoringSystem extends EventEmitter {
  private config: MonitoringConfig = {
    autoTrading: false,
    alertsEnabled: true,
    minProfit: 200,
    minROI: 2,
    updateInterval: 30000, // 30 seconds
    displayMode: 'detailed'
  };

  private stats = {
    startTime: new Date(),
    opportunitiesFound: 0,
    alertsSent: 0,
    tradesExecuted: 0,
    totalProfit: 0,
    bestOpportunity: null as any
  };

  private lastPrices: Map<string, any> = new Map();
  private displayTimer: NodeJS.Timeout | null = null;

  async start() {
    console.log(chalk.bgCyan.black(' 🚀 Integrated Arbitrage Monitoring System '));
    console.log(chalk.cyan('━'.repeat(60)));
    
    // Initialize services
    await this.initializeServices();
    
    // Setup event listeners
    this.setupEventListeners();
    
    // Start monitoring
    await priceMonitor.start();
    
    // Start display update loop
    this.startDisplayLoop();
    
    console.log(chalk.green('\n✅ All systems initialized and running\n'));
  }

  private async initializeServices() {
    // Configure auto trader
    autoTrader.updateConfig({
      enabled: this.config.autoTrading,
      minProfit: this.config.minProfit,
      minROI: this.config.minROI
    });

    // Start auto trader if enabled
    if (this.config.autoTrading) {
      await autoTrader.start();
    }

    // Test Telegram connection
    if (this.config.alertsEnabled) {
      await telegramAlert.sendSystemAlert(
        'Monitoring System Started',
        `Auto Trading: ${this.config.autoTrading ? 'ENABLED' : 'DISABLED'}\nMin Profit: ₹${this.config.minProfit}\nMin ROI: ${this.config.minROI}%`
      );
    }
  }

  private setupEventListeners() {
    // Price updates
    priceMonitor.on('priceUpdate', (exchange: string, data: any) => {
      this.lastPrices.set(exchange, data);
    });

    // Arbitrage opportunities
    priceMonitor.on('arbitrageFound', async (opportunity: any) => {
      this.stats.opportunitiesFound++;
      
      // Track best opportunity
      if (!this.stats.bestOpportunity || 
          opportunity.netProfit > this.stats.bestOpportunity.netProfit) {
        this.stats.bestOpportunity = opportunity;
      }

      // Send alert if enabled
      if (this.config.alertsEnabled && 
          opportunity.netProfit >= this.config.minProfit &&
          opportunity.roi >= this.config.minROI) {
        await this.sendArbitrageAlert(opportunity);
        this.stats.alertsSent++;
      }

      // Auto trade if enabled
      if (this.config.autoTrading) {
        const executed = await autoTrader.evaluateOpportunity(
          opportunity.buyExchange,
          opportunity.sellExchange,
          opportunity.buyPrice,
          opportunity.sellPrice,
          100
        );
        
        if (executed) {
          this.stats.tradesExecuted++;
        }
      }
    });

    // Trading events
    autoTrader.on('executionCompleted', async (execution) => {
      this.stats.totalProfit += execution.actualProfit || 0;
      
      // Record in profit tracker
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
              (execution.sellTrade.price * execution.sellTrade.amount * 0.01),
        executionTime: execution.endTime ? 
          (execution.endTime.getTime() - execution.startTime.getTime()) / 1000 : 0,
        status: 'completed'
      });
    });

    // Risk alerts
    riskManager.on('riskAlert', async (alert) => {
      console.log(chalk.red(`\n⚠️  Risk Alert: ${alert.message}`));
      
      if (this.config.alertsEnabled) {
        await telegramAlert.sendSystemAlert(
          'Risk Management Alert',
          `${alert.message}\nSeverity: ${alert.severity}`,
          'warning'
        );
      }
    });
  }

  private async sendArbitrageAlert(opportunity: any) {
    await telegramAlert.sendArbitrageAlert(
      opportunity.buyExchange,
      opportunity.sellExchange,
      opportunity.buyPrice,
      opportunity.sellPrice,
      opportunity.netProfit,
      opportunity.roi,
      100
    );
  }

  private startDisplayLoop() {
    this.updateDisplay();
    
    this.displayTimer = setInterval(() => {
      this.updateDisplay();
    }, this.config.updateInterval);
  }

  private updateDisplay() {
    console.clear();
    
    // Header
    console.log(chalk.bgCyan.black(' 🚀 Integrated Arbitrage Monitoring System '));
    console.log(chalk.cyan('━'.repeat(60)));
    
    // System Status
    this.displaySystemStatus();
    
    // Current Prices
    this.displayCurrentPrices();
    
    // Trading Stats
    this.displayTradingStats();
    
    // Risk Metrics
    this.displayRiskMetrics();
    
    // Best Opportunities
    this.displayBestOpportunities();
    
    // Footer
    console.log(chalk.cyan('━'.repeat(60)));
    console.log(chalk.gray(`Last updated: ${new Date().toLocaleTimeString()}`));
  }

  private displaySystemStatus() {
    const runtime = Math.floor((Date.now() - this.stats.startTime.getTime()) / 1000 / 60);
    const tradingStats = autoTrader.getStats();
    
    console.log(chalk.yellow('\n📊 System Status:'));
    console.log(`  Runtime: ${runtime} minutes`);
    console.log(`  Auto Trading: ${tradingStats.isRunning ? chalk.green('ACTIVE') : chalk.red('INACTIVE')}`);
    console.log(`  Alerts: ${this.config.alertsEnabled ? chalk.green('ENABLED') : chalk.red('DISABLED')}`);
    console.log(`  Mode: ${this.config.displayMode.toUpperCase()}`);
  }

  private displayCurrentPrices() {
    console.log(chalk.yellow('\n💹 Current Prices:'));
    
    const priceTable = new Table({
      head: ['Exchange', 'Buy Price', 'Sell Price', 'Spread', 'Last Update'],
      colWidths: [15, 12, 12, 10, 15]
    });

    this.lastPrices.forEach((data, exchange) => {
      const spread = ((data.sellPrice - data.buyPrice) / data.buyPrice * 100).toFixed(2);
      const lastUpdate = new Date(data.timestamp).toLocaleTimeString();
      
      priceTable.push([
        exchange,
        `₹${data.buyPrice.toFixed(2)}`,
        `₹${data.sellPrice.toFixed(2)}`,
        `${spread}%`,
        lastUpdate
      ]);
    });

    console.log(priceTable.toString());
  }

  private displayTradingStats() {
    const dailyReport = profitTracker.generateDailyReport();
    
    console.log(chalk.yellow('\n📈 Trading Statistics:'));
    console.log(`  Opportunities Found: ${this.stats.opportunitiesFound}`);
    console.log(`  Alerts Sent: ${this.stats.alertsSent}`);
    console.log(`  Trades Executed: ${this.stats.tradesExecuted}`);
    console.log(`  Session Profit: ₹${this.stats.totalProfit.toFixed(2)}`);
    
    if (this.stats.bestOpportunity) {
      console.log(chalk.green(`  Best Opportunity: ${this.stats.bestOpportunity.buyExchange} → ${this.stats.bestOpportunity.sellExchange} (₹${this.stats.bestOpportunity.netProfit.toFixed(2)})`));
    }
  }

  private displayRiskMetrics() {
    const riskMetrics = riskManager.getMetrics();
    const winRate = riskMetrics.totalTrades > 0 
      ? (riskMetrics.winningTrades / riskMetrics.totalTrades * 100).toFixed(2)
      : '0.00';
    
    console.log(chalk.yellow('\n⚠️  Risk Management:'));
    console.log(`  Win Rate: ${winRate}%`);
    console.log(`  Consecutive Losses: ${riskMetrics.consecutiveLosses}`);
    console.log(`  Daily P&L: ₹${riskMetrics.dailyPnL.toFixed(2)}`);
    console.log(`  Current Exposure: ₹${riskMetrics.currentExposure.toFixed(2)}`);
  }

  private displayBestOpportunities() {
    if (this.config.displayMode !== 'detailed') return;
    
    console.log(chalk.yellow('\n🏆 Recent Opportunities:'));
    
    // In a real implementation, we would track recent opportunities
    // For now, just show the best one if available
    if (this.stats.bestOpportunity) {
      const opp = this.stats.bestOpportunity;
      const analysis = arbitrageCalculator.calculateProfit(
        opp.buyPrice,
        opp.sellPrice,
        100,
        opp.buyExchange
      );
      
      arbitrageCalculator.displayAnalysis(analysis);
    }
  }

  async generateReports() {
    console.log(chalk.yellow('\n📊 Generating Reports...'));
    
    // Daily report
    const dailyReport = await profitTracker.generateDailyReport();
    console.log(chalk.green('✅ Daily report generated'));
    
    // Weekly summary
    const weeklySummary = await profitTracker.generateWeeklySummary();
    console.log(chalk.green('✅ Weekly summary generated'));
    
    // Risk report
    const riskReport = riskManager.generateRiskReport();
    console.log(chalk.green('✅ Risk report generated'));
    
    // Send summary to Telegram
    if (this.config.alertsEnabled) {
      await telegramAlert.sendSystemAlert(
        'Daily Reports Generated',
        `Net Profit: ₹${dailyReport.netProfit.toFixed(2)}\nTotal Trades: ${dailyReport.totalTrades}\nWin Rate: ${riskManager.getMetrics().totalTrades > 0 ? 
          ((riskManager.getMetrics().winningTrades / riskManager.getMetrics().totalTrades) * 100).toFixed(2) : '0'}%`
      );
    }
  }

  stop() {
    if (this.displayTimer) {
      clearInterval(this.displayTimer);
    }
    
    priceMonitor.stop();
    autoTrader.stop();
    
    console.log(chalk.yellow('\n🛑 Monitoring system stopped'));
  }
}

// Main execution
const monitor = new IntegratedMonitoringSystem();

// Handle commands
process.stdin.on('data', async (data) => {
  const command = data.toString().trim().toLowerCase();
  
  switch (command) {
    case 'auto':
      monitor['config'].autoTrading = !monitor['config'].autoTrading;
      autoTrader.updateConfig({ enabled: monitor['config'].autoTrading });
      if (monitor['config'].autoTrading) {
        await autoTrader.start();
      } else {
        await autoTrader.stop();
      }
      console.log(chalk.yellow(`Auto trading: ${monitor['config'].autoTrading ? 'ENABLED' : 'DISABLED'}`));
      break;
      
    case 'alerts':
      monitor['config'].alertsEnabled = !monitor['config'].alertsEnabled;
      console.log(chalk.yellow(`Alerts: ${monitor['config'].alertsEnabled ? 'ENABLED' : 'DISABLED'}`));
      break;
      
    case 'report':
      await monitor.generateReports();
      break;
      
    case 'risk':
      console.log(riskManager.generateRiskReport());
      break;
      
    case 'quit':
    case 'exit':
      monitor.stop();
      process.exit(0);
      break;
      
    default:
      console.log(chalk.gray('\nCommands: auto, alerts, report, risk, quit'));
  }
});

// Start monitoring
monitor.start().catch(console.error);

// Handle graceful shutdown
process.on('SIGINT', () => {
  monitor.stop();
  process.exit(0);
});