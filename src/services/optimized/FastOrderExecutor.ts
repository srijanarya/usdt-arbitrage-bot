import { EventEmitter } from 'events';
import chalk from 'chalk';
import { concurrentApiManager } from './ConcurrentApiManager';
import { optimizedDb } from './OptimizedDatabaseService';
import { RetryMechanism } from '../../utils/RetryMechanism';
import { errorHandler, ErrorType, ErrorSeverity } from '../../utils/errors/ErrorHandler';

interface OrderRequest {
  id: string;
  exchange: string;
  symbol: string;
  side: 'buy' | 'sell';
  type: 'market' | 'limit';
  amount: number;
  price?: number;
  priority: 'critical' | 'high' | 'normal';
  timeout: number;
  metadata?: any;
}

interface OrderResponse {
  id: string;
  success: boolean;
  orderId?: string;
  executedPrice?: number;
  executedAmount?: number;
  fees?: number;
  latency: number;
  error?: string;
  timestamp: Date;
}

interface ExecutionRoute {
  buyExchange: string;
  sellExchange: string;
  buyPrice: number;
  sellPrice: number;
  amount: number;
  expectedProfit: number;
  urgency: 'immediate' | 'fast' | 'normal';
}

interface OptimizationMetrics {
  totalOrders: number;
  successfulOrders: number;
  averageLatency: number;
  fastestExecution: number;
  slowestExecution: number;
  profitLoss: number;
}

/**
 * Ultra-fast order execution service optimized for arbitrage trading
 * with parallel execution, intelligent routing, and latency optimization
 */
export class FastOrderExecutor extends EventEmitter {
  private activeOrders: Map<string, OrderRequest> = new Map();
  private executionQueue: OrderRequest[] = [];
  private exchangeClients: Map<string, any> = new Map();
  private routingCache: Map<string, any> = new Map();
  private latencyMetrics: Map<string, number[]> = new Map();
  private preAuthTokens: Map<string, { token: string; expires: Date }> = new Map();
  
  private readonly maxConcurrentOrders = 10;
  private readonly maxQueueSize = 100;
  private readonly latencyWindow = 100; // Keep last 100 measurements
  
  private metrics: OptimizationMetrics = {
    totalOrders: 0,
    successfulOrders: 0,
    averageLatency: 0,
    fastestExecution: Infinity,
    slowestExecution: 0,
    profitLoss: 0,
  };

  constructor() {
    super();
    this.initializeExchangeClients();
    this.startOrderProcessor();
    this.startTokenRefresh();
  }

  /**
   * Execute arbitrage opportunity with maximum speed
   */
  async executeArbitrageImmediate(route: ExecutionRoute): Promise<{
    success: boolean;
    profit?: number;
    latency: number;
    details: any;
  }> {
    const startTime = process.hrtime.bigint();
    const executionId = this.generateExecutionId();

    try {
      console.log(chalk.bgBlue.white(` 🚀 FAST ARBITRAGE EXECUTION ${executionId} `));
      console.log(chalk.cyan(`Route: ${route.buyExchange} → ${route.sellExchange}`));
      console.log(chalk.cyan(`Expected Profit: ₹${route.expectedProfit.toFixed(2)}`));

      // Create parallel order requests
      const buyOrder: OrderRequest = {
        id: `${executionId}_buy`,
        exchange: route.buyExchange,
        symbol: 'USDT/INR',
        side: 'buy',
        type: 'market',
        amount: route.amount,
        priority: 'critical',
        timeout: 5000,
        metadata: { executionId, route },
      };

      const sellOrder: OrderRequest = {
        id: `${executionId}_sell`,
        exchange: route.sellExchange,
        symbol: 'USDT/INR',
        side: 'sell',
        type: 'limit',
        amount: route.amount,
        price: route.sellPrice,
        priority: 'critical',
        timeout: 5000,
        metadata: { executionId, route },
      };

      // Execute buy and sell orders in parallel
      const [buyResult, sellResult] = await Promise.all([
        this.executeOrderFast(buyOrder),
        this.executeOrderFast(sellOrder),
      ]);

      const totalLatency = Number(process.hrtime.bigint() - startTime) / 1000000;

      if (buyResult.success && sellResult.success) {
        // Calculate actual profit
        const actualCost = (buyResult.executedPrice || route.buyPrice) * buyResult.executedAmount!;
        const actualRevenue = (sellResult.executedPrice || route.sellPrice) * sellResult.executedAmount!;
        const actualProfit = actualRevenue - actualCost - (buyResult.fees || 0) - (sellResult.fees || 0);

        this.metrics.successfulOrders += 2;
        this.metrics.profitLoss += actualProfit;

        console.log(chalk.bgGreen.black(` ✅ ARBITRAGE COMPLETED IN ${totalLatency.toFixed(2)}ms `));
        console.log(chalk.green(`Actual Profit: ₹${actualProfit.toFixed(2)}`));

        // Save to database asynchronously
        this.saveTradePair(buyResult, sellResult, actualProfit);

        return {
          success: true,
          profit: actualProfit,
          latency: totalLatency,
          details: { buyResult, sellResult },
        };

      } else {
        console.log(chalk.bgRed.white(` ❌ ARBITRAGE FAILED `));
        const errors = [
          buyResult.error && `Buy: ${buyResult.error}`,
          sellResult.error && `Sell: ${sellResult.error}`,
        ].filter(Boolean);

        return {
          success: false,
          latency: totalLatency,
          details: { buyResult, sellResult, errors },
        };
      }

    } catch (error) {
      const totalLatency = Number(process.hrtime.bigint() - startTime) / 1000000;
      
      await errorHandler.handleError(error as Error, {
        type: ErrorType.TRADING_ERROR,
        severity: ErrorSeverity.CRITICAL,
        operation: 'executeArbitrageImmediate',
        data: { route, executionId },
      });

      return {
        success: false,
        latency: totalLatency,
        details: { error: (error as Error).message },
      };
    }
  }

  /**
   * Execute single order with maximum optimization
   */
  async executeOrderFast(order: OrderRequest): Promise<OrderResponse> {
    const startTime = process.hrtime.bigint();
    this.activeOrders.set(order.id, order);

    try {
      // Pre-flight checks
      await this.preflightCheck(order);

      // Get optimal execution strategy
      const strategy = this.getExecutionStrategy(order);

      // Execute with appropriate method
      let result: OrderResponse;
      switch (strategy) {
        case 'direct_api':
          result = await this.executeDirectAPI(order);
          break;
        case 'websocket':
          result = await this.executeViaWebSocket(order);
          break;
        case 'bulk_api':
          result = await this.executeBulkAPI([order]);
          break;
        default:
          result = await this.executeDirectAPI(order);
      }

      const latency = Number(process.hrtime.bigint() - startTime) / 1000000;
      result.latency = latency;

      // Update metrics
      this.updateLatencyMetrics(order.exchange, latency);
      this.metrics.totalOrders++;
      if (result.success) this.metrics.successfulOrders++;

      console.log(chalk.green(
        `⚡ Order ${order.id} executed in ${latency.toFixed(2)}ms`
      ));

      return result;

    } catch (error) {
      const latency = Number(process.hrtime.bigint() - startTime) / 1000000;
      
      return {
        id: order.id,
        success: false,
        error: (error as Error).message,
        latency,
        timestamp: new Date(),
      };

    } finally {
      this.activeOrders.delete(order.id);
    }
  }

  /**
   * Execute multiple orders in parallel with intelligent batching
   */
  async executeBatch(orders: OrderRequest[]): Promise<OrderResponse[]> {
    const startTime = Date.now();
    
    // Group orders by exchange for optimal batching
    const ordersByExchange = new Map<string, OrderRequest[]>();
    for (const order of orders) {
      if (!ordersByExchange.has(order.exchange)) {
        ordersByExchange.set(order.exchange, []);
      }
      ordersByExchange.get(order.exchange)!.push(order);
    }

    // Execute each exchange group in parallel
    const promises = Array.from(ordersByExchange.entries()).map(
      async ([exchange, exchangeOrders]) => {
        if (this.supportsBulkExecution(exchange)) {
          return await this.executeBulkAPI(exchangeOrders);
        } else {
          // Execute individually but in parallel
          return await Promise.all(
            exchangeOrders.map(order => this.executeOrderFast(order))
          );
        }
      }
    );

    const results = await Promise.all(promises);
    const flatResults = results.flat();

    console.log(chalk.blue(
      `📦 Batch execution completed: ${flatResults.length} orders in ${Date.now() - startTime}ms`
    ));

    return flatResults;
  }

  /**
   * Pre-flight checks for order optimization
   */
  private async preflightCheck(order: OrderRequest): Promise<void> {
    // Check if exchange is healthy
    const health = await this.getExchangeHealth(order.exchange);
    if (!health.healthy) {
      throw new Error(`Exchange ${order.exchange} is unhealthy: ${health.reason}`);
    }

    // Check rate limits
    const rateLimitOk = await this.checkRateLimit(order.exchange);
    if (!rateLimitOk) {
      throw new Error(`Rate limit exceeded for ${order.exchange}`);
    }

    // Ensure authentication is ready
    await this.ensureAuthentication(order.exchange);

    // Validate order parameters
    this.validateOrder(order);
  }

  /**
   * Get optimal execution strategy for order
   */
  private getExecutionStrategy(order: OrderRequest): string {
    const exchange = order.exchange;
    const avgLatency = this.getAverageLatency(exchange);

    // Critical orders always use fastest method
    if (order.priority === 'critical') {
      return 'direct_api';
    }

    // For high-latency exchanges, prefer WebSocket if available
    if (avgLatency > 1000 && this.supportsWebSocketTrading(exchange)) {
      return 'websocket';
    }

    // Default to direct API
    return 'direct_api';
  }

  /**
   * Execute order via direct API call
   */
  private async executeDirectAPI(order: OrderRequest): Promise<OrderResponse> {
    const client = this.exchangeClients.get(order.exchange);
    if (!client) {
      throw new Error(`No client available for ${order.exchange}`);
    }

    const orderData = this.prepareOrderData(order);
    
    const response = await concurrentApiManager.executeConcurrent([{
      exchange: order.exchange,
      method: 'POST',
      url: this.getOrderEndpoint(order.exchange),
      config: {
        data: orderData,
        timeout: order.timeout,
        headers: await this.getAuthHeaders(order.exchange),
      },
      priority: order.priority === 'critical' ? 'high' : 'medium',
      retryable: false, // Don't retry orders
    }]);

    const result = response[0];
    if (!result.success) {
      throw new Error(result.error?.message || 'Order execution failed');
    }

    return this.parseOrderResponse(order, result.data);
  }

  /**
   * Execute order via WebSocket (for supported exchanges)
   */
  private async executeViaWebSocket(order: OrderRequest): Promise<OrderResponse> {
    // Implementation for WebSocket-based order execution
    // This would be exchange-specific
    throw new Error('WebSocket execution not implemented');
  }

  /**
   * Execute multiple orders via bulk API
   */
  private async executeBulkAPI(orders: OrderRequest[]): Promise<OrderResponse[]> {
    if (orders.length === 1) {
      return [await this.executeDirectAPI(orders[0])];
    }

    const exchange = orders[0].exchange;
    const bulkOrderData = orders.map(order => this.prepareOrderData(order));

    const response = await concurrentApiManager.executeConcurrent([{
      exchange,
      method: 'POST',
      url: this.getBulkOrderEndpoint(exchange),
      config: {
        data: { orders: bulkOrderData },
        timeout: Math.max(...orders.map(o => o.timeout)),
        headers: await this.getAuthHeaders(exchange),
      },
      priority: 'high',
      retryable: false,
    }]);

    const result = response[0];
    if (!result.success) {
      throw new Error(result.error?.message || 'Bulk order execution failed');
    }

    return orders.map((order, index) => 
      this.parseOrderResponse(order, result.data.results[index])
    );
  }

  /**
   * Prepare order data for API call
   */
  private prepareOrderData(order: OrderRequest): any {
    const baseData = {
      symbol: order.symbol,
      side: order.side.toUpperCase(),
      type: order.type.toUpperCase(),
      quantity: order.amount,
    };

    if (order.type === 'limit' && order.price) {
      baseData['price'] = order.price;
    }

    // Add exchange-specific parameters
    switch (order.exchange) {
      case 'binance':
        return {
          ...baseData,
          timeInForce: 'IOC', // Immediate or Cancel for speed
          newOrderRespType: 'FULL',
        };
      case 'zebpay':
        return {
          ...baseData,
          product: 'spot',
          post_only: false,
        };
      default:
        return baseData;
    }
  }

  /**
   * Parse order response from exchange
   */
  private parseOrderResponse(order: OrderRequest, responseData: any): OrderResponse {
    // Exchange-specific response parsing
    switch (order.exchange) {
      case 'binance':
        return {
          id: order.id,
          success: responseData.status === 'FILLED',
          orderId: responseData.orderId,
          executedPrice: parseFloat(responseData.price || responseData.fills?.[0]?.price),
          executedAmount: parseFloat(responseData.executedQty),
          fees: responseData.fills?.reduce((sum: number, fill: any) => 
            sum + parseFloat(fill.commission), 0
          ),
          timestamp: new Date(responseData.transactTime),
          latency: 0, // Will be set by caller
        };
      
      case 'zebpay':
        return {
          id: order.id,
          success: responseData.state === 'done',
          orderId: responseData.id,
          executedPrice: parseFloat(responseData.executed_price),
          executedAmount: parseFloat(responseData.executed_size),
          fees: parseFloat(responseData.fill_fees),
          timestamp: new Date(responseData.done_at),
          latency: 0,
        };
      
      default:
        return {
          id: order.id,
          success: false,
          error: 'Unknown exchange response format',
          timestamp: new Date(),
          latency: 0,
        };
    }
  }

  /**
   * Initialize exchange clients with optimal settings
   */
  private initializeExchangeClients(): void {
    // Initialize exchange-specific clients
    // This would include API clients for each supported exchange
    const exchanges = ['binance', 'zebpay', 'coindcx', 'coinswitch'];
    
    for (const exchange of exchanges) {
      // Initialize latency tracking
      this.latencyMetrics.set(exchange, []);
    }
  }

  /**
   * Start order processing queue
   */
  private startOrderProcessor(): void {
    setInterval(async () => {
      if (this.executionQueue.length > 0 && 
          this.activeOrders.size < this.maxConcurrentOrders) {
        
        const order = this.executionQueue.shift()!;
        
        // Execute without awaiting to allow parallel processing
        this.executeOrderFast(order).catch(error => {
          console.error(chalk.red(`Queue order execution failed:`), error);
        });
      }
    }, 10); // Process every 10ms for ultra-low latency
  }

  /**
   * Start token refresh for pre-authentication
   */
  private startTokenRefresh(): void {
    setInterval(async () => {
      for (const exchange of this.exchangeClients.keys()) {
        try {
          await this.refreshAuthToken(exchange);
        } catch (error) {
          console.error(chalk.yellow(`Token refresh failed for ${exchange}:`), error);
        }
      }
    }, 60000); // Refresh every minute
  }

  /**
   * Ensure authentication is ready for exchange
   */
  private async ensureAuthentication(exchange: string): Promise<void> {
    const token = this.preAuthTokens.get(exchange);
    
    if (!token || token.expires < new Date()) {
      await this.refreshAuthToken(exchange);
    }
  }

  /**
   * Refresh authentication token
   */
  private async refreshAuthToken(exchange: string): Promise<void> {
    // Exchange-specific token refresh logic
    // This would be implemented based on each exchange's auth requirements
  }

  /**
   * Get authentication headers for exchange
   */
  private async getAuthHeaders(exchange: string): Promise<any> {
    const token = this.preAuthTokens.get(exchange);
    
    switch (exchange) {
      case 'binance':
        return {
          'X-MBX-APIKEY': process.env.BINANCE_API_KEY,
        };
      case 'zebpay':
        return {
          'Authorization': `Bearer ${token?.token}`,
        };
      default:
        return {};
    }
  }

  /**
   * Update latency metrics for exchange
   */
  private updateLatencyMetrics(exchange: string, latency: number): void {
    const metrics = this.latencyMetrics.get(exchange)!;
    metrics.push(latency);
    
    // Keep only last N measurements
    if (metrics.length > this.latencyWindow) {
      metrics.shift();
    }

    // Update global metrics
    this.metrics.averageLatency = 
      (this.metrics.averageLatency * (this.metrics.totalOrders - 1) + latency) / 
      this.metrics.totalOrders;
    
    this.metrics.fastestExecution = Math.min(this.metrics.fastestExecution, latency);
    this.metrics.slowestExecution = Math.max(this.metrics.slowestExecution, latency);
  }

  /**
   * Get average latency for exchange
   */
  private getAverageLatency(exchange: string): number {
    const metrics = this.latencyMetrics.get(exchange);
    if (!metrics || metrics.length === 0) return 0;
    
    return metrics.reduce((sum, val) => sum + val, 0) / metrics.length;
  }

  /**
   * Helper methods
   */
  private generateExecutionId(): string {
    return `exec_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  }

  private getOrderEndpoint(exchange: string): string {
    const endpoints = {
      binance: '/api/v3/order',
      zebpay: '/pro/v1/orders',
      coindcx: '/exchange/v1/orders/create',
    };
    return endpoints[exchange as keyof typeof endpoints] || '/order';
  }

  private getBulkOrderEndpoint(exchange: string): string {
    const endpoints = {
      binance: '/api/v3/batchOrders',
      zebpay: '/pro/v1/orders/batch',
    };
    return endpoints[exchange as keyof typeof endpoints] || '/orders/batch';
  }

  private supportsBulkExecution(exchange: string): boolean {
    return ['binance', 'zebpay'].includes(exchange);
  }

  private supportsWebSocketTrading(exchange: string): boolean {
    return ['binance'].includes(exchange);
  }

  private async getExchangeHealth(exchange: string): Promise<{
    healthy: boolean;
    reason?: string;
  }> {
    // Check exchange health metrics
    const avgLatency = this.getAverageLatency(exchange);
    if (avgLatency > 5000) {
      return { healthy: false, reason: 'High latency' };
    }
    
    return { healthy: true };
  }

  private async checkRateLimit(exchange: string): Promise<boolean> {
    // Implementation would check current rate limit status
    return true;
  }

  private validateOrder(order: OrderRequest): void {
    if (!order.amount || order.amount <= 0) {
      throw new Error('Invalid order amount');
    }
    
    if (order.type === 'limit' && (!order.price || order.price <= 0)) {
      throw new Error('Invalid price for limit order');
    }
  }

  /**
   * Save trade pair to database asynchronously
   */
  private async saveTradePair(
    buyResult: OrderResponse,
    sellResult: OrderResponse,
    profit: number
  ): Promise<void> {
    try {
      await optimizedDb.batchInsert('trades', [
        {
          order_id: buyResult.orderId,
          side: 'buy',
          executed_price: buyResult.executedPrice,
          executed_amount: buyResult.executedAmount,
          fees: buyResult.fees,
          latency: buyResult.latency,
          profit_contribution: -buyResult.executedPrice! * buyResult.executedAmount!,
        },
        {
          order_id: sellResult.orderId,
          side: 'sell',
          executed_price: sellResult.executedPrice,
          executed_amount: sellResult.executedAmount,
          fees: sellResult.fees,
          latency: sellResult.latency,
          profit_contribution: sellResult.executedPrice! * sellResult.executedAmount!,
        },
      ]);
    } catch (error) {
      console.error(chalk.red('Failed to save trade pair:'), error);
    }
  }

  /**
   * Get performance metrics
   */
  getMetrics(): OptimizationMetrics & {
    exchangeLatencies: Record<string, number>;
    activeOrders: number;
    queueSize: number;
  } {
    const exchangeLatencies: Record<string, number> = {};
    for (const [exchange, metrics] of this.latencyMetrics) {
      exchangeLatencies[exchange] = this.getAverageLatency(exchange);
    }

    return {
      ...this.metrics,
      exchangeLatencies,
      activeOrders: this.activeOrders.size,
      queueSize: this.executionQueue.length,
    };
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    // Wait for active orders to complete
    while (this.activeOrders.size > 0) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    this.removeAllListeners();
  }
}

export const fastOrderExecutor = new FastOrderExecutor();