import chalk from 'chalk';
import { EventEmitter } from 'events';

interface RiskProfile {
  maxExposure: number;          // Maximum INR exposure at any time
  maxPositionSize: number;      // Maximum USDT per trade
  maxDailyLoss: number;         // Maximum daily loss allowed
  maxConsecutiveLosses: number; // Stop after X consecutive losses
  minLiquidity: number;         // Minimum INR balance to maintain
  riskPerTrade: number;         // Percentage of capital to risk per trade
}

interface TradingMetrics {
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  consecutiveLosses: number;
  dailyPnL: number;
  currentExposure: number;
  availableCapital: number;
}

interface RiskAssessment {
  allowed: boolean;
  reason?: string;
  suggestedAmount?: number;
  riskScore: number; // 0-100, higher is riskier
  warnings: string[];
}

export class RiskManagementService extends EventEmitter {
  private profile: RiskProfile;
  private metrics: TradingMetrics;
  private volatilityIndex: Map<string, number> = new Map();
  private blacklistedMerchants: Set<string> = new Set();

  constructor(initialCapital: number = 10000) {
    super();
    
    // Conservative risk profile by default
    this.profile = {
      maxExposure: initialCapital * 0.5,        // 50% max exposure
      maxPositionSize: initialCapital * 0.1,    // 10% max per trade
      maxDailyLoss: initialCapital * 0.05,     // 5% max daily loss
      maxConsecutiveLosses: 3,                 // Stop after 3 losses
      minLiquidity: initialCapital * 0.2,       // Keep 20% liquid
      riskPerTrade: 0.02                       // Risk 2% per trade
    };

    this.metrics = {
      totalTrades: 0,
      winningTrades: 0,
      losingTrades: 0,
      consecutiveLosses: 0,
      dailyPnL: 0,
      currentExposure: 0,
      availableCapital: initialCapital
    };

    this.initializeVolatilityTracking();
  }

  /**
   * Assess risk for a potential trade
   */
  assessTrade(
    buyExchange: string,
    sellExchange: string,
    amount: number,
    buyPrice: number,
    expectedProfit: number,
    merchantName?: string
  ): RiskAssessment {
    const assessment: RiskAssessment = {
      allowed: true,
      riskScore: 0,
      warnings: []
    };

    // Check blacklisted merchants
    if (merchantName && this.blacklistedMerchants.has(merchantName)) {
      assessment.allowed = false;
      assessment.reason = 'Merchant is blacklisted';
      assessment.riskScore = 100;
      return assessment;
    }

    // Check consecutive losses
    if (this.metrics.consecutiveLosses >= this.profile.maxConsecutiveLosses) {
      assessment.allowed = false;
      assessment.reason = `${this.metrics.consecutiveLosses} consecutive losses - trading paused`;
      assessment.riskScore = 90;
      return assessment;
    }

    // Check daily loss limit
    if (this.metrics.dailyPnL < -this.profile.maxDailyLoss) {
      assessment.allowed = false;
      assessment.reason = 'Daily loss limit reached';
      assessment.riskScore = 95;
      return assessment;
    }

    const tradeValue = amount * buyPrice;

    // Check exposure limits
    if (this.metrics.currentExposure + tradeValue > this.profile.maxExposure) {
      assessment.allowed = false;
      assessment.reason = 'Would exceed maximum exposure limit';
      assessment.riskScore = 85;
      return assessment;
    }

    // Check position size
    if (tradeValue > this.profile.maxPositionSize) {
      const suggestedAmount = this.profile.maxPositionSize / buyPrice;
      assessment.warnings.push(`Position size too large. Suggested: ${suggestedAmount.toFixed(2)} USDT`);
      assessment.suggestedAmount = suggestedAmount;
      assessment.riskScore += 20;
    }

    // Check available capital
    if (tradeValue > this.metrics.availableCapital - this.profile.minLiquidity) {
      assessment.allowed = false;
      assessment.reason = 'Insufficient capital (would breach liquidity requirement)';
      assessment.riskScore = 80;
      return assessment;
    }

    // Assess exchange volatility
    const volatility = this.getExchangeVolatility(buyExchange);
    if (volatility > 0.05) { // 5% volatility
      assessment.warnings.push(`High volatility on ${buyExchange}: ${(volatility * 100).toFixed(2)}%`);
      assessment.riskScore += 15;
    }

    // Check profit/risk ratio
    const riskAmount = tradeValue * this.profile.riskPerTrade;
    const profitRiskRatio = expectedProfit / riskAmount;
    
    if (profitRiskRatio < 2) { // Less than 2:1 profit/risk ratio
      assessment.warnings.push(`Low profit/risk ratio: ${profitRiskRatio.toFixed(2)}:1`);
      assessment.riskScore += 10;
    }

    // Time-based risk (avoid trading during high-risk hours)
    const hour = new Date().getHours();
    if (hour < 9 || hour > 21) { // Outside 9 AM - 9 PM
      assessment.warnings.push('Trading outside optimal hours');
      assessment.riskScore += 5;
    }

    // Calculate position sizing based on Kelly Criterion
    const kellySizing = this.calculateKellyPosition(expectedProfit, tradeValue);
    if (kellySizing < amount) {
      assessment.suggestedAmount = kellySizing;
      assessment.warnings.push(`Kelly Criterion suggests ${kellySizing.toFixed(2)} USDT`);
    }

    // Final risk score adjustment
    if (this.metrics.consecutiveLosses > 0) {
      assessment.riskScore += this.metrics.consecutiveLosses * 10;
    }

    // Add warning if risk score is high
    if (assessment.riskScore > 50) {
      assessment.warnings.push(`High risk score: ${assessment.riskScore}/100`);
    }

    return assessment;
  }

  /**
   * Record trade result for risk tracking
   */
  recordTrade(
    profit: number,
    amount: number,
    buyPrice: number,
    success: boolean,
    merchantName?: string
  ) {
    this.metrics.totalTrades++;
    this.metrics.dailyPnL += profit;

    if (success && profit > 0) {
      this.metrics.winningTrades++;
      this.metrics.consecutiveLosses = 0;
    } else {
      this.metrics.losingTrades++;
      this.metrics.consecutiveLosses++;
      
      // Blacklist merchant after 2 failed trades
      if (merchantName && !success) {
        const key = `merchant_failures_${merchantName}`;
        const failures = (this[key] || 0) + 1;
        this[key] = failures;
        
        if (failures >= 2) {
          this.blacklistedMerchants.add(merchantName);
          console.log(chalk.red(`⚠️  Merchant ${merchantName} blacklisted after ${failures} failures`));
        }
      }
    }

    // Update exposure
    if (!success) {
      this.metrics.currentExposure -= amount * buyPrice;
    }

    // Emit risk alerts
    if (this.metrics.consecutiveLosses >= 2) {
      this.emit('riskAlert', {
        type: 'consecutive_losses',
        message: `${this.metrics.consecutiveLosses} consecutive losses`,
        severity: 'high'
      });
    }

    if (this.metrics.dailyPnL < -this.profile.maxDailyLoss * 0.8) {
      this.emit('riskAlert', {
        type: 'approaching_daily_limit',
        message: `Daily P&L: ₹${this.metrics.dailyPnL.toFixed(2)} (80% of limit)`,
        severity: 'medium'
      });
    }
  }

  /**
   * Calculate position size using Kelly Criterion
   */
  private calculateKellyPosition(expectedProfit: number, tradeValue: number): number {
    const winRate = this.metrics.totalTrades > 0 
      ? this.metrics.winningTrades / this.metrics.totalTrades 
      : 0.5; // Assume 50% if no history
    
    const avgWin = this.metrics.winningTrades > 0
      ? this.metrics.dailyPnL / this.metrics.winningTrades
      : expectedProfit;
    
    const avgLoss = this.metrics.losingTrades > 0
      ? Math.abs(this.metrics.dailyPnL / this.metrics.losingTrades)
      : tradeValue * 0.02; // Assume 2% loss
    
    const winLossRatio = avgWin / avgLoss;
    
    // Kelly formula: f = (p * b - q) / b
    // where f = fraction to bet, p = win probability, q = loss probability, b = win/loss ratio
    const kellyFraction = (winRate * winLossRatio - (1 - winRate)) / winLossRatio;
    
    // Apply Kelly fraction with safety factor (use 25% of Kelly)
    const safeFraction = Math.max(0, Math.min(0.1, kellyFraction * 0.25));
    
    return this.metrics.availableCapital * safeFraction;
  }

  /**
   * Initialize volatility tracking for exchanges
   */
  private initializeVolatilityTracking() {
    // Initialize with baseline volatility
    this.volatilityIndex.set('zebpay', 0.02);       // 2% baseline
    this.volatilityIndex.set('coindcx', 0.03);      // 3% baseline
    this.volatilityIndex.set('binance_p2p', 0.025); // 2.5% baseline
  }

  /**
   * Update volatility for an exchange based on price movements
   */
  updateVolatility(exchange: string, priceChange: number) {
    const current = this.volatilityIndex.get(exchange) || 0.02;
    // Exponential moving average of volatility
    const updated = current * 0.7 + Math.abs(priceChange) * 0.3;
    this.volatilityIndex.set(exchange, updated);
  }

  /**
   * Get current volatility for an exchange
   */
  private getExchangeVolatility(exchange: string): number {
    return this.volatilityIndex.get(exchange) || 0.02;
  }

  /**
   * Update available capital
   */
  updateCapital(amount: number) {
    this.metrics.availableCapital = amount;
  }

  /**
   * Reset daily metrics (call at midnight)
   */
  resetDailyMetrics() {
    this.metrics.dailyPnL = 0;
    this.metrics.consecutiveLosses = 0;
    console.log(chalk.blue('Daily risk metrics reset'));
  }

  /**
   * Get current risk metrics
   */
  getMetrics(): TradingMetrics {
    return { ...this.metrics };
  }

  /**
   * Get risk profile
   */
  getProfile(): RiskProfile {
    return { ...this.profile };
  }

  /**
   * Update risk profile
   */
  updateProfile(updates: Partial<RiskProfile>) {
    this.profile = { ...this.profile, ...updates };
    console.log(chalk.yellow('Risk profile updated'));
  }

  /**
   * Generate risk report
   */
  generateRiskReport(): string {
    const winRate = this.metrics.totalTrades > 0 
      ? (this.metrics.winningTrades / this.metrics.totalTrades * 100).toFixed(2)
      : 'N/A';
    
    const avgProfit = this.metrics.totalTrades > 0
      ? (this.metrics.dailyPnL / this.metrics.totalTrades).toFixed(2)
      : 'N/A';
    
    const report = `
📊 Risk Management Report
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📈 Trading Metrics:
  • Total Trades: ${this.metrics.totalTrades}
  • Win Rate: ${winRate}%
  • Consecutive Losses: ${this.metrics.consecutiveLosses}
  • Daily P&L: ₹${this.metrics.dailyPnL.toFixed(2)}
  • Average Profit/Trade: ₹${avgProfit}
  
💰 Capital Management:
  • Available Capital: ₹${this.metrics.availableCapital.toFixed(2)}
  • Current Exposure: ₹${this.metrics.currentExposure.toFixed(2)}
  • Max Exposure Allowed: ₹${this.profile.maxExposure.toFixed(2)}
  
⚠️  Risk Limits:
  • Max Position Size: ₹${this.profile.maxPositionSize.toFixed(2)}
  • Max Daily Loss: ₹${this.profile.maxDailyLoss.toFixed(2)}
  • Risk Per Trade: ${(this.profile.riskPerTrade * 100).toFixed(2)}%
  
🚫 Blacklisted Merchants: ${this.blacklistedMerchants.size}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    `;
    
    return report;
  }
}

// Export singleton
export const riskManager = new RiskManagementService();