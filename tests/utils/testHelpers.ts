import { EventEmitter } from 'events';

export class MockExchangeClient extends EventEmitter {
  private prices: Map<string, number> = new Map();
  private orders: any[] = [];
  public connected: boolean = false;

  constructor(private exchange: string) {
    super();
  }

  async connect() {
    this.connected = true;
    this.emit('connected');
    return true;
  }

  async disconnect() {
    this.connected = false;
    this.emit('disconnected');
  }

  async fetchTicker(symbol: string) {
    const basePrice = this.prices.get(symbol) || 88.5;
    const variance = (Math.random() - 0.5) * 2;
    
    return {
      symbol,
      last: basePrice + variance,
      bid: basePrice + variance - 0.1,
      ask: basePrice + variance + 0.1,
      volume: 10000 + Math.random() * 5000,
      timestamp: Date.now()
    };
  }

  async fetchOrderBook(symbol: string) {
    const basePrice = this.prices.get(symbol) || 88.5;
    
    return {
      bids: Array(10).fill(0).map((_, i) => ({
        price: basePrice - (i * 0.1),
        amount: 100 + Math.random() * 500
      })),
      asks: Array(10).fill(0).map((_, i) => ({
        price: basePrice + (i * 0.1),
        amount: 100 + Math.random() * 500
      })),
      timestamp: Date.now()
    };
  }

  async createOrder(symbol: string, type: string, side: string, amount: number, price?: number) {
    const order = {
      id: `${this.exchange}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      symbol,
      type,
      side,
      amount,
      price: price || (await this.fetchTicker(symbol)).last,
      status: 'open',
      timestamp: Date.now()
    };
    
    this.orders.push(order);
    
    // Simulate order execution
    setTimeout(() => {
      order.status = 'closed';
      this.emit('order_filled', order);
    }, Math.random() * 2000 + 500);
    
    return order;
  }

  async fetchBalance() {
    return {
      USDT: {
        free: 10000 + Math.random() * 5000,
        used: Math.random() * 1000,
        total: 0
      },
      INR: {
        free: 850000 + Math.random() * 100000,
        used: Math.random() * 50000,
        total: 0
      }
    };
  }

  setPrice(symbol: string, price: number) {
    this.prices.set(symbol, price);
  }

  getOrders() {
    return this.orders;
  }

  clearOrders() {
    this.orders = [];
  }
}

export class MockWebSocketClient extends EventEmitter {
  public connected: boolean = false;
  private messageInterval?: NodeJS.Timeout;

  connect() {
    this.connected = true;
    this.emit('open');
    
    // Start sending mock price updates
    this.messageInterval = setInterval(() => {
      if (this.connected) {
        this.emit('message', JSON.stringify({
          type: 'price_update',
          symbol: 'USDT/INR',
          price: 88.5 + (Math.random() - 0.5) * 2,
          timestamp: Date.now()
        }));
      }
    }, 1000);
  }

  disconnect() {
    this.connected = false;
    if (this.messageInterval) {
      clearInterval(this.messageInterval);
    }
    this.emit('close');
  }

  send(data: string) {
    const message = JSON.parse(data);
    
    // Mock responses based on message type
    if (message.type === 'subscribe') {
      setTimeout(() => {
        this.emit('message', JSON.stringify({
          type: 'subscribed',
          channel: message.channel
        }));
      }, 100);
    }
  }
}

export class MockGmailMonitor extends EventEmitter {
  private emails: any[] = [];

  async initialize() {
    return true;
  }

  async startMonitoring() {
    // Simulate random payment emails
    setInterval(() => {
      if (Math.random() > 0.8) {
        const payment = {
          amount: 1000 + Math.random() * 9000,
          sender: `user${Math.floor(Math.random() * 1000)}@example.com`,
          bank: ['HDFC', 'ICICI', 'SBI', 'Axis'][Math.floor(Math.random() * 4)],
          timestamp: new Date(),
          transactionId: `TXN${Date.now()}`
        };
        
        this.emails.push(payment);
        this.emit('payment', payment);
      }
    }, 5000);
  }

  async searchPaymentsByAmount(amount: number, tolerance: number = 0.01) {
    const min = amount * (1 - tolerance);
    const max = amount * (1 + tolerance);
    
    return this.emails.filter(email => 
      email.amount >= min && email.amount <= max
    );
  }

  getEmails() {
    return this.emails;
  }

  clearEmails() {
    this.emails = [];
  }
}

export function generateMockMarketData(hours: number = 24) {
  const data = [];
  const now = Date.now();
  const interval = 60000; // 1 minute
  const basePrice = 88.5;
  
  for (let i = 0; i < hours * 60; i++) {
    const timestamp = now - (i * interval);
    const trend = Math.sin(i / 60) * 2; // Sinusoidal trend
    const noise = (Math.random() - 0.5) * 1; // Random noise
    const price = basePrice + trend + noise;
    
    data.unshift({
      timestamp,
      open: price - 0.1,
      high: price + 0.2,
      low: price - 0.2,
      close: price,
      volume: 1000 + Math.random() * 500
    });
  }
  
  return data;
}

export function generateMockTrades(count: number = 100) {
  const trades = [];
  const startTime = Date.now() - (24 * 60 * 60 * 1000); // 24 hours ago
  
  for (let i = 0; i < count; i++) {
    const isWin = Math.random() > 0.4; // 60% win rate
    const profit = isWin 
      ? 50 + Math.random() * 300 
      : -(30 + Math.random() * 150);
    
    trades.push({
      id: `trade-${i}`,
      timestamp: new Date(startTime + (i * 86400000 / count)),
      pair: 'USDT/INR',
      type: Math.random() > 0.5 ? 'buy' : 'sell',
      amount: 100 + Math.random() * 400,
      price: 88.5 + (Math.random() - 0.5) * 2,
      profit,
      status: 'completed'
    });
  }
  
  return trades;
}

export async function waitForCondition(
  condition: () => boolean | Promise<boolean>,
  timeout: number = 5000,
  interval: number = 100
): Promise<void> {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeout) {
    if (await condition()) {
      return;
    }
    await new Promise(resolve => setTimeout(resolve, interval));
  }
  
  throw new Error('Condition not met within timeout');
}

export function createMockDatabase() {
  const data = new Map<string, any>();
  
  return {
    async get(key: string) {
      return data.get(key);
    },
    
    async set(key: string, value: any) {
      data.set(key, value);
    },
    
    async delete(key: string) {
      data.delete(key);
    },
    
    async clear() {
      data.clear();
    },
    
    async find(filter: (value: any) => boolean) {
      const results = [];
      for (const value of data.values()) {
        if (filter(value)) {
          results.push(value);
        }
      }
      return results;
    }
  };
}

// Test data generators
export const testData = {
  validApiKeys: {
    binance: {
      apiKey: 'test-binance-api-key-1234567890',
      apiSecret: 'test-binance-api-secret-0987654321'
    },
    coindcx: {
      apiKey: 'test-coindcx-api-key-1234567890',
      apiSecret: 'test-coindcx-api-secret-0987654321'
    },
    zebpay: {
      apiKey: 'test-zebpay-api-key-1234567890',
      apiSecret: 'test-zebpay-api-secret-0987654321'
    }
  },
  
  mockPrices: {
    'USDT/INR': {
      binance: 88.50,
      coindcx: 88.65,
      zebpay: 88.70,
      p2pBuy: 88.20,
      p2pSell: 91.50
    }
  },
  
  mockOrder: {
    symbol: 'USDT/INR',
    type: 'limit',
    side: 'buy',
    amount: 100,
    price: 88.50
  },
  
  mockPayment: {
    amount: 8850,
    sender: 'test@example.com',
    bank: 'HDFC',
    transactionId: 'TXN123456789',
    timestamp: new Date()
  }
};