// READY FOR CURSOR: Press Cmd+K and say "Create CoinDCX WebSocket client with reconnection, HMAC auth, and rate limiting"
import WebSocket from 'ws';
import crypto from 'crypto';
import axios from 'axios';
import EventEmitter from 'events';

interface CoinDCXOptions {
  apiKey: string;
  apiSecret: string;
}

export class CoinDCXClient extends EventEmitter {
  private ws: WebSocket | null = null;
  private apiKey: string;
  private apiSecret: string;
  private reconnectTimeout: number = 1000;
  private rateLimit: number = 10; // requests/sec
  private lastRequest: number[] = [];

  constructor(options: CoinDCXOptions) {
    super();
    this.apiKey = options.apiKey;
    this.apiSecret = options.apiSecret;
  }

  connect() {
    this.ws = new WebSocket('wss://stream.coindcx.com');
    this.ws.on('open', () => {
      this.emit('connected');
      this.subscribeOrderBook();
    });
    this.ws.on('message', (data) => {
      this.emit('orderbook', JSON.parse(data.toString()));
    });
    this.ws.on('close', () => {
      setTimeout(() => this.connect(), this.reconnectTimeout);
    });
    this.ws.on('error', (err) => {
      this.emit('error', err);
    });
  }

  private subscribeOrderBook() {
    if (this.ws) {
      this.ws.send(JSON.stringify({
        event: 'subscribe',
        streams: ['USDTINR@orderbook'],
      }));
    }
  }

  private sign(payload: any) {
    return crypto.createHmac('sha256', this.apiSecret).update(JSON.stringify(payload)).digest('hex');
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

  async getBalance() {
    await this.rateLimitCheck();
    // ... implement authenticated balance fetch
  }

  async createOrder(order: any) {
    await this.rateLimitCheck();
    // ... implement order creation
  }

  async getOrderStatus(orderId: string) {
    await this.rateLimitCheck();
    // ... implement order status fetch
  }
}
