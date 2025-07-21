import { EventEmitter } from 'events';
import { logger } from '../utils/logger';

interface TradeValidation {
  isValid: boolean;
  reason?: string;
  suggestedAmount?: number;
}

interface RiskLimits {
  maxPositionSize: number;
  maxDailyLoss: number;
  maxConsecutiveLosses: number;
  minProfitThreshold: number;
  maxSlippage: number;
}

export class RiskManager extends EventEmitter {
  private limits: RiskLimits;
  private dailyPnL: number = 0;
  private consecutiveLosses: number = 0;
  private tradestoday: number = 0;
  private dailyReset: Date;

  constructor() {
    super();
    
    this.limits = {
      maxPositionSize: parseFloat(process.env.MAX_POSITION_SIZE || '10000'),
      maxDailyLoss: parseFloat(process.env.MAX_DAILY_LOSS || '5000'),
      maxConsecutiveLosses: parseInt(process.env.MAX_CONSECUTIVE_LOSSES || '3'),
      minProfitThreshold: parseFloat(process.env.MIN_PROFIT_THRESHOLD || '0.3'),
      maxSlippage: parseFloat(process.env.MAX_SLIPPAGE || '0.5'),
    };

    this.dailyReset = new Date();
    this.dailyReset.setHours(0, 0, 0, 0);
    
    // Reset daily stats at midnight
    setInterval(() => {
      this.checkDailyReset();
    }, 60000); // Check every minute
  }

  validateTrade(opportunity: any, amount: number): TradeValidation {
    // Check if we need to reset daily stats
    this.checkDailyReset();

    // 1. Position size check
    if (amount > this.limits.maxPositionSize) {
      return {
        isValid: false,
        reason: `Trade amount ₹${amount} exceeds max position size ₹${this.limits.maxPositionSize}`,
        suggestedAmount: this.limits.maxPositionSize,
      };
    }

    // 2. Daily loss limit check
    if (this.dailyPnL <= -this.limits.maxDailyLoss) {
      return {
        isValid: false,
        reason: `Daily loss limit of ₹${this.limits.maxDailyLoss} reached`,
      };
    }

    // 3. Consecutive losses check
    if (this.consecutiveLosses >= this.limits.maxConsecutiveLosses) {
      return {
        isValid: false,
        reason: `Maximum consecutive losses (${this.limits.maxConsecutiveLosses}) reached`,
      };
    }

    // 4. Minimum profit check
    if (opportunity.profitPercent < this.limits.minProfitThreshold) {
      return {
        isValid: false,
        reason: `Profit ${opportunity.profitPercent.toFixed(2)}% below minimum threshold ${this.limits.minProfitThreshold}%`,
      };
    }

    // 5. Slippage risk check
    const estimatedSlippage = this.estimateSlippage(opportunity, amount);
    if (estimatedSlippage > this.limits.maxSlippage) {
      return {
        isValid: false,
        reason: `Estimated slippage ${estimatedSlippage.toFixed(2)}% exceeds maximum ${this.limits.maxSlippage}%`,
      };
    }

    // 6. Exchange-specific checks
    const exchangeCheck = this.validateExchangeRisk(opportunity);
    if (!exchangeCheck.isValid) {
      return exchangeCheck;
    }

    // 7. Time-based risk (avoid trading during high volatility hours)
    const timeCheck = this.validateTimeRisk();
    if (!timeCheck.isValid) {
      return timeCheck;
    }

    // All checks passed
    logger.info(`Trade validated: ₹${amount} on ${opportunity.buyExchange}->${opportunity.sellExchange}`);
    
    return {
      isValid: true,
    };
  }

  private estimateSlippage(opportunity: any, amount: number): number {
    // Simple slippage estimation based on volume
    // In production, this should use order book depth
    const volumeRatio = amount / opportunity.volume;
    
    if (volumeRatio > 0.1) {
      // More than 10% of volume = high slippage risk
      return volumeRatio * 5; // Rough estimate
    }
    
    return volumeRatio * 2; // Normal slippage estimate
  }

  private validateExchangeRisk(opportunity: any): TradeValidation {
    // Check if exchanges are in maintenance or have issues
    const riskyExchanges = ['wazirx']; // Example: WazirX had issues in the past
    
    if (riskyExchanges.includes(opportunity.buyExchange.toLowerCase()) ||
        riskyExchanges.includes(opportunity.sellExchange.toLowerCase())) {
      return {
        isValid: false,
        reason: 'One or more exchanges flagged as risky',
      };
    }

    return { isValid: true };
  }

  private validateTimeRisk(): TradeValidation {
    const hour = new Date().getHours();
    
    // Avoid trading during Indian market opening/closing (9:00-9:30 AM, 3:00-3:30 PM)
    if ((hour === 9 && new Date().getMinutes() < 30) ||
        (hour === 15 && new Date().getMinutes() < 30)) {
      return {
        isValid: false,
        reason: 'High volatility period - Indian market opening/closing',
      };
    }

    return { isValid: true };
  }

  updatePnL(profit: number) {
    this.dailyPnL += profit;
    this.tradestoday++;

    if (profit < 0) {
      this.consecutiveLosses++;
      logger.warn(`Loss recorded: ₹${Math.abs(profit)}. Consecutive losses: ${this.consecutiveLosses}`);
      
      if (this.consecutiveLosses >= this.limits.maxConsecutiveLosses) {
        this.emit('riskAlert', {
          type: 'MAX_CONSECUTIVE_LOSSES',
          message: `Maximum consecutive losses reached (${this.consecutiveLosses})`,
          severity: 'HIGH',
        });
      }
    } else {
      this.consecutiveLosses = 0;
    }

    if (this.dailyPnL <= -this.limits.maxDailyLoss) {
      this.emit('riskAlert', {
        type: 'DAILY_LOSS_LIMIT',
        message: `Daily loss limit reached: ₹${Math.abs(this.dailyPnL)}`,
        severity: 'CRITICAL',
      });
    }

    logger.info(`PnL Update - Daily: ₹${this.dailyPnL.toFixed(2)}, Trades: ${this.tradestoday}`);
  }

  private checkDailyReset() {
    const now = new Date();
    if (now.getDate() !== this.dailyReset.getDate()) {
      logger.info('Resetting daily risk metrics');
      this.dailyPnL = 0;
      this.tradestoday = 0;
      this.dailyReset = now;
      this.dailyReset.setHours(0, 0, 0, 0);
    }
  }

  getStatus() {
    return {
      dailyPnL: this.dailyPnL,
      tradestoday: this.tradestoday,
      consecutiveLosses: this.consecutiveLosses,
      limits: this.limits,
      canTrade: this.dailyPnL > -this.limits.maxDailyLoss && 
                this.consecutiveLosses < this.limits.maxConsecutiveLosses,
    };
  }

  adjustLimitsForMarketConditions(volatility: number) {
    // Dynamic risk adjustment based on market conditions
    if (volatility > 5) {
      // High volatility - reduce position sizes
      this.limits.maxPositionSize *= 0.7;
      this.limits.minProfitThreshold *= 1.5;
      logger.warn(`High volatility detected (${volatility.toFixed(2)}%). Adjusting risk limits.`);
    } else if (volatility < 1) {
      // Low volatility - can increase position sizes slightly
      this.limits.maxPositionSize *= 1.1;
      logger.info(`Low volatility (${volatility.toFixed(2)}%). Relaxing risk limits slightly.`);
    }
  }
}