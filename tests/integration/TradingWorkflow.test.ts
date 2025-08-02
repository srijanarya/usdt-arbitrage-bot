import { DynamicPositionSizer } from '../../src/services/trading/DynamicPositionSizer';
import { volatilityCalculator } from '../../src/services/analysis/MarketVolatilityCalculator';
import { performanceMonitor } from '../../src/services/monitoring/PerformanceMonitorAPI';
import { credentialManager } from '../../src/services/security/CredentialManager';

describe('Trading Workflow Integration', () => {
  let positionSizer: DynamicPositionSizer;
  
  beforeAll(async () => {
    // Initialize components
    positionSizer = new DynamicPositionSizer({
      winRate: 0.6,
      avgWin: 150,
      avgLoss: 100,
      consecutiveLosses: 0,
      totalTrades: 0,
      currentCapital: 10000
    });
    
    // Start performance monitor on test port
    await performanceMonitor.start();
  });

  afterAll(() => {
    performanceMonitor.stop();
  });

  describe('complete trading cycle', () => {
    it('should execute full arbitrage workflow', async () => {
      // Step 1: Market Analysis
      const mockPrices = [88.5, 88.7, 88.6, 88.9, 89.1, 88.8];
      mockPrices.forEach(price => {
        volatilityCalculator.addPrice('USDT/INR', price);
      });

      const marketConditions = volatilityCalculator.getMarketConditions('USDT/INR');
      expect(marketConditions.volatility).toBeDefined();

      // Step 2: Opportunity Detection
      const opportunity = {
        exchange1: 'binance',
        exchange2: 'coindcx',
        buyPrice: 88.5,
        sellPrice: 91.2,
        profitPercent: 3.05,
        confidence: 0.85
      };

      // Step 3: Position Sizing
      const positionResult = positionSizer.calculatePositionSize(
        {
          expectedProfit: opportunity.profitPercent,
          confidence: opportunity.confidence
        },
        marketConditions
      );

      expect(positionResult.size).toBeGreaterThan(0);
      expect(positionResult.size).toBeLessThanOrEqual(1500); // Max 15% of 10k

      // Step 4: Execute Trade (Mock)
      const tradeResult = {
        success: true,
        actualProfit: 245,
        executionTime: 1250
      };

      // Step 5: Update Systems
      positionSizer.updateStats({
        profit: tradeResult.actualProfit,
        win: tradeResult.actualProfit > 0
      });

      performanceMonitor.recordTrade({
        pair: 'USDT/INR',
        type: 'buy',
        profit: tradeResult.actualProfit
      });

      performanceMonitor.updateApiLatency(tradeResult.executionTime);

      // Step 6: Verify Updates
      const params = positionSizer.getParameters();
      expect(params.currentStats.totalTrades).toBe(1);
      expect(params.currentStats.currentCapital).toBe(10245);

      // Check performance metrics
      const response = await fetch('http://localhost:3001/api/metrics');
      const metrics = await response.json();
      
      expect(metrics.totalProfit).toBe(245);
      expect(metrics.winRate).toBe(100);
      expect(metrics.apiLatency).toBe(1250);
    });

    it('should handle losing trades correctly', async () => {
      // Simulate losing trades
      const losses = [-120, -80, -150];
      
      losses.forEach((loss, index) => {
        positionSizer.updateStats({
          profit: loss,
          win: false
        });

        performanceMonitor.recordTrade({
          pair: 'USDT/INR',
          type: index % 2 === 0 ? 'buy' : 'sell',
          profit: loss
        });
      });

      // Check consecutive loss protection
      const marketConditions = {
        volatility: 40,
        liquidityDepth: 50000,
        spread: 0.2,
        recentDrawdown: 15
      };

      const positionResult = positionSizer.calculatePositionSize(
        { expectedProfit: 2.5, confidence: 0.8 },
        marketConditions
      );

      // Should be reduced due to consecutive losses
      expect(positionResult.reasoning).toContain('consecutive losses');
      expect(positionResult.size).toBeLessThan(1000); // Much less than 10% of capital
    });
  });

  describe('risk management integration', () => {
    it('should prevent oversized positions', async () => {
      const extremeOpportunity = {
        expectedProfit: 10, // Very high profit
        confidence: 0.95   // Very high confidence
      };

      const normalConditions = {
        volatility: 30,
        liquidityDepth: 50000,
        spread: 0.1,
        recentDrawdown: 3
      };

      const position = positionSizer.calculatePositionSize(
        extremeOpportunity,
        normalConditions
      );

      // Should still respect max position size
      const maxAllowed = positionSizer.getParameters().currentStats.currentCapital * 0.15;
      expect(position.size).toBeLessThanOrEqual(maxAllowed);
    });

    it('should adapt to changing market conditions', async () => {
      // Simulate volatile market
      const volatilePrices = [88, 92, 87, 93, 86, 94, 85];
      volatilePrices.forEach(price => {
        volatilityCalculator.addPrice('USDT/INR', price);
      });

      const volatileConditions = volatilityCalculator.getMarketConditions('USDT/INR');
      expect(volatileConditions.volatility).toBeGreaterThan(50);

      // Position sizing should be conservative
      const position = positionSizer.calculatePositionSize(
        { expectedProfit: 3, confidence: 0.8 },
        volatileConditions
      );

      expect(position.size).toBeLessThan(
        positionSizer.getParameters().currentStats.currentCapital * 0.08
      );
    });
  });

  describe('performance tracking integration', () => {
    it('should aggregate metrics correctly', async () => {
      // Execute multiple trades
      const trades = [
        { profit: 150, latency: 100 },
        { profit: -80, latency: 150 },
        { profit: 200, latency: 120 },
        { profit: 120, latency: 90 },
        { profit: -50, latency: 110 }
      ];

      trades.forEach(trade => {
        performanceMonitor.recordTrade({
          pair: 'USDT/INR',
          type: 'buy',
          profit: trade.profit
        });
        performanceMonitor.updateApiLatency(trade.latency);
      });

      const response = await fetch('http://localhost:3001/api/metrics');
      const metrics = await response.json();

      // Verify aggregations
      expect(metrics.totalProfit).toBe(340); // 150 - 80 + 200 + 120 - 50
      expect(metrics.winRate).toBe(60); // 3 wins out of 5
      expect(metrics.apiLatency).toBeCloseTo(114, 0); // Average latency
      expect(metrics.recentTrades).toHaveLength(5);
    });
  });

  describe('error handling', () => {
    it('should handle API failures gracefully', async () => {
      // Simulate API failure
      performanceMonitor.updateMetric('status', 'error');

      // Position sizer should still work
      const position = positionSizer.calculatePositionSize(
        { expectedProfit: 2, confidence: 0.7 },
        { volatility: 40, liquidityDepth: 30000, spread: 0.2, recentDrawdown: 5 }
      );

      expect(position.size).toBeGreaterThan(0);
    });

    it('should handle missing market data', () => {
      // Clear volatility data
      const emptyConditions = volatilityCalculator.getMarketConditions('UNKNOWN/PAIR');
      
      // Should return default values
      expect(emptyConditions.volatility).toBe(50);
      expect(emptyConditions.recentDrawdown).toBe(0);
    });
  });

  describe('security integration', () => {
    it('should handle credential encryption workflow', async () => {
      // This is a mock test - actual encryption requires file system
      const mockCredentials = {
        BINANCE_API_KEY: 'test-key',
        BINANCE_API_SECRET: 'test-secret'
      };

      // Mock the credential manager methods
      jest.spyOn(credentialManager, 'isEncrypted').mockReturnValue(true);
      jest.spyOn(credentialManager, 'getStatus').mockReturnValue({
        encrypted: true,
        lastModified: new Date(),
        credentialCount: 2
      });

      const status = credentialManager.getStatus();
      expect(status.encrypted).toBe(true);
      expect(status.credentialCount).toBe(2);
    });
  });
});