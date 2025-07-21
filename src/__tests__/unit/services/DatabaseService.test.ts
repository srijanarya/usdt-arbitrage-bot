import { DatabaseService } from '../../../services/database/DatabaseService';
import { Pool } from 'pg';

// Mock pg module
jest.mock('pg', () => {
  const mockClient = {
    query: jest.fn(),
    release: jest.fn(),
  };

  const mockPool = {
    connect: jest.fn().mockResolvedValue(mockClient),
    query: jest.fn(),
    end: jest.fn(),
    on: jest.fn(),
  };

  return {
    Pool: jest.fn(() => mockPool),
  };
});

describe('DatabaseService', () => {
  let service: DatabaseService;
  let mockPool: any;
  let mockClient: any;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Get mock instances
    mockPool = new Pool();
    mockClient = {
      query: jest.fn(),
      release: jest.fn(),
    };
    mockPool.connect.mockResolvedValue(mockClient);

    // Create service instance
    service = new DatabaseService();
  });

  afterEach(async () => {
    await service.close();
  });

  describe('testConnection', () => {
    it('should return true on successful connection', async () => {
      mockClient.query.mockResolvedValue({
        rows: [{ now: new Date() }],
      });

      const result = await service.testConnection();

      expect(result).toBe(true);
      expect(mockPool.connect).toHaveBeenCalled();
      expect(mockClient.query).toHaveBeenCalledWith('SELECT NOW()');
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should return false on connection failure', async () => {
      mockPool.connect.mockRejectedValue(new Error('Connection failed'));

      const result = await service.testConnection();

      expect(result).toBe(false);
    });
  });

  describe('initializeSchema', () => {
    it('should create all required tables', async () => {
      mockClient.query.mockResolvedValue({ rows: [] });

      await service.initializeSchema();

      // Check for table creation queries
      const queries = mockClient.query.mock.calls.map(call => call[0]);
      
      expect(queries).toContain('BEGIN');
      expect(queries.some(q => q.includes('CREATE TABLE IF NOT EXISTS exchanges'))).toBe(true);
      expect(queries.some(q => q.includes('CREATE TABLE IF NOT EXISTS price_history'))).toBe(true);
      expect(queries.some(q => q.includes('CREATE TABLE IF NOT EXISTS arbitrage_opportunities'))).toBe(true);
      expect(queries.some(q => q.includes('CREATE TABLE IF NOT EXISTS trades'))).toBe(true);
      expect(queries.some(q => q.includes('CREATE OR REPLACE VIEW daily_performance'))).toBe(true);
      expect(queries).toContain('COMMIT');
    });

    it('should rollback on error', async () => {
      mockClient.query
        .mockResolvedValueOnce({}) // BEGIN
        .mockRejectedValueOnce(new Error('Schema error'));

      await expect(service.initializeSchema()).rejects.toThrow('Schema error');
      
      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
    });

    it('should insert default exchanges', async () => {
      mockClient.query.mockResolvedValue({ rows: [] });

      await service.initializeSchema();

      const insertQuery = mockClient.query.mock.calls.find(
        call => call[0].includes('INSERT INTO exchanges')
      );

      expect(insertQuery).toBeDefined();
      expect(insertQuery[0]).toContain('zebpay');
      expect(insertQuery[0]).toContain('coindcx');
      expect(insertQuery[0]).toContain('wazirx');
      expect(insertQuery[0]).toContain('coinswitch');
    });
  });

  describe('insertPrice', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should batch price inserts', async () => {
      const priceData = {
        exchange: 'zebpay',
        symbol: 'USDT/INR',
        buyPrice: 83.5,
        sellPrice: 84.2,
        timestamp: new Date(),
      };

      // Insert multiple prices
      for (let i = 0; i < 5; i++) {
        await service.insertPrice(priceData);
      }

      // Batch should not be flushed yet
      expect(mockClient.query).not.toHaveBeenCalled();

      // Advance timer to trigger batch flush
      jest.advanceTimersByTime(5000);

      // Wait for async operations
      await new Promise(resolve => setImmediate(resolve));

      // Now batch should be flushed
      expect(mockClient.query).toHaveBeenCalled();
    });

    it('should flush batch when size limit reached', async () => {
      mockClient.query.mockResolvedValue({ rows: [{ id: 1 }] });

      const priceData = {
        exchange: 'zebpay',
        symbol: 'USDT/INR',
        buyPrice: 83.5,
        sellPrice: 84.2,
        timestamp: new Date(),
      };

      // Insert 100 prices to reach batch size
      for (let i = 0; i < 100; i++) {
        await service.insertPrice(priceData);
      }

      // Wait for async flush
      await new Promise(resolve => setImmediate(resolve));

      expect(mockClient.query).toHaveBeenCalled();
    });
  });

  describe('saveArbitrageOpportunity', () => {
    it('should save opportunity and return ID', async () => {
      mockClient.query
        .mockResolvedValueOnce({ rows: [{ id: 1 }] }) // buy exchange
        .mockResolvedValueOnce({ rows: [{ id: 2 }] }) // sell exchange
        .mockResolvedValueOnce({ rows: [{ id: 123 }] }); // insert

      const opportunity = {
        buyExchange: 'zebpay',
        sellExchange: 'coindcx',
        buyPrice: 83.5,
        sellPrice: 84.2,
        profit: 500,
        profitPercent: 0.5,
        volume: 100000,
        timestamp: new Date(),
      };

      const id = await service.saveArbitrageOpportunity(opportunity);

      expect(id).toBe(123);
      expect(mockClient.query).toHaveBeenCalledTimes(3);
    });

    it('should throw error if exchange not found', async () => {
      mockClient.query.mockResolvedValue({ rows: [] });

      const opportunity = {
        buyExchange: 'unknown',
        sellExchange: 'coindcx',
        buyPrice: 83.5,
        sellPrice: 84.2,
        profit: 500,
        profitPercent: 0.5,
        volume: 100000,
        timestamp: new Date(),
      };

      await expect(service.saveArbitrageOpportunity(opportunity))
        .rejects.toThrow('Exchange not found');
    });
  });

  describe('getRecentOpportunities', () => {
    it('should return recent opportunities with exchange names', async () => {
      const mockData = [
        {
          id: 1,
          buy_exchange: 'zebpay',
          sell_exchange: 'coindcx',
          profit: 500,
          profit_percent: 0.5,
          detected_at: new Date(),
        },
      ];

      mockPool.query.mockResolvedValue({ rows: mockData });

      const opportunities = await service.getRecentOpportunities(5);

      expect(opportunities).toEqual(mockData);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('JOIN exchanges'),
        [5]
      );
    });
  });

  describe('getDailyPerformance', () => {
    it('should return daily performance metrics', async () => {
      const mockData = [
        {
          date: new Date(),
          opportunities_count: 10,
          avg_profit_percent: 0.5,
          total_potential_profit: 5000,
        },
      ];

      mockPool.query.mockResolvedValue({ rows: mockData });

      const performance = await service.getDailyPerformance(7);

      expect(performance).toEqual(mockData);
      expect(mockPool.query).toHaveBeenCalledWith(
        'SELECT * FROM daily_performance LIMIT $1',
        [7]
      );
    });
  });

  describe('getLatestPrices', () => {
    it('should return latest prices for all exchanges', async () => {
      const mockData = [
        {
          exchange: 'zebpay',
          buy_price: 83.5,
          sell_price: 84.2,
          timestamp: new Date(),
        },
        {
          exchange: 'coindcx',
          buy_price: 83.4,
          sell_price: 84.1,
          timestamp: new Date(),
        },
      ];

      mockPool.query.mockResolvedValue({ rows: mockData });

      const prices = await service.getLatestPrices();

      expect(prices).toEqual(mockData);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('DISTINCT ON (e.name)')
      );
    });
  });

  describe('saveTrade', () => {
    it('should save trade record', async () => {
      mockClient.query
        .mockResolvedValueOnce({ rows: [{ id: 1 }] }) // exchange lookup
        .mockResolvedValueOnce({ rows: [{ id: 456 }] }); // insert

      const trade = {
        opportunityId: 123,
        type: 'buy' as const,
        exchangeName: 'zebpay',
        price: 83.5,
        amount: 1000,
        fees: 1.5,
        status: 'completed' as const,
        executedAt: new Date(),
      };

      const id = await service.saveTrade(trade);

      expect(id).toBe(456);
      expect(mockClient.query).toHaveBeenCalledTimes(2);
    });
  });

  describe('cleanupOldData', () => {
    it('should delete old price history records', async () => {
      mockPool.query.mockResolvedValue({ 
        rowCount: 1000,
        rows: Array(1000).fill({ id: 1 })
      });

      await service.cleanupOldData(7);

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM price_history'),
        [7]
      );
    });
  });

  describe('executeQuery', () => {
    it('should execute raw query', async () => {
      const mockResult = { rows: [{ count: 10 }] };
      mockClient.query.mockResolvedValue(mockResult);

      const result = await service.executeQuery(
        'SELECT COUNT(*) FROM trades',
        []
      );

      expect(result).toEqual(mockResult);
      expect(mockClient.query).toHaveBeenCalledWith(
        'SELECT COUNT(*) FROM trades',
        []
      );
      expect(mockClient.release).toHaveBeenCalled();
    });
  });

  describe('close', () => {
    it('should flush batch and close pool', async () => {
      // Add some data to batch
      await service.insertPrice({
        exchange: 'zebpay',
        symbol: 'USDT/INR',
        buyPrice: 83.5,
        sellPrice: 84.2,
        timestamp: new Date(),
      });

      await service.close();

      expect(mockPool.end).toHaveBeenCalled();
    });
  });
});