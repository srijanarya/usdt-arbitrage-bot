import { HealthMonitor } from '../../../services/monitoring/HealthMonitor';
import { databaseService } from '../../../services/database/DatabaseService';
import { priceStreamService } from '../../../services/websocket/PriceStreamService';
import { telegramBot } from '../../../services/telegram/TelegramBotService';
import os from 'os';

// Mock dependencies
jest.mock('../../../services/database/DatabaseService', () => ({
  databaseService: {
    testConnection: jest.fn(),
    getLatestPrices: jest.fn(),
  },
}));

jest.mock('../../../services/websocket/PriceStreamService', () => ({
  priceStreamService: {
    getConnectionStatus: jest.fn(),
    getCurrentPrices: jest.fn(),
    on: jest.fn(),
  },
}));

jest.mock('../../../services/telegram/TelegramBotService', () => ({
  telegramBot: {
    isAlertActive: jest.fn(),
    sendSystemAlert: jest.fn(),
  },
}));

// Mock os module
jest.mock('os', () => ({
  cpus: jest.fn(),
  totalmem: jest.fn(),
  freemem: jest.fn(),
  loadavg: jest.fn(),
}));

describe('HealthMonitor', () => {
  let monitor: HealthMonitor;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    
    // Reset singleton
    (HealthMonitor as any).instance = null;
    monitor = HealthMonitor.getInstance();

    // Setup default mocks
    (databaseService.testConnection as jest.Mock).mockResolvedValue(true);
    (databaseService.getLatestPrices as jest.Mock).mockResolvedValue([]);
    (priceStreamService.getConnectionStatus as jest.Mock).mockReturnValue({
      zebpay: true,
      coindcx: true,
    });
    (telegramBot.isAlertActive as jest.Mock).mockReturnValue(true);
    
    // Mock OS stats
    (os.cpus as jest.Mock).mockReturnValue([
      { times: { user: 100, nice: 0, sys: 50, idle: 850, irq: 0 } },
    ]);
    (os.totalmem as jest.Mock).mockReturnValue(8 * 1024 * 1024 * 1024); // 8GB
    (os.freemem as jest.Mock).mockReturnValue(4 * 1024 * 1024 * 1024); // 4GB
    (os.loadavg as jest.Mock).mockReturnValue([1.0, 1.5, 2.0]);
  });

  afterEach(() => {
    monitor.stop();
    jest.useRealTimers();
  });

  describe('start', () => {
    it('should start health monitoring', () => {
      const healthCheckSpy = jest.fn();
      monitor.on('healthCheck', healthCheckSpy);

      monitor.start(1000); // 1 second interval for testing

      // Initial check should happen immediately
      expect(healthCheckSpy).not.toHaveBeenCalled();

      // Advance timer to trigger first check
      jest.advanceTimersByTime(100);
      
      expect(healthCheckSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          status: expect.any(String),
          timestamp: expect.any(Date),
          services: expect.any(Object),
          system: expect.any(Object),
          performance: expect.any(Object),
        })
      );
    });

    it('should not start multiple times', () => {
      monitor.start(1000);
      const firstInterval = (monitor as any).checkInterval;
      
      monitor.start(1000);
      const secondInterval = (monitor as any).checkInterval;
      
      expect(firstInterval).toBe(secondInterval);
    });
  });

  describe('stop', () => {
    it('should stop health monitoring', () => {
      monitor.start(1000);
      expect((monitor as any).checkInterval).toBeTruthy();
      
      monitor.stop();
      expect((monitor as any).checkInterval).toBeNull();
    });
  });

  describe('health checks', () => {
    it('should check database health', async () => {
      (databaseService.testConnection as jest.Mock).mockResolvedValue(true);
      (databaseService.getLatestPrices as jest.Mock).mockResolvedValue([]);

      const result = await monitor.forceCheck();

      expect(result.services.database.status).toBe('up');
      expect(databaseService.testConnection).toHaveBeenCalled();
    });

    it('should detect database issues', async () => {
      (databaseService.testConnection as jest.Mock).mockResolvedValue(false);

      const result = await monitor.forceCheck();

      expect(result.services.database.status).toBe('down');
      expect(result.status).not.toBe('healthy');
    });

    it('should check WebSocket health', async () => {
      (priceStreamService.getConnectionStatus as jest.Mock).mockReturnValue({
        zebpay: true,
        coindcx: true,
      });

      const result = await monitor.forceCheck();

      expect(result.services.websocket.status).toBe('up');
    });

    it('should detect partial WebSocket connectivity', async () => {
      (priceStreamService.getConnectionStatus as jest.Mock).mockReturnValue({
        zebpay: true,
        coindcx: false,
      });

      const result = await monitor.forceCheck();

      expect(result.services.websocket.status).toBe('degraded');
      expect(result.status).toBe('degraded');
    });

    it('should detect complete WebSocket failure', async () => {
      (priceStreamService.getConnectionStatus as jest.Mock).mockReturnValue({
        zebpay: false,
        coindcx: false,
      });

      const result = await monitor.forceCheck();

      expect(result.services.websocket.status).toBe('down');
      expect(result.status).toBe('unhealthy');
    });

    it('should check Telegram health', async () => {
      (telegramBot.isAlertActive as jest.Mock).mockReturnValue(true);

      const result = await monitor.forceCheck();

      expect(result.services.telegram.status).toBe('up');
    });

    it('should detect Telegram issues', async () => {
      (telegramBot.isAlertActive as jest.Mock).mockReturnValue(false);

      const result = await monitor.forceCheck();

      expect(result.services.telegram.status).toBe('degraded');
    });
  });

  describe('system health', () => {
    it('should monitor CPU usage', async () => {
      const result = await monitor.forceCheck();

      expect(result.system.cpuUsage).toBeDefined();
      expect(result.system.cpuUsage).toBeGreaterThanOrEqual(0);
      expect(result.system.cpuUsage).toBeLessThanOrEqual(100);
    });

    it('should monitor memory usage', async () => {
      const result = await monitor.forceCheck();

      expect(result.system.memoryUsage).toBeDefined();
      expect(result.system.memoryUsage.total).toBe(8 * 1024 * 1024 * 1024);
      expect(result.system.memoryUsage.used).toBe(4 * 1024 * 1024 * 1024);
      expect(result.system.memoryUsage.percentage).toBe(50);
    });

    it('should monitor system uptime', async () => {
      jest.spyOn(process, 'uptime').mockReturnValue(3600); // 1 hour

      const result = await monitor.forceCheck();

      expect(result.system.uptime).toBe(3600);
    });

    it('should monitor load average', async () => {
      const result = await monitor.forceCheck();

      expect(result.system.loadAverage).toEqual([1.0, 1.5, 2.0]);
    });
  });

  describe('performance metrics', () => {
    it('should track price updates per minute', () => {
      monitor.start(1000);

      // Simulate price updates
      for (let i = 0; i < 10; i++) {
        (monitor as any).metrics.priceUpdates.push(Date.now());
      }

      const stats = monitor.getCurrentHealth();
      expect(stats?.performance.priceUpdatesPerMinute).toBe(10);
    });

    it('should track opportunities per hour', () => {
      monitor.start(1000);

      // Simulate opportunities
      for (let i = 0; i < 5; i++) {
        (monitor as any).metrics.opportunities.push(Date.now());
      }

      const stats = monitor.getCurrentHealth();
      expect(stats?.performance.opportunitiesPerHour).toBe(5);
    });

    it('should track average latency', () => {
      monitor.recordLatency(50);
      monitor.recordLatency(100);
      monitor.recordLatency(150);

      const stats = monitor.getCurrentHealth();
      expect(stats?.performance.averageLatency).toBe(100);
    });

    it('should calculate error rate', () => {
      monitor.start(1000);

      // Simulate some activity
      for (let i = 0; i < 100; i++) {
        (monitor as any).metrics.priceUpdates.push(Date.now());
      }
      
      // Simulate errors
      for (let i = 0; i < 5; i++) {
        (monitor as any).metrics.errors.push(Date.now());
      }

      const stats = monitor.getCurrentHealth();
      expect(stats?.performance.errorRate).toBe(5); // 5% error rate
    });
  });

  describe('status changes', () => {
    it('should detect and alert on status changes', async () => {
      // First check - healthy
      (databaseService.testConnection as jest.Mock).mockResolvedValue(true);
      await monitor.forceCheck();

      // Second check - degraded
      (priceStreamService.getConnectionStatus as jest.Mock).mockReturnValue({
        zebpay: true,
        coindcx: false,
      });
      await monitor.forceCheck();

      expect(telegramBot.sendSystemAlert).toHaveBeenCalledWith(
        'Health Status Change',
        expect.stringContaining('healthy → ⚠️ degraded'),
        'medium'
      );
    });

    it('should alert on critical status', async () => {
      // First check - healthy
      await monitor.forceCheck();

      // Second check - unhealthy
      (databaseService.testConnection as jest.Mock).mockResolvedValue(false);
      (priceStreamService.getConnectionStatus as jest.Mock).mockReturnValue({
        zebpay: false,
        coindcx: false,
      });
      await monitor.forceCheck();

      expect(telegramBot.sendSystemAlert).toHaveBeenCalledWith(
        'Health Status Change',
        expect.stringContaining('healthy → 🚨 unhealthy'),
        'high'
      );
    });
  });

  describe('health score calculation', () => {
    it('should calculate correct health score for all services up', async () => {
      const result = await monitor.forceCheck();
      expect(result.status).toBe('healthy');
    });

    it('should calculate degraded score for partial failures', async () => {
      (priceStreamService.getConnectionStatus as jest.Mock).mockReturnValue({
        zebpay: true,
        coindcx: false,
      });

      const result = await monitor.forceCheck();
      expect(result.status).toBe('degraded');
    });

    it('should calculate unhealthy score for critical failures', async () => {
      (databaseService.testConnection as jest.Mock).mockResolvedValue(false);
      (priceStreamService.getConnectionStatus as jest.Mock).mockReturnValue({
        zebpay: false,
        coindcx: false,
      });

      const result = await monitor.forceCheck();
      expect(result.status).toBe('unhealthy');
    });
  });

  describe('getCurrentHealth', () => {
    it('should return null before first check', () => {
      const health = monitor.getCurrentHealth();
      expect(health).toBeNull();
    });

    it('should return last health status', async () => {
      await monitor.forceCheck();
      const health = monitor.getCurrentHealth();
      
      expect(health).toBeDefined();
      expect(health?.status).toBeDefined();
      expect(health?.timestamp).toBeInstanceOf(Date);
    });
  });

  describe('metrics collection', () => {
    it('should setup event listeners for metrics', () => {
      const onSpy = priceStreamService.on as jest.Mock;
      
      // Create new instance to trigger setup
      (HealthMonitor as any).instance = null;
      const newMonitor = HealthMonitor.getInstance();
      
      expect(onSpy).toHaveBeenCalledWith('priceUpdate', expect.any(Function));
      expect(onSpy).toHaveBeenCalledWith('arbitrageOpportunity', expect.any(Function));
    });

    it('should clean old metrics', () => {
      monitor.start(1000);

      // Add old metrics
      const oldTime = Date.now() - 90 * 60 * 1000; // 90 minutes ago
      (monitor as any).metrics.priceUpdates = Array(100).fill(oldTime);
      (monitor as any).metrics.opportunities = Array(50).fill(oldTime);
      
      // Add recent metrics
      const recentTime = Date.now();
      (monitor as any).metrics.priceUpdates.push(recentTime);
      (monitor as any).metrics.opportunities.push(recentTime);

      // Force metrics calculation
      const health = monitor.getCurrentHealth();
      
      expect(health?.performance.priceUpdatesPerMinute).toBe(1);
      expect(health?.performance.opportunitiesPerHour).toBe(1);
    });
  });
});