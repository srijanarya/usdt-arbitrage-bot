import chalk from 'chalk';
import dotenv from 'dotenv';
import { priceStreamService } from './services/websocket/PriceStreamService';
import { databaseService } from './services/database/DatabaseService';
import { telegramBot } from './services/telegram/TelegramBotService';
import { startDashboardServer } from './dashboard/server';
import { errorHandler, ErrorType, ErrorSeverity } from './utils/errors/ErrorHandler';
import { healthMonitor } from './services/monitoring/HealthMonitor';
import { ValidationUtils } from './utils/ValidationUtils';
import { retry } from './utils/RetryMechanism';

dotenv.config();

export class IntegratedArbitrageMonitor {
  private isRunning = false;
  private startTime = Date.now();
  private opportunityCount = 0;
  private lastCleanup = Date.now();

  async start() {
    console.log(chalk.bgCyan.black('\n 🚀 TREUM ALGOTECH ARBITRAGE BOT STARTING... \n'));
    console.log(chalk.gray(`Company: Treum Algotech (OPC) Private Limited`));
    console.log(chalk.gray(`CIN: U72900MH2023OPC397915`));
    console.log(chalk.gray(`Startup India: DIPP135090\n`));

    try {
      // Validate environment
      const envValidation = ValidationUtils.validateEnvironment();
      if (!envValidation.isValid) {
        throw new Error(`Missing required environment variables: ${envValidation.missing.join(', ')}`);
      }
      if (envValidation.warnings.length > 0) {
        envValidation.warnings.forEach(warning => 
          console.log(chalk.yellow(`⚠️  ${warning}`))
        );
      }
      // Step 1: Test database connection with retry
      console.log(chalk.yellow('🔌 Connecting to database...'));
      const dbConnected = await retry(
        () => databaseService.testConnection(),
        {
          maxAttempts: 3,
          onRetry: (error, attempt) => {
            console.log(chalk.yellow(`Database connection attempt ${attempt} failed: ${error.message}`));
          }
        }
      );
      if (!dbConnected) {
        throw new Error('Database connection failed after all retries');
      }

      // Step 2: Initialize database schema
      console.log(chalk.yellow('📋 Initializing database schema...'));
      await databaseService.initializeSchema();

      // Step 3: Start WebSocket connections
      console.log(chalk.yellow('🌐 Connecting to exchange WebSockets...'));
      await priceStreamService.connectAll();

      // Step 4: Setup event listeners
      this.setupEventListeners();

      // Step 5: Start health monitoring
      console.log(chalk.yellow('🏥 Starting health monitoring...'));
      healthMonitor.start(30000); // Check every 30 seconds
      
      // Step 6: Start dashboard server
      console.log(chalk.yellow('📊 Starting dashboard server...'));
      startDashboardServer();

      // Step 7: Send startup notification
      await telegramBot.sendSystemAlert(
        'Bot Started',
        `USDT Arbitrage Bot is now online and monitoring exchanges.\n\nWebSocket: ✅\nDatabase: ✅\nDashboard: http://localhost:3001\nHealth Monitor: ✅`,
        'medium'
      );

      this.isRunning = true;
      console.log(chalk.green('\n✅ All systems operational!\n'));
      console.log(chalk.cyan('📊 Dashboard: http://localhost:3001'));
      console.log(chalk.cyan('📱 Telegram alerts: Active'));
      console.log(chalk.cyan('🔄 WebSocket feeds: Real-time\n'));

      // Start periodic tasks
      this.startPeriodicTasks();

      // Display initial status
      this.displayStatus();

    } catch (error) {
      await errorHandler.handleError(error as Error, {
        type: ErrorType.SYSTEM,
        severity: ErrorSeverity.CRITICAL,
        operation: 'startup'
      });
      await this.shutdown();
      process.exit(1);
    }
  }

  /**
   * Setup event listeners for all services
   */
  private setupEventListeners() {
    // Price update events
    priceStreamService.on('priceUpdate', async (priceData) => {
      try {
        // Validate price data
        const validation = ValidationUtils.validatePriceData(priceData);
        if (!validation.isValid) {
          throw new Error(`Invalid price data: ${validation.errors.join(', ')}`);
        }
        
        // Save to database
        await databaseService.insertPrice(priceData);
      } catch (error) {
        await errorHandler.handleError(error as Error, {
          type: ErrorType.PARSE_ERROR,
          severity: ErrorSeverity.MEDIUM,
          operation: 'priceUpdate',
          data: priceData
        });
      }
    });

    // Arbitrage opportunity events
    priceStreamService.on('arbitrageOpportunity', async (opportunity) => {
      try {
        // Validate opportunity
        ValidationUtils.validateArbitrageOpportunity(opportunity);
        
        this.opportunityCount++;
        
        // Save to database with retry
        const opportunityId = await retry(
          () => databaseService.saveArbitrageOpportunity(opportunity),
          { maxAttempts: 2 }
        );
        
        // Send Telegram alert
        await telegramBot.sendArbitrageAlert(opportunity);

        // Log to console
        console.log(chalk.bgGreen.black('\n 💰 ARBITRAGE OPPORTUNITY DETECTED! '));
        console.log(chalk.green(`Route: ${opportunity.buyExchange} → ${opportunity.sellExchange}`));
        console.log(chalk.green(`Profit: ₹${opportunity.profit.toFixed(2)} (${opportunity.profitPercent.toFixed(2)}%)`));
        console.log(chalk.green(`Volume: ₹${opportunity.volume.toLocaleString('en-IN')}`));
        console.log(chalk.gray(`Time: ${new Date().toLocaleTimeString('en-IN')}\n`));
      } catch (error) {
        await errorHandler.handleError(error as Error, {
          type: ErrorType.SYSTEM,
          severity: ErrorSeverity.HIGH,
          operation: 'arbitrageOpportunity',
          data: opportunity
        });
      }
    });

    // Connection events
    priceStreamService.on('connected', (exchange) => {
      console.log(chalk.green(`✅ Connected to ${exchange}`));
    });

    priceStreamService.on('disconnected', async (exchange) => {
      console.log(chalk.red(`❌ Disconnected from ${exchange}`));
      await telegramBot.sendSystemAlert(
        'Connection Lost',
        `WebSocket connection to ${exchange} was lost. Attempting to reconnect...`,
        'high'
      );
    });

    priceStreamService.on('error', async ({ exchange, error }) => {
      await errorHandler.handleError(error, {
        type: ErrorType.WEBSOCKET_CONNECTION,
        severity: ErrorSeverity.MEDIUM,
        exchange,
        operation: 'stream'
      });
    });

    priceStreamService.on('maxReconnectReached', async (exchange) => {
      await telegramBot.sendSystemAlert(
        'Critical Error',
        `Failed to reconnect to ${exchange} after maximum attempts. Manual intervention required.`,
        'high'
      );
    });

    // Handle process signals
    process.on('SIGINT', () => this.shutdown());
    process.on('SIGTERM', () => this.shutdown());
    process.on('unhandledRejection', async (reason, promise) => {
      await errorHandler.handleError(
        new Error(`Unhandled rejection: ${reason}`),
        {
          type: ErrorType.SYSTEM,
          severity: ErrorSeverity.CRITICAL,
          operation: 'unhandledRejection',
          data: { promise, reason }
        }
      );
    });
  }

  /**
   * Start periodic maintenance tasks
   */
  private startPeriodicTasks() {
    // Display status every 30 seconds
    setInterval(() => {
      if (this.isRunning) {
        this.displayStatus();
      }
    }, 30000);

    // Send daily summary
    setInterval(() => {
      const now = new Date();
      if (now.getHours() === 20 && now.getMinutes() === 0) { // 8 PM
        telegramBot.sendDailySummary();
      }
    }, 60000); // Check every minute

    // Database cleanup every 6 hours
    setInterval(async () => {
      if (Date.now() - this.lastCleanup > 6 * 60 * 60 * 1000) {
        console.log(chalk.yellow('🧹 Running database cleanup...'));
        await databaseService.cleanupOldData(7); // Keep 7 days of data
        this.lastCleanup = Date.now();
      }
    }, 60 * 60 * 1000); // Check every hour
  }

  /**
   * Display current status
   */
  private displayStatus() {
    const uptime = Math.floor((Date.now() - this.startTime) / 1000);
    const hours = Math.floor(uptime / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);
    const seconds = uptime % 60;

    const connections = priceStreamService.getConnectionStatus();
    const prices = priceStreamService.getCurrentPrices();

    console.log(chalk.cyan('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
    console.log(chalk.cyan(`📊 Status Update - ${new Date().toLocaleTimeString('en-IN')}`));
    console.log(chalk.cyan('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
    
    console.log(chalk.yellow('\n🔌 Connections:'));
    Object.entries(connections).forEach(([exchange, connected]) => {
      console.log(`  ${exchange}: ${connected ? chalk.green('✅ Connected') : chalk.red('❌ Disconnected')}`);
    });

    console.log(chalk.yellow('\n💹 Current Prices:'));
    prices.forEach((price, exchange) => {
      console.log(`  ${exchange}: Buy ₹${price.buyPrice.toFixed(2)} | Sell ₹${price.sellPrice.toFixed(2)}`);
    });

    console.log(chalk.yellow('\n📈 Statistics:'));
    console.log(`  Uptime: ${hours}h ${minutes}m ${seconds}s`);
    console.log(`  Opportunities Found: ${this.opportunityCount}`);
    console.log(`  Telegram Alerts: ${telegramBot.isAlertActive() ? 'Active' : 'Inactive'}`);

    // Add error stats
    const errorStats = errorHandler.getErrorStats();
    if (errorStats.total > 0) {
      console.log(chalk.yellow('\n⚠️  Errors:'));
      console.log(`  Total: ${errorStats.total}`);
      errorStats.byType.forEach((count, type) => {
        console.log(`  ${type}: ${count}`);
      });
    }
    
    // Add health status
    const health = healthMonitor.getCurrentHealth();
    if (health) {
      console.log(chalk.yellow('\n🏥 Health:'));
      console.log(`  Status: ${health.status === 'healthy' ? chalk.green(health.status) : 
                              health.status === 'degraded' ? chalk.yellow(health.status) : 
                              chalk.red(health.status)}`);
    }
    
    console.log(chalk.cyan('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'));
  }

  /**
   * Graceful shutdown
   */
  private async shutdown() {
    if (!this.isRunning) return;
    
    console.log(chalk.yellow('\n🛑 Shutting down...'));
    this.isRunning = false;

    try {
      // Send shutdown notification
      await telegramBot.sendSystemAlert(
        'Bot Shutdown',
        `USDT Arbitrage Bot is shutting down.\n\nUptime: ${Math.floor((Date.now() - this.startTime) / 1000 / 60)} minutes\nOpportunities Found: ${this.opportunityCount}\n\nError Statistics:\n${this.getErrorSummary()}`,
        'medium'
      );

      // Disconnect WebSocket
      priceStreamService.disconnectAll();

      // Close database
      await databaseService.close();

      // Stop Telegram bot
      telegramBot.stop();
      
      // Stop health monitor
      healthMonitor.stop();

      console.log(chalk.green('✅ Shutdown complete'));
      process.exit(0);
    } catch (error) {
      console.error(chalk.red('Error during shutdown:'), error);
      process.exit(1);
    }
  }
  
  /**
   * Get error summary for shutdown message
   */
  private getErrorSummary(): string {
    const stats = errorHandler.getErrorStats();
    let summary = `Total Errors: ${stats.total}\n`;
    
    stats.byType.forEach((count, type) => {
      summary += `${type}: ${count}\n`;
    });
    
    return summary;
  }
}

// Error handling
process.on('uncaughtException', async (error) => {
  await errorHandler.handleError(error, {
    type: ErrorType.SYSTEM,
    severity: ErrorSeverity.CRITICAL,
    operation: 'uncaughtException'
  });
  process.exit(1);
});

// Start the monitor
const monitor = new IntegratedArbitrageMonitor();
monitor.start().catch(console.error);