import { ZebPayClient } from '../../../src/api/exchanges/zebPay';
import axios from 'axios';
import crypto from 'crypto';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('ZebPay Exchange Integration', () => {
  let client: ZebPayClient;
  const mockApiKey = 'test_zebpay_key';
  const mockApiSecret = 'test_zebpay_secret';

  beforeEach(() => {
    jest.clearAllMocks();
    client = new ZebPayClient({
      apiKey: mockApiKey,
      apiSecret: mockApiSecret,
    });
  });

  describe('Authentication', () => {
    it('should generate correct HMAC signature', () => {
      const method = 'GET';
      const path = '/api/v1/ticker';
      const timestamp = Date.now();
      const body = '';

      const signature = client['generateSignature'](method, path, timestamp, body);

      const message = `${method}${path}${timestamp}${body}`;
      const expectedSignature = crypto
        .createHmac('sha256', mockApiSecret)
        .update(message)
        .digest('hex');

      expect(signature).toBe(expectedSignature);
    });

    it('should include required headers in authenticated requests', async () => {
      mockedAxios.create.mockReturnValue(mockedAxios);
      mockedAxios.get.mockResolvedValueOnce({
        data: { USDT_INR: { last: '89.15' } }
      });

      await client.getPrice('USDT_INR');

      const call = mockedAxios.get.mock.calls[0];
      expect(call[1]?.headers).toHaveProperty('X-API-KEY', mockApiKey);
      expect(call[1]?.headers).toHaveProperty('X-SIGNATURE');
      expect(call[1]?.headers).toHaveProperty('X-TIMESTAMP');
    });
  });

  describe('getPrice', () => {
    it('should fetch current USDT/INR price', async () => {
      mockedAxios.create.mockReturnValue(mockedAxios);
      mockedAxios.get.mockResolvedValueOnce({
        data: {
          USDT_INR: {
            last: '89.15',
            bid: '89.10',
            ask: '89.20',
            volume24h: '500000'
          }
        }
      });

      const price = await client.getPrice('USDT_INR');

      expect(price).toBe(89.15);
      expect(mockedAxios.get).toHaveBeenCalledWith(
        '/api/v1/ticker/USDT_INR',
        expect.any(Object)
      );
    });

    it('should handle different trading pairs', async () => {
      mockedAxios.create.mockReturnValue(mockedAxios);
      mockedAxios.get.mockResolvedValueOnce({
        data: {
          BTC_INR: {
            last: '3500000',
            bid: '3495000',
            ask: '3505000'
          }
        }
      });

      const price = await client.getPrice('BTC_INR');

      expect(price).toBe(3500000);
    });

    it('should handle API errors', async () => {
      mockedAxios.create.mockReturnValue(mockedAxios);
      mockedAxios.get.mockRejectedValueOnce({
        response: {
          status: 404,
          data: { error: 'Trading pair not found' }
        }
      });

      await expect(client.getPrice('INVALID_PAIR')).rejects.toThrow('Trading pair not found');
    });
  });

  describe('getOrderBook', () => {
    it('should fetch order book with proper depth', async () => {
      const mockOrderBook = {
        timestamp: Date.now(),
        bids: [
          ['89.10', '1000'],
          ['89.09', '2000'],
          ['89.08', '3000']
        ],
        asks: [
          ['89.20', '1500'],
          ['89.21', '2500'],
          ['89.22', '3500']
        ]
      };

      mockedAxios.create.mockReturnValue(mockedAxios);
      mockedAxios.get.mockResolvedValueOnce({ data: mockOrderBook });

      const orderBook = await client.getOrderBook('USDT_INR', 10);

      expect(orderBook).toEqual({
        bids: [
          { price: 89.10, quantity: 1000 },
          { price: 89.09, quantity: 2000 },
          { price: 89.08, quantity: 3000 }
        ],
        asks: [
          { price: 89.20, quantity: 1500 },
          { price: 89.21, quantity: 2500 },
          { price: 89.22, quantity: 3500 }
        ],
        timestamp: mockOrderBook.timestamp
      });

      expect(mockedAxios.get).toHaveBeenCalledWith(
        '/api/v1/orderbook/USDT_INR',
        expect.objectContaining({
          params: { depth: 10 }
        })
      );
    });

    it('should calculate market impact for large orders', async () => {
      const mockOrderBook = {
        bids: [
          ['89.10', '500'],
          ['89.09', '1000'],
          ['89.08', '2000']
        ],
        asks: [
          ['89.20', '500'],
          ['89.21', '1000'],
          ['89.22', '2000']
        ]
      };

      mockedAxios.create.mockReturnValue(mockedAxios);
      mockedAxios.get.mockResolvedValueOnce({ data: mockOrderBook });

      const impact = await client.calculateMarketImpact('USDT_INR', 2000, 'buy');

      // Buying 2000 USDT: 500 @ 89.20, 1000 @ 89.21, 500 @ 89.22
      const expectedPrice = (500 * 89.20 + 1000 * 89.21 + 500 * 89.22) / 2000;
      expect(impact.averagePrice).toBeCloseTo(expectedPrice, 2);
      expect(impact.slippage).toBeCloseTo((expectedPrice - 89.20) / 89.20 * 100, 2);
    });
  });

  describe('getFees', () => {
    it('should return correct fee structure', async () => {
      mockedAxios.create.mockReturnValue(mockedAxios);
      mockedAxios.get.mockResolvedValueOnce({
        data: {
          trading: {
            maker: '0.0015',
            taker: '0.0025'
          },
          withdrawal: {
            USDT: {
              fee: '2',
              minAmount: '10'
            },
            INR: {
              fee: '0',
              minAmount: '100'
            }
          }
        }
      });

      const fees = await client.getFees();

      expect(fees).toEqual({
        maker: 0.0015,
        taker: 0.0025,
        withdrawal: {
          USDT: {
            fee: 2,
            minAmount: 10
          },
          INR: {
            fee: 0,
            minAmount: 100
          }
        }
      });
    });

    it('should calculate total fees including GST', async () => {
      const tradeAmount = 100000; // ₹1,00,000
      const fees = await client.calculateTotalFees(tradeAmount, 'taker');

      // Taker fee: 0.25% = ₹250
      // GST: 18% of ₹250 = ₹45
      // Total: ₹295
      expect(fees).toEqual({
        tradingFee: 250,
        gst: 45,
        totalFee: 295
      });
    });
  });

  describe('getTradingLimits', () => {
    it('should fetch trading limits for user', async () => {
      mockedAxios.create.mockReturnValue(mockedAxios);
      mockedAxios.get.mockResolvedValueOnce({
        data: {
          USDT_INR: {
            minOrderSize: '10',
            maxOrderSize: '10000',
            tickSize: '0.01',
            minOrderValue: '890'
          }
        }
      });

      const limits = await client.getTradingLimits('USDT_INR');

      expect(limits).toEqual({
        minOrderSize: 10,
        maxOrderSize: 10000,
        tickSize: 0.01,
        minOrderValue: 890
      });
    });
  });

  describe('WebSocket Integration', () => {
    it('should handle real-time price updates', (done) => {
      const mockWs = {
        on: jest.fn(),
        send: jest.fn(),
        close: jest.fn(),
        readyState: 1
      };

      const priceHandler = jest.fn((data) => {
        expect(data).toEqual({
          symbol: 'USDT_INR',
          price: 89.25,
          bid: 89.20,
          ask: 89.30,
          timestamp: expect.any(Number)
        });
        done();
      });

      client.subscribeToPriceStream('USDT_INR', priceHandler);

      // Simulate WebSocket message
      const messageHandler = mockWs.on.mock.calls.find(call => call[0] === 'message')?.[1];
      messageHandler?.(JSON.stringify({
        type: 'ticker',
        data: {
          symbol: 'USDT_INR',
          last: '89.25',
          bid: '89.20',
          ask: '89.30',
          timestamp: Date.now()
        }
      }));
    });

    it('should handle WebSocket reconnection', async () => {
      const mockWs = {
        on: jest.fn(),
        close: jest.fn(),
        readyState: 3 // CLOSED
      };

      const reconnectSpy = jest.spyOn(client as any, 'reconnectWebSocket');
      
      await client.subscribeToPriceStream('USDT_INR', jest.fn());

      // Simulate disconnect
      const closeHandler = mockWs.on.mock.calls.find(call => call[0] === 'close')?.[1];
      closeHandler?.();

      expect(reconnectSpy).toHaveBeenCalled();
    });
  });

  describe('Error Handling and Retries', () => {
    it('should implement exponential backoff for retries', async () => {
      mockedAxios.create.mockReturnValue(mockedAxios);
      
      let attemptCount = 0;
      mockedAxios.get.mockImplementation(() => {
        attemptCount++;
        if (attemptCount < 3) {
          return Promise.reject(new Error('Network error'));
        }
        return Promise.resolve({ data: { USDT_INR: { last: '89.15' } } });
      });

      const startTime = Date.now();
      const price = await client.getPrice('USDT_INR');
      const duration = Date.now() - startTime;

      expect(price).toBe(89.15);
      expect(attemptCount).toBe(3);
      expect(duration).toBeGreaterThan(200); // At least 2 retry delays
    });

    it('should handle rate limit errors with retry', async () => {
      mockedAxios.create.mockReturnValue(mockedAxios);
      
      mockedAxios.get
        .mockRejectedValueOnce({
          response: {
            status: 429,
            headers: { 'retry-after': '2' }
          }
        })
        .mockResolvedValueOnce({
          data: { USDT_INR: { last: '89.15' } }
        });

      const price = await client.getPrice('USDT_INR');

      expect(price).toBe(89.15);
      expect(mockedAxios.get).toHaveBeenCalledTimes(2);
    });
  });

  describe('Data Validation', () => {
    it('should validate price data', async () => {
      mockedAxios.create.mockReturnValue(mockedAxios);
      mockedAxios.get.mockResolvedValueOnce({
        data: { USDT_INR: { last: '-89.15' } } // Invalid negative price
      });

      await expect(client.getPrice('USDT_INR')).rejects.toThrow('Invalid price data');
    });

    it('should validate order book data', async () => {
      mockedAxios.create.mockReturnValue(mockedAxios);
      mockedAxios.get.mockResolvedValueOnce({
        data: {
          bids: [['not-a-number', '1000']], // Invalid price format
          asks: [['89.20', '1000']]
        }
      });

      await expect(client.getOrderBook('USDT_INR')).rejects.toThrow('Invalid order book data');
    });
  });
});