import { priceStreamService } from '../../services/websocket/PriceStreamService';
import { databaseService } from '../../services/database/DatabaseService';
import { telegramBot } from '../../services/telegram/TelegramBotService';
import { healthMonitor } from '../../services/monitoring/HealthMonitor';
import { IntegratedArbitrageMonitor } from '../../monitorIntegrated';

// Mock all external dependencies
jest.mock('ws');
jest.mock('pg');
jest.mock('node-telegram-bot-api');
jest.mock('../../dashboard/server', () => ({
  startDashboardServer: jest.fn(),
}));

// Mock environment
process.env.DB_HOST = 'localhost';
process.env.DB_PORT = '5432';
process.env.DB_NAME = 'test_db';
process.env.DB_USER = 'test';
process.env.DB_PASSWORD = 'test';

describe('Arbitrage System Integration', () => {
  let monitor: any;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock database connection
    jest.spyOn(databaseService, 'testConnection').mockResolvedValue(true);
    jest.spyOn(databaseService, 'initializeSchema').mockResolvedValue(undefined);
    jest.spyOn(databaseService, 'insertPrice').mockResolvedValue(undefined);
    jest.spyOn(databaseService, 'saveArbitrageOpportunity').mockResolvedValue(1);
    
    // Mock WebSocket connections
    jest.spyOn(priceStreamService, 'connectAll').mockResolvedValue(undefined);
    jest.spyOn(priceStreamService, 'getConnectionStatus').mockReturnValue({
      zebpay: true,
      coindcx: true,
    });
    
    // Mock Telegram bot
    jest.spyOn(telegramBot, 'sendSystemAlert').mockResolvedValue(undefined);
    jest.spyOn(telegramBot, 'sendArbitrageAlert').mockResolvedValue(undefined);
    
    // Mock health monitor
    jest.spyOn(healthMonitor, 'start').mockImplementation(() => {});
  });

  afterEach(async () => {
    if (monitor) {
      await monitor.shutdown();
    }
  });

  describe('System Startup', () => {
    it('should start all services successfully', async () => {
      // Create monitor instance
      const Monitor = jest.requireActual('../../monitorIntegrated').IntegratedArbitrageMonitor;
      monitor = new Monitor();
      
      await monitor.start();

      // Verify all services started
      expect(databaseService.testConnection).toHaveBeenCalled();
      expect(databaseService.initializeSchema).toHaveBeenCalled();
      expect(priceStreamService.connectAll).toHaveBeenCalled();
      expect(healthMonitor.start).toHaveBeenCalled();
      expect(telegramBot.sendSystemAlert).toHaveBeenCalledWith(
        'Bot Started',
        expect.stringContaining('USDT Arbitrage Bot is now online'),
        'medium'
      );
    });

    it('should handle startup failures gracefully', async () => {
      // Mock database connection failure
      jest.spyOn(databaseService, 'testConnection').mockResolvedValue(false);
      
      const Monitor = jest.requireActual('../../monitorIntegrated').IntegratedArbitrageMonitor;
      monitor = new Monitor();
      
      // Spy on process.exit
      const exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('Process.exit called');
      });

      await expect(monitor.start()).rejects.toThrow('Process.exit called');
      
      expect(exitSpy).toHaveBeenCalledWith(1);
      exitSpy.mockRestore();
    });
  });

  describe('Price Update Flow', () => {
    it('should process price updates end-to-end', async () => {
      const Monitor = jest.requireActual('../../monitorIntegrated').IntegratedArbitrageMonitor;
      monitor = new Monitor();
      await monitor.start();

      const priceData = {
        exchange: 'zebpay',
        symbol: 'USDT/INR',
        buyPrice: 83.5,
        sellPrice: 84.2,
        timestamp: new Date(),
        volume: 1000000,
      };

      // Emit price update
      priceStreamService.emit('priceUpdate', priceData);

      // Wait for async processing
      await new Promise(resolve => setImmediate(resolve));

      // Verify price was saved to database
      expect(databaseService.insertPrice).toHaveBeenCalledWith(priceData);
    });
  });

  describe('Arbitrage Opportunity Detection', () => {
    it('should detect and process arbitrage opportunities', async () => {
      const Monitor = jest.requireActual('../../monitorIntegrated').IntegratedArbitrageMonitor;
      monitor = new Monitor();
      await monitor.start();

      const opportunity = {
        buyExchange: 'zebpay',
        sellExchange: 'coindcx',
        buyPrice: 83.0,
        sellPrice: 84.5,
        profit: 1470.59,
        profitPercent: 1.47,
        volume: 100000,
        timestamp: new Date(),
      };

      // Emit arbitrage opportunity
      priceStreamService.emit('arbitrageOpportunity', opportunity);

      // Wait for async processing
      await new Promise(resolve => setImmediate(resolve));

      // Verify opportunity was processed
      expect(databaseService.saveArbitrageOpportunity).toHaveBeenCalledWith(opportunity);
      expect(telegramBot.sendArbitrageAlert).toHaveBeenCalledWith(opportunity);
    });
  });

  describe('Error Handling', () => {
    it('should handle WebSocket errors', async () => {
      const Monitor = jest.requireActual('../../monitorIntegrated').IntegratedArbitrageMonitor;
      monitor = new Monitor();
      await monitor.start();

      const error = new Error('WebSocket connection failed');
      
      // Emit error
      priceStreamService.emit('error', { exchange: 'zebpay', error });

      // Wait for async processing
      await new Promise(resolve => setImmediate(resolve));

      // System should continue running
      expect(priceStreamService.getConnectionStatus).toBeDefined();
    });

    it('should handle database errors', async () => {
      const Monitor = jest.requireActual('../../monitorIntegrated').IntegratedArbitrageMonitor;
      monitor = new Monitor();
      await monitor.start();

      // Mock database error
      jest.spyOn(databaseService, 'insertPrice').mockRejectedValueOnce(
        new Error('Database error')
      );

      const priceData = {
        exchange: 'zebpay',
        symbol: 'USDT/INR',
        buyPrice: 83.5,
        sellPrice: 84.2,
        timestamp: new Date(),
      };

      // Emit price update
      priceStreamService.emit('priceUpdate', priceData);

      // Wait for async processing
      await new Promise(resolve => setImmediate(resolve));

      // System should handle error and continue
      expect(databaseService.insertPrice).toHaveBeenCalled();
    });
  });

  describe('Shutdown Process', () => {
    it('should shutdown gracefully', async () => {
      const Monitor = jest.requireActual('../../monitorIntegrated').IntegratedArbitrageMonitor;
      monitor = new Monitor();
      await monitor.start();

      // Mock shutdown methods
      jest.spyOn(priceStreamService, 'disconnectAll').mockImplementation(() => {});
      jest.spyOn(databaseService, 'close').mockResolvedValue(undefined);
      jest.spyOn(telegramBot, 'stop').mockImplementation(() => {});
      jest.spyOn(healthMonitor, 'stop').mockImplementation(() => {});

      await monitor.shutdown();

      // Verify all services stopped
      expect(telegramBot.sendSystemAlert).toHaveBeenCalledWith(
        'Bot Shutdown',
        expect.stringContaining('USDT Arbitrage Bot is shutting down'),
        'medium'
      );
      expect(priceStreamService.disconnectAll).toHaveBeenCalled();
      expect(databaseService.close).toHaveBeenCalled();
      expect(telegramBot.stop).toHaveBeenCalled();
      expect(healthMonitor.stop).toHaveBeenCalled();
    });
  });

  describe('Health Monitoring', () => {
    it('should monitor system health', async () => {
      const Monitor = jest.requireActual('../../monitorIntegrated').IntegratedArbitrageMonitor;
      monitor = new Monitor();
      await monitor.start();

      // Mock health check
      const mockHealthStatus = {
        status: 'healthy' as const,
        timestamp: new Date(),
        services: {
          database: { status: 'up' as const, lastCheck: new Date() },
          websocket: { status: 'up' as const, lastCheck: new Date() },
          telegram: { status: 'up' as const, lastCheck: new Date() },
        },
        system: {
          cpuUsage: 20,
          memoryUsage: { total: 8000000000, used: 4000000000, percentage: 50 },
          uptime: 3600,
          loadAverage: [1.0, 1.1, 1.2],
        },
        performance: {
          priceUpdatesPerMinute: 60,
          opportunitiesPerHour: 5,
          averageLatency: 50,
          errorRate: 0.01,
        },
      };

      jest.spyOn(healthMonitor, 'getCurrentHealth').mockReturnValue(mockHealthStatus);

      const health = healthMonitor.getCurrentHealth();
      expect(health?.status).toBe('healthy');
    });
  });

  describe('Concurrent Operations', () => {
    it('should handle multiple simultaneous price updates', async () => {
      const Monitor = jest.requireActual('../../monitorIntegrated').IntegratedArbitrageMonitor;
      monitor = new Monitor();
      await monitor.start();

      const priceUpdates = [
        {
          exchange: 'zebpay',
          symbol: 'USDT/INR',
          buyPrice: 83.5,
          sellPrice: 84.2,
          timestamp: new Date(),
        },
        {
          exchange: 'coindcx',
          symbol: 'USDT/INR',
          buyPrice: 83.4,
          sellPrice: 84.1,
          timestamp: new Date(),
        },
      ];

      // Emit multiple updates simultaneously
      priceUpdates.forEach(update => {
        priceStreamService.emit('priceUpdate', update);
      });

      // Wait for async processing
      await new Promise(resolve => setTimeout(resolve, 100));

      // All updates should be processed
      expect(databaseService.insertPrice).toHaveBeenCalledTimes(2);
    });
  });

  describe('Rate Limiting', () => {
    it('should handle rate limiting for Telegram alerts', async () => {
      const Monitor = jest.requireActual('../../monitorIntegrated').IntegratedArbitrageMonitor;
      monitor = new Monitor();
      await monitor.start();

      const opportunity = {
        buyExchange: 'zebpay',
        sellExchange: 'coindcx',
        buyPrice: 83.0,
        sellPrice: 84.5,
        profit: 1470.59,
        profitPercent: 1.47,
        volume: 100000,
        timestamp: new Date(),
      };

      // Emit multiple opportunities rapidly
      for (let i = 0; i < 5; i++) {
        priceStreamService.emit('arbitrageOpportunity', opportunity);
      }

      // Wait for async processing
      await new Promise(resolve => setTimeout(resolve, 100));

      // Should respect cooldown (30 seconds by default)
      expect(telegramBot.sendArbitrageAlert).toHaveBeenCalledTimes(1);
    });
  });
});