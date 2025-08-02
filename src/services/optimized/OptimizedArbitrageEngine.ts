import { EventEmitter } from 'events';
import chalk from 'chalk';
import { concurrentApiManager } from './ConcurrentApiManager';
import { optimizedDb } from './OptimizedDatabaseService';
import { optimizedWebSocket } from './OptimizedWebSocketManager';
import { fastOrderExecutor } from './FastOrderExecutor';
import { enhancedErrorHandler, ErrorType, ErrorSeverity } from '../optimized/EnhancedErrorHandler';

interface ArbitrageOpportunity {
  id: string;
  buyExchange: string;
  sellExchange: string;
  symbol: string;
  buyPrice: number;
  sellPrice: number;
  amount: number;
  spread: number;
  spreadPercent: number;
  expectedProfit: number;
  profitPercent: number;
  confidence: number;
  urgency: 'immediate' | 'fast' | 'normal';
  timestamp: Date;
  metadata?: any;
}

interface EngineConfig {
  minSpread: number;
  minProfitPercent: number;
  maxAmount: number;
  enabledExchanges: string[];
  executionMode: 'simulation' | 'live';
  riskSettings: {
    maxDailyLoss: number;
    maxConcurrentTrades: number;
    stopLossPercent: number;
  };
  performance: {
    priceUpdateFrequency: number;
    opportunityCheckInterval: number;
    maxOpportunityAge: number;
  };
}

interface PerformanceMetrics {
  opportunitiesDetected: number;
  opportunitiesExecuted: number;
  successfulTrades: number;
  totalProfit: number;
  averageExecutionTime: number;
  bestOpportunity: number;
  worstLoss: number;
  dailyStats: Map<string, any>;
}

/**
 * Optimized arbitrage engine that coordinates all components
 * for maximum performance and profit detection
 */
export class OptimizedArbitrageEngine extends EventEmitter {
  private config: EngineConfig;
  private isRunning = false;
  private priceCache: Map<string, any> = new Map();
  private lastPriceUpdate: Map<string, Date> = new Map();
  private opportunityHistory: ArbitrageOpportunity[] = [];
  private activeOpportunities: Map<string, ArbitrageOpportunity> = new Map();
  
  private metrics: PerformanceMetrics = {
    opportunitiesDetected: 0,
    opportunitiesExecuted: 0,
    successfulTrades: 0,
    totalProfit: 0,
    averageExecutionTime: 0,
    bestOpportunity: 0,
    worstLoss: 0,
    dailyStats: new Map(),
  };

  private readonly defaultConfig: EngineConfig = {
    minSpread: 0.5, // 0.5%
    minProfitPercent: 0.3, // 0.3%
    maxAmount: 1000, // 1000 USDT
    enabledExchanges: ['binance', 'zebpay', 'coindcx'],
    executionMode: 'simulation',
    riskSettings: {
      maxDailyLoss: -5000, // ₹5000
      maxConcurrentTrades: 3,
      stopLossPercent: 2.0,
    },
    performance: {
      priceUpdateFrequency: 1000, // 1 second
      opportunityCheckInterval: 100, // 100ms
      maxOpportunityAge: 5000, // 5 seconds
    },
  };

  constructor(config: Partial<EngineConfig> = {}) {
    super();
    this.config = { ...this.defaultConfig, ...config };
    this.initializeEngine();
  }

  /**
   * Initialize the arbitrage engine
   */
  private async initializeEngine(): Promise<void> {
    try {
      console.log(chalk.bgBlue.white(' 🚀 INITIALIZING OPTIMIZED ARBITRAGE ENGINE '));
      
      // Setup WebSocket connections for real-time prices
      await this.setupWebSocketFeeds();
      
      // Setup event listeners
      this.setupEventListeners();
      
      // Initialize price cache
      await this.initializePriceCache();
      
      console.log(chalk.green('✅ Arbitrage engine initialized'));
      
    } catch (error) {
      await enhancedErrorHandler.handleError(error as Error, {
        type: ErrorType.SYSTEM_ERROR,
        severity: ErrorSeverity.CRITICAL,
        operation: 'initializeEngine',
      });
      throw error;
    }
  }

  /**
   * Setup WebSocket feeds for real-time price updates
   */
  private async setupWebSocketFeeds(): Promise<void> {
    const exchangeFeeds = [
      {
        name: 'binance',
        url: 'wss://stream.binance.com:9443/ws/usdtbusd@ticker',
        subscribeMessage: null,
      },
      {
        name: 'zebpay',
        url: 'wss://ws.zebpay.co/marketdata',
        subscribeMessage: {
          event: 'subscribe',
          channel: 'ticker',
          pair: ['USDT-INR'],
        },
      },
      {
        name: 'coindcx',
        url: 'wss://stream.coindcx.com',
        subscribeMessage: {
          channel: 'ticker',
          market: 'USDTINR',
        },
      },
    ];

    for (const feed of exchangeFeeds) {
      if (this.config.enabledExchanges.includes(feed.name)) {
        optimizedWebSocket.addConnection(feed.name, {
          url: feed.url,
          subscribeMessage: feed.subscribeMessage,
          heartbeatInterval: 30000,
          reconnectDelay: 1000,
          maxReconnectAttempts: 10,
        });
        
        await optimizedWebSocket.connect(feed.name);
      }
    }
  }

  /**
   * Setup event listeners for real-time processing
   */
  private setupEventListeners(): void {
    // WebSocket price updates
    optimizedWebSocket.on('message', (exchange: string, data: any) => {
      this.handlePriceUpdate(exchange, data);
    });

    // WebSocket connection events
    optimizedWebSocket.on('connected', (exchange: string) => {
      console.log(chalk.green(`📡 ${exchange} feed connected`));
    });

    optimizedWebSocket.on('error', (exchange: string, error: Error) => {
      enhancedErrorHandler.handleError(error, {
        type: ErrorType.WEBSOCKET_CONNECTION,
        severity: ErrorSeverity.MEDIUM,
        exchange,
        operation: 'priceUpdate',
      });
    });

    // Order execution events
    fastOrderExecutor.on('executionCompleted', (result: any) => {
      this.handleExecutionResult(result);
    });

    // Error handler events
    enhancedErrorHandler.on('cascadingFailure', (event: any) => {
      this.handleCascadingFailure(event);
    });
  }

  /**
   * Initialize price cache with latest data
   */
  private async initializePriceCache(): Promise<void> {
    try {
      // Fetch initial prices from all exchanges concurrently
      const priceMap = await concurrentApiManager.fetchAllPricesConcurrent();
      
      for (const [exchange, priceData] of priceMap) {
        this.updatePriceCache(exchange, priceData);
      }

      console.log(chalk.blue(`💰 Price cache initialized with ${priceMap.size} exchanges`));
      
    } catch (error) {
      await enhancedErrorHandler.handleError(error as Error, {
        type: ErrorType.API_ERROR,
        severity: ErrorSeverity.HIGH,
        operation: 'initializePriceCache',
      });
    }
  }

  /**
   * Start the arbitrage engine
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.log(chalk.yellow('Engine already running'));
      return;
    }

    try {
      console.log(chalk.bgGreen.black(' 🟢 STARTING ARBITRAGE ENGINE '));
      console.log(chalk.cyan(`Mode: ${this.config.executionMode.toUpperCase()}`));
      console.log(chalk.cyan(`Min Spread: ${this.config.minSpread}%`));
      console.log(chalk.cyan(`Min Profit: ${this.config.minProfitPercent}%`));
      console.log(chalk.cyan(`Max Amount: ${this.config.maxAmount} USDT`));

      this.isRunning = true;
      this.emit('started');

      // Start opportunity detection loop
      this.startOpportunityDetection();

      // Start price update loop
      this.startPriceUpdateLoop();

      // Start cleanup and optimization
      this.startMaintenanceLoop();

      console.log(chalk.green('✅ Arbitrage engine started successfully'));

    } catch (error) {
      await enhancedErrorHandler.handleError(error as Error, {
        type: ErrorType.SYSTEM_ERROR,
        severity: ErrorSeverity.CRITICAL,
        operation: 'start',
      });
      throw error;
    }
  }

  /**
   * Stop the arbitrage engine
   */
  async stop(): Promise<void> {
    if (!this.isRunning) return;

    console.log(chalk.yellow('🛑 Stopping arbitrage engine...'));
    this.isRunning = false;

    // Wait for active opportunities to complete
    while (this.activeOpportunities.size > 0) {
      console.log(chalk.yellow(`Waiting for ${this.activeOpportunities.size} active opportunities...`));
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Disconnect WebSocket feeds
    optimizedWebSocket.disconnectAll();

    this.emit('stopped');
    console.log(chalk.green('✅ Arbitrage engine stopped'));
  }

  /**
   * Start opportunity detection loop
   */
  private startOpportunityDetection(): void {
    const detect = async () => {
      if (!this.isRunning) return;

      try {
        await this.detectArbitrageOpportunities();
      } catch (error) {
        await enhancedErrorHandler.handleError(error as Error, {
          type: ErrorType.SYSTEM_ERROR,
          severity: ErrorSeverity.MEDIUM,
          operation: 'opportunityDetection',
        });
      }

      // Schedule next detection
      setTimeout(detect, this.config.performance.opportunityCheckInterval);
    };

    detect();
  }

  /**
   * Start price update loop for API-based updates
   */
  private startPriceUpdateLoop(): void {
    const updatePrices = async () => {
      if (!this.isRunning) return;

      try {
        // Update prices via API for backup/validation
        const priceMap = await concurrentApiManager.fetchAllPricesConcurrent();
        
        for (const [exchange, priceData] of priceMap) {
          this.updatePriceCache(exchange, priceData);
        }

      } catch (error) {
        await enhancedErrorHandler.handleError(error as Error, {
          type: ErrorType.API_ERROR,
          severity: ErrorSeverity.LOW,
          operation: 'priceUpdate',
        });
      }

      // Schedule next update
      setTimeout(updatePrices, this.config.performance.priceUpdateFrequency);
    };

    updatePrices();
  }

  /**
   * Start maintenance and optimization loop
   */
  private startMaintenanceLoop(): void {
    setInterval(() => {
      if (!this.isRunning) return;

      try {
        this.cleanupExpiredOpportunities();
        this.optimizePerformance();
        this.updateDailyStats();
      } catch (error) {
        enhancedErrorHandler.handleError(error as Error, {
          type: ErrorType.SYSTEM_ERROR,
          severity: ErrorSeverity.LOW,
          operation: 'maintenance',
        });
      }
    }, 30000); // Every 30 seconds
  }

  /**
   * Handle real-time price updates from WebSocket
   */
  private handlePriceUpdate(exchange: string, data: any): void {
    try {
      const priceData = this.parsePriceData(exchange, data);
      if (priceData) {
        this.updatePriceCache(exchange, priceData);
        this.lastPriceUpdate.set(exchange, new Date());
        
        // Trigger immediate opportunity check for fast execution
        this.detectArbitrageOpportunities();
      }
    } catch (error) {
      enhancedErrorHandler.handleError(error as Error, {
        type: ErrorType.PARSE_ERROR,
        severity: ErrorSeverity.LOW,
        exchange,
        operation: 'handlePriceUpdate',
        data,
      });
    }
  }

  /**
   * Parse exchange-specific price data
   */
  private parsePriceData(exchange: string, data: any): any {
    switch (exchange) {
      case 'binance':
        if (data.e === '24hrTicker') {
          return {
            symbol: 'USDT/BUSD',
            bidPrice: parseFloat(data.b),
            askPrice: parseFloat(data.a),
            lastPrice: parseFloat(data.c),
            volume: parseFloat(data.v),
            timestamp: new Date(data.E),
          };
        }
        break;

      case 'zebpay':
        if (data.event === 'ticker' && data.pair === 'USDT-INR') {
          return {
            symbol: 'USDT/INR',
            bidPrice: parseFloat(data.buy),
            askPrice: parseFloat(data.sell),
            lastPrice: parseFloat(data.last),
            volume: parseFloat(data.volume || 0),
            timestamp: new Date(),
          };
        }
        break;

      case 'coindcx':
        if (data.channel === 'ticker' && data.market === 'USDTINR') {
          return {
            symbol: 'USDT/INR',
            bidPrice: parseFloat(data.bid),
            askPrice: parseFloat(data.ask),
            lastPrice: parseFloat(data.price),
            volume: parseFloat(data.volume || 0),
            timestamp: new Date(data.timestamp),
          };
        }
        break;
    }

    return null;
  }

  /**
   * Update price cache with new data
   */
  private updatePriceCache(exchange: string, priceData: any): void {
    this.priceCache.set(exchange, {
      ...priceData,
      receivedAt: new Date(),
    });

    this.emit('priceUpdate', { exchange, priceData });
  }

  /**
   * Detect arbitrage opportunities across all exchange pairs
   */
  private async detectArbitrageOpportunities(): Promise<void> {
    const exchanges = Array.from(this.priceCache.keys());
    const opportunities: ArbitrageOpportunity[] = [];

    // Compare all exchange pairs
    for (let i = 0; i < exchanges.length; i++) {
      for (let j = 0; j < exchanges.length; j++) {
        if (i === j) continue;

        const buyExchange = exchanges[i];
        const sellExchange = exchanges[j];
        
        const opportunity = this.calculateArbitrage(
          buyExchange,
          sellExchange,
          this.priceCache.get(buyExchange),
          this.priceCache.get(sellExchange)
        );

        if (opportunity) {
          opportunities.push(opportunity);
        }
      }
    }

    // Process opportunities by profitability
    opportunities.sort((a, b) => b.expectedProfit - a.expectedProfit);

    for (const opportunity of opportunities) {
      await this.evaluateOpportunity(opportunity);
    }

    this.metrics.opportunitiesDetected += opportunities.length;
  }

  /**
   * Calculate arbitrage opportunity between two exchanges
   */
  private calculateArbitrage(
    buyExchange: string,
    sellExchange: string,
    buyData: any,
    sellData: any
  ): ArbitrageOpportunity | null {
    if (!buyData || !sellData) return null;

    const buyPrice = buyData.askPrice; // We buy at ask price
    const sellPrice = sellData.bidPrice; // We sell at bid price
    
    if (!buyPrice || !sellPrice || sellPrice <= buyPrice) return null;

    const spread = sellPrice - buyPrice;
    const spreadPercent = (spread / buyPrice) * 100;

    if (spreadPercent < this.config.minSpread) return null;

    // Calculate optimal amount considering fees and market depth
    const amount = this.calculateOptimalAmount(buyData, sellData);
    if (amount < 10) return null; // Minimum 10 USDT

    // Calculate fees
    const buyFee = this.getExchangeFee(buyExchange, 'buy');
    const sellFee = this.getExchangeFee(sellExchange, 'sell');
    const tdsRate = sellExchange === 'binance' ? 0.01 : 0; // 1% TDS for Indian exchanges

    // Calculate net profit
    const grossRevenue = amount * sellPrice;
    const totalCost = amount * buyPrice;
    const totalFees = (totalCost * buyFee) + (grossRevenue * sellFee);
    const tdsDeduction = grossRevenue * tdsRate;
    const netRevenue = grossRevenue - totalFees - tdsDeduction;
    const expectedProfit = netRevenue - totalCost;
    const profitPercent = (expectedProfit / totalCost) * 100;

    if (profitPercent < this.config.minProfitPercent) return null;

    // Calculate confidence based on data freshness and spread stability
    const confidence = this.calculateConfidence(buyData, sellData, spreadPercent);
    
    // Determine urgency based on profit and spread
    const urgency = profitPercent > 2.0 ? 'immediate' : 
                   profitPercent > 1.0 ? 'fast' : 'normal';

    return {
      id: this.generateOpportunityId(),
      buyExchange,
      sellExchange,
      symbol: 'USDT/INR',
      buyPrice,
      sellPrice,
      amount,
      spread,
      spreadPercent,
      expectedProfit,
      profitPercent,
      confidence,
      urgency,
      timestamp: new Date(),
      metadata: {
        buyFee,
        sellFee,
        tdsRate,
        dataAge: {
          buy: buyData.receivedAt,
          sell: sellData.receivedAt,
        },
      },
    };
  }

  /**
   * Calculate optimal trading amount
   */
  private calculateOptimalAmount(buyData: any, sellData: any): number {
    // Start with minimum amount and scale up based on volume
    let amount = Math.min(100, this.config.maxAmount); // Start with 100 USDT

    // Adjust based on volume availability
    const buyVolume = buyData.volume || 1000;
    const sellVolume = sellData.volume || 1000;
    const maxVolumeAmount = Math.min(buyVolume, sellVolume) * 0.1; // Use 10% of volume

    amount = Math.min(amount, maxVolumeAmount);
    
    // Ensure minimum viable amount
    return Math.max(amount, 10);
  }

  /**
   * Get exchange trading fee
   */
  private getExchangeFee(exchange: string, side: 'buy' | 'sell'): number {
    const fees: Record<string, { buy: number; sell: number }> = {
      binance: { buy: 0.001, sell: 0.001 }, // 0.1%
      zebpay: { buy: 0.0015, sell: 0.0015 }, // 0.15%
      coindcx: { buy: 0.001, sell: 0.001 }, // 0.1%
      coinswitch: { buy: 0.002, sell: 0.002 }, // 0.2%
    };

    return fees[exchange]?.[side] || 0.002;
  }

  /**
   * Calculate confidence score for opportunity
   */
  private calculateConfidence(buyData: any, sellData: any, spreadPercent: number): number {
    let confidence = 50; // Base confidence

    // Data freshness (0-30 points)
    const buyAge = Date.now() - buyData.receivedAt.getTime();
    const sellAge = Date.now() - sellData.receivedAt.getTime();
    const maxAge = Math.max(buyAge, sellAge);
    
    if (maxAge < 1000) confidence += 30; // Very fresh
    else if (maxAge < 5000) confidence += 20; // Fresh
    else if (maxAge < 10000) confidence += 10; // Acceptable
    // else no bonus for stale data

    // Spread magnitude (0-20 points)
    if (spreadPercent > 3.0) confidence += 20; // Very high spread
    else if (spreadPercent > 2.0) confidence += 15; // High spread
    else if (spreadPercent > 1.0) confidence += 10; // Good spread
    else if (spreadPercent > 0.5) confidence += 5; // Minimum spread

    return Math.min(confidence, 100);
  }

  /**
   * Evaluate and potentially execute opportunity
   */
  private async evaluateOpportunity(opportunity: ArbitrageOpportunity): Promise<void> {
    try {
      // Check if opportunity is still valid (not expired)
      const age = Date.now() - opportunity.timestamp.getTime();
      if (age > this.config.performance.maxOpportunityAge) {
        return; // Too old
      }

      // Check risk limits
      if (!this.checkRiskLimits(opportunity)) {
        return; // Risk limits exceeded
      }

      // Check if similar opportunity is already active
      if (this.hasSimilarActiveOpportunity(opportunity)) {
        return; // Avoid duplicate execution
      }

      console.log(chalk.bgCyan.black(' 💎 ARBITRAGE OPPORTUNITY DETECTED '));
      console.log(chalk.cyan(`${opportunity.buyExchange} → ${opportunity.sellExchange}`));
      console.log(chalk.cyan(`Spread: ${opportunity.spreadPercent.toFixed(3)}%`));
      console.log(chalk.cyan(`Expected Profit: ₹${opportunity.expectedProfit.toFixed(2)} (${opportunity.profitPercent.toFixed(2)}%)`));
      console.log(chalk.cyan(`Confidence: ${opportunity.confidence}%`));
      console.log(chalk.cyan(`Urgency: ${opportunity.urgency.toUpperCase()}`));

      this.emit('opportunityDetected', opportunity);

      // Execute if in live mode and confidence is high enough
      if (this.config.executionMode === 'live' && opportunity.confidence >= 70) {
        await this.executeOpportunity(opportunity);
      } else {
        // Save to database for analysis
        await this.saveOpportunity(opportunity);
      }

    } catch (error) {
      await enhancedErrorHandler.handleError(error as Error, {
        type: ErrorType.SYSTEM_ERROR,
        severity: ErrorSeverity.MEDIUM,
        operation: 'evaluateOpportunity',
        data: { opportunityId: opportunity.id },
      });
    }
  }

  /**
   * Execute arbitrage opportunity
   */
  private async executeOpportunity(opportunity: ArbitrageOpportunity): Promise<void> {
    this.activeOpportunities.set(opportunity.id, opportunity);
    this.metrics.opportunitiesExecuted++;

    try {
      const result = await fastOrderExecutor.executeArbitrageImmediate({
        buyExchange: opportunity.buyExchange,
        sellExchange: opportunity.sellExchange,
        buyPrice: opportunity.buyPrice,
        sellPrice: opportunity.sellPrice,
        amount: opportunity.amount,
        expectedProfit: opportunity.expectedProfit,
        urgency: opportunity.urgency,
      });

      if (result.success) {
        this.metrics.successfulTrades++;
        this.metrics.totalProfit += result.profit || 0;
        this.metrics.bestOpportunity = Math.max(this.metrics.bestOpportunity, result.profit || 0);
        
        console.log(chalk.bgGreen.black(' ✅ ARBITRAGE EXECUTED SUCCESSFULLY '));
        console.log(chalk.green(`Profit: ₹${result.profit?.toFixed(2)} in ${result.latency.toFixed(2)}ms`));
      } else {
        console.log(chalk.bgRed.white(' ❌ ARBITRAGE EXECUTION FAILED '));
        this.metrics.worstLoss = Math.min(this.metrics.worstLoss, -(result.profit || 0));
      }

      // Update average execution time
      this.updateAverageExecutionTime(result.latency);

      this.emit('opportunityExecuted', { opportunity, result });

    } catch (error) {
      await enhancedErrorHandler.handleError(error as Error, {
        type: ErrorType.TRADING_ERROR,
        severity: ErrorSeverity.HIGH,
        operation: 'executeOpportunity',
        data: { opportunityId: opportunity.id },
      });
    } finally {
      this.activeOpportunities.delete(opportunity.id);
    }
  }

  /**
   * Check risk management limits
   */
  private checkRiskLimits(opportunity: ArbitrageOpportunity): boolean {
    // Check maximum concurrent trades
    if (this.activeOpportunities.size >= this.config.riskSettings.maxConcurrentTrades) {
      return false;
    }

    // Check daily loss limit
    const today = new Date().toDateString();
    const todayStats = this.metrics.dailyStats.get(today);
    if (todayStats && todayStats.profit < this.config.riskSettings.maxDailyLoss) {
      return false;
    }

    // Check confidence threshold
    if (opportunity.confidence < 60) {
      return false;
    }

    return true;
  }

  /**
   * Check for similar active opportunities
   */
  private hasSimilarActiveOpportunity(opportunity: ArbitrageOpportunity): boolean {
    for (const active of this.activeOpportunities.values()) {
      if (active.buyExchange === opportunity.buyExchange &&
          active.sellExchange === opportunity.sellExchange) {
        return true;
      }
    }
    return false;
  }

  /**
   * Save opportunity to database
   */
  private async saveOpportunity(opportunity: ArbitrageOpportunity): Promise<void> {
    try {
      await optimizedDb.batchInsert('arbitrage_opportunities', {
        id: opportunity.id,
        buy_exchange: opportunity.buyExchange,
        sell_exchange: opportunity.sellExchange,
        symbol: opportunity.symbol,
        buy_price: opportunity.buyPrice,
        sell_price: opportunity.sellPrice,
        amount: opportunity.amount,
        spread: opportunity.spread,
        spread_percent: opportunity.spreadPercent,
        expected_profit: opportunity.expectedProfit,
        profit_percent: opportunity.profitPercent,
        confidence: opportunity.confidence,
        urgency: opportunity.urgency,
        detected_at: opportunity.timestamp,
        executed: false,
      });
    } catch (error) {
      await enhancedErrorHandler.handleError(error as Error, {
        type: ErrorType.DATABASE_ERROR,
        severity: ErrorSeverity.MEDIUM,
        operation: 'saveOpportunity',
      });
    }
  }

  /**
   * Handle execution results
   */
  private handleExecutionResult(result: any): void {
    // Process execution results for metrics and learning
    this.emit('executionResult', result);
  }

  /**
   * Handle cascading failures
   */
  private handleCascadingFailure(event: any): void {
    console.log(chalk.bgRed.white(' 🚨 CASCADING FAILURE DETECTED - STOPPING ENGINE '));
    this.stop();
  }

  /**
   * Cleanup expired opportunities
   */
  private cleanupExpiredOpportunities(): void {
    const now = Date.now();
    const maxAge = this.config.performance.maxOpportunityAge;

    this.opportunityHistory = this.opportunityHistory.filter(
      opportunity => now - opportunity.timestamp.getTime() < maxAge * 10
    );
  }

  /**
   * Optimize performance based on metrics
   */
  private optimizePerformance(): void {
    // Adjust check intervals based on opportunity frequency
    const recentOpportunities = this.opportunityHistory.filter(
      op => Date.now() - op.timestamp.getTime() < 300000 // Last 5 minutes
    );

    if (recentOpportunities.length > 10) {
      // High opportunity frequency - check more often
      this.config.performance.opportunityCheckInterval = Math.max(50, 
        this.config.performance.opportunityCheckInterval * 0.9);
    } else if (recentOpportunities.length < 2) {
      // Low opportunity frequency - check less often
      this.config.performance.opportunityCheckInterval = Math.min(500,
        this.config.performance.opportunityCheckInterval * 1.1);
    }
  }

  /**
   * Update daily statistics
   */
  private updateDailyStats(): void {
    const today = new Date().toDateString();
    const todayStats = this.metrics.dailyStats.get(today) || {
      opportunities: 0,
      executions: 0,
      profit: 0,
      bestTrade: 0,
      worstTrade: 0,
    };

    this.metrics.dailyStats.set(today, todayStats);
  }

  /**
   * Update average execution time
   */
  private updateAverageExecutionTime(latency: number): void {
    const count = this.metrics.opportunitiesExecuted;
    this.metrics.averageExecutionTime = 
      ((this.metrics.averageExecutionTime * (count - 1)) + latency) / count;
  }

  /**
   * Generate unique opportunity ID
   */
  private generateOpportunityId(): string {
    return `arb_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  }

  /**
   * Get comprehensive metrics
   */
  getMetrics(): any {
    const successRate = this.metrics.opportunitiesExecuted > 0
      ? (this.metrics.successfulTrades / this.metrics.opportunitiesExecuted) * 100
      : 0;

    return {
      ...this.metrics,
      successRate: Math.round(successRate * 100) / 100,
      activeOpportunities: this.activeOpportunities.size,
      cacheSize: this.priceCache.size,
      lastPriceUpdates: Object.fromEntries(this.lastPriceUpdate),
      dailyStats: Object.fromEntries(this.metrics.dailyStats),
      exchangeStatus: optimizedWebSocket.getStatus(),
      performance: {
        opportunityCheckInterval: this.config.performance.opportunityCheckInterval,
        averageExecutionTime: this.metrics.averageExecutionTime,
      },
    };
  }

  /**
   * Update configuration
   */
  updateConfig(updates: Partial<EngineConfig>): void {
    this.config = { ...this.config, ...updates };
    console.log(chalk.yellow('Engine configuration updated'));
    this.emit('configUpdated', this.config);
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    await this.stop();
    await optimizedWebSocket.disconnectAll();
    await fastOrderExecutor.cleanup();
    await optimizedDb.cleanup();
    this.removeAllListeners();
  }
}

export const optimizedArbitrageEngine = new OptimizedArbitrageEngine();