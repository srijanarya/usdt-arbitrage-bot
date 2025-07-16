import { CoinDCXClient } from '../../../src/api/exchanges/coinDCX';
import axios from 'axios';
import crypto from 'crypto';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('CoinDCX Exchange Integration', () => {
  let client: CoinDCXClient;
  const mockApiKey = 'test_api_key';
  const mockApiSecret = 'test_api_secret';

  beforeEach(() => {
    jest.clearAllMocks();
    client = new CoinDCXClient({
      apiKey: mockApiKey,
      apiSecret: mockApiSecret,
    });
  });

  describe('Authentication', () => {
    it('should generate correct signature for requests', () => {
      const payload = { symbol: 'USDTINR', side: 'buy' };
      const timestamp = Date.now();
      
      const signature = client['generateSignature'](payload, timestamp);
      
      const expectedSignature = crypto
        .createHmac('sha256', mockApiSecret)
        .update(JSON.stringify(payload) + timestamp)
        .digest('hex');
      
      expect(signature).toBe(expectedSignature);
    });

    it('should include authentication headers in requests', async () => {
      mockedAxios.create.mockReturnValue(mockedAxios);
      mockedAxios.get.mockResolvedValueOnce({
        data: { price: '87.50' }
      });

      await client.getPrice('USDTINR');

      const call = mockedAxios.get.mock.calls[0];
      expect(call[1]?.headers).toHaveProperty('X-AUTH-APIKEY', mockApiKey);
      expect(call[1]?.headers).toHaveProperty('X-AUTH-SIGNATURE');
    });
  });

  describe('getPrice', () => {
    it('should fetch current USDT/INR price', async () => {
      const mockPrice = '87.50';
      mockedAxios.create.mockReturnValue(mockedAxios);
      mockedAxios.get.mockResolvedValueOnce({
        data: {
          bid: '87.45',
          ask: '87.55',
          last: mockPrice,
        }
      });

      const price = await client.getPrice('USDTINR');

      expect(price).toBe(87.50);
      expect(mockedAxios.get).toHaveBeenCalledWith(
        '/exchange/ticker',
        expect.objectContaining({
          params: { symbol: 'USDTINR' }
        })
      );
    });

    it('should handle API errors gracefully', async () => {
      mockedAxios.create.mockReturnValue(mockedAxios);
      mockedAxios.get.mockRejectedValueOnce(new Error('API Error'));

      await expect(client.getPrice('USDTINR')).rejects.toThrow('API Error');
    });

    it('should handle rate limiting', async () => {
      mockedAxios.create.mockReturnValue(mockedAxios);
      mockedAxios.get.mockRejectedValueOnce({
        response: {
          status: 429,
          data: { message: 'Rate limit exceeded' }
        }
      });

      await expect(client.getPrice('USDTINR')).rejects.toThrow('Rate limit');
    });
  });

  describe('getOrderBook', () => {
    it('should fetch order book data', async () => {
      const mockOrderBook = {
        bids: [
          { price: '87.45', quantity: '1000' },
          { price: '87.44', quantity: '2000' }
        ],
        asks: [
          { price: '87.55', quantity: '1500' },
          { price: '87.56', quantity: '2500' }
        ]
      };

      mockedAxios.create.mockReturnValue(mockedAxios);
      mockedAxios.get.mockResolvedValueOnce({ data: mockOrderBook });

      const orderBook = await client.getOrderBook('USDTINR');

      expect(orderBook).toEqual(mockOrderBook);
      expect(mockedAxios.get).toHaveBeenCalledWith(
        '/exchange/orderbook',
        expect.objectContaining({
          params: { symbol: 'USDTINR' }
        })
      );
    });

    it('should calculate effective price for given volume', async () => {
      const mockOrderBook = {
        bids: [
          { price: '87.45', quantity: '1000' },
          { price: '87.44', quantity: '2000' }
        ],
        asks: [
          { price: '87.55', quantity: '1000' },
          { price: '87.56', quantity: '2000' }
        ]
      };

      mockedAxios.create.mockReturnValue(mockedAxios);
      mockedAxios.get.mockResolvedValueOnce({ data: mockOrderBook });

      const effectivePrice = await client.getEffectivePrice('USDTINR', 1500, 'buy');

      // Should calculate weighted average: (1000 * 87.55 + 500 * 87.56) / 1500
      expect(effectivePrice).toBeCloseTo(87.55333, 2);
    });
  });

  describe('getFees', () => {
    it('should return correct fee structure', async () => {
      const fees = await client.getFees();

      expect(fees).toEqual({
        maker: 0.001,
        taker: 0.001,
        withdrawal: {
          USDT: 1,
          INR: 0
        }
      });
    });

    it('should calculate fees for a trade', async () => {
      const tradeAmount = 50000; // ₹50,000
      const fees = await client.calculateTradeFees(tradeAmount, 'taker');

      expect(fees).toEqual({
        tradingFee: 50, // 0.1% of 50,000
        gst: 9, // 18% of trading fee
        totalFee: 59
      });
    });
  });

  describe('get24hStats', () => {
    it('should fetch 24h market statistics', async () => {
      const mockStats = {
        high: '88.50',
        low: '86.50',
        volume: '1000000',
        change: '1.5',
        lastPrice: '87.50'
      };

      mockedAxios.create.mockReturnValue(mockedAxios);
      mockedAxios.get.mockResolvedValueOnce({ data: mockStats });

      const stats = await client.get24hStats('USDTINR');

      expect(stats).toEqual({
        high: 88.50,
        low: 86.50,
        volume: 1000000,
        changePercent: 1.5,
        lastPrice: 87.50
      });
    });
  });

  describe('Error Handling', () => {
    it('should retry failed requests', async () => {
      mockedAxios.create.mockReturnValue(mockedAxios);
      
      // First call fails, second succeeds
      mockedAxios.get
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({ data: { last: '87.50' } });

      const price = await client.getPrice('USDTINR');

      expect(price).toBe(87.50);
      expect(mockedAxios.get).toHaveBeenCalledTimes(2);
    });

    it('should handle invalid API responses', async () => {
      mockedAxios.create.mockReturnValue(mockedAxios);
      mockedAxios.get.mockResolvedValueOnce({ data: null });

      await expect(client.getPrice('USDTINR')).rejects.toThrow('Invalid response');
    });

    it('should handle maintenance mode', async () => {
      mockedAxios.create.mockReturnValue(mockedAxios);
      mockedAxios.get.mockRejectedValueOnce({
        response: {
          status: 503,
          data: { message: 'Exchange under maintenance' }
        }
      });

      await expect(client.getPrice('USDTINR')).rejects.toThrow('maintenance');
    });
  });

  describe('WebSocket Integration', () => {
    it('should subscribe to price updates', async () => {
      const mockWs = {
        on: jest.fn(),
        send: jest.fn(),
        close: jest.fn(),
      };

      const onPriceUpdate = jest.fn();
      const ws = await client.subscribeToPriceUpdates('USDTINR', onPriceUpdate);

      // Simulate price update
      const priceUpdate = {
        symbol: 'USDTINR',
        price: '87.75',
        timestamp: Date.now()
      };

      // Trigger the message handler
      const messageHandler = mockWs.on.mock.calls.find(call => call[0] === 'message')?.[1];
      messageHandler?.(JSON.stringify(priceUpdate));

      expect(onPriceUpdate).toHaveBeenCalledWith({
        symbol: 'USDTINR',
        price: 87.75,
        timestamp: expect.any(Number)
      });
    });
  });

  describe('Rate Limiting', () => {
    it('should respect rate limits', async () => {
      const startTime = Date.now();
      
      // Make multiple rapid requests
      const promises = Array(5).fill(null).map(() => 
        client.getPrice('USDTINR').catch(() => null)
      );

      await Promise.all(promises);

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should have rate limiting delays
      expect(duration).toBeGreaterThan(100); // At least 100ms for rate limiting
    });
  });
});