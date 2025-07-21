import TelegramBot from 'node-telegram-bot-api';
import chalk from 'chalk';
import dotenv from 'dotenv';
import { databaseService } from '../database/DatabaseService';

dotenv.config();

interface ArbitrageAlert {
  buyExchange: string;
  sellExchange: string;
  buyPrice: number;
  sellPrice: number;
  profit: number;
  profitPercent: number;
  volume: number;
  timestamp: Date;
}

interface SystemStatus {
  websocketStatus: { [exchange: string]: boolean };
  databaseConnected: boolean;
  uptime: number;
  lastOpportunity?: Date;
}

export class TelegramBotService {
  private bot: TelegramBot;
  private chatId: string;
  private isActive: boolean = false;
  private alertThreshold: number = 0.1; // 0.1% profit minimum
  private lastAlertTime: Map<string, number> = new Map();
  private alertCooldown: number = 30000; // 30 seconds between similar alerts

  constructor() {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    this.chatId = process.env.TELEGRAM_CHAT_ID || '';

    if (!token) {
      console.log(chalk.yellow('⚠️  Telegram bot token not configured'));
      return;
    }

    this.bot = new TelegramBot(token, { polling: true });
    this.setupCommands();
    this.isActive = true;
    console.log(chalk.green('✅ Telegram bot initialized'));
  }

  /**
   * Setup bot commands
   */
  private setupCommands(): void {
    // Start command
    this.bot.onText(/\/start/, async (msg) => {
      const chatId = msg.chat.id;
      await this.bot.sendMessage(chatId, 
        `🚀 *Treum Algotech Arbitrage Bot*\n\n` +
        `Welcome! I'll send you real-time arbitrage opportunities.\n\n` +
        `*Available Commands:*\n` +
        `/status - System status\n` +
        `/opportunities - Recent opportunities\n` +
        `/profits - Profit summary\n` +
        `/threshold <value> - Set alert threshold\n` +
        `/stop - Stop alerts\n` +
        `/resume - Resume alerts\n\n` +
        `Your Chat ID: \`${chatId}\``,
        { parse_mode: 'Markdown' }
      );
      
      // Save chat ID if not set
      if (!this.chatId) {
        this.chatId = chatId.toString();
        console.log(chalk.green(`Chat ID set to: ${this.chatId}`));
      }
    });

    // Status command
    this.bot.onText(/\/status/, async (msg) => {
      const status = await this.getSystemStatus();
      await this.sendStatusMessage(msg.chat.id, status);
    });

    // Recent opportunities command
    this.bot.onText(/\/opportunities/, async (msg) => {
      const opportunities = await databaseService.getRecentOpportunities(5);
      await this.sendOpportunitiesMessage(msg.chat.id, opportunities);
    });

    // Profits command
    this.bot.onText(/\/profits/, async (msg) => {
      const performance = await databaseService.getDailyPerformance(7);
      await this.sendProfitSummary(msg.chat.id, performance);
    });

    // Set threshold command
    this.bot.onText(/\/threshold (.+)/, async (msg, match) => {
      if (match && match[1]) {
        const threshold = parseFloat(match[1]);
        if (!isNaN(threshold) && threshold >= 0) {
          this.alertThreshold = threshold;
          await this.bot.sendMessage(
            msg.chat.id,
            `✅ Alert threshold set to ${threshold}%`
          );
        } else {
          await this.bot.sendMessage(
            msg.chat.id,
            `❌ Invalid threshold. Please provide a number >= 0`
          );
        }
      }
    });

    // Stop alerts
    this.bot.onText(/\/stop/, async (msg) => {
      this.isActive = false;
      await this.bot.sendMessage(msg.chat.id, '🛑 Alerts stopped');
    });

    // Resume alerts
    this.bot.onText(/\/resume/, async (msg) => {
      this.isActive = true;
      await this.bot.sendMessage(msg.chat.id, '✅ Alerts resumed');
    });
  }

  /**
   * Send arbitrage opportunity alert
   */
  async sendArbitrageAlert(opportunity: ArbitrageAlert): Promise<void> {
    if (!this.isActive || !this.chatId) return;

    // Check if profit meets threshold
    if (opportunity.profitPercent < this.alertThreshold) return;

    // Check cooldown
    const alertKey = `${opportunity.buyExchange}-${opportunity.sellExchange}`;
    const lastAlert = this.lastAlertTime.get(alertKey) || 0;
    const now = Date.now();
    
    if (now - lastAlert < this.alertCooldown) return;
    
    this.lastAlertTime.set(alertKey, now);

    const message = 
      `🚨 *ARBITRAGE OPPORTUNITY*\n\n` +
      `💰 *Profit: ₹${opportunity.profit.toFixed(2)} (${opportunity.profitPercent.toFixed(2)}%)*\n` +
      `📊 Volume: ₹${opportunity.volume.toLocaleString('en-IN')}\n\n` +
      `🏪 *Buy:* ${opportunity.buyExchange.toUpperCase()} @ ₹${opportunity.buyPrice.toFixed(2)}\n` +
      `🏪 *Sell:* ${opportunity.sellExchange.toUpperCase()} @ ₹${opportunity.sellPrice.toFixed(2)}\n\n` +
      `⏰ ${new Date(opportunity.timestamp).toLocaleTimeString('en-IN')}\n` +
      `🏢 _Treum Algotech (OPC) Pvt. Ltd._`;

    try {
      await this.bot.sendMessage(this.chatId, message, { 
        parse_mode: 'Markdown',
        disable_notification: opportunity.profitPercent < 0.5 // Silent for small profits
      });
      console.log(chalk.green(`📱 Telegram alert sent: ${opportunity.profitPercent.toFixed(2)}% profit`));
    } catch (error) {
      console.error(chalk.red('Failed to send Telegram alert:'), error);
    }
  }

  /**
   * Send system alert
   */
  async sendSystemAlert(title: string, message: string, priority: 'high' | 'medium' | 'low' = 'medium'): Promise<void> {
    if (!this.chatId) return;

    const emoji = priority === 'high' ? '🚨' : priority === 'medium' ? '⚠️' : 'ℹ️';
    const formattedMessage = `${emoji} *${title}*\n\n${message}\n\n_${new Date().toLocaleString('en-IN')}_`;

    try {
      await this.bot.sendMessage(this.chatId, formattedMessage, {
        parse_mode: 'Markdown',
        disable_notification: priority === 'low'
      });
    } catch (error) {
      console.error(chalk.red('Failed to send system alert:'), error);
    }
  }

  /**
   * Get system status
   */
  private async getSystemStatus(): Promise<SystemStatus> {
    // This would be populated by the main application
    return {
      websocketStatus: {
        zebpay: true,
        coindcx: true
      },
      databaseConnected: true,
      uptime: process.uptime(),
      lastOpportunity: new Date()
    };
  }

  /**
   * Send status message
   */
  private async sendStatusMessage(chatId: number, status: SystemStatus): Promise<void> {
    const uptimeHours = Math.floor(status.uptime / 3600);
    const uptimeMinutes = Math.floor((status.uptime % 3600) / 60);
    
    let statusEmojis = '';
    for (const [exchange, connected] of Object.entries(status.websocketStatus)) {
      statusEmojis += `${exchange}: ${connected ? '🟢' : '🔴'}\n`;
    }

    const message = 
      `📊 *System Status*\n\n` +
      `*WebSocket Connections:*\n${statusEmojis}\n` +
      `*Database:* ${status.databaseConnected ? '🟢 Connected' : '🔴 Disconnected'}\n` +
      `*Uptime:* ${uptimeHours}h ${uptimeMinutes}m\n` +
      `*Alerts:* ${this.isActive ? '✅ Active' : '🛑 Stopped'}\n` +
      `*Threshold:* ${this.alertThreshold}%\n\n` +
      `_Treum Algotech Systems_`;

    await this.bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
  }

  /**
   * Send opportunities message
   */
  private async sendOpportunitiesMessage(chatId: number, opportunities: any[]): Promise<void> {
    if (opportunities.length === 0) {
      await this.bot.sendMessage(chatId, 'No recent opportunities found');
      return;
    }

    let message = '📈 *Recent Opportunities*\n\n';
    
    for (const opp of opportunities) {
      const time = new Date(opp.detected_at).toLocaleTimeString('en-IN');
      const acted = opp.acted_upon ? '✅' : '⏳';
      
      message += 
        `${acted} *${opp.buy_exchange} → ${opp.sell_exchange}*\n` +
        `   💰 ₹${parseFloat(opp.profit).toFixed(2)} (${parseFloat(opp.profit_percent).toFixed(2)}%)\n` +
        `   ⏰ ${time}\n\n`;
    }

    await this.bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
  }

  /**
   * Send profit summary
   */
  private async sendProfitSummary(chatId: number, performance: any[]): Promise<void> {
    if (performance.length === 0) {
      await this.bot.sendMessage(chatId, 'No performance data available');
      return;
    }

    let message = '💰 *Weekly Performance*\n\n';
    let totalOpportunities = 0;
    let totalPotentialProfit = 0;
    
    for (const day of performance) {
      const date = new Date(day.date).toLocaleDateString('en-IN');
      totalOpportunities += parseInt(day.opportunities_count);
      totalPotentialProfit += parseFloat(day.total_potential_profit || 0);
      
      message += 
        `*${date}*\n` +
        `   📊 Opportunities: ${day.opportunities_count}\n` +
        `   💰 Avg Profit: ${parseFloat(day.avg_profit_percent || 0).toFixed(2)}%\n\n`;
    }

    message += 
      `*Total Summary:*\n` +
      `📊 Total Opportunities: ${totalOpportunities}\n` +
      `💰 Potential Profit: ₹${totalPotentialProfit.toFixed(2)}\n\n` +
      `_Treum Algotech Analytics_`;

    await this.bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
  }

  /**
   * Send daily summary
   */
  async sendDailySummary(): Promise<void> {
    if (!this.chatId) return;

    const performance = await databaseService.getDailyPerformance(1);
    const opportunities = await databaseService.getRecentOpportunities(10);
    
    if (performance.length > 0) {
      const today = performance[0];
      const message = 
        `📅 *Daily Summary*\n\n` +
        `📊 Opportunities Found: ${today.opportunities_count}\n` +
        `💰 Average Profit: ${parseFloat(today.avg_profit_percent || 0).toFixed(2)}%\n` +
        `🎯 Best Opportunity: ${parseFloat(today.max_profit_percent || 0).toFixed(2)}%\n` +
        `💵 Total Potential: ₹${parseFloat(today.total_potential_profit || 0).toFixed(2)}\n\n` +
        `_Treum Algotech Daily Report_`;

      await this.bot.sendMessage(this.chatId, message, { parse_mode: 'Markdown' });
    }
  }

  /**
   * Check if bot is active
   */
  isAlertActive(): boolean {
    return this.isActive;
  }

  /**
   * Stop the bot
   */
  stop(): void {
    if (this.bot) {
      this.bot.stopPolling();
      console.log(chalk.yellow('Telegram bot stopped'));
    }
  }
}

// Create singleton instance
export const telegramBot = new TelegramBotService();