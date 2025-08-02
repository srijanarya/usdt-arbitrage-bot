import { EventEmitter } from 'events';
import { promisify } from 'util';
import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import { RetryMechanism } from '../../utils/RetryMechanism';
import { errorHandler, ErrorType, ErrorSeverity } from '../../utils/errors/ErrorHandler';

interface ApiCall {
  id: string;
  method: string;
  url: string;
  config?: AxiosRequestConfig;
  exchange: string;
  priority: 'high' | 'medium' | 'low';
  retryable: boolean;
  timeout: number;
}

interface ApiResponse {
  id: string;
  success: boolean;
  data?: any;
  error?: Error;
  duration: number;
  retryCount: number;
}

interface RateLimitConfig {
  maxRequestsPerSecond: number;
  burstCapacity: number;
  windowSize: number;
}

/**
 * Optimized API manager with connection pooling, concurrent processing,
 * and intelligent rate limiting
 */
export class ConcurrentApiManager extends EventEmitter {
  private clients: Map<string, AxiosInstance> = new Map();
  private requestQueues: Map<string, ApiCall[]> = new Map();
  private rateLimiters: Map<string, TokenBucket> = new Map();
  private activeRequests: Map<string, Set<string>> = new Map();
  private connectionPools: Map<string, ConnectionPool> = new Map();
  
  private readonly defaultConfig: AxiosRequestConfig = {
    timeout: 10000,
    maxRedirects: 3,
    validateStatus: (status) => status < 500, // Don't retry client errors
  };

  private readonly exchangeConfigs: Map<string, RateLimitConfig> = new Map([
    ['binance', { maxRequestsPerSecond: 50, burstCapacity: 100, windowSize: 1000 }],
    ['zebpay', { maxRequestsPerSecond: 10, burstCapacity: 20, windowSize: 1000 }],
    ['coindcx', { maxRequestsPerSecond: 20, burstCapacity: 40, windowSize: 1000 }],
    ['coinswitch', { maxRequestsPerSecond: 15, burstCapacity: 30, windowSize: 1000 }],
  ]);

  constructor() {
    super();
    this.initializeClients();
    this.startRequestProcessor();
  }

  /**
   * Initialize HTTP clients with optimized settings
   */
  private initializeClients(): void {
    for (const [exchange, rateLimitConfig] of this.exchangeConfigs) {
      // Create optimized HTTP client
      const client = axios.create({
        ...this.defaultConfig,
        // Connection pooling configuration
        httpAgent: new (require('http').Agent)({
          keepAlive: true,
          maxSockets: 20,
          maxFreeSockets: 5,
          timeout: 60000,
          freeSocketTimeout: 30000,
        }),
        httpsAgent: new (require('https').Agent)({
          keepAlive: true,
          maxSockets: 20,
          maxFreeSockets: 5,
          timeout: 60000,
          freeSocketTimeout: 30000,
        }),
      });

      // Add response interceptor for monitoring
      client.interceptors.response.use(
        (response) => {
          this.emit('apiSuccess', { exchange, url: response.config.url });
          return response;
        },
        (error) => {
          this.emit('apiError', { exchange, error: error.message });
          return Promise.reject(error);
        }
      );

      this.clients.set(exchange, client);
      this.requestQueues.set(exchange, []);
      this.activeRequests.set(exchange, new Set());
      this.rateLimiters.set(exchange, new TokenBucket(rateLimitConfig));
      this.connectionPools.set(exchange, new ConnectionPool(exchange, 10));
    }
  }

  /**
   * Execute multiple API calls concurrently with intelligent batching
   */
  async executeConcurrent<T>(
    calls: Array<{
      exchange: string;
      method: string;
      url: string;
      config?: AxiosRequestConfig;
      priority?: 'high' | 'medium' | 'low';
      retryable?: boolean;
    }>
  ): Promise<Array<ApiResponse>> {
    const apiCalls: ApiCall[] = calls.map((call, index) => ({
      id: `concurrent_${Date.now()}_${index}`,
      method: call.method,
      url: call.url,
      config: call.config,
      exchange: call.exchange,
      priority: call.priority || 'medium',
      retryable: call.retryable !== false,
      timeout: call.config?.timeout || 10000,
    }));

    // Sort by priority (high first)
    apiCalls.sort((a, b) => {
      const priorities = { high: 3, medium: 2, low: 1 };
      return priorities[b.priority] - priorities[a.priority];
    });

    // Group by exchange to respect rate limits
    const groupedCalls = new Map<string, ApiCall[]>();
    for (const call of apiCalls) {
      if (!groupedCalls.has(call.exchange)) {
        groupedCalls.set(call.exchange, []);
      }
      groupedCalls.get(call.exchange)!.push(call);
    }

    // Execute all groups concurrently
    const promises = Array.from(groupedCalls.entries()).map(
      ([exchange, exchangeCalls]) => this.executeExchangeCalls(exchange, exchangeCalls)
    );

    const results = await Promise.all(promises);
    return results.flat();
  }

  /**
   * Execute price fetching for all exchanges simultaneously
   */
  async fetchAllPricesConcurrent(): Promise<Map<string, any>> {
    const calls = [
      {
        exchange: 'binance',
        method: 'GET',
        url: '/api/v3/ticker/price',
        config: { params: { symbol: 'USDTBUSD' } },
        priority: 'high' as const,
      },
      {
        exchange: 'zebpay',
        method: 'GET',
        url: '/pro/v1/market/USDT-INR/ticker',
        priority: 'high' as const,
      },
      {
        exchange: 'coindcx',
        method: 'GET',
        url: '/exchange/ticker',
        priority: 'high' as const,
      },
    ];

    const results = await this.executeConcurrent(calls);
    const priceMap = new Map<string, any>();

    for (const result of results) {
      const call = calls.find(c => result.id.includes(c.exchange));
      if (call && result.success) {
        priceMap.set(call.exchange, result.data);
      }
    }

    return priceMap;
  }

  /**
   * Execute balance checks across all exchanges
   */
  async fetchAllBalancesConcurrent(apiKeys: Map<string, any>): Promise<Map<string, any>> {
    const calls = Array.from(apiKeys.entries()).map(([exchange, keys]) => ({
      exchange,
      method: 'GET',
      url: this.getBalanceEndpoint(exchange),
      config: this.createAuthConfig(exchange, keys),
      priority: 'high' as const,
      retryable: true,
    }));

    const results = await this.executeConcurrent(calls);
    const balanceMap = new Map<string, any>();

    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      const exchange = calls[i].exchange;
      
      if (result.success) {
        balanceMap.set(exchange, this.parseBalance(exchange, result.data));
      } else {
        balanceMap.set(exchange, { error: result.error?.message });
      }
    }

    return balanceMap;
  }

  /**
   * Execute calls for a specific exchange with rate limiting
   */
  private async executeExchangeCalls(
    exchange: string,
    calls: ApiCall[]
  ): Promise<ApiResponse[]> {
    const client = this.clients.get(exchange);
    const rateLimiter = this.rateLimiters.get(exchange);
    
    if (!client || !rateLimiter) {
      throw new Error(`Exchange ${exchange} not configured`);
    }

    const results: ApiResponse[] = [];
    const semaphore = new Semaphore(5); // Max 5 concurrent requests per exchange

    const promises = calls.map(async (call) => {
      await semaphore.acquire();
      
      try {
        // Wait for rate limit token
        await rateLimiter.consume();
        
        const startTime = Date.now();
        const response = await this.executeWithRetry(client, call);
        const duration = Date.now() - startTime;

        results.push({
          id: call.id,
          success: true,
          data: response.data,
          duration,
          retryCount: 0,
        });

      } catch (error) {
        const duration = Date.now() - Date.now();
        results.push({
          id: call.id,
          success: false,
          error: error as Error,
          duration,
          retryCount: 0,
        });

        await errorHandler.handleError(error as Error, {
          type: ErrorType.API_ERROR,
          severity: ErrorSeverity.MEDIUM,
          exchange,
          operation: `${call.method} ${call.url}`,
        });

      } finally {
        semaphore.release();
      }
    });

    await Promise.all(promises);
    return results;
  }

  /**
   * Execute single API call with optimized retry logic
   */
  private async executeWithRetry(
    client: AxiosInstance,
    call: ApiCall
  ): Promise<any> {
    if (!call.retryable) {
      return await client.request({
        method: call.method.toLowerCase() as any,
        url: call.url,
        ...call.config,
      });
    }

    return await RetryMechanism.execute(
      async () => {
        return await client.request({
          method: call.method.toLowerCase() as any,
          url: call.url,
          ...call.config,
        });
      },
      {
        maxAttempts: 3,
        initialDelay: 1000,
        backoffMultiplier: 2,
        shouldRetry: (error: any) => {
          // Don't retry on client errors (4xx)
          if (error.response?.status >= 400 && error.response?.status < 500) {
            return false;
          }
          return true;
        },
      }
    );
  }

  /**
   * Start background request processor
   */
  private startRequestProcessor(): void {
    setInterval(() => {
      this.processRequestQueues();
    }, 100); // Process every 100ms
  }

  /**
   * Process queued requests
   */
  private async processRequestQueues(): Promise<void> {
    for (const [exchange, queue] of this.requestQueues) {
      if (queue.length === 0) continue;

      const rateLimiter = this.rateLimiters.get(exchange);
      const activeSet = this.activeRequests.get(exchange);
      
      if (!rateLimiter || !activeSet) continue;

      // Process high priority requests first
      const availableTokens = rateLimiter.getAvailableTokens();
      const maxConcurrent = Math.min(availableTokens, 5 - activeSet.size);

      for (let i = 0; i < maxConcurrent && queue.length > 0; i++) {
        const call = queue.shift()!;
        activeSet.add(call.id);
        
        this.executeQueuedCall(exchange, call).finally(() => {
          activeSet.delete(call.id);
        });
      }
    }
  }

  /**
   * Execute a queued API call
   */
  private async executeQueuedCall(exchange: string, call: ApiCall): Promise<void> {
    const client = this.clients.get(exchange);
    if (!client) return;

    try {
      const response = await this.executeWithRetry(client, call);
      this.emit('callComplete', { id: call.id, success: true, data: response.data });
    } catch (error) {
      this.emit('callComplete', { id: call.id, success: false, error });
    }
  }

  /**
   * Get balance endpoint for exchange
   */
  private getBalanceEndpoint(exchange: string): string {
    const endpoints = {
      binance: '/api/v3/account',
      zebpay: '/pro/v1/account/balance',
      coindcx: '/exchange/v1/users/balances',
      coinswitch: '/trade/api/v2/user/wallet/balance',
    };
    return endpoints[exchange as keyof typeof endpoints] || '/balance';
  }

  /**
   * Create authentication config for exchange
   */
  private createAuthConfig(exchange: string, keys: any): AxiosRequestConfig {
    // Exchange-specific auth logic would go here
    return {
      headers: {
        'X-API-KEY': keys.apiKey,
        'Authorization': `Bearer ${keys.token}`,
      },
    };
  }

  /**
   * Parse balance response from exchange
   */
  private parseBalance(exchange: string, data: any): any {
    // Exchange-specific parsing logic
    switch (exchange) {
      case 'binance':
        return data.balances?.find((b: any) => b.asset === 'USDT') || {};
      case 'zebpay':
        return data.find((b: any) => b.symbol === 'USDT') || {};
      default:
        return data;
    }
  }

  /**
   * Get performance metrics
   */
  getMetrics(): any {
    const metrics = {};
    
    for (const [exchange, rateLimiter] of this.rateLimiters) {
      const activeSet = this.activeRequests.get(exchange);
      metrics[exchange] = {
        availableTokens: rateLimiter.getAvailableTokens(),
        activeRequests: activeSet?.size || 0,
        queueSize: this.requestQueues.get(exchange)?.length || 0,
      };
    }

    return metrics;
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    // Close all HTTP connections
    for (const client of this.clients.values()) {
      // Force close keep-alive connections
      if (client.defaults.httpAgent) {
        client.defaults.httpAgent.destroy();
      }
      if (client.defaults.httpsAgent) {
        client.defaults.httpsAgent.destroy();
      }
    }

    this.removeAllListeners();
  }
}

/**
 * Token bucket for rate limiting
 */
class TokenBucket {
  private tokens: number;
  private lastRefill: number;
  private readonly capacity: number;
  private readonly refillRate: number;

  constructor(config: RateLimitConfig) {
    this.capacity = config.burstCapacity;
    this.tokens = this.capacity;
    this.refillRate = config.maxRequestsPerSecond;
    this.lastRefill = Date.now();
  }

  async consume(tokens: number = 1): Promise<void> {
    this.refill();
    
    if (this.tokens >= tokens) {
      this.tokens -= tokens;
      return;
    }

    // Wait for tokens to be available
    const waitTime = (tokens - this.tokens) / this.refillRate * 1000;
    await new Promise(resolve => setTimeout(resolve, waitTime));
    await this.consume(tokens);
  }

  getAvailableTokens(): number {
    this.refill();
    return Math.floor(this.tokens);
  }

  private refill(): void {
    const now = Date.now();
    const timePassed = (now - this.lastRefill) / 1000;
    const tokensToAdd = timePassed * this.refillRate;
    
    this.tokens = Math.min(this.capacity, this.tokens + tokensToAdd);
    this.lastRefill = now;
  }
}

/**
 * Semaphore for limiting concurrent operations
 */
class Semaphore {
  private permits: number;
  private waitQueue: Array<() => void> = [];

  constructor(permits: number) {
    this.permits = permits;
  }

  async acquire(): Promise<void> {
    return new Promise((resolve) => {
      if (this.permits > 0) {
        this.permits--;
        resolve();
      } else {
        this.waitQueue.push(resolve);
      }
    });
  }

  release(): void {
    if (this.waitQueue.length > 0) {
      const resolve = this.waitQueue.shift()!;
      resolve();
    } else {
      this.permits++;
    }
  }
}

/**
 * Connection pool for managing HTTP connections
 */
class ConnectionPool {
  private connections: Set<any> = new Set();
  private readonly maxConnections: number;
  private readonly exchange: string;

  constructor(exchange: string, maxConnections: number) {
    this.exchange = exchange;
    this.maxConnections = maxConnections;
  }

  acquire(): any {
    // Implementation for connection pooling
    return null;
  }

  release(connection: any): void {
    // Implementation for releasing connections
  }
}

export const concurrentApiManager = new ConcurrentApiManager();