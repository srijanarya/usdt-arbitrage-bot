import WebSocket from 'ws';
import crypto from 'crypto';
import axios, { AxiosInstance } from 'axios';
import EventEmitter from 'events';

interface KuCoinOptions {
  apiKey: string;
  apiSecret: string;
  passphrase: string;
  testMode?: boolean;
}

interface OrderRequest {
  symbol: string;
  side: 'buy' | 'sell';
  type: 'limit' | 'market';
  size?: number; // Amount to buy/sell
  price?: number; // Price for limit orders
  funds?: number; // Amount of quote currency to use (for market buy)
}

interface Balance {
  currency: string;
  available: string;
  holds: string;
  balance: string;
}

interface Ticker {
  symbol: string;
  buy: string;
  sell: string;
  bestBid: string;
  bestAsk: string;
  price: string;
  time: number;
}

interface OrderBook {
  asks: [string, string][]; // [price, size]
  bids: [string, string][]; // [price, size]
  time: number;
}

export class KuCoinClient extends EventEmitter {
  private ws: WebSocket | null = null;
  private apiKey: string;
  private apiSecret: string;
  private passphrase: string;
  private baseURL: string;
  private wsURL: string = '';
  private reconnectTimeout: number = 1000;
  private maxReconnectAttempts: number = 10;
  private reconnectAttempts: number = 0;
  private rateLimit: number = 30; // requests/sec for private endpoints
  private lastRequest: number[] = [];
  private client: AxiosInstance;
  private pingInterval: NodeJS.Timeout | null = null;
  private isConnected: boolean = false;
  private connectId: string = '';

  constructor(options: KuCoinOptions) {
    super();
    this.apiKey = options.apiKey;
    this.apiSecret = options.apiSecret;
    this.passphrase = options.passphrase;
    this.baseURL = options.testMode ? 'https://openapi-sandbox.kucoin.com' : 'https://api.kucoin.com';
    
    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      }
    });
  }

  private getTimestamp(): string {
    return Date.now().toString();
  }

  private createSignature(method: string, endpoint: string, timestamp: string, body: string = ''): string {
    const signaturePayload = timestamp + method.toUpperCase() + endpoint + body;
    return crypto
      .createHmac('sha256', this.apiSecret)
      .update(signaturePayload)
      .digest('base64');
  }

  private passphraseSignature(): string {
    return crypto
      .createHmac('sha256', this.apiSecret)
      .update(this.passphrase)
      .digest('base64');
  }

  private async makeRequest(method: string, endpoint: string, params?: any, isPrivate: boolean = false): Promise<any> {
    if (isPrivate) {
      await this.rateLimitCheck();
    }

    const timestamp = this.getTimestamp();
    const headers: any = {
      'KC-API-TIMESTAMP': timestamp,
    };

    if (isPrivate) {
      let signatureEndpoint = endpoint;
      let body = '';
      
      if (method === 'GET' && params && Object.keys(params).length > 0) {
        // For GET requests, append query string to endpoint for signature
        const queryString = new URLSearchParams(params).toString();
        signatureEndpoint = `${endpoint}?${queryString}`;
      } else if (method !== 'GET') {
        // For POST/DELETE requests, body is JSON
        body = JSON.stringify(params || {});
      }
      
      const signature = this.createSignature(method, signatureEndpoint, timestamp, body);
      
      headers['KC-API-KEY'] = this.apiKey;
      headers['KC-API-SIGN'] = signature;
      headers['KC-API-PASSPHRASE'] = this.passphraseSignature();
      headers['KC-API-KEY-VERSION'] = '2';
    }

    try {
      const config: any = {
        method,
        url: endpoint,
        headers,
      };

      if (method === 'GET' && params) {
        config.params = params;
      } else if (method !== 'GET' && params) {
        config.data = params;
      }

      const response = await this.client.request(config);
      
      if (response.data.code && response.data.code !== '200000') {
        throw new Error(`KuCoin API Error: ${response.data.msg}`);
      }

      return response.data.data;
    } catch (error: any) {
      if (error.response) {
        throw new Error(`KuCoin API Error: ${error.response.data.msg || error.response.statusText}`);
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
  async getTicker(symbol: string = 'USDT-USDC'): Promise<Ticker> {
    const data = await this.makeRequest('GET', '/api/v1/market/orderbook/level1', { symbol });
    return {
      symbol,
      buy: data.bestBid,
      sell: data.bestAsk,
      bestBid: data.bestBid,
      bestAsk: data.bestAsk,
      price: data.price,
      time: data.time
    };
  }

  async getOrderBook(symbol: string = 'USDT-USDC'): Promise<OrderBook> {
    const data = await this.makeRequest('GET', '/api/v1/market/orderbook/level2_20', { symbol });
    return {
      asks: data.asks,
      bids: data.bids,
      time: data.time
    };
  }

  async get24hrStats(symbol: string = 'USDT-USDC'): Promise<any> {
    return await this.makeRequest('GET', '/api/v1/market/stats', { symbol });
  }

  async getAllTickers(): Promise<any> {
    const data = await this.makeRequest('GET', '/api/v1/market/allTickers');
    return data.ticker;
  }

  // Authenticated API Methods
  async getBalance(): Promise<Balance[]> {
    const accounts = await this.makeRequest('GET', '/api/v1/accounts', { type: 'trade' }, true);
    return accounts;
  }

  async getUSDTBalance(): Promise<number> {
    const balances = await this.getBalance();
    const usdtBalance = balances.find((b: Balance) => b.currency === 'USDT');
    return usdtBalance ? parseFloat(usdtBalance.available) : 0;
  }

  async getUSDCBalance(): Promise<number> {
    const balances = await this.getBalance();
    const usdcBalance = balances.find((b: Balance) => b.currency === 'USDC');
    return usdcBalance ? parseFloat(usdcBalance.available) : 0;
  }

  async createOrder(order: OrderRequest): Promise<any> {
    const orderData: any = {
      clientOid: crypto.randomBytes(16).toString('hex'),
      side: order.side,
      symbol: order.symbol,
      type: order.type,
    };

    if (order.type === 'limit') {
      orderData.price = order.price?.toString();
      orderData.size = order.size?.toString();
    } else if (order.type === 'market') {
      if (order.side === 'buy' && order.funds) {
        orderData.funds = order.funds.toString();
      } else if (order.size) {
        orderData.size = order.size.toString();
      }
    }

    const result = await this.makeRequest('POST', '/api/v1/orders', orderData, true);
    return result;
  }

  async getOrderStatus(orderId: string): Promise<any> {
    return await this.makeRequest('GET', `/api/v1/orders/${orderId}`, null, true);
  }

  async cancelOrder(orderId: string): Promise<any> {
    return await this.makeRequest('DELETE', `/api/v1/orders/${orderId}`, null, true);
  }

  async getActiveOrders(symbol?: string): Promise<any[]> {
    const params = symbol ? { symbol } : {};
    const data = await this.makeRequest('GET', '/api/v1/orders', { ...params, status: 'active' }, true);
    return data.items || [];
  }

  async getTradeHistory(symbol?: string, limit: number = 100): Promise<any[]> {
    const params: any = { limit };
    if (symbol) params.symbol = symbol;
    
    const data = await this.makeRequest('GET', '/api/v1/fills', params, true);
    return data.items || [];
  }

  // WebSocket Connection
  async connect() {
    if (this.isConnected) {
      console.log('Already connected to KuCoin WebSocket');
      return;
    }

    // Get WebSocket connection info
    const wsInfo = await this.getWebSocketInfo();
    this.wsURL = wsInfo.instanceServers[0].endpoint;
    this.connectId = wsInfo.token;

    this.ws = new WebSocket(`${this.wsURL}?token=${this.connectId}`);
    
    this.ws.on('open', () => {
      console.log('Connected to KuCoin WebSocket');
      this.isConnected = true;
      this.reconnectAttempts = 0;
      this.emit('connected');
      
      // Setup ping to keep connection alive
      this.setupPing();
      
      // Subscribe to desired channels
      this.subscribeToTicker('USDT-USDC');
      this.subscribeToOrderBook('USDT-USDC');
    });

    this.ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        
        if (message.type === 'message' && message.topic) {
          if (message.topic.includes('/market/ticker:')) {
            this.emit('ticker', message.data);
          } else if (message.topic.includes('/market/level2:')) {
            this.emit('orderbook', message.data);
          }
        } else if (message.type === 'error') {
          this.emit('error', new Error(message.data || 'WebSocket error'));
        }
      } catch (error) {
        this.emit('error', error);
      }
    });

    this.ws.on('close', () => {
      console.log('Disconnected from KuCoin WebSocket');
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
      console.error('KuCoin WebSocket error:', err);
      this.emit('error', err);
    });
  }

  disconnect() {
    this.clearPing();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.isConnected = false;
  }

  private async getWebSocketInfo(): Promise<any> {
    return await this.makeRequest('POST', '/api/v1/bullet-public');
  }

  private setupPing() {
    this.pingInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({
          type: 'ping',
          id: Date.now().toString()
        }));
      }
    }, 20000); // KuCoin requires ping every 30 seconds, we do it every 20
  }

  private clearPing() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  private subscribeToTicker(symbol: string) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      const subscribeMessage = {
        type: 'subscribe',
        topic: `/market/ticker:${symbol}`,
        id: Date.now().toString(),
        privateChannel: false,
        response: true
      };
      this.ws.send(JSON.stringify(subscribeMessage));
    }
  }

  private subscribeToOrderBook(symbol: string) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      const subscribeMessage = {
        type: 'subscribe',
        topic: `/market/level2:${symbol}`,
        id: Date.now().toString(),
        privateChannel: false,
        response: true
      };
      this.ws.send(JSON.stringify(subscribeMessage));
    }
  }

  // Helper methods for USDT trading
  async marketBuyUSDC(usdtAmount: number): Promise<any> {
    return this.createOrder({
      symbol: 'USDT-USDC',
      side: 'sell', // Sell USDT to get USDC
      type: 'market',
      size: usdtAmount
    });
  }

  async marketSellUSDC(usdcAmount: number): Promise<any> {
    return this.createOrder({
      symbol: 'USDT-USDC',
      side: 'buy', // Buy USDT with USDC
      type: 'market',
      funds: usdcAmount
    });
  }

  async limitBuyUSDC(usdtAmount: number, price: number): Promise<any> {
    return this.createOrder({
      symbol: 'USDT-USDC',
      side: 'sell',
      type: 'limit',
      size: usdtAmount,
      price: price
    });
  }

  async limitSellUSDC(usdcAmount: number, price: number): Promise<any> {
    return this.createOrder({
      symbol: 'USDT-USDC',
      side: 'buy',
      type: 'limit',
      size: usdcAmount / price, // Convert USDC amount to USDT size
      price: price
    });
  }

  // Get current USDT/USDC price info
  async getUSDTUSDCPrice(): Promise<{bid: number, ask: number, last: number}> {
    const ticker = await this.getTicker('USDT-USDC');
    
    return {
      bid: parseFloat(ticker.bestBid),
      ask: parseFloat(ticker.bestAsk),
      last: parseFloat(ticker.price)
    };
  }
}