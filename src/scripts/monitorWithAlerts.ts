import chalk from 'chalk';
import { priceMonitor } from '../services/websocket/SimpleWebSocketMonitor';
import { telegramAlert } from '../services/telegram/TelegramAlertService';
import { arbitrageCalculator } from '../services/arbitrage/USDTArbitrageCalculator';
import { PostgresService } from '../services/database/postgresService';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

interface AlertThresholds {
  minProfit: number;          // Minimum profit to trigger alert
  minROI: number;             // Minimum ROI % to trigger alert
  priceThresholds: {
    zebpay: number;           // Alert when ZebPay price drops below this
    coindcx: number;          // Alert when CoinDCX price drops below this
  };
  cooldownMinutes: number;    // Minutes before repeating same alert
}

class ArbitrageMonitorWithAlerts {
  private alertThresholds: AlertThresholds = {
    minProfit: 200,           // ₹200 minimum profit
    minROI: 2,                // 2% minimum ROI
    priceThresholds: {
      zebpay: 85,             // Alert when below ₹85
      coindcx: 85
    },
    cooldownMinutes: 30       // 30 minutes cooldown
  };

  private lastAlerts: Map<string, Date> = new Map();
  private dailyStats = {
    opportunities: 0,
    bestProfit: 0,
    totalVolume: 0,
    activeExchanges: new Set<string>()
  };

  async start() {
    console.log(chalk.bgCyan.black(' 🚀 Arbitrage Monitor with Telegram Alerts \n'));
    
    // Check Telegram configuration
    const telegramConfigured = process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID;
    if (telegramConfigured) {
      console.log(chalk.green('✅ Telegram alerts enabled'));
      await telegramAlert.testConnection();
    } else {
      console.log(chalk.yellow('⚠️  Telegram alerts disabled (no configuration)'));
    }

    // Set up event listeners
    this.setupEventListeners();

    // Start monitoring
    await priceMonitor.start();

    // Schedule daily summary
    this.scheduleDailySummary();

    console.log(chalk.gray('\nMonitoring started. Press Ctrl+C to stop.\n'));
  }

  private setupEventListeners() {
    // Listen for arbitrage opportunities
    priceMonitor.on('arbitrageFound', async (opportunity) => {
      this.dailyStats.opportunities++;
      this.dailyStats.activeExchanges.add(opportunity.buyExchange);
      this.dailyStats.activeExchanges.add(opportunity.sellExchange);
      
      if (opportunity.netProfit > this.dailyStats.bestProfit) {
        this.dailyStats.bestProfit = opportunity.netProfit;
      }

      // Check if we should send alert
      if (this.shouldSendAlert(opportunity)) {
        await this.sendArbitrageAlert(opportunity);
      }
    });

    // Listen for price updates
    priceMonitor.on('priceUpdate', async (priceUpdate) => {
      // Check price thresholds
      if (priceUpdate.exchange === 'zebpay' && 
          priceUpdate.ask < this.alertThresholds.priceThresholds.zebpay) {
        await this.sendPriceThresholdAlert(priceUpdate.exchange, priceUpdate.ask);
      }
    });
  }

  private shouldSendAlert(opportunity: any): boolean {
    // Check minimum thresholds
    if (opportunity.netProfit < this.alertThresholds.minProfit ||
        opportunity.roi < this.alertThresholds.minROI) {
      return false;
    }

    // Check cooldown
    const alertKey = `${opportunity.buyExchange}-${opportunity.sellExchange}`;
    const lastAlert = this.lastAlerts.get(alertKey);
    
    if (lastAlert) {
      const minutesSinceLastAlert = (Date.now() - lastAlert.getTime()) / (1000 * 60);
      if (minutesSinceLastAlert < this.alertThresholds.cooldownMinutes) {
        return false;
      }
    }

    return true;
  }

  private async sendArbitrageAlert(opportunity: any) {
    const alertKey = `${opportunity.buyExchange}-${opportunity.sellExchange}`;
    this.lastAlerts.set(alertKey, new Date());

    await telegramAlert.sendArbitrageAlert(
      opportunity.buyExchange,
      opportunity.sellExchange,
      opportunity.buyPrice,
      opportunity.sellPrice,
      opportunity.netProfit,
      opportunity.roi,
      100
    );

    // Also save to database
    await PostgresService.saveArbitrageOpportunity({
      type: 'alert_sent',
      buyExchange: opportunity.buyExchange,
      sellExchange: opportunity.sellExchange,
      symbol: 'USDT/INR',
      buyPrice: opportunity.buyPrice,
      sellPrice: opportunity.sellPrice,
      grossProfit: opportunity.netProfit * 1.05,
      netProfit: opportunity.netProfit,
      profitPercentage: opportunity.roi
    });
  }

  private async sendPriceThresholdAlert(exchange: string, price: number) {
    const alertKey = `price-${exchange}`;
    const lastAlert = this.lastAlerts.get(alertKey);
    
    if (lastAlert) {
      const minutesSinceLastAlert = (Date.now() - lastAlert.getTime()) / (1000 * 60);
      if (minutesSinceLastAlert < this.alertThresholds.cooldownMinutes) {
        return;
      }
    }

    this.lastAlerts.set(alertKey, new Date());
    await telegramAlert.sendPriceAlert(
      exchange, 
      price, 
      this.alertThresholds.priceThresholds[exchange as keyof typeof this.alertThresholds.priceThresholds]
    );
  }

  private scheduleDailySummary() {
    // Send summary every 24 hours
    setInterval(async () => {
      await telegramAlert.sendDailySummary(
        this.dailyStats.opportunities,
        this.dailyStats.bestProfit,
        this.dailyStats.totalVolume,
        Array.from(this.dailyStats.activeExchanges)
      );

      // Reset daily stats
      this.dailyStats = {
        opportunities: 0,
        bestProfit: 0,
        totalVolume: 0,
        activeExchanges: new Set<string>()
      };
    }, 24 * 60 * 60 * 1000); // 24 hours
  }

  async stop() {
    priceMonitor.stop();
    console.log(chalk.yellow('\nMonitor stopped'));
  }

  // Update alert thresholds
  updateThresholds(thresholds: Partial<AlertThresholds>) {
    this.alertThresholds = { ...this.alertThresholds, ...thresholds };
    console.log(chalk.yellow('Alert thresholds updated'));
  }
}

// Create and start monitor
const monitor = new ArbitrageMonitorWithAlerts();

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log(chalk.yellow('\n\nShutting down...'));
  await monitor.stop();
  process.exit(0);
});

// Start monitoring
monitor.start().catch(console.error);