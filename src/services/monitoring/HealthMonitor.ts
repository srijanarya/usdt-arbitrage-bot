import chalk from 'chalk';
import os from 'os';
import { EventEmitter } from 'events';
import { databaseService } from '../database/DatabaseService';
import { priceStreamService } from '../websocket/PriceStreamService';
import { telegramBot } from '../telegram/TelegramBotService';
import { errorHandler, ErrorType, ErrorSeverity } from '../../utils/errors/ErrorHandler';

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: Date;
  services: {
    database: ServiceHealth;
    websocket: ServiceHealth;
    telegram: ServiceHealth;
  };
  system: SystemHealth;
  performance: PerformanceMetrics;
}

interface ServiceHealth {
  status: 'up' | 'down' | 'degraded';
  lastCheck: Date;
  error?: string;
  metadata?: any;
}

interface SystemHealth {
  cpuUsage: number;
  memoryUsage: {
    total: number;
    used: number;
    percentage: number;
  };
  uptime: number;
  loadAverage: number[];
}

interface PerformanceMetrics {
  priceUpdatesPerMinute: number;
  opportunitiesPerHour: number;
  averageLatency: number;
  errorRate: number;
}

export class HealthMonitor extends EventEmitter {
  private static instance: HealthMonitor;
  private checkInterval: NodeJS.Timeout | null = null;
  private metrics: {
    priceUpdates: number[];
    opportunities: number[];
    latencies: number[];
    errors: number[];
  } = {
    priceUpdates: [],
    opportunities: [],
    latencies: [],
    errors: []
  };
  
  private lastHealthStatus: HealthStatus | null = null;
  private degradedThreshold = 0.7; // 70% health = degraded
  private unhealthyThreshold = 0.3; // 30% health = unhealthy

  private constructor() {
    super();
    this.setupMetricsCollection();
  }

  static getInstance(): HealthMonitor {
    if (!HealthMonitor.instance) {
      HealthMonitor.instance = new HealthMonitor();
    }
    return HealthMonitor.instance;
  }

  /**
   * Start health monitoring
   */
  start(intervalMs: number = 60000): void {
    if (this.checkInterval) {
      return;
    }

    console.log(chalk.blue('🏥 Starting health monitoring...'));
    
    // Initial check
    this.performHealthCheck();
    
    // Periodic checks
    this.checkInterval = setInterval(() => {
      this.performHealthCheck();
    }, intervalMs);
  }

  /**
   * Stop health monitoring
   */
  stop(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
      console.log(chalk.yellow('Health monitoring stopped'));
    }
  }

  /**
   * Perform comprehensive health check
   */
  private async performHealthCheck(): Promise<void> {
    try {
      const healthStatus: HealthStatus = {
        status: 'healthy',
        timestamp: new Date(),
        services: {
          database: await this.checkDatabaseHealth(),
          websocket: await this.checkWebSocketHealth(),
          telegram: await this.checkTelegramHealth()
        },
        system: await this.checkSystemHealth(),
        performance: this.calculatePerformanceMetrics()
      };

      // Calculate overall health
      const healthScore = this.calculateHealthScore(healthStatus);
      
      if (healthScore < this.unhealthyThreshold) {
        healthStatus.status = 'unhealthy';
      } else if (healthScore < this.degradedThreshold) {
        healthStatus.status = 'degraded';
      }

      // Check for status changes
      if (this.lastHealthStatus && 
          this.lastHealthStatus.status !== healthStatus.status) {
        await this.handleStatusChange(this.lastHealthStatus.status, healthStatus.status);
      }

      this.lastHealthStatus = healthStatus;
      this.emit('healthCheck', healthStatus);

      // Log critical issues
      if (healthStatus.status !== 'healthy') {
        console.log(chalk.yellow(`System health: ${healthStatus.status}`));
      }

    } catch (error) {
      await errorHandler.handleError(error as Error, {
        type: ErrorType.SYSTEM,
        severity: ErrorSeverity.HIGH,
        operation: 'healthCheck'
      });
    }
  }

  /**
   * Check database health
   */
  private async checkDatabaseHealth(): Promise<ServiceHealth> {
    try {
      const start = Date.now();
      const connected = await databaseService.testConnection();
      const latency = Date.now() - start;

      if (!connected) {
        throw new Error('Database connection test failed');
      }

      // Check query performance
      const perfStart = Date.now();
      await databaseService.getLatestPrices();
      const queryTime = Date.now() - perfStart;

      return {
        status: queryTime < 1000 ? 'up' : 'degraded',
        lastCheck: new Date(),
        metadata: {
          connectionLatency: latency,
          queryTime: queryTime
        }
      };
    } catch (error) {
      return {
        status: 'down',
        lastCheck: new Date(),
        error: (error as Error).message
      };
    }
  }

  /**
   * Check WebSocket health
   */
  private async checkWebSocketHealth(): Promise<ServiceHealth> {
    try {
      const connections = priceStreamService.getConnectionStatus();
      const connectedCount = Object.values(connections).filter(c => c).length;
      const totalCount = Object.keys(connections).length;

      if (connectedCount === 0) {
        return {
          status: 'down',
          lastCheck: new Date(),
          error: 'No WebSocket connections active'
        };
      }

      if (connectedCount < totalCount) {
        return {
          status: 'degraded',
          lastCheck: new Date(),
          metadata: {
            connected: connectedCount,
            total: totalCount,
            connections
          }
        };
      }

      return {
        status: 'up',
        lastCheck: new Date(),
        metadata: {
          connected: connectedCount,
          total: totalCount
        }
      };
    } catch (error) {
      return {
        status: 'down',
        lastCheck: new Date(),
        error: (error as Error).message
      };
    }
  }

  /**
   * Check Telegram bot health
   */
  private async checkTelegramHealth(): Promise<ServiceHealth> {
    try {
      const isActive = telegramBot.isAlertActive();
      
      return {
        status: isActive ? 'up' : 'degraded',
        lastCheck: new Date(),
        metadata: {
          alertsActive: isActive
        }
      };
    } catch (error) {
      return {
        status: 'down',
        lastCheck: new Date(),
        error: (error as Error).message
      };
    }
  }

  /**
   * Check system health
   */
  private async checkSystemHealth(): Promise<SystemHealth> {
    const cpus = os.cpus();
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;

    // Calculate CPU usage
    let totalIdle = 0;
    let totalTick = 0;
    
    cpus.forEach(cpu => {
      for (const type in cpu.times) {
        totalTick += cpu.times[type as keyof typeof cpu.times];
      }
      totalIdle += cpu.times.idle;
    });

    const cpuUsage = 100 - ~~(100 * totalIdle / totalTick);

    return {
      cpuUsage,
      memoryUsage: {
        total: totalMemory,
        used: usedMemory,
        percentage: (usedMemory / totalMemory) * 100
      },
      uptime: process.uptime(),
      loadAverage: os.loadavg()
    };
  }

  /**
   * Calculate performance metrics
   */
  private calculatePerformanceMetrics(): PerformanceMetrics {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    const oneHourAgo = now - 3600000;

    // Clean old metrics
    this.metrics.priceUpdates = this.metrics.priceUpdates.filter(t => t > oneMinuteAgo);
    this.metrics.opportunities = this.metrics.opportunities.filter(t => t > oneHourAgo);
    this.metrics.errors = this.metrics.errors.filter(t => t > oneHourAgo);

    // Calculate averages
    const avgLatency = this.metrics.latencies.length > 0
      ? this.metrics.latencies.reduce((a, b) => a + b, 0) / this.metrics.latencies.length
      : 0;

    const errorRate = this.metrics.errors.length / Math.max(1, this.metrics.priceUpdates.length);

    return {
      priceUpdatesPerMinute: this.metrics.priceUpdates.length,
      opportunitiesPerHour: this.metrics.opportunities.length,
      averageLatency: avgLatency,
      errorRate: errorRate * 100
    };
  }

  /**
   * Calculate overall health score
   */
  private calculateHealthScore(status: HealthStatus): number {
    const weights = {
      database: 0.3,
      websocket: 0.4,
      telegram: 0.1,
      system: 0.2
    };

    const serviceScores = {
      database: status.services.database.status === 'up' ? 1 : 
                status.services.database.status === 'degraded' ? 0.5 : 0,
      websocket: status.services.websocket.status === 'up' ? 1 : 
                 status.services.websocket.status === 'degraded' ? 0.5 : 0,
      telegram: status.services.telegram.status === 'up' ? 1 : 
                status.services.telegram.status === 'degraded' ? 0.5 : 0
    };

    // System score based on resources
    const systemScore = 
      (status.system.cpuUsage < 80 ? 1 : 0.5) * 0.5 +
      (status.system.memoryUsage.percentage < 80 ? 1 : 0.5) * 0.5;

    const totalScore = 
      serviceScores.database * weights.database +
      serviceScores.websocket * weights.websocket +
      serviceScores.telegram * weights.telegram +
      systemScore * weights.system;

    return totalScore;
  }

  /**
   * Handle health status changes
   */
  private async handleStatusChange(
    oldStatus: string,
    newStatus: string
  ): Promise<void> {
    const emoji = {
      healthy: '✅',
      degraded: '⚠️',
      unhealthy: '🚨'
    };

    const message = `System health changed: ${emoji[oldStatus as keyof typeof emoji]} ${oldStatus} → ${emoji[newStatus as keyof typeof emoji]} ${newStatus}`;

    console.log(
      newStatus === 'healthy' ? chalk.green(message) :
      newStatus === 'degraded' ? chalk.yellow(message) :
      chalk.red(message)
    );

    await telegramBot.sendSystemAlert(
      'Health Status Change',
      message,
      newStatus === 'unhealthy' ? 'high' : 'medium'
    );
  }

  /**
   * Setup metrics collection
   */
  private setupMetricsCollection(): void {
    // Track price updates
    priceStreamService.on('priceUpdate', () => {
      this.metrics.priceUpdates.push(Date.now());
    });

    // Track opportunities
    priceStreamService.on('arbitrageOpportunity', () => {
      this.metrics.opportunities.push(Date.now());
    });

    // Track errors
    process.on('unhandledRejection', () => {
      this.metrics.errors.push(Date.now());
    });
  }

  /**
   * Record latency measurement
   */
  recordLatency(latency: number): void {
    this.metrics.latencies.push(latency);
    
    // Keep only last 100 measurements
    if (this.metrics.latencies.length > 100) {
      this.metrics.latencies.shift();
    }
  }

  /**
   * Get current health status
   */
  getCurrentHealth(): HealthStatus | null {
    return this.lastHealthStatus;
  }

  /**
   * Force health check
   */
  async forceCheck(): Promise<HealthStatus> {
    await this.performHealthCheck();
    return this.lastHealthStatus!;
  }
}

// Export singleton instance
export const healthMonitor = HealthMonitor.getInstance();