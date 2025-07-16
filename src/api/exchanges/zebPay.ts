import axios, { AxiosInstance } from 'axios';
import crypto from 'crypto';
import EventEmitter from 'events';
import dotenv from 'dotenv';

dotenv.config();

interface ZebPayTicker {
  market: string;
  buy: string;
  sell: string;
  volume: string;
  priceChange: string;
}

export class ZebPayClient extends EventEmitter {
  private apiKey: string;
  private apiSecret: string;
  private baseURL = 'https://api.zebpay.com';
  private client: AxiosInstance;

  constructor() {
    super();
    this.apiKey = process.env.ZEBPAY_API_KEY || '';
    this.apiSecret = process.env.ZEBPAY_API_SECRET || '';
    
    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: 10000,
    });
  }

  private generateSignature(method: string, endpoint: string, body: string = ''): string {
    const timestamp = Date.now().toString();
    const message = timestamp + method + endpoint + body;
    const signature = crypto
      .createHmac('sha256', this.apiSecret)
      .update(message)
      .digest('hex');
    
    return signature;
  }

  private getHeaders(method: string, endpoint: string, body: string = '') {
    const timestamp = Date.now().toString();
    const signature = this.generateSignature(method, endpoint, body);
    
    return {
      'X-API-KEY': this.apiKey,
      'X-SIGNATURE': signature,
      'X-TIMESTAMP': timestamp,
      'Content-Type': 'application/json'
    };
  }

  async getPrice(pair: string): Promise<number> {
    try {
      const response = await this.client.get<ZebPayTicker>(`/api/v1/market/ticker/${pair}`);
      return parseFloat(response.data.market);
    } catch (error) {
      console.error('ZebPay getPrice error:', error);
      throw error;
    }
  }

  async getTicker(pair: string): Promise<ZebPayTicker> {
    try {
      const response = await this.client.get<ZebPayTicker>(`/api/v1/market/ticker/${pair}`);
      return response.data;
    } catch (error) {
      console.error('ZebPay getTicker error:', error);
      throw error;
    }
  }

  async getOrderBook(pair: string): Promise<any> {
    try {
      const response = await this.client.get(`/api/v1/market/depth/${pair}`);
      return response.data;
    } catch (error) {
      console.error('ZebPay getOrderBook error:', error);
      throw error;
    }
  }

  async getBalance(): Promise<any> {
    const endpoint = '/api/v1/user/wallet';
    try {
      const response = await this.client.get(endpoint, {
        headers: this.getHeaders('GET', endpoint)
      });
      return response.data;
    } catch (error) {
      console.error('ZebPay getBalance error:', error);
      throw error;
    }
  }

  async createOrder(order: {
    pair: string;
    type: 'buy' | 'sell';
    price: number;
    quantity: number;
  }): Promise<any> {
    const endpoint = '/api/v1/user/orders';
    const body = JSON.stringify(order);
    
    try {
      const response = await this.client.post(endpoint, body, {
        headers: this.getHeaders('POST', endpoint, body)
      });
      return response.data;
    } catch (error) {
      console.error('ZebPay createOrder error:', error);
      throw error;
    }
  }

  async getOrderStatus(orderId: string): Promise<any> {
    const endpoint = `/api/v1/user/orders/${orderId}`;
    try {
      const response = await this.client.get(endpoint, {
        headers: this.getHeaders('GET', endpoint)
      });
      return response.data;
    } catch (error) {
      console.error('ZebPay getOrderStatus error:', error);
      throw error;
    }
  }

  // Start price monitoring
  startPriceMonitoring(pair: string, interval: number = 5000): void {
    console.log(`Starting ZebPay price monitoring for ${pair}`);
    
    setInterval(async () => {
      try {
        const ticker = await this.getTicker(pair);
        this.emit('priceUpdate', {
          exchange: 'ZebPay',
          pair: pair,
          bid: parseFloat(ticker.buy),
          ask: parseFloat(ticker.sell),
          last: parseFloat(ticker.market),
          timestamp: new Date()
        });
      } catch (error) {
        this.emit('error', error);
      }
    }, interval);
  }
}

export default ZebPayClient;