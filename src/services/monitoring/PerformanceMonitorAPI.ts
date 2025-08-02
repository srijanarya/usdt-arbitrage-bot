import express from 'express';
import path from 'path';
import { logger } from '../../utils/logger';
import { getPositionSizer } from '../../config/tradingConfig';
import { volatilityCalculator } from '../analysis/MarketVolatilityCalculator';

interface MetricsData {
  totalProfit: number;
  currentCapital: number;
  winRate: number;
  activePositions: number;
  apiLatency: number;
  uptime: number;
  status: 'active' | 'warning' | 'error';
  profitHistory: Array<{ timestamp: Date; cumulative: number }>;
  recentTrades: Array<{
    timestamp: Date;
    pair: string;
    type: string;
    profit: number;
  }>;
  risk: {
    currentDrawdown: number;
    volatility: number;
    liquidityStatus: string;
  };
  positionSizing: {
    currentPercent: number;
    kellyFraction: number;
    consecutiveLosses: number;
    riskAdjustment: number;
  };
}

export class PerformanceMonitorAPI {
  private app: express.Application;
  private port: number;
  private startTime: Date;
  private metrics: Partial<MetricsData> = {
    totalProfit: 0,
    currentCapital: parseFloat(process.env.INITIAL_CAPITAL || '10000'),
    winRate: 0,
    activePositions: 0,
    apiLatency: 0,
    uptime: 0,
    status: 'active',
    profitHistory: [],
    recentTrades: []
  };
  
  // Performance tracking
  private apiCallCount = 0;
  private apiTotalLatency = 0;
  private tradeHistory: any[] = [];
  private profitHistory: Array<{ timestamp: Date; cumulative: number }> = [];

  constructor(port: number = 3001) {
    this.port = port;
    this.app = express();
    this.startTime = new Date();
    this.setupMiddleware();
    this.setupRoutes();
  }

  private setupMiddleware() {
    this.app.use(express.json());
    this.app.use(express.static(path.join(__dirname, '../../dashboard')));
    
    // CORS for development
    this.app.use((req, res, next) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Headers', 'Content-Type');
      res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
      next();
    });
  }

  private setupRoutes() {
    // Serve dashboard
    this.app.get('/', (req, res) => {
      res.sendFile(path.join(__dirname, '../../dashboard/performance-monitor.html'));
    });

    // Metrics API
    this.app.get('/api/metrics', (req, res) => {
      const metrics = this.calculateMetrics();
      res.json(metrics);
    });

    // Export data
    this.app.get('/api/export', (req, res) => {
      const data = {
        exportTime: new Date(),
        metrics: this.calculateMetrics(),
        fullTradeHistory: this.tradeHistory,
        configuration: {
          initialCapital: process.env.INITIAL_CAPITAL,
          minProfitThreshold: process.env.MIN_PROFIT_THRESHOLD,
          exchanges: ['binance', 'coindcx', 'zebpay']
        }
      };
      
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', 'attachment; filename="bot-metrics-export.json"');
      res.send(JSON.stringify(data, null, 2));
    });

    // Emergency stop
    this.app.post('/api/emergency-stop', async (req, res) => {
      try {
        logger.warn('EMERGENCY STOP TRIGGERED via dashboard');
        
        // TODO: Implement actual emergency stop logic
        // This should:
        // 1. Cancel all open orders
        // 2. Close all positions
        // 3. Stop the bot gracefully
        
        // For now, just log and respond
        this.updateMetric('status', 'error');
        
        res.json({ success: true, message: 'Emergency stop executed' });
      } catch (error) {
        logger.error('Emergency stop failed:', error);
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // Update metrics endpoints (called by bot)
    this.app.post('/api/update-trade', (req, res) => {
      const trade = req.body;
      this.recordTrade(trade);
      res.json({ success: true });
    });

    this.app.post('/api/update-api-latency', (req, res) => {
      const { latency } = req.body;
      this.updateApiLatency(latency);
      res.json({ success: true });
    });

    this.app.post('/api/update-position', (req, res) => {
      const { positions } = req.body;
      this.updateMetric('activePositions', positions);
      res.json({ success: true });
    });
  }

  private calculateMetrics(): MetricsData {
    // Calculate uptime
    const uptime = Math.floor((Date.now() - this.startTime.getTime()) / 1000);
    
    // Calculate win rate
    const wins = this.tradeHistory.filter(t => t.profit > 0).length;
    const winRate = this.tradeHistory.length > 0 
      ? (wins / this.tradeHistory.length) * 100 
      : 0;
    
    // Get position sizing info
    const positionSizer = getPositionSizer();
    const sizingParams = positionSizer.getParameters();
    
    // Get market conditions
    const marketConditions = volatilityCalculator.getMarketConditions('USDT/INR');
    
    // Calculate drawdown
    const currentDrawdown = this.calculateDrawdown();
    
    // Calculate risk adjustment
    const riskAdjustment = this.calculateRiskAdjustment(marketConditions);
    
    return {
      totalProfit: this.metrics.totalProfit || 0,
      currentCapital: this.metrics.currentCapital || 0,
      winRate,
      activePositions: this.metrics.activePositions || 0,
      apiLatency: this.apiCallCount > 0 
        ? Math.round(this.apiTotalLatency / this.apiCallCount) 
        : 0,
      uptime,
      status: this.metrics.status || 'active',
      profitHistory: this.profitHistory.slice(-100), // Last 100 points
      recentTrades: this.tradeHistory.slice(-10), // Last 10 trades
      risk: {
        currentDrawdown,
        volatility: marketConditions.volatility,
        liquidityStatus: this.getLiquidityStatus()
      },
      positionSizing: {
        currentPercent: sizingParams.currentStats.currentCapital > 0
          ? (this.calculateCurrentPositionValue() / sizingParams.currentStats.currentCapital) * 100
          : 0,
        kellyFraction: sizingParams.currentStats.winRate * 
          (sizingParams.currentStats.avgWin / sizingParams.currentStats.avgLoss) - 
          (1 - sizingParams.currentStats.winRate),
        consecutiveLosses: sizingParams.currentStats.consecutiveLosses,
        riskAdjustment
      }
    };
  }

  private calculateDrawdown(): number {
    if (this.profitHistory.length === 0) return 0;
    
    let maxValue = this.metrics.currentCapital || 0;
    let maxDrawdown = 0;
    
    for (const point of this.profitHistory) {
      const value = (this.metrics.currentCapital || 0) - 
                   ((this.metrics.totalProfit || 0) - point.cumulative);
      maxValue = Math.max(maxValue, value);
      const drawdown = ((maxValue - value) / maxValue) * 100;
      maxDrawdown = Math.max(maxDrawdown, drawdown);
    }
    
    return maxDrawdown;
  }

  private calculateRiskAdjustment(conditions: any): number {
    let adjustment = 1.0;
    
    // Volatility adjustment
    if (conditions.volatility > 70) adjustment *= 0.7;
    else if (conditions.volatility > 50) adjustment *= 0.85;
    
    // Drawdown adjustment
    const drawdown = this.calculateDrawdown();
    if (drawdown > 10) adjustment *= 0.8;
    else if (drawdown > 5) adjustment *= 0.9;
    
    return adjustment;
  }

  private calculateCurrentPositionValue(): number {
    // TODO: Calculate actual position value from open positions
    // For now, return a percentage of capital
    return (this.metrics.currentCapital || 0) * 0.1;
  }

  private getLiquidityStatus(): string {
    // TODO: Get actual liquidity from exchanges
    // For now, return based on time of day
    const hour = new Date().getHours();
    if (hour >= 10 && hour <= 16) return 'Good';
    if (hour >= 8 && hour <= 18) return 'Fair';
    return 'Low';
  }

  public recordTrade(trade: {
    pair: string;
    type: 'buy' | 'sell';
    profit: number;
    timestamp?: Date;
  }) {
    const tradeRecord = {
      ...trade,
      timestamp: trade.timestamp || new Date()
    };
    
    this.tradeHistory.push(tradeRecord);
    
    // Update total profit
    this.metrics.totalProfit = (this.metrics.totalProfit || 0) + trade.profit;
    this.metrics.currentCapital = (this.metrics.currentCapital || 0) + trade.profit;
    
    // Update profit history
    this.profitHistory.push({
      timestamp: new Date(),
      cumulative: this.metrics.totalProfit
    });
    
    // Keep only last 1000 trades
    if (this.tradeHistory.length > 1000) {
      this.tradeHistory.shift();
    }
    
    logger.info('Trade recorded', tradeRecord);
  }

  public updateApiLatency(latency: number) {
    this.apiCallCount++;
    this.apiTotalLatency += latency;
    
    // Keep rolling average of last 1000 calls
    if (this.apiCallCount > 1000) {
      this.apiCallCount = 1;
      this.apiTotalLatency = latency;
    }
  }

  public updateMetric(key: keyof MetricsData, value: any) {
    (this.metrics as any)[key] = value;
  }

  public async start() {
    return new Promise<void>((resolve) => {
      this.app.listen(this.port, () => {
        logger.info(`Performance monitor API started on port ${this.port}`);
        logger.info(`Dashboard available at http://localhost:${this.port}`);
        resolve();
      });
    });
  }

  public stop() {
    // TODO: Implement graceful shutdown
    logger.info('Performance monitor API stopped');
  }
}

// Create singleton instance
export const performanceMonitor = new PerformanceMonitorAPI();