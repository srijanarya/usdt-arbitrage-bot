import axios from 'axios';
import { EventEmitter } from 'events';

interface TelegramConfig {
  botToken: string;
  chatId: string;
  enabled: boolean;
}

interface ArbitrageAlert {
  type: string;
  buyExchange: string;
  sellExchange: string;
  pair: string;
  buyPrice: number;
  sellPrice: number;
  netProfit: number;
  timestamp: Date;
}

export class TelegramNotifier extends EventEmitter {
  private config: TelegramConfig;
  private baseURL: string;
  private messageQueue: string[] = [];
  private isProcessing = false;
  private rateLimitDelay = 1000; // 1 message per second to avoid Telegram rate limits

  constructor() {
    super();
    this.config = {
      botToken: process.env.TELEGRAM_BOT_TOKEN || '',
      chatId: process.env.TELEGRAM_CHAT_ID || '',
      enabled: process.env.TELEGRAM_ENABLED === 'true'
    };
    
    this.baseURL = `https://api.telegram.org/bot${this.config.botToken}`;
    
    if (this.config.enabled && (!this.config.botToken || !this.config.chatId)) {
      console.warn('⚠️ Telegram notifications enabled but credentials not configured');
      this.config.enabled = false;
    }
  }

  async sendMessage(message: string): Promise<void> {
    if (!this.config.enabled) return;

    this.messageQueue.push(message);
    
    if (!this.isProcessing) {
      this.processQueue();
    }
  }

  private async processQueue(): Promise<void> {
    if (this.messageQueue.length === 0) {
      this.isProcessing = false;
      return;
    }

    this.isProcessing = true;
    const message = this.messageQueue.shift()!;

    try {
      await axios.post(`${this.baseURL}/sendMessage`, {
        chat_id: this.config.chatId,
        text: message,
        parse_mode: 'HTML',
        disable_web_page_preview: true
      });

      this.emit('sent', { message, timestamp: new Date() });
    } catch (error: any) {
      console.error('Failed to send Telegram message:', error.response?.data || error.message);
      this.emit('error', error);
    }

    // Wait before processing next message
    setTimeout(() => this.processQueue(), this.rateLimitDelay);
  }

  async sendArbitrageAlert(opportunity: ArbitrageAlert): Promise<void> {
    const profitEmoji = opportunity.netProfit > 1 ? '🚀' : '💰';
    const profitPercentage = opportunity.netProfit.toFixed(3);
    
    const message = `
${profitEmoji} <b>ARBITRAGE OPPORTUNITY DETECTED!</b>

📊 <b>Pair:</b> ${opportunity.pair}
💸 <b>Net Profit:</b> ${profitPercentage}%

📈 <b>Buy on:</b> ${opportunity.buyExchange}
   Price: ${opportunity.buyPrice.toFixed(6)}

📉 <b>Sell on:</b> ${opportunity.sellExchange}
   Price: ${opportunity.sellPrice.toFixed(6)}

⏰ <b>Time:</b> ${opportunity.timestamp.toLocaleTimeString()}

<i>Act quickly! Arbitrage opportunities are time-sensitive.</i>
    `.trim();

    await this.sendMessage(message);
  }

  async sendSystemAlert(title: string, message: string, type: 'info' | 'warning' | 'error' = 'info'): Promise<void> {
    const emoji = {
      info: 'ℹ️',
      warning: '⚠️',
      error: '❌'
    }[type];

    const formattedMessage = `
${emoji} <b>${title}</b>

${message}

⏰ ${new Date().toLocaleTimeString()}
    `.trim();

    await this.sendMessage(formattedMessage);
  }

  async sendDailySummary(data: {
    totalOpportunities: number;
    profitableOpportunities: number;
    bestOpportunity: ArbitrageAlert | null;
    totalVolume: number;
  }): Promise<void> {
    const profitRate = data.totalOpportunities > 0 
      ? ((data.profitableOpportunities / data.totalOpportunities) * 100).toFixed(2)
      : '0';

    let message = `
📊 <b>DAILY ARBITRAGE SUMMARY</b>

📈 <b>Total Opportunities:</b> ${data.totalOpportunities}
✅ <b>Profitable:</b> ${data.profitableOpportunities} (${profitRate}%)
💵 <b>Total Volume:</b> $${data.totalVolume.toFixed(2)}
`;

    if (data.bestOpportunity) {
      message += `

🏆 <b>Best Opportunity Today:</b>
   Profit: ${data.bestOpportunity.netProfit.toFixed(3)}%
   Route: ${data.bestOpportunity.buyExchange} → ${data.bestOpportunity.sellExchange}
`;
    }

    message += `

📅 ${new Date().toLocaleDateString()}
    `.trim();

    await this.sendMessage(message);
  }

  async testConnection(): Promise<boolean> {
    if (!this.config.enabled) {
      console.log('Telegram notifications are disabled');
      return false;
    }

    try {
      const response = await axios.get(`${this.baseURL}/getMe`);
      console.log('✅ Telegram bot connected:', response.data.result.username);
      
      await this.sendSystemAlert(
        'Bot Connected',
        'USDT Arbitrage Bot is now monitoring the markets!',
        'info'
      );
      
      return true;
    } catch (error) {
      console.error('❌ Failed to connect to Telegram bot:', error);
      return false;
    }
  }

  isEnabled(): boolean {
    return this.config.enabled;
  }
}

// Singleton instance
export const telegramNotifier = new TelegramNotifier();