import { ArbitrageBot } from '../../src/services/arbitrageBot';
import { CoinDCXClient } from '../../src/api/exchanges/coinDCX';
import { ZebPayClient } from '../../src/api/exchanges/zebPay';
import { PriceCalculator } from '../../src/services/priceCalculator';
import { delay } from '../setup';

jest.mock('../../src/api/exchanges/coinDCX');
jest.mock('../../src/api/exchanges/zebPay');

describe('Arbitrage Bot Integration Tests', () => {
  let bot: ArbitrageBot;
  let mockCoinDCX: jest.Mocked<CoinDCXClient>;
  let mockZebPay: jest.Mocked<ZebPayClient>;

  beforeEach(() => {
    // Create mocked instances
    mockCoinDCX = new CoinDCXClient({
      apiKey: 'test',
      apiSecret: 'test'
    }) as jest.Mocked<CoinDCXClient>;

    mockZebPay = new ZebPayClient({
      apiKey: 'test',
      apiSecret: 'test'
    }) as jest.Mocked<ZebPayClient>;

    bot = new ArbitrageBot({
      exchanges: {
        coinDCX: mockCoinDCX,
        zebPay: mockZebPay
      },
      calculator: new PriceCalculator(),
      config: {
        minProfitPercentage: 1.5,
        maxVolume: 49900,
        enableTelegram: false,
        scanInterval: 5000
      }
    });
  });

  afterEach(() => {
    bot.stop();
  });

  describe('Opportunity Detection', () => {
    it('should detect profitable arbitrage opportunities', async () => {
      // Setup mock prices
      mockCoinDCX.getPrice.mockResolvedValue(87.48);
      mockZebPay.getPrice.mockResolvedValue(89.15);

      const opportunities = await bot.scanForOpportunities();

      expect(opportunities).toHaveLength(1);
      expect(opportunities[0]).toMatchObject({
        buyExchange: 'CoinDCX',
        sellExchange: 'ZebPay',
        buyPrice: 87.48,
        sellPrice: 89.15,
        profitPercentage: expect.any(Number),
        recommendedVolume: 49900
      });

      expect(opportunities[0].profitPercentage).toBeGreaterThan(1.5);
    });

    it('should ignore opportunities below minimum profit threshold', async () => {
      mockCoinDCX.getPrice.mockResolvedValue(87.48);
      mockZebPay.getPrice.mockResolvedValue(87.80); // Small difference

      const opportunities = await bot.scanForOpportunities();

      expect(opportunities).toHaveLength(0);
    });

    it('should handle exchange errors gracefully', async () => {
      mockCoinDCX.getPrice.mockRejectedValue(new Error('API Error'));
      mockZebPay.getPrice.mockResolvedValue(89.15);

      const opportunities = await bot.scanForOpportunities();

      expect(opportunities).toHaveLength(0);
      expect(bot.getStatus().errors).toContain('CoinDCX: API Error');
    });
  });

  describe('P2P Integration', () => {
    it('should include P2P platforms in opportunity scanning', async () => {
      mockCoinDCX.getPrice.mockResolvedValue(87.48);
      
      // Mock P2P prices
      bot.setP2PPrices({
        'Binance P2P': { price: 89.50, premium: 2.3 },
        'Local P2P': { price: 90.20, premium: 3.1 }
      });

      const opportunities = await bot.scanForP2POpportunities();

      expect(opportunities).toContainEqual(
        expect.objectContaining({
          buyExchange: 'CoinDCX',
          sellPlatform: 'Local P2P',
          profitPercentage: expect.any(Number)
        })
      );
    });

    it('should calculate P2P profits including platform fees', async () => {
      mockCoinDCX.getPrice.mockResolvedValue(87.48);
      
      const p2pPrice = 90.20;
      const p2pFee = 0.002; // 0.2%
      
      const profit = await bot.calculateP2PProfit(
        'CoinDCX',
        87.48,
        p2pPrice,
        p2pFee,
        49000
      );

      expect(profit.netProfit).toBeLessThan(profit.grossProfit);
      expect(profit.fees).toInclude({
        exchangeFee: expect.any(Number),
        p2pFee: expect.any(Number),
        gst: expect.any(Number)
      });
    });
  });

  describe('Automated Monitoring', () => {
    it('should start and stop monitoring correctly', async () => {
      const onOpportunity = jest.fn();
      
      bot.on('opportunity', onOpportunity);
      bot.start();

      expect(bot.isRunning()).toBe(true);

      // Wait for one scan cycle
      await delay(6000);

      bot.stop();
      expect(bot.isRunning()).toBe(false);
    });

    it('should emit events when opportunities are found', async () => {
      mockCoinDCX.getPrice.mockResolvedValue(87.48);
      mockZebPay.getPrice.mockResolvedValue(89.15);

      const opportunityHandler = jest.fn();
      bot.on('opportunity', opportunityHandler);

      bot.start();
      await delay(1000); // Wait for first scan

      expect(opportunityHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          buyExchange: 'CoinDCX',
          sellExchange: 'ZebPay'
        })
      );

      bot.stop();
    });
  });

  describe('Risk Management', () => {
    it('should respect volume limits', async () => {
      bot.setConfig({ maxVolume: 30000 });
      
      const opportunities = await bot.scanForOpportunities();

      opportunities.forEach(opp => {
        expect(opp.recommendedVolume).toBeLessThanOrEqual(30000);
      });
    });

    it('should apply risk-adjusted calculations', async () => {
      mockCoinDCX.getPrice.mockResolvedValue(87.48);
      mockZebPay.getPrice.mockResolvedValue(89.15);

      bot.setRiskFactors({
        'CoinDCX': 0.95,
        'ZebPay': 0.90
      });

      const opportunities = await bot.scanForOpportunities();
      const riskyOpp = opportunities[0];

      // Risk-adjusted profit should be lower
      expect(riskyOpp.riskAdjustedProfit).toBeLessThan(riskyOpp.profitPercentage);
    });
  });

  describe('Performance Metrics', () => {
    it('should track scan performance', async () => {
      mockCoinDCX.getPrice.mockImplementation(async () => {
        await delay(100);
        return 87.48;
      });

      mockZebPay.getPrice.mockImplementation(async () => {
        await delay(150);
        return 89.15;
      });

      const startTime = Date.now();
      await bot.scanForOpportunities();
      const duration = Date.now() - startTime;

      const metrics = bot.getMetrics();
      expect(metrics.lastScanDuration).toBeCloseTo(duration, -50);
      expect(metrics.averageScanTime).toBeGreaterThan(0);
    });

    it('should maintain scan history', async () => {
      // Perform multiple scans
      for (let i = 0; i < 5; i++) {
        mockCoinDCX.getPrice.mockResolvedValue(87.48 + i * 0.1);
        mockZebPay.getPrice.mockResolvedValue(89.15 + i * 0.1);
        await bot.scanForOpportunities();
      }

      const history = bot.getScanHistory();
      expect(history).toHaveLength(5);
      expect(history[0].timestamp).toBeLessThan(history[4].timestamp);
    });
  });

  describe('Error Recovery', () => {
    it('should recover from temporary exchange failures', async () => {
      let callCount = 0;
      mockCoinDCX.getPrice.mockImplementation(async () => {
        callCount++;
        if (callCount < 3) {
          throw new Error('Temporary failure');
        }
        return 87.48;
      });

      mockZebPay.getPrice.mockResolvedValue(89.15);

      bot.start();
      await delay(10000); // Wait for retry attempts

      const opportunities = await bot.scanForOpportunities();
      expect(opportunities).toHaveLength(1);

      bot.stop();
    });

    it('should handle WebSocket disconnections', async () => {
      const mockWs = {
        on: jest.fn(),
        close: jest.fn(),
        readyState: 3 // CLOSED
      };

      bot.connectWebSocket();
      
      // Simulate disconnect
      const errorHandler = mockWs.on.mock.calls.find(call => call[0] === 'error')?.[1];
      errorHandler?.(new Error('Connection lost'));

      await delay(1000);

      expect(bot.getStatus().websocketConnected).toBe(false);
      expect(bot.getStatus().reconnectAttempts).toBeGreaterThan(0);
    });
  });
});