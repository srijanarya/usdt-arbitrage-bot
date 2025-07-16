import crypto from 'crypto';
import { EnhancedExchangeClient, Ticker, OrderBook } from './enhancedExchangeClient';
import { logger } from '../../utils/logger';

interface BinanceStreamTicker {
  e: string;  // Event type
  E: number;  // Event time
  s: string;  // Symbol
  b: string;  // Best bid price
  B: string;  // Best bid quantity
  a: string;  // Best ask price
  A: string;  // Best ask quantity
  c: string;  // Last price
  v: string;  // Volume
  p: string;  // Price change
  P: string;  // Price change percent
}

interface BinanceStreamDepth {
  e: string;  // Event type
  E: number;  // Event time
  s: string;  // Symbol
  b: [string, string][];  // Bids
  a: [string, string][];  // Asks
}

export class BinanceEnhancedClient extends EnhancedExchangeClient {
  private streamSubscriptions: Map<string, number> = new Map();

  constructor(apiKey: string, apiSecret: string, testMode: boolean = false) {
    super({
      name: 'Binance',
      apiKey,
      apiSecret,
      baseURL: testMode 
        ? 'https://testnet.binance.vision/api/v3'
        : 'https://api.binance.com/api/v3',
      wsURL: testMode
        ? 'wss://testnet.binance.vision/ws'
        : 'wss://stream.binance.com:9443/ws',
      testMode
    });
  }

  protected getAuthHeaders(): any {
    return {
      'X-MBX-APIKEY': this.config.apiKey
    };
  }

  protected createSignature(queryString: string): string {
    return crypto
      .createHmac('sha256', this.config.apiSecret)
      .update(queryString)
      .digest('hex');
  }

  protected handleWebSocketMessage(message: any): void {
    const data = message.data;
    
    if (!data || !data.e) {
      logger.warn(`[${this.config.name}] Unknown message format:`, data);
      return;
    }

    switch (data.e) {
      case '24hrTicker':
        this.handleTickerUpdate(data as BinanceStreamTicker);
        break;
        
      case 'depthUpdate':
        this.handleDepthUpdate(data as BinanceStreamDepth);
        break;
        
      case 'error':
        logger.error(`[${this.config.name}] Stream error:`, data);
        this.emit('streamError', data);
        break;
        
      default:
        logger.debug(`[${this.config.name}] Unhandled message type: ${data.e}`);
    }
  }

  private handleTickerUpdate(data: BinanceStreamTicker): void {
    const ticker: Ticker = {
      symbol: data.s,
      bid: parseFloat(data.b),
      ask: parseFloat(data.a),
      last: parseFloat(data.c),
      volume: parseFloat(data.v),
      change24h: parseFloat(data.P),
      timestamp: new Date(data.E)
    };

    this.updateTickerCache(data.s, ticker);
  }

  private handleDepthUpdate(data: BinanceStreamDepth): void {
    const orderBook: OrderBook = {
      bids: data.b.map(([price, quantity]) => [parseFloat(price), parseFloat(quantity)]),
      asks: data.a.map(([price, quantity]) => [parseFloat(price), parseFloat(quantity)]),
      timestamp: new Date(data.E)
    };

    // Sort bids descending, asks ascending
    orderBook.bids.sort((a, b) => b[0] - a[0]);
    orderBook.asks.sort((a, b) => a[0] - b[0]);

    this.updateOrderBookCache(data.s, orderBook);
  }

  protected subscribeToSymbol(symbol: string): void {
    if (!this.wsManager) {
      logger.error(`[${this.config.name}] WebSocket manager not initialized`);
      return;
    }

    const normalizedSymbol = this.normalizeSymbol(symbol);
    
    // Subscribe to combined stream (ticker + depth)
    const streamName = `${normalizedSymbol.toLowerCase()}@ticker/${normalizedSymbol.toLowerCase()}@depth20`;
    
    const subscribeMessage = {
      method: 'SUBSCRIBE',
      params: [streamName],
      id: Date.now()
    };

    this.wsManager.send(subscribeMessage);
    this.streamSubscriptions.set(normalizedSymbol, subscribeMessage.id);
    
    logger.info(`[${this.config.name}] Subscribed to ${streamName}`);
  }

  async unsubscribe(symbol: string): Promise<void> {
    await super.unsubscribe(symbol);
    
    if (!this.wsManager || !this.wsManager.isConnected()) return;
    
    const normalizedSymbol = this.normalizeSymbol(symbol);
    const streamName = `${normalizedSymbol.toLowerCase()}@ticker/${normalizedSymbol.toLowerCase()}@depth20`;
    
    const unsubscribeMessage = {
      method: 'UNSUBSCRIBE',
      params: [streamName],
      id: Date.now()
    };

    this.wsManager.send(unsubscribeMessage);
    this.streamSubscriptions.delete(normalizedSymbol);
  }

  // REST API methods
  async getTicker(symbol: string): Promise<Ticker> {
    // Check cache first
    const cached = this.getCachedTicker(symbol);
    if (cached && Date.now() - cached.timestamp.getTime() < 1000) {
      return cached;
    }

    try {
      const response = await this.api.get('/ticker/24hr', {
        params: { symbol: this.normalizeSymbol(symbol) }
      });

      const data = response.data;
      const ticker: Ticker = {
        symbol: data.symbol,
        bid: parseFloat(data.bidPrice),
        ask: parseFloat(data.askPrice),
        last: parseFloat(data.lastPrice),
        volume: parseFloat(data.volume),
        change24h: parseFloat(data.priceChangePercent),
        timestamp: new Date()
      };

      this.updateTickerCache(symbol, ticker);
      return ticker;
      
    } catch (error) {
      logger.error(`[${this.config.name}] Error fetching ticker:`, error);
      throw error;
    }
  }

  async getOrderBook(symbol: string, limit: number = 20): Promise<OrderBook> {
    // Check cache first
    const cached = this.getCachedOrderBook(symbol);
    if (cached && Date.now() - cached.timestamp.getTime() < 1000) {
      return cached;
    }

    try {
      const response = await this.api.get('/depth', {
        params: { 
          symbol: this.normalizeSymbol(symbol),
          limit
        }
      });

      const data = response.data;
      const orderBook: OrderBook = {
        bids: data.bids.map(([price, quantity]: string[]) => 
          [parseFloat(price), parseFloat(quantity)]
        ),
        asks: data.asks.map(([price, quantity]: string[]) => 
          [parseFloat(price), parseFloat(quantity)]
        ),
        timestamp: new Date()
      };

      this.updateOrderBookCache(symbol, orderBook);
      return orderBook;
      
    } catch (error) {
      logger.error(`[${this.config.name}] Error fetching order book:`, error);
      throw error;
    }
  }

  async getBalance(asset: string): Promise<{ free: number; locked: number }> {
    try {
      const timestamp = Date.now();
      const queryString = `timestamp=${timestamp}`;
      const signature = this.createSignature(queryString);
      
      const response = await this.api.get('/account', {
        params: {
          timestamp,
          signature
        }
      });

      const balance = response.data.balances.find((b: any) => b.asset === asset);
      
      return {
        free: balance ? parseFloat(balance.free) : 0,
        locked: balance ? parseFloat(balance.locked) : 0
      };
      
    } catch (error) {
      logger.error(`[${this.config.name}] Error fetching balance:`, error);
      throw error;
    }
  }

  async placeOrder(params: {
    symbol: string;
    side: 'BUY' | 'SELL';
    type: 'LIMIT' | 'MARKET';
    quantity?: number;
    price?: number;
    timeInForce?: 'GTC' | 'IOC' | 'FOK';
  }): Promise<any> {
    try {
      const timestamp = Date.now();
      const orderParams: any = {
        symbol: this.normalizeSymbol(params.symbol),
        side: params.side,
        type: params.type,
        timestamp
      };

      if (params.type === 'LIMIT') {
        if (!params.price || !params.quantity) {
          throw new Error('Price and quantity required for limit orders');
        }
        orderParams.price = params.price.toFixed(2);
        orderParams.quantity = params.quantity.toFixed(8);
        orderParams.timeInForce = params.timeInForce || 'GTC';
      } else if (params.type === 'MARKET') {
        if (!params.quantity) {
          throw new Error('Quantity required for market orders');
        }
        orderParams.quantity = params.quantity.toFixed(8);
      }

      const queryString = Object.keys(orderParams)
        .map(key => `${key}=${orderParams[key]}`)
        .join('&');
      
      orderParams.signature = this.createSignature(queryString);

      const response = await this.api.post('/order', null, { params: orderParams });
      
      logger.info(`[${this.config.name}] Order placed:`, response.data);
      this.emit('orderPlaced', response.data);
      
      return response.data;
      
    } catch (error) {
      logger.error(`[${this.config.name}] Error placing order:`, error);
      throw error;
    }
  }

  async cancelOrder(symbol: string, orderId: number): Promise<any> {
    try {
      const timestamp = Date.now();
      const params: any = {
        symbol: this.normalizeSymbol(symbol),
        orderId,
        timestamp
      };

      const queryString = Object.keys(params)
        .map(key => `${key}=${params[key]}`)
        .join('&');
      
      params.signature = this.createSignature(queryString);

      const response = await this.api.delete('/order', { params });
      
      logger.info(`[${this.config.name}] Order cancelled:`, response.data);
      this.emit('orderCancelled', response.data);
      
      return response.data;
      
    } catch (error) {
      logger.error(`[${this.config.name}] Error cancelling order:`, error);
      throw error;
    }
  }

  protected normalizeSymbol(symbol: string): string {
    // Binance uses no separators (e.g., BTCUSDT)
    return symbol.replace(/[-_\/]/g, '').toUpperCase();
  }

  // Additional Binance-specific methods
  async startUserDataStream(): Promise<string> {
    try {
      const response = await this.api.post('/userDataStream');
      const listenKey = response.data.listenKey;
      
      logger.info(`[${this.config.name}] User data stream started: ${listenKey}`);
      
      // Keep alive every 30 minutes
      setInterval(() => {
        this.keepAliveUserDataStream(listenKey);
      }, 30 * 60 * 1000);
      
      return listenKey;
      
    } catch (error) {
      logger.error(`[${this.config.name}] Error starting user data stream:`, error);
      throw error;
    }
  }

  private async keepAliveUserDataStream(listenKey: string): Promise<void> {
    try {
      await this.api.put('/userDataStream', null, {
        params: { listenKey }
      });
      logger.debug(`[${this.config.name}] User data stream kept alive`);
    } catch (error) {
      logger.error(`[${this.config.name}] Error keeping user data stream alive:`, error);
    }
  }

  async getExchangeInfo(): Promise<any> {
    try {
      const response = await this.api.get('/exchangeInfo');
      return response.data;
    } catch (error) {
      logger.error(`[${this.config.name}] Error fetching exchange info:`, error);
      throw error;
    }
  }

  async getKlines(symbol: string, interval: string, limit: number = 500): Promise<any[]> {
    try {
      const response = await this.api.get('/klines', {
        params: {
          symbol: this.normalizeSymbol(symbol),
          interval,
          limit
        }
      });
      
      return response.data.map((k: any[]) => ({
        openTime: k[0],
        open: parseFloat(k[1]),
        high: parseFloat(k[2]),
        low: parseFloat(k[3]),
        close: parseFloat(k[4]),
        volume: parseFloat(k[5]),
        closeTime: k[6],
        quoteVolume: parseFloat(k[7]),
        trades: k[8]
      }));
      
    } catch (error) {
      logger.error(`[${this.config.name}] Error fetching klines:`, error);
      throw error;
    }
  }
}