import axios from 'axios';
import crypto from 'crypto';
import { EventEmitter } from 'events';
import { logger } from '../../utils/logger';
import { config } from 'dotenv';

config();

interface ICICIConfig {
  clientId: string;
  clientSecret: string;
  apiKey: string;
  accountNumber: string;
  baseURL: string;
  webhookSecret: string;
}

interface PaymentRequest {
  amount: number;
  beneficiaryVPA: string;
  remarks: string;
  paymentMode: 'UPI' | 'IMPS' | 'NEFT';
}

interface PaymentResponse {
  transactionId: string;
  status: 'SUCCESS' | 'PENDING' | 'FAILED';
  amount: number;
  timestamp: Date;
  referenceNumber: string;
}

export class ICICIPaymentService extends EventEmitter {
  private config: ICICIConfig;
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;

  constructor() {
    super();
    
    this.config = {
      clientId: process.env.ICICI_CLIENT_ID || '',
      clientSecret: process.env.ICICI_CLIENT_SECRET || '',
      apiKey: process.env.ICICI_API_KEY || '',
      accountNumber: process.env.ICICI_ACCOUNT_NUMBER || '',
      baseURL: process.env.ICICI_API_BASE_URL || 'https://api.icicibank.com/api/v1',
      webhookSecret: process.env.ICICI_WEBHOOK_SECRET || ''
    };
  }

  // OAuth2 Authentication
  private async authenticate(): Promise<string> {
    if (this.accessToken && Date.now() < this.tokenExpiry) {
      return this.accessToken;
    }

    try {
      const response = await axios.post(
        `${this.config.baseURL}/oauth/token`,
        {
          grant_type: 'client_credentials',
          client_id: this.config.clientId,
          client_secret: this.config.clientSecret,
          scope: 'payments accounts'
        },
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'X-API-KEY': this.config.apiKey
          }
        }
      );

      this.accessToken = response.data.access_token;
      this.tokenExpiry = Date.now() + (response.data.expires_in * 1000) - 60000; // Refresh 1 min early
      
      logger.info('ICICI authentication successful');
      return this.accessToken;
    } catch (error) {
      logger.error('ICICI authentication failed:', error);
      throw new Error('Failed to authenticate with ICICI Bank');
    }
  }

  // Check account balance
  async getBalance(): Promise<number> {
    try {
      const token = await this.authenticate();
      
      const response = await axios.get(
        `${this.config.baseURL}/accounts/${this.config.accountNumber}/balance`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'X-API-KEY': this.config.apiKey
          }
        }
      );

      const balance = response.data.availableBalance;
      logger.info(`ICICI account balance: ₹${balance}`);
      
      return balance;
    } catch (error) {
      logger.error('Failed to get balance:', error);
      throw error;
    }
  }

  // UPI Payment
  async makeUPIPayment(request: PaymentRequest): Promise<PaymentResponse> {
    try {
      const token = await this.authenticate();
      
      const payload = {
        debitAccountNumber: this.config.accountNumber,
        beneficiaryVPA: request.beneficiaryVPA,
        amount: request.amount,
        currency: 'INR',
        paymentRemarks: request.remarks,
        referenceNumber: this.generateReferenceNumber(),
        timestamp: new Date().toISOString()
      };

      logger.info(`Initiating UPI payment: ₹${request.amount} to ${request.beneficiaryVPA}`);

      const response = await axios.post(
        `${this.config.baseURL}/payments/upi/transfer`,
        payload,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'X-API-KEY': this.config.apiKey,
            'Content-Type': 'application/json',
            'X-Request-ID': crypto.randomUUID()
          }
        }
      );

      const result: PaymentResponse = {
        transactionId: response.data.transactionId,
        status: response.data.status,
        amount: response.data.amount,
        timestamp: new Date(response.data.timestamp),
        referenceNumber: response.data.referenceNumber
      };

      logger.info(`UPI payment initiated: ${result.transactionId}`);
      this.emit('paymentInitiated', result);

      return result;
    } catch (error) {
      logger.error('UPI payment failed:', error);
      this.emit('paymentFailed', { error, request });
      throw error;
    }
  }

  // IMPS Payment
  async makeIMPSPayment(request: PaymentRequest & { 
    beneficiaryAccount: string; 
    beneficiaryIFSC: string;
    beneficiaryName: string;
  }): Promise<PaymentResponse> {
    try {
      const token = await this.authenticate();
      
      const payload = {
        debitAccountNumber: this.config.accountNumber,
        beneficiaryAccountNumber: request.beneficiaryAccount,
        beneficiaryIFSC: request.beneficiaryIFSC,
        beneficiaryName: request.beneficiaryName,
        amount: request.amount,
        currency: 'INR',
        paymentRemarks: request.remarks,
        referenceNumber: this.generateReferenceNumber(),
        transferMode: 'IMPS'
      };

      const response = await axios.post(
        `${this.config.baseURL}/payments/imps/transfer`,
        payload,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'X-API-KEY': this.config.apiKey,
            'Content-Type': 'application/json'
          }
        }
      );

      const result: PaymentResponse = {
        transactionId: response.data.transactionId,
        status: response.data.status,
        amount: response.data.amount,
        timestamp: new Date(response.data.timestamp),
        referenceNumber: response.data.referenceNumber
      };

      logger.info(`IMPS payment initiated: ${result.transactionId}`);
      this.emit('paymentInitiated', result);

      return result;
    } catch (error) {
      logger.error('IMPS payment failed:', error);
      this.emit('paymentFailed', { error, request });
      throw error;
    }
  }

  // Get payment status
  async getPaymentStatus(transactionId: string): Promise<PaymentResponse> {
    try {
      const token = await this.authenticate();
      
      const response = await axios.get(
        `${this.config.baseURL}/payments/status/${transactionId}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'X-API-KEY': this.config.apiKey
          }
        }
      );

      return {
        transactionId: response.data.transactionId,
        status: response.data.status,
        amount: response.data.amount,
        timestamp: new Date(response.data.timestamp),
        referenceNumber: response.data.referenceNumber
      };
    } catch (error) {
      logger.error('Failed to get payment status:', error);
      throw error;
    }
  }

  // Webhook handler
  async handleWebhook(body: any, signature: string): Promise<void> {
    // Verify webhook signature
    const expectedSignature = crypto
      .createHmac('sha256', this.config.webhookSecret)
      .update(JSON.stringify(body))
      .digest('hex');

    if (signature !== expectedSignature) {
      throw new Error('Invalid webhook signature');
    }

    // Process webhook
    const { transactionId, status, amount } = body;
    
    logger.info(`Webhook received: Transaction ${transactionId} is ${status}`);
    
    if (status === 'SUCCESS') {
      this.emit('paymentSuccess', body);
    } else if (status === 'FAILED') {
      this.emit('paymentFailed', body);
    }
  }

  // Generate unique reference number
  private generateReferenceNumber(): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `ICICI${timestamp}${random}`.toUpperCase();
  }

  // Validate configuration
  isConfigured(): boolean {
    return !!(
      this.config.clientId &&
      this.config.clientSecret &&
      this.config.apiKey &&
      this.config.accountNumber
    );
  }

  // Get configuration status
  getConfigStatus(): Record<string, boolean> {
    return {
      clientId: !!this.config.clientId,
      clientSecret: !!this.config.clientSecret,
      apiKey: !!this.config.apiKey,
      accountNumber: !!this.config.accountNumber,
      baseURL: !!this.config.baseURL,
      webhookSecret: !!this.config.webhookSecret
    };
  }
}

// Export singleton instance
export const iciciPaymentService = new ICICIPaymentService();