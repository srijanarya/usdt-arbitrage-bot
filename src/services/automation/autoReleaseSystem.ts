import { EventEmitter } from 'events';
import { P2POrderManager, P2POrder } from '../p2p/orderManager';
import { PaymentVerifier, VerificationResult } from '../payment/paymentVerifier';
import { GmailPaymentMonitor } from '../payment/gmailMonitor';
import { SmsPaymentMonitor } from '../payment/smsMonitor';
import { PaymentDetails } from '../payment/parsers/bankParsers';
import { logger } from '../../utils/logger';

interface AutoReleaseConfig {
  enabled: boolean;
  minimumConfidence: number;
  maxAutoReleaseAmount: number;
  requireMultipleConfirmations: boolean;
  delayBeforeRelease: number; // seconds
  enableManualOverride: boolean;
  blacklistedSenders: string[];
  whitelistedSenders: string[];
}

interface PendingRelease {
  orderId: string;
  verification: VerificationResult;
  scheduledAt: Date;
  timeout: NodeJS.Timeout;
}

export class AutoReleaseSystem extends EventEmitter {
  private orderManager: P2POrderManager;
  private paymentVerifier: PaymentVerifier;
  private gmailMonitor: GmailPaymentMonitor;
  private smsMonitor: SmsPaymentMonitor;
  private config: AutoReleaseConfig;
  private pendingReleases: Map<string, PendingRelease> = new Map();
  private isRunning: boolean = false;

  constructor(
    orderManager: P2POrderManager,
    paymentVerifier: PaymentVerifier,
    gmailMonitor: GmailPaymentMonitor,
    smsMonitor: SmsPaymentMonitor,
    config: Partial<AutoReleaseConfig> = {}
  ) {
    super();
    
    this.orderManager = orderManager;
    this.paymentVerifier = paymentVerifier;
    this.gmailMonitor = gmailMonitor;
    this.smsMonitor = smsMonitor;
    
    this.config = {
      enabled: true,
      minimumConfidence: 0.9,
      maxAutoReleaseAmount: 50000, // ₹50k
      requireMultipleConfirmations: true,
      delayBeforeRelease: 30, // 30 seconds
      enableManualOverride: true,
      blacklistedSenders: [],
      whitelistedSenders: [],
      ...config
    };

    this.setupEventListeners();
  }

  private setupEventListeners() {
    // Listen for payment verifications
    this.paymentVerifier.on('paymentVerified', (verification: VerificationResult) => {
      this.handleVerifiedPayment(verification);
    });

    // Listen for Gmail payments
    this.gmailMonitor.on('payment', (payment: PaymentDetails) => {
      this.handleIncomingPayment(payment, 'gmail');
    });

    // Listen for SMS payments
    this.smsMonitor.on('payment', (payment: PaymentDetails) => {
      this.handleIncomingPayment(payment, 'sms');
    });

    // Listen for order status changes
    this.orderManager.on('orderCreated', (order: P2POrder) => {
      if (order.autoReleaseEnabled) {
        this.paymentVerifier.addOrderForVerification(order);
      }
    });

    // Listen for manual order completions
    this.orderManager.on('orderCompleted', (order: P2POrder) => {
      this.cancelPendingRelease(order.id);
    });

    // Listen for order cancellations
    this.orderManager.on('orderCancelled', (order: P2POrder) => {
      this.cancelPendingRelease(order.id);
    });
  }

  async start() {
    if (this.isRunning) {
      logger.warn('Auto-release system is already running');
      return;
    }

    if (!this.config.enabled) {
      logger.info('Auto-release system is disabled');
      return;
    }

    this.isRunning = true;
    logger.info('Auto-release system started', this.config);
    this.emit('systemStarted');
  }

  async stop() {
    if (!this.isRunning) return;

    this.isRunning = false;
    
    // Cancel all pending releases
    for (const [orderId, pending] of this.pendingReleases) {
      clearTimeout(pending.timeout);
      this.emit('releaseCancel', { orderId, reason: 'System stopped' });
    }
    this.pendingReleases.clear();

    logger.info('Auto-release system stopped');
    this.emit('systemStopped');
  }

  private async handleIncomingPayment(payment: PaymentDetails, source: string) {
    if (!this.isRunning || !this.config.enabled) return;

    logger.info(`Processing ${source} payment:`, {
      amount: payment.amount,
      sender: payment.sender,
      bank: payment.bank
    });

    // Check blacklist
    if (this.isBlacklisted(payment.sender)) {
      logger.warn(`Payment from blacklisted sender: ${payment.sender}`);
      this.emit('paymentBlacklisted', { payment, source });
      return;
    }

    try {
      // Verify payment against pending orders
      const verifications = await this.paymentVerifier.verifyPayment(payment);
      
      for (const verification of verifications) {
        if (verification.verified) {
          await this.handleVerifiedPayment(verification);
        }
      }
    } catch (error) {
      logger.error('Error processing payment:', error);
      this.emit('error', { error, payment, source });
    }
  }

  private async handleVerifiedPayment(verification: VerificationResult) {
    if (!this.isRunning || !this.config.enabled) return;

    const { orderId, confidence, payment } = verification;
    const order = this.orderManager.getOrder(orderId);

    if (!order) {
      logger.error(`Order not found for verification: ${orderId}`);
      return;
    }

    // Check if auto-release is enabled for this order
    if (!order.autoReleaseEnabled) {
      logger.info(`Auto-release disabled for order ${orderId}`);
      this.emit('autoReleaseSkipped', { orderId, reason: 'Auto-release disabled' });
      return;
    }

    // Check confidence threshold
    if (confidence < this.config.minimumConfidence) {
      logger.info(`Confidence too low for auto-release: ${confidence} < ${this.config.minimumConfidence}`);
      this.emit('autoReleaseSkipped', { orderId, reason: 'Low confidence', confidence });
      return;
    }

    // Check amount limit
    if (payment.amount > this.config.maxAutoReleaseAmount) {
      logger.info(`Amount too high for auto-release: ₹${payment.amount} > ₹${this.config.maxAutoReleaseAmount}`);
      this.emit('autoReleaseSkipped', { orderId, reason: 'Amount too high', amount: payment.amount });
      return;
    }

    // Check if multiple confirmations are required
    if (this.config.requireMultipleConfirmations) {
      const confirmations = await this.getPaymentConfirmations(order, payment);
      if (confirmations.length < 2) {
        logger.info(`Insufficient confirmations for auto-release: ${confirmations.length} < 2`);
        this.emit('autoReleaseSkipped', { orderId, reason: 'Insufficient confirmations', confirmations: confirmations.length });
        return;
      }
    }

    // Mark payment as received in order manager
    await this.orderManager.markPaymentReceived(orderId, payment.amount, confidence);

    // Schedule auto-release
    await this.scheduleAutoRelease(verification);
  }

  private async scheduleAutoRelease(verification: VerificationResult) {
    const { orderId } = verification;

    // Cancel any existing pending release for this order
    this.cancelPendingRelease(orderId);

    const scheduledAt = new Date(Date.now() + this.config.delayBeforeRelease * 1000);
    
    const timeout = setTimeout(async () => {
      await this.executeAutoRelease(orderId);
    }, this.config.delayBeforeRelease * 1000);

    const pendingRelease: PendingRelease = {
      orderId,
      verification,
      scheduledAt,
      timeout
    };

    this.pendingReleases.set(orderId, pendingRelease);

    logger.info(`Auto-release scheduled for order ${orderId} at ${scheduledAt.toISOString()}`);
    this.emit('releaseScheduled', {
      orderId,
      scheduledAt,
      delay: this.config.delayBeforeRelease,
      verification
    });
  }

  private async executeAutoRelease(orderId: string) {
    const pending = this.pendingReleases.get(orderId);
    if (!pending) {
      logger.warn(`No pending release found for order ${orderId}`);
      return;
    }

    try {
      logger.info(`Executing auto-release for order ${orderId}`);
      
      // Double-check order status before release
      const order = this.orderManager.getOrder(orderId);
      if (!order || order.status !== 'paid') {
        throw new Error(`Order ${orderId} not in paid status: ${order?.status}`);
      }

      // Execute the release
      const success = await this.orderManager.releaseOrder(orderId);
      
      if (success) {
        logger.info(`Auto-release completed successfully for order ${orderId}`);
        this.emit('releaseCompleted', {
          orderId,
          verification: pending.verification,
          executedAt: new Date()
        });
      } else {
        throw new Error('Release failed');
      }

    } catch (error) {
      logger.error(`Auto-release failed for order ${orderId}:`, error);
      this.emit('releaseFailed', {
        orderId,
        error: error.message,
        verification: pending.verification
      });
    } finally {
      this.pendingReleases.delete(orderId);
    }
  }

  private cancelPendingRelease(orderId: string) {
    const pending = this.pendingReleases.get(orderId);
    if (pending) {
      clearTimeout(pending.timeout);
      this.pendingReleases.delete(orderId);
      logger.info(`Cancelled pending auto-release for order ${orderId}`);
      this.emit('releaseCancel', { orderId });
    }
  }

  private async getPaymentConfirmations(order: P2POrder, payment: PaymentDetails): Promise<PaymentDetails[]> {
    const confirmations: PaymentDetails[] = [payment];

    try {
      // Search for similar payments in Gmail
      const gmailPayments = await this.gmailMonitor.searchPaymentsByAmount(payment.amount, 0.01);
      confirmations.push(...gmailPayments.filter(p => 
        Math.abs(p.timestamp.getTime() - payment.timestamp.getTime()) < 5 * 60 * 1000 // within 5 minutes
      ));

      // Search for similar payments in SMS
      const smsPayments = await this.smsMonitor.searchPaymentsByAmount(payment.amount, 0.01);
      confirmations.push(...smsPayments.filter(p => 
        Math.abs(p.timestamp.getTime() - payment.timestamp.getTime()) < 5 * 60 * 1000 // within 5 minutes
      ));

    } catch (error) {
      logger.warn('Error searching for payment confirmations:', error);
    }

    // Remove duplicates based on amount and timestamp
    const uniqueConfirmations = confirmations.filter((payment, index, self) =>
      index === self.findIndex(p => 
        Math.abs(p.amount - payment.amount) < 0.01 && 
        Math.abs(p.timestamp.getTime() - payment.timestamp.getTime()) < 1000
      )
    );

    return uniqueConfirmations;
  }

  private isBlacklisted(sender: string): boolean {
    return this.config.blacklistedSenders.some(blocked => 
      sender.toLowerCase().includes(blocked.toLowerCase())
    );
  }

  // Manual override methods
  async manualRelease(orderId: string, reason: string = 'Manual override'): Promise<boolean> {
    if (!this.config.enableManualOverride) {
      throw new Error('Manual override is disabled');
    }

    try {
      const success = await this.orderManager.releaseOrder(orderId);
      if (success) {
        this.cancelPendingRelease(orderId);
        logger.info(`Manual release completed for order ${orderId}: ${reason}`);
        this.emit('manualReleaseCompleted', { orderId, reason });
      }
      return success;
    } catch (error) {
      logger.error(`Manual release failed for order ${orderId}:`, error);
      this.emit('manualReleaseFailed', { orderId, error: error.message, reason });
      return false;
    }
  }

  async cancelAutoRelease(orderId: string, reason: string = 'Manual cancellation'): Promise<boolean> {
    const pending = this.pendingReleases.get(orderId);
    if (!pending) {
      return false;
    }

    this.cancelPendingRelease(orderId);
    logger.info(`Auto-release cancelled for order ${orderId}: ${reason}`);
    this.emit('autoReleaseCancelled', { orderId, reason });
    return true;
  }

  // Status and monitoring methods
  getPendingReleases(): Array<{orderId: string, scheduledAt: Date, verification: VerificationResult}> {
    return Array.from(this.pendingReleases.values()).map(pending => ({
      orderId: pending.orderId,
      scheduledAt: pending.scheduledAt,
      verification: pending.verification
    }));
  }

  getConfig(): AutoReleaseConfig {
    return { ...this.config };
  }

  updateConfig(newConfig: Partial<AutoReleaseConfig>) {
    this.config = { ...this.config, ...newConfig };
    logger.info('Auto-release config updated:', this.config);
    this.emit('configUpdated', this.config);
  }

  getSystemStatus() {
    return {
      running: this.isRunning,
      enabled: this.config.enabled,
      pendingReleases: this.pendingReleases.size,
      config: this.config
    };
  }
}

export type { AutoReleaseConfig, PendingRelease };