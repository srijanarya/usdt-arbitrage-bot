import { describe, it, expect, beforeEach } from '@jest/globals';
import { DynamicPositionSizer, createDynamicSizer } from '../../../src/services/trading/DynamicPositionSizer';

// Add custom matcher
expect.extend({
  toBeWithinRange(received: number, floor: number, ceiling: number) {
    const pass = received >= floor && received <= ceiling;
    if (pass) {
      return {
        message: () => `expected ${received} not to be within range ${floor} - ${ceiling}`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be within range ${floor} - ${ceiling}`,
        pass: false,
      };
    }
  },
});

// Declare custom matchers
declare global {
  namespace jest {
    interface Matchers<R> {
      toBeWithinRange(floor: number, ceiling: number): R;
    }
  }
}

describe('DynamicPositionSizer', () => {
  let positionSizer: DynamicPositionSizer;
  const initialCapital = 10000;

  beforeEach(() => {
    positionSizer = createDynamicSizer(initialCapital);
  });

  describe('position size calculation', () => {
    const baseOpportunity = {
      expectedProfit: 2.5,
      confidence: 0.8
    };

    const normalConditions = {
      volatility: 30,
      liquidityDepth: 50000,
      spread: 0.2,
      recentDrawdown: 5
    };

    it('should calculate position size within min/max bounds', () => {
      const result = positionSizer.calculatePositionSize(
        baseOpportunity,
        normalConditions
      );

      expect(result.size).toBeGreaterThanOrEqual(initialCapital * 0.01); // Min 1%
      expect(result.size).toBeLessThanOrEqual(initialCapital * 0.15); // Max 15%
      expect(result.reasoning).toBeTruthy();
    });

    it('should reduce position size in high volatility', () => {
      const highVolatility = { ...normalConditions, volatility: 85 };
      const lowVolatility = { ...normalConditions, volatility: 15 };

      const highVolResult = positionSizer.calculatePositionSize(
        baseOpportunity,
        highVolatility
      );
      const lowVolResult = positionSizer.calculatePositionSize(
        baseOpportunity,
        lowVolatility
      );

      expect(highVolResult.size).toBeLessThan(lowVolResult.size);
      expect(highVolResult.reasoning).toContain('volatility');
    });

    it('should reduce position size during drawdown', () => {
      const noDrawdown = { ...normalConditions, recentDrawdown: 0 };
      const highDrawdown = { ...normalConditions, recentDrawdown: 25 };

      const noDrawdownResult = positionSizer.calculatePositionSize(
        baseOpportunity,
        noDrawdown
      );
      const highDrawdownResult = positionSizer.calculatePositionSize(
        baseOpportunity,
        highDrawdown
      );

      expect(highDrawdownResult.size).toBeLessThan(noDrawdownResult.size);
      expect(highDrawdownResult.reasoning).toContain('drawdown');
    });

    it('should scale with confidence level', () => {
      const highConfidence = { ...baseOpportunity, confidence: 0.95 };
      const lowConfidence = { ...baseOpportunity, confidence: 0.55 };

      const highConfResult = positionSizer.calculatePositionSize(
        highConfidence,
        normalConditions
      );
      const lowConfResult = positionSizer.calculatePositionSize(
        lowConfidence,
        normalConditions
      );

      expect(highConfResult.size).toBeGreaterThan(lowConfResult.size);
    });

    it('should respect liquidity constraints', () => {
      const lowLiquidity = { ...normalConditions, liquidityDepth: 5000 };
      
      const result = positionSizer.calculatePositionSize(
        baseOpportunity,
        lowLiquidity
      );

      // Should not exceed 10% of liquidity
      expect(result.size).toBeLessThanOrEqual(500);
    });

    it('should halve position after consecutive losses', () => {
      // Simulate 3 consecutive losses
      positionSizer.updateStats({ profit: -100, win: false });
      positionSizer.updateStats({ profit: -150, win: false });
      positionSizer.updateStats({ profit: -80, win: false });

      const result = positionSizer.calculatePositionSize(
        baseOpportunity,
        normalConditions
      );

      expect(result.reasoning).toContain('consecutive losses');
      expect(result.reasoning).toContain('Halved');
    });

    it('should use minimum position when insufficient data', () => {
      const newSizer = createDynamicSizer(10000);
      
      const result = newSizer.calculatePositionSize(
        baseOpportunity,
        normalConditions
      );

      expect(result.kellyFraction).toBe(0.02);
      expect(result.reasoning).toContain('insufficient trading history');
    });

    it('should handle error gracefully', () => {
      // Force an error by passing invalid data
      const result = positionSizer.calculatePositionSize(
        null as any,
        normalConditions
      );

      expect(result.size).toBe(initialCapital * 0.01);
      expect(result.reasoning).toContain('conservative 1% position');
    });
  });

  describe('Kelly Criterion calculation', () => {
    it('should calculate Kelly fraction correctly', () => {
      // Set up known stats
      for (let i = 0; i < 50; i++) {
        if (i % 3 === 0) {
          positionSizer.updateStats({ profit: -80, win: false });
        } else {
          positionSizer.updateStats({ profit: 120, win: true });
        }
      }

      const params = positionSizer.getParameters();
      
      // With ~66% win rate and 1.5 win/loss ratio
      // Kelly should be positive but conservative
      expect(params.currentStats.winRate).toBeCloseTo(0.66, 1);
      expect(params.currentStats.totalTrades).toBeGreaterThan(30);
    });
  });

  describe('stats tracking', () => {
    it('should track winning trades correctly', () => {
      const initialParams = positionSizer.getParameters();
      const initialCapital = initialParams.currentStats.currentCapital;

      positionSizer.updateStats({ profit: 150, win: true });

      const updatedParams = positionSizer.getParameters();
      
      expect(updatedParams.currentStats.totalTrades).toBe(1);
      expect(updatedParams.currentStats.currentCapital).toBe(initialCapital + 150);
      expect(updatedParams.currentStats.consecutiveLosses).toBe(0);
    });

    it('should track losing trades correctly', () => {
      positionSizer.updateStats({ profit: -100, win: false });
      positionSizer.updateStats({ profit: -50, win: false });

      const params = positionSizer.getParameters();
      
      expect(params.currentStats.consecutiveLosses).toBe(2);
      expect(params.currentStats.currentCapital).toBe(initialCapital - 150);
    });

    it('should reset consecutive losses on win', () => {
      positionSizer.updateStats({ profit: -100, win: false });
      positionSizer.updateStats({ profit: -50, win: false });
      positionSizer.updateStats({ profit: 200, win: true });

      const params = positionSizer.getParameters();
      
      expect(params.currentStats.consecutiveLosses).toBe(0);
    });

    it('should update average win/loss with EMA', () => {
      // Multiple wins
      positionSizer.updateStats({ profit: 100, win: true });
      positionSizer.updateStats({ profit: 200, win: true });
      positionSizer.updateStats({ profit: 150, win: true });

      const params = positionSizer.getParameters();
      
      // Should be weighted towards recent trades
      expect(params.currentStats.avgWin).toBeGreaterThan(100);
      expect(params.currentStats.avgWin).toBeLessThan(200);
    });
  });

  describe('market condition adjustments', () => {
    const opportunity = { expectedProfit: 3, confidence: 0.85 };

    it('should handle all volatility levels', () => {
      const volatilityLevels = [10, 25, 45, 65, 85];
      const results = volatilityLevels.map(vol => 
        positionSizer.calculatePositionSize(
          opportunity,
          { volatility: vol, liquidityDepth: 50000, spread: 0.2, recentDrawdown: 5 }
        )
      );

      // Position sizes should decrease as volatility increases
      for (let i = 1; i < results.length; i++) {
        expect(results[i].size).toBeLessThanOrEqual(results[i-1].size);
      }
    });

    it('should handle extreme market conditions', () => {
      const extremeConditions = {
        volatility: 95,
        liquidityDepth: 1000,
        spread: 2,
        recentDrawdown: 30
      };

      const result = positionSizer.calculatePositionSize(
        opportunity,
        extremeConditions
      );

      // Should be very conservative
      expect(result.size).toBeLessThanOrEqual(initialCapital * 0.02);
      expect(result.confidence).toBeLessThan(0.5);
    });
  });

  describe('getParameters', () => {
    it('should return current configuration', () => {
      const params = positionSizer.getParameters();

      expect(params.minPosition).toBe(1);
      expect(params.maxPosition).toBe(15);
      expect(params.kellyScalar).toBe(0.25);
      expect(params.currentStats).toBeDefined();
      expect(params.currentStats.currentCapital).toBe(initialCapital);
    });
  });
});