import { PriceStreamService } from '../../../services/websocket/PriceStreamService';
import WebSocket from 'ws';
import { EventEmitter } from 'events';

// Mock WebSocket
jest.mock('ws');

describe('PriceStreamService', () => {
  let service: PriceStreamService;
  let mockWebSocket: any;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Create mock WebSocket
    mockWebSocket = new EventEmitter();
    mockWebSocket.send = jest.fn();
    mockWebSocket.close = jest.fn();
    mockWebSocket.ping = jest.fn();
    mockWebSocket.readyState = WebSocket.OPEN;

    // Mock WebSocket constructor
    (WebSocket as any).mockImplementation(() => mockWebSocket);

    // Create new service instance
    service = new PriceStreamService();
  });

  afterEach(() => {
    service.disconnectAll();
  });

  describe('connectAll', () => {
    it('should connect to all configured exchanges', async () => {
      const connectPromise = service.connectAll();
      
      // Simulate successful connections
      setImmediate(() => {
        mockWebSocket.emit('open');
      });

      await connectPromise;

      const status = service.getConnectionStatus();
      expect(Object.keys(status)).toContain('zebpay');
      expect(Object.keys(status)).toContain('coindcx');
    });

    it('should emit connected event on successful connection', async () => {
      const connectedSpy = jest.fn();
      service.on('connected', connectedSpy);

      const connectPromise = service.connectAll();
      
      setImmediate(() => {
        mockWebSocket.emit('open');
      });

      await connectPromise;

      expect(connectedSpy).toHaveBeenCalledWith(expect.any(String));
    });
  });

  describe('price updates', () => {
    beforeEach(async () => {
      const connectPromise = service.connectAll();
      setImmediate(() => mockWebSocket.emit('open'));
      await connectPromise;
    });

    it('should parse and emit ZebPay price updates', async () => {
      const priceUpdateSpy = jest.fn();
      service.on('priceUpdate', priceUpdateSpy);

      const zebpayMessage = {
        event: 'ticker',
        pair: 'USDT-INR',
        buy: '83.50',
        sell: '84.20',
        volume: '1000000'
      };

      mockWebSocket.emit('message', JSON.stringify(zebpayMessage));

      // Wait for async processing
      await new Promise(resolve => setImmediate(resolve));

      expect(priceUpdateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          exchange: 'zebpay',
          symbol: 'USDT/INR',
          buyPrice: 83.50,
          sellPrice: 84.20,
          volume: 1000000,
          timestamp: expect.any(Date)
        })
      );
    });

    it('should parse and emit CoinDCX price updates', async () => {
      const priceUpdateSpy = jest.fn();
      service.on('priceUpdate', priceUpdateSpy);

      const coindcxMessage = {
        channel: 'ticker',
        market: 'USDTINR',
        bid: '83.45',
        ask: '84.15',
        volume: '2000000',
        timestamp: Date.now()
      };

      mockWebSocket.emit('message', JSON.stringify(coindcxMessage));

      // Wait for async processing
      await new Promise(resolve => setImmediate(resolve));

      expect(priceUpdateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          exchange: 'coindcx',
          symbol: 'USDT/INR',
          buyPrice: 83.45,
          sellPrice: 84.15,
          volume: 2000000,
          timestamp: expect.any(Date)
        })
      );
    });

    it('should handle invalid messages gracefully', async () => {
      const errorSpy = jest.fn();
      service.on('error', errorSpy);

      // Send invalid JSON
      mockWebSocket.emit('message', 'invalid json');

      // Wait for async processing
      await new Promise(resolve => setImmediate(resolve));

      // Should not crash, but may emit error
      expect(service.getConnectionStatus()).toBeDefined();
    });
  });

  describe('arbitrage detection', () => {
    beforeEach(async () => {
      const connectPromise = service.connectAll();
      setImmediate(() => mockWebSocket.emit('open'));
      await connectPromise;
    });

    it('should detect arbitrage opportunities', async () => {
      const arbitrageSpy = jest.fn();
      service.on('arbitrageOpportunity', arbitrageSpy);

      // First update from ZebPay
      const zebpayMessage = {
        event: 'ticker',
        pair: 'USDT-INR',
        buy: '83.00',
        sell: '83.50'
      };

      mockWebSocket.emit('message', JSON.stringify(zebpayMessage));
      await new Promise(resolve => setImmediate(resolve));

      // Second update from CoinDCX with arbitrage opportunity
      const coindcxMessage = {
        channel: 'ticker',
        market: 'USDTINR',
        bid: '84.50',
        ask: '85.00',
        timestamp: Date.now()
      };

      mockWebSocket.emit('message', JSON.stringify(coindcxMessage));
      await new Promise(resolve => setImmediate(resolve));

      expect(arbitrageSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          buyExchange: 'zebpay',
          sellExchange: 'coindcx',
          buyPrice: 83.00,
          sellPrice: 84.50,
          profit: expect.any(Number),
          profitPercent: expect.any(Number),
          volume: 100000,
          timestamp: expect.any(Date)
        })
      );

      // Verify profit calculation
      const opportunity = arbitrageSpy.mock.calls[0][0];
      expect(opportunity.profit).toBeGreaterThan(0);
      expect(opportunity.profitPercent).toBeGreaterThan(0);
    });
  });

  describe('connection management', () => {
    it('should handle connection errors', async () => {
      const errorSpy = jest.fn();
      service.on('error', errorSpy);

      const connectPromise = service.connectAll();
      
      setImmediate(() => {
        mockWebSocket.emit('error', new Error('Connection failed'));
      });

      await connectPromise;

      expect(errorSpy).toHaveBeenCalledWith({
        exchange: expect.any(String),
        error: expect.objectContaining({
          message: 'Connection failed'
        })
      });
    });

    it('should handle connection close and attempt reconnect', async () => {
      const disconnectedSpy = jest.fn();
      service.on('disconnected', disconnectedSpy);

      const connectPromise = service.connectAll();
      setImmediate(() => mockWebSocket.emit('open'));
      await connectPromise;

      // Simulate connection close
      mockWebSocket.emit('close', 1000, 'Normal closure');

      expect(disconnectedSpy).toHaveBeenCalled();
      
      // Should attempt reconnection
      expect(WebSocket).toHaveBeenCalledTimes(3); // Initial + reconnect attempt
    });

    it('should setup heartbeat on connection', async () => {
      jest.useFakeTimers();

      const connectPromise = service.connectAll();
      setImmediate(() => mockWebSocket.emit('open'));
      await connectPromise;

      // Advance timers to trigger heartbeat
      jest.advanceTimersByTime(30000);

      expect(mockWebSocket.ping).toHaveBeenCalled();

      jest.useRealTimers();
    });

    it('should emit maxReconnectReached after max attempts', async () => {
      const maxReconnectSpy = jest.fn();
      service.on('maxReconnectReached', maxReconnectSpy);

      // Set up to fail multiple times
      let attempts = 0;
      (WebSocket as any).mockImplementation(() => {
        attempts++;
        const ws = new EventEmitter();
        ws.send = jest.fn();
        ws.close = jest.fn();
        ws.readyState = WebSocket.CONNECTING;
        
        setImmediate(() => {
          ws.emit('error', new Error('Connection failed'));
          ws.emit('close', 1006, 'Abnormal closure');
        });
        
        return ws;
      });

      // Use fake timers to speed up reconnect delays
      jest.useFakeTimers();

      await service.connectAll();

      // Advance through reconnection attempts
      for (let i = 0; i < 6; i++) {
        jest.advanceTimersByTime(10000 * Math.pow(2, i));
        await Promise.resolve();
      }

      expect(maxReconnectSpy).toHaveBeenCalled();

      jest.useRealTimers();
    });
  });

  describe('getCurrentPrices', () => {
    it('should return current prices map', async () => {
      const connectPromise = service.connectAll();
      setImmediate(() => mockWebSocket.emit('open'));
      await connectPromise;

      // Add some price data
      const zebpayMessage = {
        event: 'ticker',
        pair: 'USDT-INR',
        buy: '83.50',
        sell: '84.20'
      };

      mockWebSocket.emit('message', JSON.stringify(zebpayMessage));
      await new Promise(resolve => setImmediate(resolve));

      const prices = service.getCurrentPrices();
      expect(prices.size).toBeGreaterThan(0);
      expect(prices.get('zebpay')).toEqual(
        expect.objectContaining({
          exchange: 'zebpay',
          buyPrice: 83.50,
          sellPrice: 84.20
        })
      );
    });
  });

  describe('getConnectionStatus', () => {
    it('should return connection status for all exchanges', async () => {
      const connectPromise = service.connectAll();
      setImmediate(() => mockWebSocket.emit('open'));
      await connectPromise;

      const status = service.getConnectionStatus();
      
      expect(status).toHaveProperty('zebpay');
      expect(status).toHaveProperty('coindcx');
      expect(status.zebpay).toBe(true);
      expect(status.coindcx).toBe(true);
    });
  });

  describe('disconnectAll', () => {
    it('should close all connections and clear timers', async () => {
      const connectPromise = service.connectAll();
      setImmediate(() => mockWebSocket.emit('open'));
      await connectPromise;

      service.disconnectAll();

      expect(mockWebSocket.close).toHaveBeenCalled();
      
      const status = service.getConnectionStatus();
      expect(status.zebpay).toBe(false);
      expect(status.coindcx).toBe(false);
    });
  });

  describe('addExchange', () => {
    it('should add and connect to new exchange', async () => {
      const newEndpoint = {
        url: 'wss://test.exchange.com',
        subscribeMessage: { subscribe: 'ticker' },
        parseMessage: async (data: any) => ({
          exchange: 'testexchange',
          symbol: 'USDT/INR',
          buyPrice: 83,
          sellPrice: 84,
          timestamp: new Date()
        }),
        heartbeatInterval: 20000
      };

      service.addExchange('testexchange', newEndpoint);

      // Simulate connection
      setImmediate(() => mockWebSocket.emit('open'));

      // Wait a bit for async operations
      await new Promise(resolve => setTimeout(resolve, 100));

      const status = service.getConnectionStatus();
      expect(status).toHaveProperty('testexchange');
    });
  });
});