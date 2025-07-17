import { EventEmitter } from 'events';
import { parseIndianBankSMS, PaymentDetails } from './parsers/bankParsers';
import { logger } from '../../utils/logger';

interface SmsConfig {
  accountSid: string;
  authToken: string;
  phoneNumber: string; // Twilio phone number
  webhook?: string; // Webhook URL for receiving SMS
}

export class SmsPaymentMonitor extends EventEmitter {
  private config: SmsConfig;
  private client: any; // Twilio client
  private processedMessageIds: Set<string> = new Set();
  private pollInterval: NodeJS.Timer | null = null;

  constructor(config: SmsConfig) {
    super();
    this.config = config;
  }

  async initialize() {
    try {
      // Import Twilio dynamically
      const twilio = require('twilio');
      this.client = twilio(this.config.accountSid, this.config.authToken);
      
      // Test connection
      await this.testConnection();
      logger.info('SMS monitor initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize SMS monitor:', error);
      throw error;
    }
  }

  private async testConnection() {
    try {
      // Test by fetching account info
      const account = await this.client.api.accounts(this.config.accountSid).fetch();
      logger.info('Twilio connected for account:', account.friendlyName);
    } catch (error) {
      logger.error('Twilio connection test failed:', error);
      throw error;
    }
  }

  async startMonitoring(checkInterval: number = 10000) {
    logger.info('Starting SMS payment monitoring...');
    
    // Initial check
    await this.checkNewMessages();
    
    // Set up interval checking
    this.pollInterval = setInterval(async () => {
      await this.checkNewMessages();
    }, checkInterval);
  }

  async stopMonitoring() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
    logger.info('SMS monitoring stopped');
  }

  private async checkNewMessages() {
    try {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      
      const messages = await this.client.messages.list({
        to: this.config.phoneNumber,
        dateSentAfter: oneHourAgo,
        limit: 20
      });

      for (const message of messages) {
        if (!this.processedMessageIds.has(message.sid)) {
          await this.processMessage(message);
          this.processedMessageIds.add(message.sid);
        }
      }
    } catch (error) {
      logger.error('Error checking SMS messages:', error);
      this.emit('error', error);
    }
  }

  private async processMessage(message: any) {
    try {
      // Check if message is from a bank
      const bankNumbers = [
        'SBIINB',
        'HDFCBK',
        'ICICIB',
        'AXISBK',
        'KOTAKB',
        'YESBNK'
      ];

      const isFromBank = bankNumbers.some(bank => 
        message.from.includes(bank) || message.body.includes(bank)
      );

      if (!isFromBank) return;

      // Parse payment details from SMS
      const payment = parseIndianBankSMS(message.body);
      
      if (payment) {
        const enrichedPayment = {
          ...payment,
          timestamp: new Date(message.dateSent),
          rawMessage: message.body,
          source: 'SMS',
          messageId: message.sid
        };
        
        logger.info('Payment detected via SMS:', enrichedPayment);
        this.emit('payment', enrichedPayment);
      }
    } catch (error) {
      logger.error('Error processing SMS message:', error);
    }
  }

  async searchPaymentsByAmount(amount: number, tolerance: number = 0.01): Promise<PaymentDetails[]> {
    const minAmount = amount * (1 - tolerance);
    const maxAmount = amount * (1 + tolerance);
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    try {
      const messages = await this.client.messages.list({
        to: this.config.phoneNumber,
        dateSentAfter: oneDayAgo,
        limit: 100
      });

      const payments: PaymentDetails[] = [];
      
      for (const message of messages) {
        const payment = parseIndianBankSMS(message.body);
        if (payment && payment.amount >= minAmount && payment.amount <= maxAmount) {
          payments.push({
            ...payment,
            timestamp: new Date(message.dateSent),
            rawMessage: message.body
          });
        }
      }

      return payments;
    } catch (error) {
      logger.error('Error searching SMS payments:', error);
      return [];
    }
  }

  // Webhook handler for real-time SMS processing
  async handleWebhook(body: any) {
    try {
      const messageBody = body.Body;
      const from = body.From;
      const messageSid = body.MessageSid;

      if (this.processedMessageIds.has(messageSid)) return;

      const payment = parseIndianBankSMS(messageBody);
      
      if (payment) {
        const enrichedPayment = {
          ...payment,
          timestamp: new Date(),
          rawMessage: messageBody,
          source: 'SMS_WEBHOOK',
          messageId: messageSid,
          fromNumber: from
        };
        
        logger.info('Real-time payment detected via SMS webhook:', enrichedPayment);
        this.emit('payment', enrichedPayment);
        this.processedMessageIds.add(messageSid);
      }
    } catch (error) {
      logger.error('Error processing SMS webhook:', error);
    }
  }
}

export type { SmsConfig, PaymentDetails };