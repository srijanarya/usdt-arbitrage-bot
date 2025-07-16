import { EventEmitter } from 'events';
import { WebSocketManager } from '../../utils/websocketManager';
import { logger } from '../../utils/logger';
import axios, { AxiosInstance } from 'axios';

export interface ExchangeConfig {
  name: string;
  apiKey: string;
  apiSecret: string;
  baseURL: string;
  wsURL: string;
  testMode?: boolean;
}

export interface OrderBook {
  bids: [number, number][];
  asks: [number, number][];
  timestamp: Date;
}

export interface Ticker {
  symbol: string;
  bid: number;
  ask: number;
  last: number;
  volume: number;
  change24h: number;
  timestamp: Date;
}

export abstract class EnhancedExchangeClient extends EventEmitter {
  protected config: ExchangeConfig;
  protected wsManager: WebSocketManager | null = null;
  protected api: AxiosInstance;
  protected subscriptions: Map<string, any> = new Map();
  protected priceCache: Map<string, Ticker> = new Map();
  protected orderBookCache: Map<string, OrderBook> = new Map();

  constructor(config: ExchangeConfig) {
    super();
    this.config = config;
    
    // Initialize REST API client
    this.api = axios.create({
      baseURL: this.config.baseURL,
      timeout: 10000,
      headers: this.getAuthHeaders()
    });

    // Add request/response interceptors
    this.setupInterceptors();
  }

  protected abstract getAuthHeaders(): any;
  protected abstract handleWebSocketMessage(message: any): void;
  protected abstract subscribeToSymbol(symbol: string): void;

  private setupInterceptors(): void {
    // Request interceptor
    this.api.interceptors.request.use(
      (config) => {
        logger.debug(`[${this.config.name}] API Request: ${config.method?.toUpperCase()} ${config.url}`);
        return config;
      },
      (error) => {
        logger.error(`[${this.config.name}] Request error:`, error);
        return Promise.reject(error);
      }
    );

    // Response interceptor
    this.api.interceptors.response.use(
      (response) => {
        logger.debug(`[${this.config.name}] API Response: ${response.status}`);
        return response;
      },
      async (error) => {
        if (error.response) {
          const { status, data } = error.response;
          
          // Handle rate limiting
          if (status === 429) {
            const retryAfter = error.response.headers['retry-after'] || 60;
            logger.warn(`[${this.config.name}] Rate limited, retry after ${retryAfter}s`);
            this.emit('rateLimited', { retryAfter });
            
            // Optionally retry after delay
            if (error.config && !error.config._retry) {
              error.config._retry = true;
              await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
              return this.api.request(error.config);
            }
          }
          
          // Handle authentication errors
          if (status === 401 || status === 403) {
            logger.error(`[${this.config.name}] Authentication error`);
            this.emit('authError', { status, data });
          }
          
          logger.error(`[${this.config.name}] API Error ${status}:`, data);
        } else if (error.request) {
          logger.error(`[${this.config.name}] Network error:`, error.message);
          this.emit('networkError', error);
        }
        
        return Promise.reject(error);
      }
    );
  }

  async connect(): Promise<void> {
    if (!this.config.wsURL) {
      logger.warn(`[${this.config.name}] No WebSocket URL configured`);
      return;
    }

    logger.info(`[${this.config.name}] Initializing WebSocket connection`);
    
    this.wsManager = new WebSocketManager({
      url: this.config.wsURL,
      name: this.config.name,
      reconnectInterval: 5000,
      maxReconnectAttempts: 10,
      heartbeatInterval: 30000,
      pingInterval: 20000
    });

    // Setup WebSocket event handlers
    this.setupWebSocketHandlers();
    
    // Connect
    this.wsManager.connect();
  }

  private setupWebSocketHandlers(): void {
    if (!this.wsManager) return;

    this.wsManager.on('connected', (info) => {
      logger.info(`[${this.config.name}] WebSocket connected in ${info.connectionTime}ms`);
      this.emit('wsConnected');
      
      // Resubscribe to all symbols
      this.resubscribeAll();
    });

    this.wsManager.on('disconnected', (info) => {
      logger.warn(`[${this.config.name}] WebSocket disconnected:`, info);
      this.emit('wsDisconnected', info);
    });

    this.wsManager.on('message', (message) => {
      try {
        this.handleWebSocketMessage(message);
      } catch (error) {
        logger.error(`[${this.config.name}] Error handling WebSocket message:`, error);
      }
    });

    this.wsManager.on('error', (error) => {
      logger.error(`[${this.config.name}] WebSocket error:`, error);
      this.emit('wsError', error);
    });

    this.wsManager.on('maxReconnectAttemptsReached', () => {
      logger.error(`[${this.config.name}] Max WebSocket reconnection attempts reached`);
      this.emit('wsMaxReconnectFailed');
    });
  }

  private resubscribeAll(): void {
    logger.info(`[${this.config.name}] Resubscribing to ${this.subscriptions.size} symbols`);
    
    this.subscriptions.forEach((_, symbol) => {
      try {
        this.subscribeToSymbol(symbol);
      } catch (error) {
        logger.error(`[${this.config.name}] Error resubscribing to ${symbol}:`, error);
      }
    });
  }

  async subscribe(symbol: string): Promise<void> {
    if (this.subscriptions.has(symbol)) {
      logger.warn(`[${this.config.name}] Already subscribed to ${symbol}`);
      return;
    }

    logger.info(`[${this.config.name}] Subscribing to ${symbol}`);
    this.subscriptions.set(symbol, { subscribedAt: Date.now() });
    
    if (this.wsManager && this.wsManager.isConnected()) {
      this.subscribeToSymbol(symbol);
    }
  }

  async unsubscribe(symbol: string): Promise<void> {
    if (!this.subscriptions.has(symbol)) {
      logger.warn(`[${this.config.name}] Not subscribed to ${symbol}`);
      return;
    }

    logger.info(`[${this.config.name}] Unsubscribing from ${symbol}`);
    this.subscriptions.delete(symbol);
    
    // Send unsubscribe message if needed (exchange-specific)
    // This should be implemented in derived classes
  }

  disconnect(): void {
    logger.info(`[${this.config.name}] Disconnecting`);
    
    if (this.wsManager) {
      this.wsManager.disconnect();
      this.wsManager = null;
    }
    
    this.subscriptions.clear();
    this.priceCache.clear();
    this.orderBookCache.clear();
    
    this.emit('disconnected');
  }

  // REST API methods
  async getTicker(symbol: string): Promise<Ticker> {
    // Check cache first
    const cached = this.priceCache.get(symbol);
    if (cached && Date.now() - cached.timestamp.getTime() < 1000) {
      return cached;
    }

    // Implement in derived class
    throw new Error('getTicker must be implemented by derived class');
  }

  async getOrderBook(symbol: string, limit: number = 20): Promise<OrderBook> {
    // Check cache first
    const cached = this.orderBookCache.get(symbol);
    if (cached && Date.now() - cached.timestamp.getTime() < 1000) {
      return cached;
    }

    // Implement in derived class
    throw new Error('getOrderBook must be implemented by derived class');
  }

  // Cache management
  protected updateTickerCache(symbol: string, ticker: Ticker): void {
    this.priceCache.set(symbol, ticker);
    this.emit('ticker', { symbol, ...ticker });
  }

  protected updateOrderBookCache(symbol: string, orderBook: OrderBook): void {
    this.orderBookCache.set(symbol, orderBook);
    this.emit('orderBook', { symbol, ...orderBook });
  }

  // Status methods
  isConnected(): boolean {
    return this.wsManager ? this.wsManager.isConnected() : false;
  }

  getConnectionStats(): any {
    return this.wsManager ? this.wsManager.getStats() : null;
  }

  getCachedTicker(symbol: string): Ticker | undefined {
    return this.priceCache.get(symbol);
  }

  getCachedOrderBook(symbol: string): OrderBook | undefined {
    return this.orderBookCache.get(symbol);
  }

  getSubscriptions(): string[] {
    return Array.from(this.subscriptions.keys());
  }

  // Utility methods
  protected normalizeSymbol(symbol: string): string {
    // Override in derived class for exchange-specific normalization
    return symbol.toUpperCase();
  }

  protected calculateSpread(orderBook: OrderBook): number {
    if (orderBook.asks.length === 0 || orderBook.bids.length === 0) {
      return 0;
    }
    
    const bestBid = orderBook.bids[0][0];
    const bestAsk = orderBook.asks[0][0];
    
    return ((bestAsk - bestBid) / bestBid) * 100;
  }

  protected calculateMidPrice(orderBook: OrderBook): number {
    if (orderBook.asks.length === 0 || orderBook.bids.length === 0) {
      return 0;
    }
    
    const bestBid = orderBook.bids[0][0];
    const bestAsk = orderBook.asks[0][0];
    
    return (bestBid + bestAsk) / 2;
  }
}