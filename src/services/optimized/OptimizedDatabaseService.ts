import { Pool, PoolClient } from 'pg';
import Redis from 'ioredis';
import chalk from 'chalk';
import { EventEmitter } from 'events';
import { promisify } from 'util';

interface CacheConfig {
  ttl: number;
  maxMemory: string;
  evictionPolicy: 'allkeys-lru' | 'volatile-lru' | 'allkeys-lfu';
}

interface QueryOptions {
  cache?: boolean;
  cacheTTL?: number;
  skipTransaction?: boolean;
  priority?: 'high' | 'medium' | 'low';
}

interface BatchInsertConfig {
  batchSize: number;
  flushInterval: number;
  maxRetries: number;
}

/**
 * Optimized database service with Redis caching, connection pooling,
 * and batch operations for maximum performance
 */
export class OptimizedDatabaseService extends EventEmitter {
  private pgPool: Pool;
  private redisClient: Redis;
  private writeQueue: Map<string, any[]> = new Map();
  private batchTimers: Map<string, NodeJS.Timeout> = new Map();
  private readonly batchConfigs: Map<string, BatchInsertConfig> = new Map();
  private queryCache: Map<string, { data: any; expiry: number }> = new Map();
  private performanceMetrics = {
    totalQueries: 0,
    cacheHits: 0,
    cacheMisses: 0,
    batchInserts: 0,
    avgQueryTime: 0,
  };

  private readonly cacheConfig: CacheConfig = {
    ttl: 300, // 5 minutes default
    maxMemory: '256mb',
    evictionPolicy: 'allkeys-lru',
  };

  constructor() {
    super();
    this.initializePostgres();
    this.initializeRedis();
    this.setupBatchConfigs();
    this.startPerformanceMonitoring();
  }

  /**
   * Initialize PostgreSQL with optimized connection pool
   */
  private initializePostgres(): void {
    this.pgPool = new Pool({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || 'arbitrage_bot',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || '',
      
      // Optimized pool settings
      min: 5,
      max: 25,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
      acquireTimeoutMillis: 60000,
      
      // Connection optimization
      statement_timeout: 30000,
      query_timeout: 30000,
      
      // SSL configuration
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    });

    this.pgPool.on('error', (err) => {
      console.error(chalk.red('PostgreSQL pool error:'), err);
      this.emit('pgError', err);
    });

    this.pgPool.on('connect', () => {
      this.emit('pgConnect');
    });
  }

  /**
   * Initialize Redis with clustering support
   */
  private initializeRedis(): void {
    const redisConfig = {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      
      // Performance optimizations
      lazyConnect: true,
      keepAlive: 30000,
      connectTimeout: 10000,
      commandTimeout: 5000,
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3,
      
      // Memory optimization
      maxmemory: this.cacheConfig.maxMemory,
      'maxmemory-policy': this.cacheConfig.evictionPolicy,
    };

    // Use cluster if multiple Redis nodes are configured
    const redisNodes = process.env.REDIS_CLUSTER_NODES?.split(',');
    if (redisNodes && redisNodes.length > 1) {
      this.redisClient = new Redis.Cluster(
        redisNodes.map(node => {
          const [host, port] = node.split(':');
          return { host, port: parseInt(port) };
        }),
        {
          redisOptions: redisConfig,
          enableOfflineQueue: false,
        }
      );
    } else {
      this.redisClient = new Redis(redisConfig);
    }

    this.redisClient.on('error', (err) => {
      console.error(chalk.red('Redis error:'), err);
      this.emit('redisError', err);
    });
  }

  /**
   * Setup batch insert configurations for different tables
   */
  private setupBatchConfigs(): void {
    this.batchConfigs.set('price_history', {
      batchSize: 1000,
      flushInterval: 5000,
      maxRetries: 3,
    });

    this.batchConfigs.set('arbitrage_opportunities', {
      batchSize: 100,
      flushInterval: 2000,
      maxRetries: 3,
    });

    this.batchConfigs.set('trades', {
      batchSize: 50,
      flushInterval: 1000,
      maxRetries: 5,
    });

    // Initialize queues and timers
    for (const table of this.batchConfigs.keys()) {
      this.writeQueue.set(table, []);
      this.startBatchTimer(table);
    }
  }

  /**
   * Execute optimized query with caching
   */
  async query<T = any>(
    text: string,
    params: any[] = [],
    options: QueryOptions = {}
  ): Promise<{ rows: T[]; rowCount: number }> {
    const startTime = Date.now();
    const cacheKey = options.cache ? this.generateCacheKey(text, params) : null;

    // Try cache first
    if (cacheKey) {
      const cached = await this.getFromCache(cacheKey);
      if (cached) {
        this.performanceMetrics.cacheHits++;
        return cached;
      }
      this.performanceMetrics.cacheMisses++;
    }

    const client = await this.pgPool.connect();
    try {
      // Use prepared statements for better performance
      const result = await client.query({
        text,
        values: params,
        name: options.cache ? this.generateStatementName(text) : undefined,
      });

      // Cache the result if enabled
      if (cacheKey && result.rows.length > 0) {
        await this.setCache(
          cacheKey,
          { rows: result.rows, rowCount: result.rowCount },
          options.cacheTTL || this.cacheConfig.ttl
        );
      }

      this.updateMetrics(Date.now() - startTime);
      return { rows: result.rows, rowCount: result.rowCount };

    } finally {
      client.release();
    }
  }

  /**
   * Execute transaction with automatic retry
   */
  async transaction<T>(
    callback: (client: PoolClient) => Promise<T>,
    options: { retries?: number; isolation?: string } = {}
  ): Promise<T> {
    const { retries = 3, isolation = 'READ COMMITTED' } = options;
    let lastError: Error;

    for (let attempt = 1; attempt <= retries; attempt++) {
      const client = await this.pgPool.connect();
      
      try {
        await client.query('BEGIN');
        if (isolation !== 'READ COMMITTED') {
          await client.query(`SET TRANSACTION ISOLATION LEVEL ${isolation}`);
        }

        const result = await callback(client);
        await client.query('COMMIT');
        return result;

      } catch (error) {
        await client.query('ROLLBACK');
        lastError = error as Error;

        if (attempt < retries && this.isRetryableError(error as Error)) {
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        
        throw error;
      } finally {
        client.release();
      }
    }

    throw lastError!;
  }

  /**
   * Optimized batch insert with automatic batching
   */
  async batchInsert(
    table: string,
    data: any | any[],
    options: { immediate?: boolean } = {}
  ): Promise<void> {
    const records = Array.isArray(data) ? data : [data];
    const queue = this.writeQueue.get(table);
    
    if (!queue) {
      throw new Error(`Table ${table} not configured for batch inserts`);
    }

    queue.push(...records);

    if (options.immediate) {
      await this.flushBatch(table);
    } else {
      const config = this.batchConfigs.get(table)!;
      if (queue.length >= config.batchSize) {
        await this.flushBatch(table);
      }
    }
  }

  /**
   * Insert price data with intelligent batching
   */
  async insertPriceData(priceData: any[]): Promise<void> {
    // Pre-process data for optimal insertion
    const processedData = priceData.map(price => ({
      exchange_id: this.getExchangeId(price.exchange),
      symbol: price.symbol,
      buy_price: price.buyPrice,
      sell_price: price.sellPrice,
      volume: price.volume,
      timestamp: price.timestamp,
      spread: price.sellPrice - price.buyPrice,
      mid_price: (price.buyPrice + price.sellPrice) / 2,
    }));

    await this.batchInsert('price_history', processedData);
  }

  /**
   * Get latest prices with multi-level caching
   */
  async getLatestPrices(exchanges?: string[]): Promise<any[]> {
    const cacheKey = `latest_prices:${exchanges?.join(',') || 'all'}`;
    
    // Try memory cache first (fastest)
    const memoryCache = this.queryCache.get(cacheKey);
    if (memoryCache && memoryCache.expiry > Date.now()) {
      return memoryCache.data;
    }

    // Try Redis cache (fast)
    const redisCache = await this.getFromCache(cacheKey);
    if (redisCache) {
      // Update memory cache
      this.queryCache.set(cacheKey, {
        data: redisCache,
        expiry: Date.now() + 30000, // 30 seconds
      });
      return redisCache;
    }

    // Fetch from database (slower)
    const exchangeFilter = exchanges?.length 
      ? `AND e.name = ANY($1)` 
      : '';
    
    const params = exchanges?.length ? [exchanges] : [];

    const result = await this.query(`
      SELECT DISTINCT ON (e.name) 
        e.name as exchange,
        ph.buy_price,
        ph.sell_price,
        ph.volume,
        ph.timestamp,
        ph.spread,
        ph.mid_price
      FROM price_history ph
      JOIN exchanges e ON ph.exchange_id = e.id
      WHERE ph.timestamp > NOW() - INTERVAL '2 minutes'
        ${exchangeFilter}
      ORDER BY e.name, ph.timestamp DESC
    `, params, { cache: true, cacheTTL: 60 });

    // Cache in both Redis and memory
    await this.setCache(cacheKey, result.rows, 60);
    this.queryCache.set(cacheKey, {
      data: result.rows,
      expiry: Date.now() + 30000,
    });

    return result.rows;
  }

  /**
   * Get aggregated price statistics with window functions
   */
  async getPriceStatistics(
    timeWindow: number = 3600, // 1 hour
    exchanges?: string[]
  ): Promise<any[]> {
    const cacheKey = `price_stats:${timeWindow}:${exchanges?.join(',')}`;
    
    const cached = await this.getFromCache(cacheKey);
    if (cached) return cached;

    const exchangeFilter = exchanges?.length 
      ? `AND e.name = ANY($2)` 
      : '';
    
    const params = exchanges?.length 
      ? [timeWindow, exchanges] 
      : [timeWindow];

    const result = await this.query(`
      SELECT 
        e.name as exchange,
        COUNT(*) as data_points,
        AVG(ph.buy_price) as avg_buy_price,
        AVG(ph.sell_price) as avg_sell_price,
        AVG(ph.spread) as avg_spread,
        STDDEV(ph.buy_price) as buy_price_volatility,
        STDDEV(ph.sell_price) as sell_price_volatility,
        MIN(ph.buy_price) as min_buy_price,
        MAX(ph.sell_price) as max_sell_price,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY ph.spread) as median_spread,
        
        -- Moving averages
        AVG(ph.buy_price) OVER (
          PARTITION BY e.name 
          ORDER BY ph.timestamp 
          ROWS BETWEEN 10 PRECEDING AND CURRENT ROW
        ) as ma_10_buy_price,
        
        -- Price momentum
        (AVG(ph.buy_price) - LAG(AVG(ph.buy_price), 1) OVER (
          PARTITION BY e.name ORDER BY e.name
        )) / LAG(AVG(ph.buy_price), 1) OVER (
          PARTITION BY e.name ORDER BY e.name
        ) * 100 as price_momentum_pct
        
      FROM price_history ph
      JOIN exchanges e ON ph.exchange_id = e.id
      WHERE ph.timestamp > NOW() - INTERVAL '1 second' * $1
        ${exchangeFilter}
      GROUP BY e.name, e.id
      ORDER BY e.name
    `, params, { cache: true, cacheTTL: 300 });

    await this.setCache(cacheKey, result.rows, 300);
    return result.rows;
  }

  /**
   * Flush batch for specific table
   */
  private async flushBatch(table: string): Promise<void> {
    const queue = this.writeQueue.get(table);
    const config = this.batchConfigs.get(table);
    
    if (!queue || !config || queue.length === 0) return;

    const batch = queue.splice(0, config.batchSize);
    
    try {
      await this.executeBatchInsert(table, batch);
      this.performanceMetrics.batchInserts++;
      this.emit('batchInserted', { table, count: batch.length });
      
    } catch (error) {
      console.error(chalk.red(`Batch insert failed for ${table}:`), error);
      
      // Re-queue failed items for retry
      queue.unshift(...batch);
      throw error;
    }
  }

  /**
   * Execute optimized batch insert
   */
  private async executeBatchInsert(table: string, batch: any[]): Promise<void> {
    if (batch.length === 0) return;

    const columns = Object.keys(batch[0]);
    const placeholders: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    for (const item of batch) {
      const itemPlaceholders = columns.map(() => `$${paramIndex++}`);
      placeholders.push(`(${itemPlaceholders.join(', ')})`);
      values.push(...columns.map(col => item[col]));
    }

    const query = `
      INSERT INTO ${table} (${columns.join(', ')})
      VALUES ${placeholders.join(', ')}
      ON CONFLICT DO NOTHING
    `;

    await this.query(query, values, { skipTransaction: true });
  }

  /**
   * Start batch timer for table
   */
  private startBatchTimer(table: string): void {
    const config = this.batchConfigs.get(table);
    if (!config) return;

    const timer = setInterval(async () => {
      try {
        await this.flushBatch(table);
      } catch (error) {
        console.error(chalk.red(`Auto-flush failed for ${table}:`), error);
      }
    }, config.flushInterval);

    this.batchTimers.set(table, timer);
  }

  /**
   * Cache operations
   */
  private async getFromCache(key: string): Promise<any> {
    try {
      const cached = await this.redisClient.get(key);
      return cached ? JSON.parse(cached) : null;
    } catch (error) {
      console.error(chalk.yellow('Cache get error:'), error);
      return null;
    }
  }

  private async setCache(key: string, data: any, ttl: number): Promise<void> {
    try {
      await this.redisClient.setex(key, ttl, JSON.stringify(data));
    } catch (error) {
      console.error(chalk.yellow('Cache set error:'), error);
    }
  }

  /**
   * Generate cache key
   */
  private generateCacheKey(query: string, params: any[]): string {
    const hash = require('crypto')
      .createHash('md5')
      .update(query + JSON.stringify(params))
      .digest('hex');
    return `query:${hash}`;
  }

  /**
   * Generate prepared statement name
   */
  private generateStatementName(query: string): string {
    return `stmt_${require('crypto')
      .createHash('md5')
      .update(query)
      .digest('hex')
      .substring(0, 8)}`;
  }

  /**
   * Get cached exchange ID
   */
  private getExchangeId(exchangeName: string): number {
    // This would typically be cached in memory
    const exchangeIds = new Map([
      ['binance', 1],
      ['zebpay', 2],
      ['coindcx', 3],
      ['coinswitch', 4],
    ]);
    
    return exchangeIds.get(exchangeName) || 0;
  }

  /**
   * Check if error is retryable
   */
  private isRetryableError(error: Error): boolean {
    const retryableErrors = [
      'connection terminated',
      'connection timeout',
      'serialization failure',
      'deadlock detected',
    ];
    
    return retryableErrors.some(msg => 
      error.message.toLowerCase().includes(msg)
    );
  }

  /**
   * Update performance metrics
   */
  private updateMetrics(queryTime: number): void {
    this.performanceMetrics.totalQueries++;
    this.performanceMetrics.avgQueryTime = 
      (this.performanceMetrics.avgQueryTime * (this.performanceMetrics.totalQueries - 1) + queryTime) 
      / this.performanceMetrics.totalQueries;
  }

  /**
   * Start performance monitoring
   */
  private startPerformanceMonitoring(): void {
    setInterval(() => {
      const metrics = this.getPerformanceMetrics();
      this.emit('performanceUpdate', metrics);
      
      // Log slow queries
      if (metrics.avgQueryTime > 1000) {
        console.warn(chalk.yellow(`Slow queries detected: ${metrics.avgQueryTime}ms average`));
      }
    }, 60000); // Every minute
  }

  /**
   * Get performance metrics
   */
  getPerformanceMetrics(): any {
    const cacheHitRate = this.performanceMetrics.totalQueries > 0 
      ? (this.performanceMetrics.cacheHits / this.performanceMetrics.totalQueries) * 100 
      : 0;

    return {
      ...this.performanceMetrics,
      cacheHitRate: Math.round(cacheHitRate * 100) / 100,
      poolStats: {
        totalConnections: this.pgPool.totalCount,
        idleConnections: this.pgPool.idleCount,
        waitingClients: this.pgPool.waitingCount,
      },
      queueSizes: Object.fromEntries(
        Array.from(this.writeQueue.entries()).map(([table, queue]) => [
          table,
          queue.length,
        ])
      ),
    };
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    // Flush all pending batches
    for (const table of this.batchConfigs.keys()) {
      await this.flushBatch(table);
    }

    // Clear timers
    for (const timer of this.batchTimers.values()) {
      clearInterval(timer);
    }

    // Close connections
    await this.redisClient.quit();
    await this.pgPool.end();
    
    this.removeAllListeners();
  }
}

export const optimizedDb = new OptimizedDatabaseService();