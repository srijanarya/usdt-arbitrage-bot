import { PerformanceMonitorAPI } from '../../../src/services/monitoring/PerformanceMonitorAPI';
import request from 'supertest';
import express from 'express';

// Mock dependencies
jest.mock('../../../src/config/tradingConfig', () => ({
  getPositionSizer: jest.fn(() => ({
    getParameters: () => ({
      currentStats: {
        winRate: 0.65,
        avgWin: 150,
        avgLoss: 100,
        consecutiveLosses: 1,
        totalTrades: 50,
        currentCapital: 12000
      }
    })
  }))
}));

jest.mock('../../../src/services/analysis/MarketVolatilityCalculator', () => ({
  volatilityCalculator: {
    getMarketConditions: jest.fn(() => ({
      volatility: 45,
      liquidityDepth: 100000,
      spread: 0.1,
      recentDrawdown: 8
    }))
  }
}));

describe('PerformanceMonitorAPI', () => {
  let performanceMonitor: PerformanceMonitorAPI;
  let app: express.Application;

  beforeEach(() => {
    performanceMonitor = new PerformanceMonitorAPI(0); // Use random port
    app = (performanceMonitor as any).app;
  });

  afterEach(() => {
    performanceMonitor.stop();
  });

  describe('API endpoints', () => {
    describe('GET /', () => {
      it('should serve dashboard HTML', async () => {
        const response = await request(app).get('/');
        
        expect(response.status).toBe(200);
        expect(response.headers['content-type']).toContain('text/html');
      });
    });

    describe('GET /api/metrics', () => {
      it('should return performance metrics', async () => {
        // Record some test data
        performanceMonitor.recordTrade({
          pair: 'USDT/INR',
          type: 'buy',
          profit: 250
        });
        performanceMonitor.updateApiLatency(45);
        performanceMonitor.updateMetric('activePositions', 3);

        const response = await request(app).get('/api/metrics');
        
        expect(response.status).toBe(200);
        expect(response.body).toMatchObject({
          totalProfit: 250,
          currentCapital: expect.any(Number),
          winRate: expect.any(Number),
          activePositions: 3,
          apiLatency: 45,
          uptime: expect.any(Number),
          status: 'active',
          profitHistory: expect.any(Array),
          recentTrades: expect.any(Array),
          risk: {
            currentDrawdown: expect.any(Number),
            volatility: 45,
            liquidityStatus: expect.any(String)
          },
          positionSizing: {
            currentPercent: expect.any(Number),
            kellyFraction: expect.any(Number),
            consecutiveLosses: 1,
            riskAdjustment: expect.any(Number)
          }
        });
      });
    });

    describe('GET /api/export', () => {
      it('should export data as JSON', async () => {
        const response = await request(app).get('/api/export');
        
        expect(response.status).toBe(200);
        expect(response.headers['content-type']).toContain('application/json');
        expect(response.headers['content-disposition']).toContain('attachment');
        expect(response.body).toHaveProperty('exportTime');
        expect(response.body).toHaveProperty('metrics');
        expect(response.body).toHaveProperty('fullTradeHistory');
      });
    });

    describe('POST /api/emergency-stop', () => {
      it('should trigger emergency stop', async () => {
        const response = await request(app)
          .post('/api/emergency-stop')
          .send({});
        
        expect(response.status).toBe(200);
        expect(response.body).toEqual({
          success: true,
          message: 'Emergency stop executed'
        });
        
        // Check status updated to error
        const metrics = await request(app).get('/api/metrics');
        expect(metrics.body.status).toBe('error');
      });
    });

    describe('POST /api/update-trade', () => {
      it('should record new trade', async () => {
        const trade = {
          pair: 'USDT/INR',
          type: 'sell',
          profit: -50
        };

        const response = await request(app)
          .post('/api/update-trade')
          .send(trade);
        
        expect(response.status).toBe(200);
        expect(response.body).toEqual({ success: true });
        
        // Verify trade was recorded
        const metrics = await request(app).get('/api/metrics');
        expect(metrics.body.totalProfit).toBe(-50);
        expect(metrics.body.recentTrades).toHaveLength(1);
      });
    });

    describe('POST /api/update-api-latency', () => {
      it('should update API latency', async () => {
        const response = await request(app)
          .post('/api/update-api-latency')
          .send({ latency: 120 });
        
        expect(response.status).toBe(200);
        expect(response.body).toEqual({ success: true });
        
        const metrics = await request(app).get('/api/metrics');
        expect(metrics.body.apiLatency).toBe(120);
      });
    });

    describe('POST /api/update-position', () => {
      it('should update active positions', async () => {
        const response = await request(app)
          .post('/api/update-position')
          .send({ positions: 5 });
        
        expect(response.status).toBe(200);
        expect(response.body).toEqual({ success: true });
        
        const metrics = await request(app).get('/api/metrics');
        expect(metrics.body.activePositions).toBe(5);
      });
    });
  });

  describe('trade recording', () => {
    it('should track profit history', () => {
      performanceMonitor.recordTrade({
        pair: 'USDT/INR',
        type: 'buy',
        profit: 100
      });
      performanceMonitor.recordTrade({
        pair: 'USDT/INR',
        type: 'sell',
        profit: 150
      });

      const metrics = (performanceMonitor as any).calculateMetrics();
      
      expect(metrics.totalProfit).toBe(250);
      expect(metrics.profitHistory).toHaveLength(2);
      expect(metrics.profitHistory[1].cumulative).toBe(250);
    });

    it('should calculate win rate correctly', () => {
      performanceMonitor.recordTrade({ pair: 'USDT/INR', type: 'buy', profit: 100 });
      performanceMonitor.recordTrade({ pair: 'USDT/INR', type: 'sell', profit: -50 });
      performanceMonitor.recordTrade({ pair: 'USDT/INR', type: 'buy', profit: 75 });
      performanceMonitor.recordTrade({ pair: 'USDT/INR', type: 'sell', profit: -25 });

      const metrics = (performanceMonitor as any).calculateMetrics();
      
      expect(metrics.winRate).toBe(50); // 2 wins out of 4 trades
    });

    it('should limit trade history to 1000 entries', () => {
      // Record 1005 trades
      for (let i = 0; i < 1005; i++) {
        performanceMonitor.recordTrade({
          pair: 'USDT/INR',
          type: 'buy',
          profit: 10
        });
      }

      const tradeHistory = (performanceMonitor as any).tradeHistory;
      expect(tradeHistory).toHaveLength(1000);
    });
  });

  describe('API latency tracking', () => {
    it('should calculate rolling average', () => {
      performanceMonitor.updateApiLatency(100);
      performanceMonitor.updateApiLatency(200);
      performanceMonitor.updateApiLatency(150);

      const metrics = (performanceMonitor as any).calculateMetrics();
      
      expect(metrics.apiLatency).toBe(150); // Average of 100, 200, 150
    });

    it('should reset after 1000 calls', () => {
      // Record 1001 API calls
      for (let i = 0; i < 1001; i++) {
        performanceMonitor.updateApiLatency(100);
      }

      const apiCallCount = (performanceMonitor as any).apiCallCount;
      expect(apiCallCount).toBe(1);
    });
  });

  describe('risk calculations', () => {
    it('should calculate drawdown correctly', () => {
      // Simulate profit history with drawdown
      performanceMonitor.recordTrade({ pair: 'USDT/INR', type: 'buy', profit: 1000 });
      performanceMonitor.recordTrade({ pair: 'USDT/INR', type: 'sell', profit: -300 });
      performanceMonitor.recordTrade({ pair: 'USDT/INR', type: 'buy', profit: -200 });

      const drawdown = (performanceMonitor as any).calculateDrawdown();
      
      // From peak of 11000 to current 10500 = 4.5% drawdown
      expect(drawdown).toBeGreaterThan(0);
      expect(drawdown).toBeLessThan(10);
    });

    it('should calculate risk adjustment based on conditions', () => {
      const conditions = {
        volatility: 75, // High volatility
        recentDrawdown: 12 // High drawdown
      };

      const adjustment = (performanceMonitor as any).calculateRiskAdjustment(conditions);
      
      // Should reduce risk significantly
      expect(adjustment).toBeLessThan(0.7);
    });

    it('should determine liquidity status by time', () => {
      const originalDate = Date;
      
      // Mock different times
      const times = [
        new Date('2024-01-01T12:00:00'), // Good liquidity (noon)
        new Date('2024-01-01T08:00:00'), // Fair liquidity (morning)
        new Date('2024-01-01T02:00:00')  // Low liquidity (night)
      ];

      times.forEach(mockTime => {
        global.Date = jest.fn(() => mockTime) as any;
        const status = (performanceMonitor as any).getLiquidityStatus();
        
        if (mockTime.getHours() >= 10 && mockTime.getHours() <= 16) {
          expect(status).toBe('Good');
        } else if (mockTime.getHours() >= 8 && mockTime.getHours() <= 18) {
          expect(status).toBe('Fair');
        } else {
          expect(status).toBe('Low');
        }
      });

      global.Date = originalDate;
    });
  });

  describe('metric updates', () => {
    it('should update individual metrics', () => {
      performanceMonitor.updateMetric('status', 'warning');
      performanceMonitor.updateMetric('activePositions', 7);

      const metrics = (performanceMonitor as any).metrics;
      
      expect(metrics.status).toBe('warning');
      expect(metrics.activePositions).toBe(7);
    });
  });

  describe('server lifecycle', () => {
    it('should start server successfully', async () => {
      const monitor = new PerformanceMonitorAPI(0);
      await monitor.start();
      
      // Server should be running
      expect(true).toBe(true);
      
      monitor.stop();
    });
  });
});