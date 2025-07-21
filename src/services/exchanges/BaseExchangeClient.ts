import axios, { AxiosInstance } from 'axios';
import crypto from 'crypto';
import { EventEmitter } from 'events';
import chalk from 'chalk';

export interface OrderRequest {
  pair: string;
  type: 'buy' | 'sell';
  orderType: 'market' | 'limit';
  quantity: number;
  price?: number;
}

export interface OrderResponse {
  id: string;
  status: 'pending' | 'partial' | 'completed' | 'cancelled';
  executedQty: number;
  executedPrice: number;
  fee: number;
  timestamp: number;
}

export interface Balance {
  currency: string;
  available: number;
  locked: number;
  total: number;
}

export interface DepositAddress {
  currency: string;
  address: string;
  network: string;
  memo?: string;
}

export interface WithdrawalRequest {
  currency: string;
  amount: number;
  address: string;
  network: string;
  memo?: string;
}

export interface WithdrawalResponse {
  id: string;
  txId?: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  amount: number;
  fee: number;
}

export abstract class BaseExchangeClient extends EventEmitter {
  protected apiKey: string;
  protected apiSecret: string;
  protected baseURL: string;
  protected client: AxiosInstance;
  protected rateLimiter: Map<string, number> = new Map();

  constructor(apiKey: string, apiSecret: string, baseURL: string) {
    super();
    this.apiKey = apiKey;
    this.apiSecret = apiSecret;
    this.baseURL = baseURL;
    
    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json'
      }
    });

    this.setupInterceptors();
  }

  /**
   * Setup axios interceptors for logging and error handling
   */
  private setupInterceptors() {
    // Request interceptor
    this.client.interceptors.request.use(
      (config) => {
        // Add authentication headers
        config.headers = this.addAuthHeaders(config);
        
        // Rate limiting check
        if (!this.checkRateLimit(config.url || '')) {
          throw new Error('RATE_LIMIT_EXCEEDED');
        }
        
        console.log(chalk.gray(`${config.method?.toUpperCase()} ${config.url}`));
        return config;
      },
      (error) => {
        console.error(chalk.red('Request error:', error.message));
        return Promise.reject(error);
      }
    );

    // Response interceptor
    this.client.interceptors.response.use(
      (response) => {
        this.updateRateLimit(response.config.url || '');
        return response;
      },
      (error) => {
        if (error.response) {
          const { status, data } = error.response;
          console.error(chalk.red(`API Error [${status}]:`, data.message || data));
          
          // Handle specific error codes
          switch (status) {
            case 401:
              this.emit('error', new Error('UNAUTHORIZED'));
              break;
            case 429:
              this.emit('error', new Error('RATE_LIMIT'));
              break;
            case 503:
              this.emit('error', new Error('SERVICE_UNAVAILABLE'));
              break;
          }
        }
        return Promise.reject(error);
      }
    );
  }

  /**
   * Add authentication headers (to be implemented by each exchange)
   */
  protected abstract addAuthHeaders(config: any): any;

  /**
   * Sign request (exchange-specific implementation)
   */
  protected abstract signRequest(params: any): string;

  /**
   * Create order
   */
  abstract createOrder(order: OrderRequest): Promise<OrderResponse>;

  /**
   * Cancel order
   */
  abstract cancelOrder(orderId: string, pair: string): Promise<boolean>;

  /**
   * Get order status
   */
  abstract getOrderStatus(orderId: string, pair: string): Promise<OrderResponse>;

  /**
   * Get account balance
   */
  abstract getBalance(currency?: string): Promise<Balance[]>;

  /**
   * Get deposit address
   */
  abstract getDepositAddress(currency: string, network: string): Promise<DepositAddress>;

  /**
   * Create withdrawal
   */
  abstract createWithdrawal(withdrawal: WithdrawalRequest): Promise<WithdrawalResponse>;

  /**
   * Get withdrawal status
   */
  abstract getWithdrawalStatus(withdrawalId: string): Promise<WithdrawalResponse>;

  /**
   * Wait for order completion with timeout
   */
  async waitForOrderCompletion(orderId: string, pair: string, timeout: number = 60000): Promise<OrderResponse> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      const order = await this.getOrderStatus(orderId, pair);
      
      if (order.status === 'completed' || order.status === 'cancelled') {
        return order;
      }
      
      // Wait before next check
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    throw new Error('ORDER_TIMEOUT');
  }

  /**
   * Check rate limits
   */
  protected checkRateLimit(endpoint: string): boolean {
    const key = this.getRateLimitKey(endpoint);
    const lastCall = this.rateLimiter.get(key) || 0;
    const now = Date.now();
    
    // Default: 10 requests per second per endpoint
    const minInterval = 100; // milliseconds
    
    return now - lastCall >= minInterval;
  }

  /**
   * Update rate limit tracker
   */
  protected updateRateLimit(endpoint: string) {
    const key = this.getRateLimitKey(endpoint);
    this.rateLimiter.set(key, Date.now());
  }

  /**
   * Get rate limit key for endpoint
   */
  protected getRateLimitKey(endpoint: string): string {
    // Extract endpoint path for rate limiting
    const url = new URL(endpoint, this.baseURL);
    return url.pathname;
  }

  /**
   * Generate signature for request (common HMAC-SHA256 implementation)
   */
  protected generateSignature(data: string): string {
    return crypto
      .createHmac('sha256', this.apiSecret)
      .update(data)
      .digest('hex');
  }

  /**
   * Format timestamp
   */
  protected getTimestamp(): number {
    return Date.now();
  }

  /**
   * Handle common errors
   */
  protected handleError(error: any): never {
    if (error.response) {
      const { status, data } = error.response;
      
      switch (status) {
        case 400:
          throw new Error(`BAD_REQUEST: ${data.message || 'Invalid request'}`);
        case 401:
          throw new Error('UNAUTHORIZED: Invalid API credentials');
        case 403:
          throw new Error('FORBIDDEN: Insufficient permissions');
        case 404:
          throw new Error('NOT_FOUND: Resource not found');
        case 429:
          throw new Error('RATE_LIMIT: Too many requests');
        case 500:
          throw new Error('SERVER_ERROR: Exchange server error');
        case 503:
          throw new Error('SERVICE_UNAVAILABLE: Exchange maintenance');
        default:
          throw new Error(`API_ERROR: ${data.message || 'Unknown error'}`);
      }
    } else if (error.code === 'ECONNREFUSED') {
      throw new Error('CONNECTION_ERROR: Cannot connect to exchange');
    } else if (error.code === 'ETIMEDOUT') {
      throw new Error('TIMEOUT: Request timed out');
    } else {
      throw error;
    }
  }

  /**
   * Validate order parameters
   */
  protected validateOrder(order: OrderRequest) {
    if (!order.pair || !order.type || !order.orderType || !order.quantity) {
      throw new Error('INVALID_ORDER: Missing required parameters');
    }
    
    if (order.quantity <= 0) {
      throw new Error('INVALID_ORDER: Quantity must be positive');
    }
    
    if (order.orderType === 'limit' && !order.price) {
      throw new Error('INVALID_ORDER: Limit order requires price');
    }
    
    if (order.price && order.price <= 0) {
      throw new Error('INVALID_ORDER: Price must be positive');
    }
  }

  /**
   * Calculate order fees (to be overridden by specific exchanges)
   */
  protected calculateFee(amount: number, price: number, isMaker: boolean = false): number {
    // Default: 0.25% fee
    const feeRate = isMaker ? 0.0025 : 0.0025;
    return amount * price * feeRate;
  }

  /**
   * Format currency pair (exchange-specific formatting)
   */
  protected formatPair(pair: string): string {
    // Default format: USDT-INR -> USDTINR
    return pair.replace('-', '');
  }

  /**
   * Parse API response (with error checking)
   */
  protected parseResponse<T>(response: any): T {
    if (!response || !response.data) {
      throw new Error('INVALID_RESPONSE: Empty response from exchange');
    }
    
    // Check for error in response
    if (response.data.error || response.data.code) {
      throw new Error(`API_ERROR: ${response.data.message || response.data.error}`);
    }
    
    return response.data;
  }
}