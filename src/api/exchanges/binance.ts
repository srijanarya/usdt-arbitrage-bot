import WebSocket from 'ws';
import crypto from 'crypto';
import axios, { AxiosInstance } from 'axios';
import EventEmitter from 'events';

interface BinanceOptions {
  apiKey: string;
  apiSecret: string;
  testMode?: boolean;
}

interface OrderRequest {
  symbol: string;
  side: 'BUY' | 'SELL';
  type: 'LIMIT' | 'MARKET' | 'STOP_LOSS' | 'STOP_LOSS_LIMIT' | 'TAKE_PROFIT' | 'TAKE_PROFIT_LIMIT' | 'LIMIT_MAKER';
  quantity?: number;
  quoteOrderQty?: number; // For market orders using quote asset
  price?: number;
  timeInForce?: 'GTC' | 'IOC' | 'FOK';
  stopPrice?: number;
}

interface Balance {
  asset: string;
  free: string;
  locked: string;
}

interface Ticker {
  symbol: string;
  bidPrice: string;
  bidQty: string;
  askPrice: string;
  askQty: string;
  lastPrice: string;
  count: number;
  volume: string;
  quoteVolume: string;
}

interface OrderBook {
  lastUpdateId: number;
  bids: [string, string][];
  asks: [string, string][];
}

export class BinanceClient extends EventEmitter {
  private ws: WebSocket | null = null;
  private apiKey: string;
  private apiSecret: string;
  private baseURL: string;
  private wsURL: string;
  private reconnectTimeout: number = 1000;
  private maxReconnectAttempts: number = 10;
  private reconnectAttempts: number = 0;
  private rateLimit: number = 50; // Binance allows more requests
  private lastRequest: number[] = [];
  private client: AxiosInstance;
  private pingInterval: NodeJS.Timeout | null = null;
  private isConnected: boolean = false;
  private listenKey: string = '';
  private listenKeyInterval: NodeJS.Timeout | null = null;

  constructor(options: BinanceOptions) {
    super();
    this.apiKey = options.apiKey;
    this.apiSecret = options.apiSecret;
    this.baseURL = options.testMode ? 'https://testnet.binance.vision' : 'https://api.binance.com';
    this.wsURL = options.testMode ? 'wss://testnet.binance.vision/ws' : 'wss://stream.binance.com:9443/ws';
    
    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
        'X-MBX-APIKEY': this.apiKey
      }
    });
  }

  private getTimestamp(): number {
    return Date.now();
  }

  private createSignature(queryString: string): string {
    return crypto
      .createHmac('sha256', this.apiSecret)
      .update(queryString)
      .digest('hex');
  }

  private async makeRequest(method: string, endpoint: string, params: any = {}, signed: boolean = false): Promise<any> {
    if (signed) {
      await this.rateLimitCheck();
    }

    try {
      const config: any = {
        method,
        url: endpoint,
      };

      if (signed) {
        const timestamp = this.getTimestamp();
        const queryParams = {
          ...params,
          timestamp,
          recvWindow: 5000
        };

        const queryString = new URLSearchParams(queryParams as any).toString();
        const signature = this.createSignature(queryString);
        const finalQueryString = `${queryString}&signature=${signature}`;

        if (method === 'GET' || method === 'DELETE') {
          config.url = `${endpoint}?${finalQueryString}`;
        } else {
          config.data = queryParams;
          config.url = `${endpoint}?${finalQueryString}`;
        }
      } else {
        if (method === 'GET' && Object.keys(params).length > 0) {
          config.params = params;
        } else if (method !== 'GET') {
          config.data = params;
        }
      }

      const response = await this.client.request(config);
      return response.data;
    } catch (error: any) {
      if (error.response) {
        throw new Error(`Binance API Error: ${error.response.data.msg || error.response.statusText}`);
      }
      throw error;
    }
  }

  private async rateLimitCheck(): Promise<void> {
    const now = Date.now();
    this.lastRequest = this.lastRequest.filter(ts => now - ts < 1000);
    if (this.lastRequest.length >= this.rateLimit) {
      await new Promise(res => setTimeout(res, 100));
      return this.rateLimitCheck();
    }
    this.lastRequest.push(now);
  }

  // Public API Methods (No authentication required)
  async getTicker(symbol: string = 'BUSDUSDT'): Promise<Ticker> {
    const data = await this.makeRequest('GET', '/api/v3/ticker/24hr', { symbol });
    return data;
  }

  async getOrderBook(symbol: string = 'USDTBUSD', limit: number = 100): Promise<OrderBook> {
    const data = await this.makeRequest('GET', '/api/v3/depth', { symbol, limit });
    return data;
  }

  async getPrice(symbol: string = 'USDTBUSD'): Promise<number> {
    const data = await this.makeRequest('GET', '/api/v3/ticker/price', { symbol });
    return parseFloat(data.price);
  }

  async getAllPrices(): Promise<any[]> {
    return await this.makeRequest('GET', '/api/v3/ticker/price');
  }

  async getExchangeInfo(): Promise<any> {
    return await this.makeRequest('GET', '/api/v3/exchangeInfo');
  }

  // Authenticated API Methods
  async getAccount(): Promise<any> {
    return await this.makeRequest('GET', '/api/v3/account', {}, true);
  }

  async getBalance(): Promise<Balance[]> {
    const account = await this.getAccount();
    return account.balances.filter((b: Balance) => parseFloat(b.free) > 0 || parseFloat(b.locked) > 0);
  }

  async getUSDTBalance(): Promise<number> {
    const account = await this.getAccount();
    const usdtBalance = account.balances.find((b: Balance) => b.asset === 'USDT');
    return usdtBalance ? parseFloat(usdtBalance.free) : 0;
  }

  async getBUSDBalance(): Promise<number> {
    const account = await this.getAccount();
    const busdBalance = account.balances.find((b: Balance) => b.asset === 'BUSD');
    return busdBalance ? parseFloat(busdBalance.free) : 0;
  }

  async getUSDCBalance(): Promise<number> {
    const account = await this.getAccount();
    const usdcBalance = account.balances.find((b: Balance) => b.asset === 'USDC');
    return usdcBalance ? parseFloat(usdcBalance.free) : 0;
  }

  async createOrder(order: OrderRequest): Promise<any> {
    const orderData: any = {
      symbol: order.symbol,
      side: order.side,
      type: order.type,
    };

    if (order.quantity) {
      orderData.quantity = order.quantity;
    } else if (order.quoteOrderQty) {
      orderData.quoteOrderQty = order.quoteOrderQty;
    }

    if (order.type === 'LIMIT' || order.type === 'LIMIT_MAKER') {
      orderData.price = order.price;
      orderData.timeInForce = order.timeInForce || 'GTC';
    }

    if (order.stopPrice) {
      orderData.stopPrice = order.stopPrice;
    }

    return await this.makeRequest('POST', '/api/v3/order', orderData, true);
  }

  async getOrder(symbol: string, orderId: number): Promise<any> {
    return await this.makeRequest('GET', '/api/v3/order', { symbol, orderId }, true);
  }

  async cancelOrder(symbol: string, orderId: number): Promise<any> {
    return await this.makeRequest('DELETE', '/api/v3/order', { symbol, orderId }, true);
  }

  async getOpenOrders(symbol?: string): Promise<any[]> {
    const params = symbol ? { symbol } : {};
    return await this.makeRequest('GET', '/api/v3/openOrders', params, true);
  }

  async getAllOrders(symbol: string, limit: number = 500): Promise<any[]> {
    return await this.makeRequest('GET', '/api/v3/allOrders', { symbol, limit }, true);
  }

  async getMyTrades(symbol: string, limit: number = 500): Promise<any[]> {
    return await this.makeRequest('GET', '/api/v3/myTrades', { symbol, limit }, true);
  }

  // WebSocket Methods
  async connect() {
    if (this.isConnected) {
      console.log('Already connected to Binance WebSocket');
      return;
    }

    // Create listen key for user data stream
    if (this.apiKey && this.apiSecret) {
      try {
        const response = await this.makeRequest('POST', '/api/v3/userDataStream');
        this.listenKey = response.listenKey;
        
        // Keep listen key alive every 30 minutes
        this.listenKeyInterval = setInterval(async () => {
          try {
            await this.makeRequest('PUT', '/api/v3/userDataStream', { listenKey: this.listenKey });
          } catch (error) {
            console.error('Failed to keep listen key alive:', error);
          }
        }, 30 * 60 * 1000);
      } catch (error) {
        console.error('Failed to create listen key:', error);
      }
    }

    // Connect to combined streams
    const streams = [
      'usdtbusd@ticker',
      'usdtbusd@depth20@100ms',
      'btcusdt@ticker',
      'ethusdt@ticker'
    ];

    if (this.listenKey) {
      streams.push(this.listenKey);
    }

    const streamUrl = `${this.wsURL}/${streams.join('/')}`;
    this.ws = new WebSocket(streamUrl);
    
    this.ws.on('open', () => {
      console.log('Connected to Binance WebSocket');
      this.isConnected = true;
      this.reconnectAttempts = 0;
      this.emit('connected');
      
      // Setup ping to keep connection alive
      this.setupPing();
    });

    this.ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        
        if (message.e === 'executionReport') {
          this.emit('order', message);
        } else if (message.e === 'outboundAccountPosition') {
          this.emit('balance', message);
        } else if (message.e === '24hrTicker') {
          this.emit('ticker', {
            symbol: message.s,
            bidPrice: message.b,
            askPrice: message.a,
            lastPrice: message.c,
            volume: message.v
          });
        } else if (message.lastUpdateId) {
          this.emit('orderbook', message);
        }
      } catch (error) {
        this.emit('error', error);
      }
    });

    this.ws.on('close', () => {
      console.log('Disconnected from Binance WebSocket');
      this.isConnected = false;
      this.clearPing();
      
      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        this.reconnectAttempts++;
        const delay = Math.min(this.reconnectTimeout * Math.pow(2, this.reconnectAttempts - 1), 30000);
        console.log(`Reconnecting in ${delay}ms... (attempt ${this.reconnectAttempts})`);
        setTimeout(() => this.connect(), delay);
      } else {
        this.emit('error', new Error('Max reconnection attempts reached'));
      }
    });

    this.ws.on('error', (err) => {
      console.error('Binance WebSocket error:', err);
      this.emit('error', err);
    });
  }

  disconnect() {
    this.clearPing();
    if (this.listenKeyInterval) {
      clearInterval(this.listenKeyInterval);
      this.listenKeyInterval = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.isConnected = false;
  }

  private setupPing() {
    this.pingInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.ping();
      }
    }, 10 * 60 * 1000); // Ping every 10 minutes
  }

  private clearPing() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  // Helper methods for USDT trading
  async marketBuy(symbol: string, usdtAmount: number): Promise<any> {
    return this.createOrder({
      symbol,
      side: 'BUY',
      type: 'MARKET',
      quoteOrderQty: usdtAmount
    });
  }

  async marketSell(symbol: string, quantity: number): Promise<any> {
    return this.createOrder({
      symbol,
      side: 'SELL',
      type: 'MARKET',
      quantity
    });
  }

  async limitBuy(symbol: string, quantity: number, price: number): Promise<any> {
    return this.createOrder({
      symbol,
      side: 'BUY',
      type: 'LIMIT',
      quantity,
      price,
      timeInForce: 'GTC'
    });
  }

  async limitSell(symbol: string, quantity: number, price: number): Promise<any> {
    return this.createOrder({
      symbol,
      side: 'SELL',
      type: 'LIMIT',
      quantity,
      price,
      timeInForce: 'GTC'
    });
  }

  // Get current price info for common USDT pairs
  async getUSDTBUSDPrice(): Promise<{bid: number, ask: number, last: number}> {
    const ticker = await this.getTicker('USDTBUSD');
    
    return {
      bid: parseFloat(ticker.bidPrice),
      ask: parseFloat(ticker.askPrice),
      last: parseFloat(ticker.lastPrice)
    };
  }

  async getUSDTUSDCPrice(): Promise<{bid: number, ask: number, last: number}> {
    const ticker = await this.getTicker('USDTUSDC');
    
    return {
      bid: parseFloat(ticker.bidPrice),
      ask: parseFloat(ticker.askPrice),
      last: parseFloat(ticker.lastPrice)
    };
  }
}