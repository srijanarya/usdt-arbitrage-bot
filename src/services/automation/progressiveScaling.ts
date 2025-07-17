import { EventEmitter } from 'events';
import { logger } from '../../utils/logger';

interface ScalingConfig {
  enabled: boolean;
  initialAmount: number;
  successThreshold: number; // Number of successful trades to trigger scaling
  multiplier: number; // Amount multiplier on scaling
  maxAmount: number; // Maximum amount cap
  confidenceRequirement: number; // Min confidence for scaling
}

interface TradeRecord {
  id: string;
  amount: number;
  success: boolean;
  confidence: number;
  timestamp: Date;
  profit: number;
}

export class ProgressiveScaling extends EventEmitter {
  private config: ScalingConfig;
  private tradeHistory: TradeRecord[] = [];
  private currentAmount: number;
  private consecutiveSuccesses: number = 0;
  private totalSuccesses: number = 0;
  private totalFailed: number = 0;

  constructor(config: Partial<ScalingConfig> = {}) {
    super();
    
    this.config = {
      enabled: true,
      initialAmount: 500,
      successThreshold: 3,
      multiplier: 2.0,
      maxAmount: 25000,
      confidenceRequirement: 0.95,
      ...config
    };
    
    this.currentAmount = this.config.initialAmount;
    
    logger.info('📈 Progressive Scaling initialized:', this.config);
  }

  getCurrentTradingAmount(): number {
    return this.currentAmount;
  }

  recordTrade(trade: Omit<TradeRecord, 'timestamp'>): number {
    const tradeRecord: TradeRecord = {
      ...trade,
      timestamp: new Date()
    };
    
    this.tradeHistory.push(tradeRecord);
    
    // Keep only last 50 trades for memory efficiency
    if (this.tradeHistory.length > 50) {
      this.tradeHistory = this.tradeHistory.slice(-50);
    }
    
    if (trade.success) {
      this.totalSuccesses++;
      this.consecutiveSuccesses++;
      
      logger.info(`✅ Trade ${trade.id} successful (${this.consecutiveSuccesses}/${this.config.successThreshold} for scaling)`);
      
      // Check if we should scale up
      if (this.shouldScale()) {
        this.scaleUp();
      }
      
    } else {
      this.totalFailed++;
      this.consecutiveSuccesses = 0; // Reset on failure
      
      logger.warn(`❌ Trade ${trade.id} failed - resetting scaling progress`);
      
      // Consider scaling down on repeated failures
      if (this.shouldScaleDown()) {
        this.scaleDown();
      }
    }
    
    this.emit('tradeRecorded', {
      trade: tradeRecord,
      currentAmount: this.currentAmount,
      progress: this.getScalingProgress()
    });
    
    return this.currentAmount;
  }

  private shouldScale(): boolean {
    if (!this.config.enabled) return false;
    if (this.currentAmount >= this.config.maxAmount) return false;
    if (this.consecutiveSuccesses < this.config.successThreshold) return false;
    
    // Check recent trades have sufficient confidence
    const recentTrades = this.tradeHistory.slice(-this.config.successThreshold);
    const avgConfidence = recentTrades.reduce((sum, t) => sum + t.confidence, 0) / recentTrades.length;
    
    return avgConfidence >= this.config.confidenceRequirement;
  }

  private shouldScaleDown(): boolean {
    if (!this.config.enabled) return false;
    if (this.currentAmount <= this.config.initialAmount) return false;
    
    // Scale down if last 3 trades failed
    const recentTrades = this.tradeHistory.slice(-3);
    const allFailed = recentTrades.length === 3 && recentTrades.every(t => !t.success);
    
    return allFailed;
  }

  private scaleUp(): void {
    const previousAmount = this.currentAmount;
    this.currentAmount = Math.min(
      this.currentAmount * this.config.multiplier,
      this.config.maxAmount
    );
    
    // Reset consecutive counter after scaling
    this.consecutiveSuccesses = 0;
    
    logger.info(`📈 SCALING UP: ₹${previousAmount} → ₹${this.currentAmount} (${this.config.multiplier}x)`);
    
    this.emit('scaledUp', {
      previousAmount,
      newAmount: this.currentAmount,
      multiplier: this.config.multiplier,
      successCount: this.totalSuccesses
    });
  }

  private scaleDown(): void {
    const previousAmount = this.currentAmount;
    this.currentAmount = Math.max(
      this.currentAmount / this.config.multiplier,
      this.config.initialAmount
    );
    
    // Reset consecutive counter after scaling down
    this.consecutiveSuccesses = 0;
    
    logger.warn(`📉 SCALING DOWN: ₹${previousAmount} → ₹${this.currentAmount} (failed trades detected)`);
    
    this.emit('scaledDown', {
      previousAmount,
      newAmount: this.currentAmount,
      reason: 'consecutive_failures'
    });
  }

  getScalingProgress(): {
    currentAmount: number;
    consecutiveSuccesses: number;
    requiredForNextScale: number;
    nextScaleAmount: number;
    totalTrades: number;
    successRate: number;
    canScaleUp: boolean;
  } {
    const totalTrades = this.totalSuccesses + this.totalFailed;
    const successRate = totalTrades > 0 ? (this.totalSuccesses / totalTrades) * 100 : 0;
    const nextScaleAmount = Math.min(this.currentAmount * this.config.multiplier, this.config.maxAmount);
    
    return {
      currentAmount: this.currentAmount,
      consecutiveSuccesses: this.consecutiveSuccesses,
      requiredForNextScale: this.config.successThreshold,
      nextScaleAmount,
      totalTrades,
      successRate,
      canScaleUp: this.shouldScale()
    };
  }

  getTradeHistory(): TradeRecord[] {
    return [...this.tradeHistory];
  }

  getStatistics(): {
    totalTrades: number;
    totalSuccesses: number;
    totalFailed: number;
    successRate: number;
    totalProfit: number;
    averageTradeSize: number;
    currentAmount: number;
    maxAmountReached: number;
  } {
    const totalTrades = this.totalSuccesses + this.totalFailed;
    const successRate = totalTrades > 0 ? (this.totalSuccesses / totalTrades) * 100 : 0;
    const totalProfit = this.tradeHistory.reduce((sum, t) => sum + (t.success ? t.profit : -Math.abs(t.profit)), 0);
    const averageTradeSize = totalTrades > 0 ? 
      this.tradeHistory.reduce((sum, t) => sum + t.amount, 0) / totalTrades : 0;
    const maxAmountReached = Math.max(...this.tradeHistory.map(t => t.amount), this.config.initialAmount);
    
    return {
      totalTrades,
      totalSuccesses: this.totalSuccesses,
      totalFailed: this.totalFailed,
      successRate,
      totalProfit,
      averageTradeSize,
      currentAmount: this.currentAmount,
      maxAmountReached
    };
  }

  updateConfig(newConfig: Partial<ScalingConfig>): void {
    this.config = { ...this.config, ...newConfig };
    logger.info('📝 Progressive scaling config updated:', this.config);
    this.emit('configUpdated', this.config);
  }

  reset(): void {
    this.currentAmount = this.config.initialAmount;
    this.consecutiveSuccesses = 0;
    this.totalSuccesses = 0;
    this.totalFailed = 0;
    this.tradeHistory = [];
    
    logger.info('🔄 Progressive scaling reset to initial amount:', this.currentAmount);
    this.emit('reset', { amount: this.currentAmount });
  }

  // Manual override methods
  setAmount(amount: number): void {
    const previousAmount = this.currentAmount;
    this.currentAmount = Math.min(Math.max(amount, this.config.initialAmount), this.config.maxAmount);
    
    logger.info(`🎛️ Manual amount override: ₹${previousAmount} → ₹${this.currentAmount}`);
    this.emit('manualOverride', { previousAmount, newAmount: this.currentAmount });
  }

  pauseScaling(): void {
    this.config.enabled = false;
    logger.info('⏸️ Progressive scaling paused');
    this.emit('scalingPaused');
  }

  resumeScaling(): void {
    this.config.enabled = true;
    logger.info('▶️ Progressive scaling resumed');
    this.emit('scalingResumed');
  }
}

export type { ScalingConfig, TradeRecord };