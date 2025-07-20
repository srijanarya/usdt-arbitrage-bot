import axios from 'axios';
import chalk from 'chalk';

interface TelegramConfig {
  botToken: string;
  chatId: string;
  enabled: boolean;
}

interface AlertMessage {
  type: 'opportunity' | 'warning' | 'info' | 'error';
  title: string;
  message: string;
  details?: Record<string, any>;
  priority?: 'high' | 'medium' | 'low';
}

export class TelegramAlertService {
  private config: TelegramConfig;
  private messageQueue: AlertMessage[] = [];
  private isProcessing = false;
  private lastMessageTime = 0;
  private minInterval = 1000; // Minimum 1 second between messages

  constructor(config: Partial<TelegramConfig> = {}) {
    this.config = {
      botToken: config.botToken || process.env.TELEGRAM_BOT_TOKEN || '',
      chatId: config.chatId || process.env.TELEGRAM_CHAT_ID || '',
      enabled: config.enabled !== undefined ? config.enabled : true
    };

    if (!this.config.botToken || !this.config.chatId) {
      console.log(chalk.yellow('⚠️  Telegram alerts disabled - missing bot token or chat ID'));
      this.config.enabled = false;
    }
  }

  /**
   * Send an arbitrage opportunity alert
   */
  async sendArbitrageAlert(
    buyExchange: string,
    sellExchange: string,
    buyPrice: number,
    sellPrice: number,
    profit: number,
    roi: number,
    amount: number = 100
  ) {
    const emoji = profit > 500 ? '🚀' : profit > 200 ? '💰' : '📈';
    
    const message = `${emoji} *Arbitrage Opportunity!*\n\n` +
      `🔄 Route: ${buyExchange} → ${sellExchange}\n` +
      `💵 Buy: ₹${buyPrice.toFixed(2)}\n` +
      `💸 Sell: ₹${sellPrice.toFixed(2)}\n` +
      `📊 Amount: ${amount} USDT\n` +
      `💹 Profit: ₹${profit.toFixed(2)} (${roi.toFixed(2)}% ROI)\n` +
      `⏰ Time: ${new Date().toLocaleTimeString()}`;

    await this.sendAlert({
      type: 'opportunity',
      title: 'Arbitrage Alert',
      message,
      priority: profit > 500 ? 'high' : 'medium'
    });
  }

  /**
   * Send a price alert
   */
  async sendPriceAlert(exchange: string, price: number, threshold: number) {
    const isBelow = price < threshold;
    const emoji = isBelow ? '🎯' : '📉';
    
    const message = `${emoji} *Price Alert - ${exchange}*\n\n` +
      `Current Price: ₹${price.toFixed(2)}\n` +
      `${isBelow ? 'Below' : 'Above'} threshold: ₹${threshold.toFixed(2)}\n` +
      `Time: ${new Date().toLocaleTimeString()}`;

    await this.sendAlert({
      type: 'info',
      title: 'Price Alert',
      message,
      priority: 'medium'
    });
  }

  /**
   * Send a system alert (errors, warnings, etc.)
   */
  async sendSystemAlert(title: string, message: string, type: 'warning' | 'error' = 'warning') {
    const emoji = type === 'error' ? '❌' : '⚠️';
    
    const formattedMessage = `${emoji} *${title}*\n\n${message}\n\nTime: ${new Date().toLocaleTimeString()}`;

    await this.sendAlert({
      type,
      title,
      message: formattedMessage,
      priority: type === 'error' ? 'high' : 'medium'
    });
  }

  /**
   * Send daily summary
   */
  async sendDailySummary(
    totalOpportunities: number,
    bestProfit: number,
    totalVolume: number,
    activeExchanges: string[]
  ) {
    const message = `📊 *Daily Arbitrage Summary*\n\n` +
      `📈 Total Opportunities: ${totalOpportunities}\n` +
      `💰 Best Profit: ₹${bestProfit.toFixed(2)}\n` +
      `📦 Total Volume: ${totalVolume} USDT\n` +
      `🏦 Active Exchanges: ${activeExchanges.join(', ')}\n\n` +
      `Generated at: ${new Date().toLocaleString()}`;

    await this.sendAlert({
      type: 'info',
      title: 'Daily Summary',
      message,
      priority: 'low'
    });
  }

  /**
   * Core alert sending method
   */
  private async sendAlert(alert: AlertMessage) {
    if (!this.config.enabled) {
      console.log(chalk.gray(`[Telegram Disabled] ${alert.title}: ${alert.message.substring(0, 50)}...`));
      return;
    }

    // Add to queue
    this.messageQueue.push(alert);
    
    // Process queue if not already processing
    if (!this.isProcessing) {
      await this.processQueue();
    }
  }

  /**
   * Process message queue with rate limiting
   */
  private async processQueue() {
    this.isProcessing = true;

    while (this.messageQueue.length > 0) {
      const alert = this.messageQueue.shift()!;
      
      // Rate limiting
      const now = Date.now();
      const timeSinceLastMessage = now - this.lastMessageTime;
      if (timeSinceLastMessage < this.minInterval) {
        await this.sleep(this.minInterval - timeSinceLastMessage);
      }

      try {
        await this.sendTelegramMessage(alert.message);
        this.lastMessageTime = Date.now();
        
        console.log(chalk.green(`✅ Telegram alert sent: ${alert.title}`));
      } catch (error) {
        console.error(chalk.red(`❌ Failed to send Telegram alert: ${error.message}`));
        
        // Re-queue high priority messages
        if (alert.priority === 'high') {
          this.messageQueue.unshift(alert);
          await this.sleep(5000); // Wait 5 seconds before retry
        }
      }
    }

    this.isProcessing = false;
  }

  /**
   * Send message via Telegram Bot API
   */
  private async sendTelegramMessage(text: string) {
    const url = `https://api.telegram.org/bot${this.config.botToken}/sendMessage`;
    
    const response = await axios.post(url, {
      chat_id: this.config.chatId,
      text,
      parse_mode: 'Markdown',
      disable_notification: false
    });

    if (!response.data.ok) {
      throw new Error(`Telegram API error: ${response.data.description}`);
    }

    return response.data;
  }

  /**
   * Test connection and configuration
   */
  async testConnection(): Promise<boolean> {
    try {
      await this.sendTelegramMessage('🤖 Telegram alerts configured successfully!');
      return true;
    } catch (error) {
      console.error(chalk.red('Telegram connection test failed:', error.message));
      return false;
    }
  }

  /**
   * Enable/disable alerts
   */
  setEnabled(enabled: boolean) {
    this.config.enabled = enabled;
    console.log(chalk.yellow(`Telegram alerts ${enabled ? 'enabled' : 'disabled'}`));
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<TelegramConfig>) {
    this.config = { ...this.config, ...config };
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Export singleton instance
export const telegramAlert = new TelegramAlertService();