import WebSocket from 'ws';
import crypto from 'crypto';
import axios, { AxiosInstance } from 'axios';
import EventEmitter from 'events';

interface CoinSwitchOptions {
  apiKey: string;
  apiSecret: string;
  testMode?: boolean;
}

interface OrderRequest {
  symbol: string;
  side: 'buy' | 'sell';
  type: 'limit' | 'market';
  quantity: number;
  price?: number;
}

interface Balance {
  currency: string;
  balance: number;
  locked_balance: number;
}

interface Ticker {
  symbol: string;
  bid: string;
  ask: string;
  last: string;
  volume: string;
  high: string;
  low: string;
  change: string;
  change_percent: string;
}

interface OrderBook {
  bids: [string, string][];
  asks: [string, string][];
  timestamp: number;
}

export class CoinSwitchClient extends EventEmitter {
  private ws: WebSocket | null = null;
  private apiKey: string;
  private apiSecret: string;
  private baseURL: string;
  private wsURL: string;
  private reconnectTimeout: number = 1000;
  private maxReconnectAttempts: number = 10;
  private reconnectAttempts: number = 0;
  private rateLimit: number = 10; // requests/sec
  private lastRequest: number[] = [];
  private client: AxiosInstance;
  private pingInterval: NodeJS.Timeout | null = null;
  private isConnected: boolean = false;

  constructor(options: CoinSwitchOptions) {
    super();
    this.apiKey = options.apiKey;
    this.apiSecret = options.apiSecret;
    this.baseURL = options.testMode ? 'https://coinswitch.co' : 'https://coinswitch.co';
    this.wsURL = options.testMode ? 'wss://ws.coinswitch.co/pro/realtime-rates-socket/spot/coinswitchx' : 'wss://ws.coinswitch.co/pro/realtime-rates-socket/spot/coinswitchx';
    
    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }

  connect() {
    if (this.isConnected) {
      console.log('Already connected to CoinSwitch WebSocket');
      return;
    }

    this.ws = new WebSocket(this.wsURL);
    
    this.ws.on('open', () => {
      console.log('Connected to CoinSwitch WebSocket');
      this.isConnected = true;
      this.reconnectAttempts = 0;
      this.emit('connected');
      
      // Subscribe to USDT/INR streams
      this.subscribeToTicker();
      this.subscribeToOrderBook();
      
      // Setup ping to keep connection alive
      this.setupPing();
    });

    this.ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        
        if (message.type === 'ticker' && message.symbol === 'USDT/INR') {
          this.emit('ticker', message.data);
        } else if (message.type === 'orderbook' && message.symbol === 'USDT/INR') {
          this.emit('orderbook', message.data);
        } else if (message.type === 'error') {
          this.emit('error', new Error(message.message || 'WebSocket error'));
        }
      } catch (error) {
        this.emit('error', error);
      }
    });

    this.ws.on('close', () => {
      console.log('Disconnected from CoinSwitch WebSocket');
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
      console.error('CoinSwitch WebSocket error:', err);
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

  private setupPing() {
    this.pingInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'ping' }));
      }
    }, 30000);
  }

  private clearPing() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  private subscribeToTicker() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      const subscribeMessage = {
        type: 'subscribe',
        channel: 'ticker',
        symbol: 'USDT/INR'
      };
      this.ws.send(JSON.stringify(subscribeMessage));
    }
  }

  private subscribeToOrderBook() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      const subscribeMessage = {
        type: 'subscribe',
        channel: 'orderbook',
        symbol: 'USDT/INR'
      };
      this.ws.send(JSON.stringify(subscribeMessage));
    }
  }

  private getTimestamp(): number {
    return Date.now();
  }

  private createSignature(payload: string): string {
    return crypto
      .createHmac('sha256', this.apiSecret)
      .update(payload)
      .digest('hex');
  }

  private async makeAuthenticatedRequest(method: string, path: string, body?: any): Promise<any> {
    await this.rateLimitCheck();

    const timestamp = this.getTimestamp().toString();
    const requestBody = body ? JSON.stringify(body) : '';
    
    // Create payload for signature: timestamp + method + path + body
    const payloadToSign = timestamp + method.toUpperCase() + path + requestBody;
    const signature = this.createSignature(payloadToSign);

    const headers = {
      'X-AUTH-APIKEY': this.apiKey,
      'X-AUTH-SIGNATURE': signature,
      'X-AUTH-TIMESTAMP': timestamp,
      'Content-Type': 'application/json'
    };

    try {
      const response = await this.client.request({
        method,
        url: path,
        data: body,
        headers
      });

      return response.data;
    } catch (error: any) {
      if (error.response) {
        throw new Error(`CoinSwitch API Error: ${error.response.data.message || error.response.statusText}`);
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
  async getTicker(symbol: string = 'USDT/INR'): Promise<Ticker> {
    await this.rateLimitCheck();
    
    try {
      const response = await this.client.get('/trade/api/v2/24hr/ticker', {
        params: { symbol }
      });
      return response.data;
    } catch (error) {
      throw new Error(`Failed to get ticker: ${error}`);
    }
  }

  async getOrderBook(symbol: string = 'USDT/INR', limit: number = 100): Promise<OrderBook> {
    await this.rateLimitCheck();
    
    try {
      const response = await this.client.get('/trade/api/v2/depth', {
        params: { 
          symbol,
          limit 
        }
      });
      return response.data;
    } catch (error) {
      throw new Error(`Failed to get order book: ${error}`);
    }
  }

  async getAllTickers(): Promise<Ticker[]> {
    await this.rateLimitCheck();
    
    try {
      const response = await this.client.get('/trade/api/v2/24hr/ticker');
      return response.data;
    } catch (error) {
      throw new Error(`Failed to get all tickers: ${error}`);
    }
  }

  // Authenticated API Methods
  async getBalance(): Promise<Balance[]> {
    const result = await this.makeAuthenticatedRequest('GET', '/user/balances');
    return result.balances || [];
  }

  async getUSDTBalance(): Promise<number> {
    const balances = await this.getBalance();
    const usdtBalance = balances.find((b: Balance) => b.currency === 'USDT');
    return usdtBalance ? parseFloat(usdtBalance.balance.toString()) : 0;
  }

  async getINRBalance(): Promise<number> {
    const balances = await this.getBalance();
    const inrBalance = balances.find((b: Balance) => b.currency === 'INR');
    return inrBalance ? parseFloat(inrBalance.balance.toString()) : 0;
  }

  async createOrder(order: OrderRequest): Promise<any> {
    const orderData = {
      symbol: order.symbol,
      side: order.side,
      type: order.type,
      quantity: order.quantity,
      ...(order.price && { price: order.price })
    };

    const result = await this.makeAuthenticatedRequest('POST', '/user/orders', orderData);
    return result;
  }

  async getOrderStatus(orderId: string): Promise<any> {
    const result = await this.makeAuthenticatedRequest('GET', `/user/orders/${orderId}`);
    return result;
  }

  async cancelOrder(orderId: string): Promise<any> {
    const result = await this.makeAuthenticatedRequest('DELETE', `/user/orders/${orderId}`);
    return result;
  }

  async getOpenOrders(symbol?: string): Promise<any[]> {
    const params = symbol ? `?symbol=${symbol}` : '';
    const orders = await this.makeAuthenticatedRequest('GET', `/user/orders/open${params}`);
    return orders.orders || [];
  }

  async getTradeHistory(symbol?: string, limit: number = 100): Promise<any[]> {
    const params = new URLSearchParams();
    if (symbol) params.append('symbol', symbol);
    params.append('limit', limit.toString());
    
    const queryString = params.toString();
    const path = `/user/trades${queryString ? '?' + queryString : ''}`;
    
    const trades = await this.makeAuthenticatedRequest('GET', path);
    return trades.trades || [];
  }

  // Helper methods for USDT/INR trading
  async marketBuy(quantity: number): Promise<any> {
    return this.createOrder({
      symbol: 'USDT/INR',
      side: 'buy',
      type: 'market',
      quantity
    });
  }

  async marketSell(quantity: number): Promise<any> {
    return this.createOrder({
      symbol: 'USDT/INR',
      side: 'sell',
      type: 'market',
      quantity
    });
  }

  async limitBuy(quantity: number, price: number): Promise<any> {
    return this.createOrder({
      symbol: 'USDT/INR',
      side: 'buy',
      type: 'limit',
      quantity,
      price
    });
  }

  async limitSell(quantity: number, price: number): Promise<any> {
    return this.createOrder({
      symbol: 'USDT/INR',
      side: 'sell',
      type: 'limit',
      quantity,
      price
    });
  }

  // Get current USDT/INR price info
  async getUSDTINRPrice(): Promise<{bid: number, ask: number, last: number}> {
    const ticker = await this.getTicker('USDT/INR');
    
    return {
      bid: parseFloat(ticker.bid || '0'),
      ask: parseFloat(ticker.ask || '0'),
      last: parseFloat(ticker.last || '0')
    };
  }
}