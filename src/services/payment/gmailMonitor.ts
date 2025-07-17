import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { EventEmitter } from 'events';
import { parseIndianBankSMS } from './parsers/bankParsers';
import { logger } from '../../utils/logger';

interface PaymentDetails {
  amount: number;
  sender: string;
  accountNumber: string;
  timestamp: Date;
  bank: string;
  transactionId?: string;
  rawMessage: string;
}

export class GmailPaymentMonitor extends EventEmitter {
  private gmail: any;
  private oauth2Client: OAuth2Client;
  private watchInterval: NodeJS.Timer | null = null;
  private processedMessageIds: Set<string> = new Set();

  constructor() {
    super();
  }

  async initialize() {
    // Initialize OAuth2 client
    this.oauth2Client = new OAuth2Client(
      process.env.GMAIL_CLIENT_ID,
      process.env.GMAIL_CLIENT_SECRET,
      process.env.GMAIL_REDIRECT_URI
    );

    // Set credentials
    this.oauth2Client.setCredentials({
      refresh_token: process.env.GMAIL_REFRESH_TOKEN
    });

    // Initialize Gmail API
    this.gmail = google.gmail({ version: 'v1', auth: this.oauth2Client });

    // Test connection
    await this.testConnection();
  }

  private async testConnection() {
    try {
      const res = await this.gmail.users.getProfile({ userId: 'me' });
      logger.info('Gmail connected:', res.data.emailAddress);
    } catch (error) {
      logger.error('Gmail connection failed:', error);
      throw error;
    }
  }

  async startMonitoring(checkInterval: number = 5000) {
    logger.info('Starting Gmail payment monitoring...');
    
    // Initial check
    await this.checkNewMessages();
    
    // Set up interval checking
    this.watchInterval = setInterval(async () => {
      await this.checkNewMessages();
    }, checkInterval);
  }

  async stopMonitoring() {
    if (this.watchInterval) {
      clearInterval(this.watchInterval);
      this.watchInterval = null;
    }
    logger.info('Gmail monitoring stopped');
  }

  private async checkNewMessages() {
    try {
      // Search for bank notification emails
      const query = this.buildSearchQuery();
      
      const response = await this.gmail.users.messages.list({
        userId: 'me',
        q: query,
        maxResults: 10
      });

      if (!response.data.messages) return;

      for (const message of response.data.messages) {
        if (!this.processedMessageIds.has(message.id)) {
          await this.processMessage(message.id);
          this.processedMessageIds.add(message.id);
        }
      }
    } catch (error) {
      logger.error('Error checking messages:', error);
      this.emit('error', error);
    }
  }

  private buildSearchQuery(): string {
    const banks = [
      'from:sbibank@onlinesbi.com',
      'from:alerts@hdfcbank.net',
      'from:credit_alerts@icicibank.com',
      'from:alerts@axisbank.com',
      'from:noreply@kotak.com',
      'from:alerts@yesbank.com'
    ];

    const keywords = [
      'credited',
      'received',
      'deposited',
      'IMPS',
      'NEFT',
      'UPI',
      'transfer'
    ];

    // Build query: from any bank AND contains credit keywords AND from last hour
    const bankQuery = `(${banks.join(' OR ')})`;
    const keywordQuery = `(${keywords.join(' OR ')})`;
    const timeQuery = 'newer_than:1h';

    return `${bankQuery} ${keywordQuery} ${timeQuery}`;
  }

  private async processMessage(messageId: string) {
    try {
      const message = await this.gmail.users.messages.get({
        userId: 'me',
        id: messageId
      });

      const payment = await this.extractPaymentDetails(message.data);
      
      if (payment) {
        logger.info('Payment detected:', payment);
        this.emit('payment', payment);
      }
    } catch (error) {
      logger.error('Error processing message:', error);
    }
  }

  private async extractPaymentDetails(message: any): Promise<PaymentDetails | null> {
    try {
      // Extract email content
      const payload = message.payload;
      let emailBody = '';
      let subject = '';

      // Get subject
      const subjectHeader = payload.headers.find((h: any) => h.name === 'Subject');
      if (subjectHeader) subject = subjectHeader.value;

      // Extract body
      if (payload.body.data) {
        emailBody = Buffer.from(payload.body.data, 'base64').toString();
      } else if (payload.parts) {
        for (const part of payload.parts) {
          if (part.mimeType === 'text/plain' && part.body.data) {
            emailBody = Buffer.from(part.body.data, 'base64').toString();
            break;
          }
        }
      }

      // Parse payment details
      const combinedText = `${subject} ${emailBody}`;
      const payment = parseIndianBankSMS(combinedText);

      if (payment) {
        return {
          ...payment,
          rawMessage: combinedText,
          timestamp: new Date(parseInt(message.internalDate))
        };
      }

      return null;
    } catch (error) {
      logger.error('Error extracting payment:', error);
      return null;
    }
  }

  async searchPaymentsByAmount(amount: number, tolerance: number = 0.01): Promise<PaymentDetails[]> {
    const minAmount = amount * (1 - tolerance);
    const maxAmount = amount * (1 + tolerance);
    
    const query = `${this.buildSearchQuery()} "Rs ${Math.floor(minAmount)}" OR "Rs ${Math.floor(maxAmount)}"`;
    
    const response = await this.gmail.users.messages.list({
      userId: 'me',
      q: query,
      maxResults: 50
    });

    const payments: PaymentDetails[] = [];
    
    if (response.data.messages) {
      for (const message of response.data.messages) {
        const message_data = await this.gmail.users.messages.get({
          userId: 'me',
          id: message.id
        });
        const payment = await this.extractPaymentDetails(message_data.data);
        if (payment && payment.amount >= minAmount && payment.amount <= maxAmount) {
          payments.push(payment);
        }
      }
    }

    return payments;
  }

  // OAuth2 URL generation for initial setup
  static generateAuthUrl(oauth2Client: OAuth2Client): string {
    const scopes = [
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/gmail.modify'
    ];

    return oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      prompt: 'consent'
    });
  }

  // Exchange authorization code for tokens
  static async getTokensFromCode(oauth2Client: OAuth2Client, code: string) {
    const { tokens } = await oauth2Client.getToken(code);
    return tokens;
  }
}

export type { PaymentDetails };