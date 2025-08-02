import { logger } from '../../utils/logger';

interface MarketConditions {
  volatility: number;        // 0-100 scale
  liquidityDepth: number;    // Available liquidity in USDT
  spread: number;           // Bid-ask spread percentage
  recentDrawdown: number;   // Recent max drawdown percentage
}

interface PositionSizeResult {
  size: number;             // Position size in USDT
  riskAmount: number;       // Amount at risk
  kellyFraction: number;    // Kelly criterion fraction used
  confidence: number;       // Confidence level 0-1
  reasoning: string;        // Explanation of sizing decision
}

interface TradingStats {
  winRate: number;
  avgWin: number;
  avgLoss: number;
  consecutiveLosses: number;
  totalTrades: number;
  currentCapital: number;
}

export class DynamicPositionSizer {
  private readonly MIN_POSITION_PERCENT = 1;    // Minimum 1% of capital
  private readonly MAX_POSITION_PERCENT = 15;   // Maximum 15% of capital
  private readonly KELLY_SCALAR = 0.25;         // Conservative Kelly (25% of full Kelly)
  private readonly MIN_TRADES_FOR_KELLY = 30;   // Minimum trades before using Kelly

  constructor(private tradingStats: TradingStats) {}

  /**
   * Calculate optimal position size using multiple factors
   */
  calculatePositionSize(
    opportunity: { expectedProfit: number; confidence: number },
    marketConditions: MarketConditions
  ): PositionSizeResult {
    try {
      // Base calculations
      const kellyFraction = this.calculateKellyCriterion();
      const volatilityAdjustment = this.getVolatilityAdjustment(marketConditions.volatility);
      const liquidityConstraint = this.getLiquidityConstraint(marketConditions.liquidityDepth);
      const drawdownAdjustment = this.getDrawdownAdjustment(marketConditions.recentDrawdown);
      const confidenceMultiplier = this.getConfidenceMultiplier(opportunity.confidence);
      
      // Calculate base position size using Kelly
      let basePositionPercent = kellyFraction * 100;
      
      // Apply adjustments
      basePositionPercent *= volatilityAdjustment;
      basePositionPercent *= drawdownAdjustment;
      basePositionPercent *= confidenceMultiplier;
      
      // Apply consecutive loss protection
      if (this.tradingStats.consecutiveLosses >= 3) {
        basePositionPercent *= 0.5; // Reduce by 50% after 3 losses
        logger.warn(`Consecutive losses detected (${this.tradingStats.consecutiveLosses}), reducing position size`);
      }
      
      // Enforce min/max constraints
      const finalPositionPercent = Math.max(
        this.MIN_POSITION_PERCENT,
        Math.min(this.MAX_POSITION_PERCENT, basePositionPercent)
      );
      
      // Calculate actual position size
      let positionSize = (finalPositionPercent / 100) * this.tradingStats.currentCapital;
      
      // Apply liquidity constraint
      positionSize = Math.min(positionSize, liquidityConstraint);
      
      // Calculate risk amount (assuming 2% stop loss)
      const riskAmount = positionSize * 0.02;
      
      // Generate reasoning
      const reasoning = this.generateReasoning({
        kellyFraction,
        volatilityAdjustment,
        drawdownAdjustment,
        confidenceMultiplier,
        liquidityConstraint,
        finalPositionPercent,
        consecutiveLosses: this.tradingStats.consecutiveLosses
      });
      
      logger.info('Position size calculated', {
        size: positionSize,
        percent: finalPositionPercent,
        reasoning
      });
      
      return {
        size: Math.floor(positionSize * 100) / 100, // Round to 2 decimals
        riskAmount,
        kellyFraction,
        confidence: opportunity.confidence * volatilityAdjustment,
        reasoning
      };
      
    } catch (error) {
      logger.error('Error calculating position size:', error);
      // Return conservative default
      return {
        size: this.tradingStats.currentCapital * 0.01, // 1% fallback
        riskAmount: this.tradingStats.currentCapital * 0.0002,
        kellyFraction: 0.01,
        confidence: 0.5,
        reasoning: 'Error in calculation, using conservative 1% position'
      };
    }
  }

  /**
   * Calculate Kelly Criterion for position sizing
   */
  private calculateKellyCriterion(): number {
    // Not enough data for Kelly
    if (this.tradingStats.totalTrades < this.MIN_TRADES_FOR_KELLY) {
      return 0.02; // Default 2% position
    }
    
    const { winRate, avgWin, avgLoss } = this.tradingStats;
    
    // Kelly formula: f = (p * b - q) / b
    // where: p = win rate, q = loss rate, b = win/loss ratio
    const lossRate = 1 - winRate;
    const winLossRatio = avgWin / avgLoss;
    
    const kellyFraction = (winRate * winLossRatio - lossRate) / winLossRatio;
    
    // Apply conservative scalar and ensure positive
    const conservativeKelly = Math.max(0, kellyFraction * this.KELLY_SCALAR);
    
    // Cap at 25% maximum
    return Math.min(0.25, conservativeKelly);
  }

  /**
   * Adjust position size based on market volatility
   */
  private getVolatilityAdjustment(volatility: number): number {
    // High volatility = smaller positions
    if (volatility > 80) return 0.5;      // Very high volatility
    if (volatility > 60) return 0.7;      // High volatility
    if (volatility > 40) return 0.85;     // Moderate volatility
    if (volatility > 20) return 1.0;      // Normal volatility
    return 1.1;                           // Low volatility, slight increase
  }

  /**
   * Get liquidity constraint to avoid slippage
   */
  private getLiquidityConstraint(liquidityDepth: number): number {
    // Never take more than 10% of available liquidity
    return liquidityDepth * 0.1;
  }

  /**
   * Adjust based on recent drawdown
   */
  private getDrawdownAdjustment(recentDrawdown: number): number {
    // Reduce position size if in drawdown
    if (recentDrawdown > 20) return 0.5;    // Large drawdown
    if (recentDrawdown > 15) return 0.7;    // Significant drawdown
    if (recentDrawdown > 10) return 0.85;   // Moderate drawdown
    if (recentDrawdown > 5) return 0.95;    // Small drawdown
    return 1.0;                              // No drawdown
  }

  /**
   * Adjust based on trade confidence
   */
  private getConfidenceMultiplier(confidence: number): number {
    // Scale position with confidence
    if (confidence > 0.9) return 1.2;      // Very high confidence
    if (confidence > 0.8) return 1.1;      // High confidence
    if (confidence > 0.7) return 1.0;      // Good confidence
    if (confidence > 0.6) return 0.9;      // Moderate confidence
    if (confidence > 0.5) return 0.8;      // Low confidence
    return 0.6;                            // Very low confidence
  }

  /**
   * Generate human-readable reasoning for position size
   */
  private generateReasoning(factors: any): string {
    const reasons = [];
    
    if (factors.kellyFraction < 0.02) {
      reasons.push('Using minimum position due to insufficient trading history');
    } else {
      reasons.push(`Kelly criterion suggests ${(factors.kellyFraction * 100).toFixed(1)}% position`);
    }
    
    if (factors.volatilityAdjustment < 1) {
      reasons.push(`Reduced ${((1 - factors.volatilityAdjustment) * 100).toFixed(0)}% due to high volatility`);
    }
    
    if (factors.drawdownAdjustment < 1) {
      reasons.push(`Reduced ${((1 - factors.drawdownAdjustment) * 100).toFixed(0)}% due to recent drawdown`);
    }
    
    if (factors.consecutiveLosses >= 3) {
      reasons.push(`Halved position due to ${factors.consecutiveLosses} consecutive losses`);
    }
    
    if (factors.confidenceMultiplier !== 1) {
      const change = factors.confidenceMultiplier > 1 ? 'Increased' : 'Decreased';
      const percent = Math.abs((factors.confidenceMultiplier - 1) * 100).toFixed(0);
      reasons.push(`${change} ${percent}% based on trade confidence`);
    }
    
    reasons.push(`Final position: ${factors.finalPositionPercent.toFixed(1)}% of capital`);
    
    return reasons.join('. ');
  }

  /**
   * Update trading statistics after a trade
   */
  updateStats(tradeResult: { profit: number; win: boolean }) {
    this.tradingStats.totalTrades++;
    
    if (tradeResult.win) {
      this.tradingStats.consecutiveLosses = 0;
      this.tradingStats.winRate = 
        ((this.tradingStats.winRate * (this.tradingStats.totalTrades - 1)) + 1) / 
        this.tradingStats.totalTrades;
      
      // Update average win (exponential moving average)
      this.tradingStats.avgWin = 
        (this.tradingStats.avgWin * 0.9) + (tradeResult.profit * 0.1);
    } else {
      this.tradingStats.consecutiveLosses++;
      this.tradingStats.winRate = 
        (this.tradingStats.winRate * (this.tradingStats.totalTrades - 1)) / 
        this.tradingStats.totalTrades;
      
      // Update average loss
      this.tradingStats.avgLoss = 
        (this.tradingStats.avgLoss * 0.9) + (Math.abs(tradeResult.profit) * 0.1);
    }
    
    // Update capital
    this.tradingStats.currentCapital += tradeResult.profit;
  }

  /**
   * Get current position sizing parameters
   */
  getParameters() {
    return {
      minPosition: this.MIN_POSITION_PERCENT,
      maxPosition: this.MAX_POSITION_PERCENT,
      kellyScalar: this.KELLY_SCALAR,
      currentStats: this.tradingStats
    };
  }
}

// Example usage helper
export function createDynamicSizer(initialCapital: number): DynamicPositionSizer {
  const initialStats: TradingStats = {
    winRate: 0.6,          // Start with conservative 60% win rate assumption
    avgWin: 100,           // Average winning trade
    avgLoss: 80,           // Average losing trade
    consecutiveLosses: 0,
    totalTrades: 0,
    currentCapital: initialCapital
  };
  
  return new DynamicPositionSizer(initialStats);
}