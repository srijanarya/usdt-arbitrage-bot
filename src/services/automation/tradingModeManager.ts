import { EventEmitter } from 'events';
import { logger } from '../../utils/logger';

export enum TradingMode {
  FULLY_AUTOMATED = 'fully_automated',
  SEMI_ASSISTED = 'semi_assisted', 
  MANUAL_ONLY = 'manual_only',
  DISABLED = 'disabled'
}

export interface ExchangeTradingConfig {
  exchange: string;
  mode: TradingMode;
  maxOrderAmount: number;
  autoReleaseEnabled: boolean;
  requireManualApproval: boolean;
  minProfitThreshold: number;
  enabled: boolean;
}

export interface PendingApproval {
  id: string;
  exchange: string;
  opportunity: any;
  estimatedProfit: number;
  riskScore: number;
  createdAt: Date;
  expiresAt: Date;
}

export class TradingModeManager extends EventEmitter {
  private exchangeConfigs: Map<string, ExchangeTradingConfig> = new Map();
  private pendingApprovals: Map<string, PendingApproval> = new Map();
  private approvalTimeout: number = 5 * 60 * 1000; // 5 minutes

  constructor() {
    super();
    this.initializeDefaultConfigs();
  }

  private initializeDefaultConfigs() {
    // Binance - Fully automated (working)
    this.setExchangeConfig('binance', {
      exchange: 'binance',
      mode: TradingMode.FULLY_AUTOMATED,
      maxOrderAmount: 1000,
      autoReleaseEnabled: true,
      requireManualApproval: false,
      minProfitThreshold: 0.5, // 0.5% minimum
      enabled: true
    });

    // ZebPay - Semi-assisted (cheapest but needs implementation)
    this.setExchangeConfig('zebpay', {
      exchange: 'zebpay',
      mode: TradingMode.SEMI_ASSISTED,
      maxOrderAmount: 500,
      autoReleaseEnabled: false,
      requireManualApproval: true,
      minProfitThreshold: 1.0, // Higher threshold for manual approval
      enabled: true
    });

    // KuCoin - Semi-assisted 
    this.setExchangeConfig('kucoin', {
      exchange: 'kucoin',
      mode: TradingMode.SEMI_ASSISTED,
      maxOrderAmount: 500,
      autoReleaseEnabled: false,
      requireManualApproval: true,
      minProfitThreshold: 1.0,
      enabled: true
    });

    // CoinSwitch - Semi-assisted
    this.setExchangeConfig('coinswitch', {
      exchange: 'coinswitch',
      mode: TradingMode.SEMI_ASSISTED,
      maxOrderAmount: 500,
      autoReleaseEnabled: false,
      requireManualApproval: true,
      minProfitThreshold: 1.0,
      enabled: true
    });

    logger.info('🎛️ Trading mode configurations initialized');
  }

  setExchangeConfig(exchange: string, config: ExchangeTradingConfig) {
    this.exchangeConfigs.set(exchange.toLowerCase(), config);
    logger.info(`📝 Updated trading config for ${exchange}: ${config.mode}`);
    this.emit('configUpdated', { exchange, config });
  }

  getExchangeConfig(exchange: string): ExchangeTradingConfig | undefined {
    return this.exchangeConfigs.get(exchange.toLowerCase());
  }

  async shouldExecuteTrade(exchange: string, opportunity: any): Promise<{ 
    execute: boolean; 
    reason: string; 
    approvalId?: string 
  }> {
    const config = this.getExchangeConfig(exchange);
    
    if (!config || !config.enabled) {
      return { execute: false, reason: `Trading disabled for ${exchange}` };
    }

    // Check profit threshold
    if (opportunity.profitPercent < config.minProfitThreshold) {
      return { 
        execute: false, 
        reason: `Profit ${opportunity.profitPercent}% below threshold ${config.minProfitThreshold}%` 
      };
    }

    // Check amount limits
    if (opportunity.amount > config.maxOrderAmount) {
      return { 
        execute: false, 
        reason: `Amount ${opportunity.amount} exceeds limit ${config.maxOrderAmount}` 
      };
    }

    switch (config.mode) {
      case TradingMode.FULLY_AUTOMATED:
        logger.info(`🤖 Auto-executing trade on ${exchange} (${opportunity.profitPercent}% profit)`);
        return { execute: true, reason: 'Fully automated execution' };

      case TradingMode.SEMI_ASSISTED:
        const approvalId = await this.requestManualApproval(exchange, opportunity);
        logger.info(`🤔 Manual approval requested for ${exchange} trade (ID: ${approvalId})`);
        return { 
          execute: false, 
          reason: 'Manual approval required', 
          approvalId 
        };

      case TradingMode.MANUAL_ONLY:
        return { execute: false, reason: 'Manual-only mode - use dashboard to execute' };

      case TradingMode.DISABLED:
        return { execute: false, reason: 'Trading disabled for this exchange' };

      default:
        return { execute: false, reason: 'Unknown trading mode' };
    }
  }

  private async requestManualApproval(exchange: string, opportunity: any): Promise<string> {
    const approvalId = `approval_${exchange}_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    
    const approval: PendingApproval = {
      id: approvalId,
      exchange,
      opportunity,
      estimatedProfit: opportunity.amount * opportunity.spread,
      riskScore: this.calculateRiskScore(exchange, opportunity),
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + this.approvalTimeout)
    };

    this.pendingApprovals.set(approvalId, approval);

    // Auto-expire approval
    setTimeout(() => {
      if (this.pendingApprovals.has(approvalId)) {
        this.pendingApprovals.delete(approvalId);
        logger.info(`⏰ Approval ${approvalId} expired`);
        this.emit('approvalExpired', approval);
      }
    }, this.approvalTimeout);

    // Emit approval request for dashboard/notifications
    this.emit('approvalRequested', approval);
    
    logger.info(`📋 Manual approval requested: ${approvalId}`);
    return approvalId;
  }

  async approveTradeManually(approvalId: string, approved: boolean, reason?: string): Promise<boolean> {
    const approval = this.pendingApprovals.get(approvalId);
    
    if (!approval) {
      logger.error(`❌ Approval ${approvalId} not found or expired`);
      return false;
    }

    this.pendingApprovals.delete(approvalId);

    if (approved) {
      logger.info(`✅ Trade approved: ${approvalId} - ${reason || 'Manual approval'}`);
      this.emit('tradeApproved', { approval, reason });
      return true;
    } else {
      logger.info(`❌ Trade rejected: ${approvalId} - ${reason || 'Manual rejection'}`);
      this.emit('tradeRejected', { approval, reason });
      return false;
    }
  }

  private calculateRiskScore(exchange: string, opportunity: any): number {
    let riskScore = 0;
    
    // Higher amounts = higher risk
    if (opportunity.amount > 100) riskScore += 0.3;
    if (opportunity.amount > 500) riskScore += 0.3;
    
    // Very high profits might be suspicious
    if (opportunity.profitPercent > 5) riskScore += 0.2;
    if (opportunity.profitPercent > 10) riskScore += 0.4;
    
    // Exchange-specific risk factors
    if (exchange === 'binance') riskScore += 0.1; // Lower risk (working)
    else riskScore += 0.3; // Higher risk (not fully implemented)
    
    return Math.min(1.0, riskScore);
  }

  getPendingApprovals(): PendingApproval[] {
    return Array.from(this.pendingApprovals.values())
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  getAllConfigs(): ExchangeTradingConfig[] {
    return Array.from(this.exchangeConfigs.values());
  }

  getSystemSummary() {
    const configs = this.getAllConfigs();
    const pending = this.getPendingApprovals();
    
    return {
      totalExchanges: configs.length,
      fullyAutomated: configs.filter(c => c.mode === TradingMode.FULLY_AUTOMATED).length,
      semiAssisted: configs.filter(c => c.mode === TradingMode.SEMI_ASSISTED).length,
      manualOnly: configs.filter(c => c.mode === TradingMode.MANUAL_ONLY).length,
      disabled: configs.filter(c => c.mode === TradingMode.DISABLED).length,
      pendingApprovals: pending.length,
      enabled: configs.filter(c => c.enabled).length
    };
  }

  // Bulk operations
  enableFullAutomationForExchange(exchange: string) {
    const config = this.getExchangeConfig(exchange);
    if (config) {
      config.mode = TradingMode.FULLY_AUTOMATED;
      config.autoReleaseEnabled = true;
      config.requireManualApproval = false;
      this.setExchangeConfig(exchange, config);
    }
  }

  enableSemiAssistedForExchange(exchange: string) {
    const config = this.getExchangeConfig(exchange);
    if (config) {
      config.mode = TradingMode.SEMI_ASSISTED;
      config.autoReleaseEnabled = false;
      config.requireManualApproval = true;
      this.setExchangeConfig(exchange, config);
    }
  }

  pauseAllAutomation() {
    for (const [exchange, config] of this.exchangeConfigs) {
      config.mode = TradingMode.MANUAL_ONLY;
      this.setExchangeConfig(exchange, config);
    }
    logger.info('⏸️ All automation paused - switched to manual mode');
  }

  resumeAutomation() {
    // Restore automation based on exchange capabilities
    this.enableFullAutomationForExchange('binance');
    this.enableSemiAssistedForExchange('zebpay');
    this.enableSemiAssistedForExchange('kucoin');
    this.enableSemiAssistedForExchange('coinswitch');
    logger.info('▶️ Automation resumed with appropriate modes');
  }
}

