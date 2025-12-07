import { EventEmitter } from 'events';
import Imap from 'imap';
import { simpleParser } from 'mailparser';
import { logger } from '../../utils/logger';
import { config } from 'dotenv';

config();

interface PaymentNotification {
  amount: number;
  from: string;
  reference: string;
  timestamp: Date;
  rawBody: string;
}

export class IMAPPaymentMonitor extends EventEmitter {
  private imap: Imap;
  private isConnected: boolean = false;
  private processedUIDs: Set<number> = new Set();
  private checkInterval: NodeJS.Timer | null = null;

  constructor() {
    super();
    
    if (!process.env.GMAIL_EMAIL || !process.env.GMAIL_APP_PASSWORD) {
      throw new Error('GMAIL_EMAIL and GMAIL_APP_PASSWORD must be set in .env file');
    }

    this.imap = new Imap({
      user: process.env.GMAIL_EMAIL,
      password: process.env.GMAIL_APP_PASSWORD,
      host: 'imap.gmail.com',
      port: 993,
      tls: true,
      tlsOptions: { rejectUnauthorized: false },
      keepalive: true
    });

    this.setupEventHandlers();
  }

  private setupEventHandlers() {
    this.imap.on('ready', () => {
      logger.info('✅ IMAP Payment Monitor connected to Gmail');
      this.isConnected = true;
      this.openInbox();
    });

    this.imap.on('error', (err) => {
      logger.error('❌ IMAP error:', err);
      this.emit('error', err);
    });

    this.imap.on('end', () => {
      logger.info('📧 IMAP connection ended');
      this.isConnected = false;
    });
  }

  async start() {
    logger.info('🚀 Starting IMAP payment monitor...');
    this.imap.connect();
    
    // Check for new emails every 30 seconds
    this.checkInterval = setInterval(() => {
      if (this.isConnected) {
        this.checkNewPayments();
      }
    }, 30000);
  }

  stop() {
    logger.info('🛑 Stopping IMAP payment monitor...');
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    this.imap.end();
  }

  private openInbox() {
    this.imap.openBox('INBOX', false, (err, box) => {
      if (err) {
        logger.error('Error opening inbox:', err);
        return;
      }
      logger.info(`📧 Monitoring inbox for UPI payments (${box.messages.total} total messages)`);
      this.checkNewPayments();
    });
  }

  private async checkNewPayments() {
    try {
      // Search for recent Axis Bank emails (last 24 hours)
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      
      this.imap.search([
        ['FROM', 'axisbank'],
        ['SINCE', yesterday]
      ], (err, results) => {
        if (err) {
          logger.error('Search error:', err);
          return;
        }

        if (!results || results.length === 0) {
          return;
        }

        // Check only unprocessed messages
        const newMessages = results.filter(uid => !this.processedUIDs.has(uid));
        
        if (newMessages.length > 0) {
          logger.info(`📬 Found ${newMessages.length} new bank emails to check`);
          this.processMessages(newMessages);
        }
      });
    } catch (error) {
      logger.error('Error checking payments:', error);
    }
  }

  private processMessages(uids: number[]) {
    const fetch = this.imap.fetch(uids, { bodies: '' });

    fetch.on('message', (msg, seqno) => {
      msg.on('body', (stream) => {
        simpleParser(stream, async (err, parsed) => {
          if (err) return;

          const body = parsed.text || '';
          const subject = parsed.subject || '';
          
          // Check if it's a credit notification
          if (subject.toLowerCase().includes('credit') || 
              body.includes('credited to your A/c') ||
              body.includes('received payment')) {
            
            const payment = this.extractPaymentDetails(body, subject, parsed.date);
            
            if (payment && payment.amount > 0) {
              logger.info(`💰 UPI Payment detected: ₹${payment.amount} from ${payment.from}`);
              this.emit('paymentReceived', payment);
              
              // Mark this message as processed
              const uid = parsed.uid || seqno;
              this.processedUIDs.add(uid);
            }
          }
        });
      });
    });

    fetch.once('error', (err) => {
      logger.error('Fetch error:', err);
    });
  }

  private extractPaymentDetails(body: string, subject: string, date?: Date): PaymentNotification | null {
    try {
      // Extract amount
      const amountMatch = body.match(/(?:Rs\.?|INR|₹)\s*([\d,]+(?:\.\d{2})?)\s*(?:was\s+)?credited/i) ||
                         body.match(/credited.*?(?:Rs\.?|INR|₹)\s*([\d,]+(?:\.\d{2})?)/i);
      
      if (!amountMatch) return null;

      const amount = parseFloat(amountMatch[1].replace(/,/g, ''));
      
      // Extract UPI ID or sender
      const upiMatch = body.match(/UPI.*?(?:from|by|ID:?)\s*([^\s,]+)/i) ||
                       body.match(/From\s+([^\s]+@[\w]+)/i) ||
                       body.match(/Sender:\s*([^\n]+)/i);
      
      const from = upiMatch ? upiMatch[1].trim() : 'Unknown';
      
      // Extract reference
      const refMatch = body.match(/(?:Reference|Ref|Transaction ID|UTR|Txn ID)[:\s]*([\w\d]+)/i);
      const reference = refMatch ? refMatch[1] : `REF${Date.now()}`;

      return {
        amount,
        from,
        reference,
        timestamp: date || new Date(),
        rawBody: body.substring(0, 200)
      };
    } catch (error) {
      logger.error('Error extracting payment details:', error);
      return null;
    }
  }

  async verifyPaymentForOrder(orderId: string, expectedAmount: number): Promise<boolean> {
    // Check recent payments for matching amount
    const recentPayments = await this.getRecentPayments();
    
    for (const payment of recentPayments) {
      // Allow small variance (±1%) for bank charges
      const variance = expectedAmount * 0.01;
      if (Math.abs(payment.amount - expectedAmount) <= variance) {
        logger.info(`✅ Payment matched for order ${orderId}: ₹${payment.amount}`);
        return true;
      }
    }
    
    return false;
  }

  private async getRecentPayments(): Promise<PaymentNotification[]> {
    // This would return cached recent payments
    // For now, return empty array
    return [];
  }
}

// Export singleton instance
export const imapPaymentMonitor = new IMAPPaymentMonitor();