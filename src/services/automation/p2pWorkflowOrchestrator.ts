import { EventEmitter } from 'events';
import { P2POrderManager, P2POrder } from '../p2p/orderManager';
import { PaymentVerifier } from '../payment/paymentVerifier';
import { GmailPaymentMonitor } from '../payment/gmailMonitor';
import { SmsPaymentMonitor } from '../payment/smsMonitor';
import { AutoReleaseSystem } from './autoReleaseSystem';
import { TradingModeManager, TradingMode } from './tradingModeManager';
import { logger } from '../../utils/logger';

interface WorkflowConfig {
  exchanges: Array<{
    name: string;
    apiKey: string;
    apiSecret: string;
    passphrase?: string;
  }>;
  payment: {
    gmail: {
      clientId: string;
      clientSecret: string;
      refreshToken: string;
      redirectUri: string;
    };
    sms: {
      accountSid: string;
      authToken: string;
      phoneNumber: string;
    };
  };
  automation: {
    enabled: boolean;
    minimumConfidence: number;
    maxAutoReleaseAmount: number;
    delayBeforeRelease: number;
  };
  trading: {
    maxOrderAmount: number;
    defaultPaymentMethod: string;
    autoCreateOrders: boolean;
    profitThreshold: number;
  };
}

interface OpportunityData {
  buyExchange: string;
  sellExchange: string;
  buyPrice: number;
  sellPrice: number;
  spread: number;
  profitPercent: number;
  amount: number;
}

export class P2PWorkflowOrchestrator extends EventEmitter {
  private orderManager: P2POrderManager;
  private paymentVerifier: PaymentVerifier;
  private gmailMonitor: GmailPaymentMonitor;
  private smsMonitor: SmsPaymentMonitor;
  private autoReleaseSystem: AutoReleaseSystem;
  private tradingModeManager: TradingModeManager;
  private config: WorkflowConfig;
  private isRunning: boolean = false;
  private activeWorkflows: Map<string, any> = new Map();

  constructor(config: WorkflowConfig) {
    super();
    this.config = config;
    this.initializeComponents();
  }

  private initializeComponents() {
    // Initialize order manager
    this.orderManager = new P2POrderManager();

    // Add exchange configurations
    for (const exchange of this.config.exchanges) {
      this.orderManager.addExchangeConfig(exchange);
    }

    // Initialize payment verifier
    this.paymentVerifier = new PaymentVerifier({
      minimumConfidence: this.config.automation.minimumConfidence,
      amountTolerance: 0.01,
      timeWindowMinutes: 30
    });

    // Initialize Gmail monitor
    this.gmailMonitor = new GmailPaymentMonitor();

    // Initialize SMS monitor
    this.smsMonitor = new SmsPaymentMonitor(this.config.payment.sms);

    // Initialize auto-release system
    this.autoReleaseSystem = new AutoReleaseSystem(
      this.orderManager,
      this.paymentVerifier,
      this.gmailMonitor,
      this.smsMonitor,
      this.config.automation
    );

    // Initialize trading mode manager
    this.tradingModeManager = new TradingModeManager();

    this.setupEventListeners();
  }

  private setupEventListeners() {
    // Order Manager Events
    this.orderManager.on('orderCreated', (order: P2POrder) => {
      logger.info(`📝 Order created: ${order.id} on ${order.exchange}`);
      this.emit('orderCreated', order);
    });

    this.orderManager.on('paymentReceived', (data: any) => {
      logger.info(`💰 Payment received for order: ${data.order.id}`);
      this.emit('paymentReceived', data);
    });

    this.orderManager.on('orderCompleted', (order: P2POrder) => {
      logger.info(`✅ Order completed: ${order.id}`);
      this.emit('orderCompleted', order);
      this.cleanupWorkflow(order.id);
    });

    this.orderManager.on('orderCancelled', (order: P2POrder) => {
      logger.info(`❌ Order cancelled: ${order.id}`);
      this.emit('orderCancelled', order);
      this.cleanupWorkflow(order.id);
    });

    // Auto Release Events
    this.autoReleaseSystem.on('releaseScheduled', (data: any) => {
      logger.info(`⏰ Auto-release scheduled for order: ${data.orderId}`);
      this.emit('autoReleaseScheduled', data);
    });

    this.autoReleaseSystem.on('releaseCompleted', (data: any) => {
      logger.info(`🚀 Auto-release completed for order: ${data.orderId}`);
      this.emit('autoReleaseCompleted', data);
    });

    this.autoReleaseSystem.on('releaseFailed', (data: any) => {
      logger.error(`💥 Auto-release failed for order: ${data.orderId}`);
      this.emit('autoReleaseFailed', data);
    });

    // Payment Monitor Events
    this.gmailMonitor.on('payment', (payment: any) => {
      logger.info(`📧 Gmail payment detected: ₹${payment.amount}`);
      this.emit('paymentDetected', { ...payment, source: 'gmail' });
    });

    this.smsMonitor.on('payment', (payment: any) => {
      logger.info(`📱 SMS payment detected: ₹${payment.amount}`);
      this.emit('paymentDetected', { ...payment, source: 'sms' });
    });

    // Payment Verifier Events
    this.paymentVerifier.on('paymentVerified', (verification: any) => {
      logger.info(`✓ Payment verified for order: ${verification.orderId} (confidence: ${verification.confidence})`);
      this.emit('paymentVerified', verification);
    });

    // Trading Mode Manager Events
    this.tradingModeManager.on('approvalRequested', (approval: any) => {
      logger.info(`🤔 Manual approval requested for ${approval.exchange}: ${approval.id}`);
      this.emit('manualApprovalRequested', approval);
    });

    this.tradingModeManager.on('tradeApproved', (data: any) => {
      logger.info(`✅ Trade approved: ${data.approval.id}`);
      this.executeApprovedTrade(data.approval);
    });

    this.tradingModeManager.on('tradeRejected', (data: any) => {
      logger.info(`❌ Trade rejected: ${data.approval.id} - ${data.reason}`);
      this.emit('tradeRejected', data);
    });

    this.tradingModeManager.on('approvalExpired', (approval: any) => {
      logger.warn(`⏰ Trade approval expired: ${approval.id}`);
      this.emit('approvalExpired', approval);
    });

    // Error handling
    this.setupErrorHandlers();
  }

  private setupErrorHandlers() {
    const components = [
      { name: 'OrderManager', component: this.orderManager },
      { name: 'PaymentVerifier', component: this.paymentVerifier },
      { name: 'GmailMonitor', component: this.gmailMonitor },
      { name: 'SmsMonitor', component: this.smsMonitor },
      { name: 'AutoReleaseSystem', component: this.autoReleaseSystem }
    ];

    components.forEach(({ name, component }) => {
      component.on('error', (error: any) => {
        logger.error(`${name} error:`, error);
        this.emit('componentError', { component: name, error });
      });
    });
  }

  async start() {
    if (this.isRunning) {
      logger.warn('P2P workflow orchestrator is already running');
      return;
    }

    try {
      logger.info('🚀 Starting P2P Workflow Orchestrator...');

      // Initialize Gmail monitor (skip if credentials not provided)
      if (this.config.payment.gmail.clientId && this.config.payment.gmail.clientId !== 'your_gmail_client_id') {
        try {
          await this.gmailMonitor.initialize();
          await this.gmailMonitor.startMonitoring(5000); // Check every 5 seconds
          logger.info('✅ Gmail payment monitor started');
        } catch (error) {
          logger.warn('⚠️ Gmail monitor failed to start (credentials not configured):', error.message);
        }
      } else {
        logger.warn('⚠️ Gmail monitoring skipped - credentials not configured');
      }

      // Initialize SMS monitor (skip if credentials not provided)
      if (this.config.payment.sms.accountSid && this.config.payment.sms.accountSid !== 'your_twilio_account_sid') {
        try {
          await this.smsMonitor.initialize();
          await this.smsMonitor.startMonitoring(10000); // Check every 10 seconds
          logger.info('✅ SMS payment monitor started');
        } catch (error) {
          logger.warn('⚠️ SMS monitor failed to start (credentials not configured):', error.message);
        }
      } else {
        logger.warn('⚠️ SMS monitoring skipped - credentials not configured');
      }

      // Start order monitoring
      this.orderManager.startMonitoring(30000); // Check every 30 seconds

      // Start auto-release system
      await this.autoReleaseSystem.start();

      this.isRunning = true;
      logger.info('✅ P2P Workflow Orchestrator started successfully');
      this.emit('started');

    } catch (error) {
      logger.error('💥 Failed to start P2P Workflow Orchestrator:', error);
      this.emit('startError', error);
      throw error;
    }
  }

  async stop() {
    if (!this.isRunning) return;

    try {
      logger.info('⏹ Stopping P2P Workflow Orchestrator...');

      // Stop all monitors
      try {
        await this.gmailMonitor.stopMonitoring();
      } catch (error) {
        logger.warn('Gmail monitor stop error:', error.message);
      }
      
      try {
        await this.smsMonitor.stopMonitoring();
      } catch (error) {
        logger.warn('SMS monitor stop error:', error.message);
      }
      
      this.orderManager.stopMonitoring();
      await this.autoReleaseSystem.stop();

      // Clean up active workflows
      this.activeWorkflows.clear();

      this.isRunning = false;
      logger.info('✅ P2P Workflow Orchestrator stopped');
      this.emit('stopped');

    } catch (error) {
      logger.error('💥 Error stopping P2P Workflow Orchestrator:', error);
      this.emit('stopError', error);
    }
  }

  async createArbitrageOrder(opportunity: OpportunityData): Promise<P2POrder | null> {
    if (!this.isRunning) {
      throw new Error('Workflow orchestrator is not running');
    }

    // Check trading mode for this exchange
    const tradingDecision = await this.tradingModeManager.shouldExecuteTrade(
      opportunity.sellExchange, 
      opportunity
    );

    if (!tradingDecision.execute) {
      logger.info(`🚫 Trade blocked for ${opportunity.sellExchange}: ${tradingDecision.reason}`);
      
      if (tradingDecision.approvalId) {
        this.emit('approvalRequested', {
          approvalId: tradingDecision.approvalId,
          exchange: opportunity.sellExchange,
          opportunity
        });
      }
      
      return null;
    }

    const workflowId = `workflow_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      logger.info(`🎯 Creating arbitrage order for opportunity:`, {
        buy: `${opportunity.buyExchange} @ ₹${opportunity.buyPrice}`,
        sell: `${opportunity.sellExchange} @ ₹${opportunity.sellPrice}`,
        profit: `${opportunity.profitPercent.toFixed(2)}%`
      });

      return await this.executeTradeOrder(opportunity, workflowId);

    } catch (error) {
      logger.error(`💥 Failed to create arbitrage order:`, error);
      this.emit('arbitrageOrderError', { opportunity, error: error.message, workflowId });
      throw error;
    }
  }

  private async executeTradeOrder(opportunity: OpportunityData, workflowId: string): Promise<P2POrder> {
    // Get exchange config to determine automation level
    const exchangeConfig = this.tradingModeManager.getExchangeConfig(opportunity.sellExchange);
    
    // Create P2P sell order
    const order = await this.orderManager.createSellOrder({
      exchange: opportunity.sellExchange,
      amount: opportunity.amount,
      price: opportunity.sellPrice,
      paymentMethod: this.config.trading.defaultPaymentMethod,
      paymentDetails: {
        // Payment details from config or user setup
        upiId: process.env.UPI_ID,
        accountNumber: process.env.BANK_ACCOUNT,
        bankName: process.env.BANK_NAME,
        ifscCode: process.env.IFSC_CODE,
        accountHolderName: process.env.ACCOUNT_HOLDER_NAME
      },
      autoRelease: exchangeConfig?.autoReleaseEnabled || this.config.automation.enabled
    });

    // Track the workflow
    this.activeWorkflows.set(workflowId, {
      orderId: order.id,
      opportunity,
      createdAt: new Date(),
      status: 'pending'
    });

    logger.info(`📝 Arbitrage order created: ${order.id}`);
    this.emit('arbitrageOrderCreated', { order, opportunity, workflowId });

    return order;
  }

  private async executeApprovedTrade(approval: any): Promise<void> {
    try {
      logger.info(`🚀 Executing approved trade: ${approval.id}`);
      const order = await this.executeTradeOrder(approval.opportunity, `approved_${approval.id}`);
      logger.info(`✅ Approved trade executed: ${order.id}`);
      this.emit('approvedTradeExecuted', { approval, order });
    } catch (error) {
      logger.error(`💥 Failed to execute approved trade:`, error);
      this.emit('approvedTradeError', { approval, error: error.message });
    }
  }

  async executeFullArbitrageWorkflow(opportunity: OpportunityData): Promise<string> {
    const workflowId = `full_workflow_${Date.now()}`;
    
    try {
      logger.info(`🔄 Starting full arbitrage workflow: ${workflowId}`);

      // Step 1: Create P2P sell order
      const sellOrder = await this.createArbitrageOrder(opportunity);

      // Step 2: Set up payment monitoring
      await this.paymentVerifier.addOrderForVerification(sellOrder);

      // Track the complete workflow
      this.activeWorkflows.set(workflowId, {
        sellOrderId: sellOrder.id,
        opportunity,
        createdAt: new Date(),
        status: 'waiting_payment',
        steps: {
          sellOrderCreated: true,
          paymentMonitoringSetup: true,
          buyOrderCreated: false,
          arbitrageCompleted: false
        }
      });

      logger.info(`✅ Full arbitrage workflow started: ${workflowId}`);
      this.emit('fullWorkflowStarted', { workflowId, sellOrder, opportunity });

      return workflowId;

    } catch (error) {
      logger.error(`💥 Full arbitrage workflow failed:`, error);
      this.emit('fullWorkflowError', { workflowId, opportunity, error: error.message });
      throw error;
    }
  }

  private cleanupWorkflow(orderId: string) {
    // Find and remove workflows associated with this order
    for (const [workflowId, workflow] of this.activeWorkflows) {
      if (workflow.orderId === orderId || workflow.sellOrderId === orderId) {
        this.activeWorkflows.delete(workflowId);
        logger.info(`🧹 Cleaned up workflow: ${workflowId}`);
      }
    }
  }

  // Manual control methods
  async manuallyCompleteOrder(orderId: string, reason: string = 'Manual completion'): Promise<boolean> {
    try {
      return await this.autoReleaseSystem.manualRelease(orderId, reason);
    } catch (error) {
      logger.error(`Manual order completion failed:`, error);
      return false;
    }
  }

  async cancelOrder(orderId: string): Promise<boolean> {
    try {
      return await this.orderManager.cancelOrder(orderId);
    } catch (error) {
      logger.error(`Order cancellation failed:`, error);
      return false;
    }
  }

  async pauseAutomation() {
    if (this.autoReleaseSystem) {
      await this.autoReleaseSystem.stop();
      logger.info('⏸ Automation paused');
      this.emit('automationPaused');
    }
  }

  async resumeAutomation() {
    if (this.autoReleaseSystem) {
      await this.autoReleaseSystem.start();
      logger.info('▶️ Automation resumed');
      this.emit('automationResumed');
    }
  }

  // Status and monitoring methods
  getSystemStatus() {
    return {
      orchestrator: {
        running: this.isRunning,
        activeWorkflows: this.activeWorkflows.size
      },
      orderManager: {
        activeOrders: this.orderManager.getActiveOrders().length,
        totalOrders: this.orderManager.getAllOrders().length
      },
      autoRelease: this.autoReleaseSystem.getSystemStatus(),
      paymentVerifier: {
        pendingVerifications: this.paymentVerifier.getPendingVerifications().length
      }
    };
  }

  getOrder(orderId: string): P2POrder | undefined {
    return this.orderManager.getOrder(orderId);
  }

  getActiveOrders(): P2POrder[] {
    return this.orderManager.getActiveOrders();
  }

  getAllOrders(): P2POrder[] {
    return this.orderManager.getAllOrders();
  }

  getActiveWorkflows() {
    return Array.from(this.activeWorkflows.entries()).map(([id, workflow]) => ({
      id,
      ...workflow
    }));
  }

  getOrderHistory() {
    return this.orderManager.getAllOrders().map(order => ({
      id: order.id,
      exchange: order.exchange,
      amount: order.amount,
      status: order.status,
      createdAt: order.createdAt,
      completedAt: order.status === 'completed' ? order.updatedAt : null
    }));
  }

  async getPaymentHistory() {
    return await this.paymentVerifier.getVerificationHistory();
  }

  // Configuration methods
  updateConfig(newConfig: Partial<WorkflowConfig>) {
    this.config = { ...this.config, ...newConfig };
    
    // Update component configs
    if (newConfig.automation) {
      this.autoReleaseSystem.updateConfig(newConfig.automation);
    }
    
    logger.info('📝 Workflow configuration updated');
    this.emit('configUpdated', this.config);
  }

  getConfig() {
    return { ...this.config };
  }

  // Trading Mode Management Methods
  getTradingModeManager(): TradingModeManager {
    return this.tradingModeManager;
  }

  async approveTradeManually(approvalId: string, approved: boolean, reason?: string): Promise<boolean> {
    return await this.tradingModeManager.approveTradeManually(approvalId, approved, reason);
  }

  getPendingApprovals() {
    return this.tradingModeManager.getPendingApprovals();
  }

  enableFullAutomationForExchange(exchange: string) {
    this.tradingModeManager.enableFullAutomationForExchange(exchange);
    logger.info(`🤖 Full automation enabled for ${exchange}`);
  }

  enableSemiAssistedForExchange(exchange: string) {
    this.tradingModeManager.enableSemiAssistedForExchange(exchange);
    logger.info(`🤝 Semi-assisted mode enabled for ${exchange}`);
  }

  pauseAllAutomation() {
    this.tradingModeManager.pauseAllAutomation();
    this.emit('automationPaused');
  }

  resumeAutomation() {
    this.tradingModeManager.resumeAutomation();
    this.emit('automationResumed');
  }

  getTradingModeSummary() {
    return this.tradingModeManager.getSystemSummary();
  }

  // Testing and debugging methods
  async testPaymentDetection(testPayment: any) {
    logger.info('🧪 Testing payment detection with:', testPayment);
    
    try {
      const verifications = await this.paymentVerifier.verifyPayment(testPayment);
      logger.info('🧪 Test payment verification results:', verifications);
      return verifications;
    } catch (error) {
      logger.error('🧪 Test payment detection failed:', error);
      throw error;
    }
  }

  async simulatePayment(orderId: string, amount: number) {
    logger.info(`🎭 Simulating payment for order ${orderId}: ₹${amount}`);
    
    const mockPayment = {
      amount,
      sender: 'Test Sender',
      accountNumber: '****1234',
      timestamp: new Date(),
      bank: 'TEST_BANK',
      transactionId: `sim_${Date.now()}`,
      rawMessage: `Mock payment of ₹${amount} for testing`
    };

    return await this.testPaymentDetection(mockPayment);
  }
}

export type { WorkflowConfig, OpportunityData };