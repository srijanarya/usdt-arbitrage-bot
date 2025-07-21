import chalk from 'chalk';
import { priceMonitor } from '../services/websocket/SimpleWebSocketMonitor';
import { autoTrader } from '../services/trading/AutomatedTradingService';
import { riskManager } from '../services/trading/RiskManagementService';
import { profitTracker } from '../services/reporting/ProfitTrackingService';
import { PostgresService } from '../services/database/postgresService';
import Table from 'cli-table3';
import os from 'os';
import fs from 'fs/promises';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

interface HealthStatus {
  component: string;
  status: 'healthy' | 'degraded' | 'critical';
  message: string;
  lastCheck: Date;
  metrics?: any;
}

class SystemHealthMonitor {
  private healthChecks: HealthStatus[] = [];
  private startTime = Date.now();
  private checkInterval: NodeJS.Timeout | null = null;
  private logFile = path.join(process.cwd(), 'logs', 'health-monitor.log');

  async start() {
    console.log(chalk.bgGreen.black('\n 🏥 SYSTEM HEALTH MONITOR \n'));
    console.log(chalk.green('Starting continuous health monitoring...\n'));

    // Ensure log directory exists
    await this.ensureLogDirectory();

    // Run initial health check
    await this.runHealthChecks();
    
    // Display initial status
    this.displayHealthStatus();

    // Set up continuous monitoring
    this.checkInterval = setInterval(async () => {
      await this.runHealthChecks();
      this.displayHealthStatus();
    }, 30000); // Check every 30 seconds

    // Set up alert thresholds
    this.setupAlertThresholds();
  }

  /**
   * Run all health checks
   */
  private async runHealthChecks() {
    this.healthChecks = [];

    // System Resources
    await this.checkSystemResources();

    // Database Connection
    await this.checkDatabaseConnection();

    // WebSocket Connections
    await this.checkWebSocketConnections();

    // Trading Service
    await this.checkTradingService();

    // Risk Management
    await this.checkRiskManagement();

    // Price Data Freshness
    await this.checkPriceDataFreshness();

    // API Rate Limits
    await this.checkAPIRateLimits();

    // Disk Space
    await this.checkDiskSpace();

    // Log health status
    await this.logHealthStatus();
  }

  /**
   * Check system resources
   */
  private async checkSystemResources() {
    const memUsage = process.memoryUsage();
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const cpuUsage = os.loadavg()[0]; // 1 minute average

    const memoryUsagePercent = ((totalMem - freeMem) / totalMem) * 100;
    const heapUsagePercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;

    let status: 'healthy' | 'degraded' | 'critical' = 'healthy';
    let message = 'System resources normal';

    if (memoryUsagePercent > 90 || heapUsagePercent > 90) {
      status = 'critical';
      message = 'Memory usage critical';
    } else if (memoryUsagePercent > 80 || heapUsagePercent > 80) {
      status = 'degraded';
      message = 'Memory usage high';
    } else if (cpuUsage > 4) {
      status = 'degraded';
      message = 'CPU load high';
    }

    this.healthChecks.push({
      component: 'System Resources',
      status,
      message,
      lastCheck: new Date(),
      metrics: {
        memoryUsage: `${memoryUsagePercent.toFixed(1)}%`,
        heapUsage: `${heapUsagePercent.toFixed(1)}%`,
        cpuLoad: cpuUsage.toFixed(2),
        uptime: `${Math.floor((Date.now() - this.startTime) / 1000 / 60)} minutes`
      }
    });
  }

  /**
   * Check database connection
   */
  private async checkDatabaseConnection() {
    try {
      const startTime = Date.now();
      await PostgresService.pool.query('SELECT 1');
      const responseTime = Date.now() - startTime;

      let status: 'healthy' | 'degraded' | 'critical' = 'healthy';
      let message = `Connected (${responseTime}ms)`;

      if (responseTime > 1000) {
        status = 'degraded';
        message = `Slow response (${responseTime}ms)`;
      }

      this.healthChecks.push({
        component: 'Database',
        status,
        message,
        lastCheck: new Date(),
        metrics: {
          responseTime: `${responseTime}ms`,
          poolSize: PostgresService.pool.totalCount,
          idleConnections: PostgresService.pool.idleCount
        }
      });
    } catch (error) {
      this.healthChecks.push({
        component: 'Database',
        status: 'critical',
        message: `Connection failed: ${error.message}`,
        lastCheck: new Date()
      });
    }
  }

  /**
   * Check WebSocket connections
   */
  private async checkWebSocketConnections() {
    const wsStatus = priceMonitor.getConnectionStatus();
    const connectedExchanges = Object.entries(wsStatus)
      .filter(([_, connected]) => connected)
      .length;
    const totalExchanges = Object.keys(wsStatus).length;

    let status: 'healthy' | 'degraded' | 'critical' = 'healthy';
    let message = `${connectedExchanges}/${totalExchanges} connected`;

    if (connectedExchanges === 0) {
      status = 'critical';
      message = 'No WebSocket connections';
    } else if (connectedExchanges < totalExchanges) {
      status = 'degraded';
      message = `Only ${connectedExchanges}/${totalExchanges} connected`;
    }

    this.healthChecks.push({
      component: 'WebSocket Connections',
      status,
      message,
      lastCheck: new Date(),
      metrics: {
        connected: connectedExchanges,
        total: totalExchanges,
        exchanges: wsStatus
      }
    });
  }

  /**
   * Check trading service
   */
  private async checkTradingService() {
    const stats = autoTrader.getStats();
    
    let status: 'healthy' | 'degraded' | 'critical' = 'healthy';
    let message = stats.isRunning ? 'Trading active' : 'Trading inactive';

    // Check if approaching daily limit
    if (stats.dailyVolume > stats.dailyLimit * 0.9) {
      status = 'degraded';
      message = 'Approaching daily limit';
    }

    // Check for active executions stuck
    if (stats.activeExecutions > 5) {
      status = 'degraded';
      message = 'Many active executions';
    }

    this.healthChecks.push({
      component: 'Trading Service',
      status,
      message,
      lastCheck: new Date(),
      metrics: {
        isRunning: stats.isRunning,
        dailyVolume: `₹${stats.dailyVolume.toFixed(2)}`,
        dailyProfit: `₹${stats.dailyProfit.toFixed(2)}`,
        activeExecutions: stats.activeExecutions,
        volumeUsage: `${((stats.dailyVolume / stats.dailyLimit) * 100).toFixed(1)}%`
      }
    });
  }

  /**
   * Check risk management
   */
  private async checkRiskManagement() {
    const metrics = riskManager.getMetrics();
    
    let status: 'healthy' | 'degraded' | 'critical' = 'healthy';
    let message = 'Risk parameters normal';

    if (metrics.consecutiveLosses >= 3) {
      status = 'critical';
      message = `${metrics.consecutiveLosses} consecutive losses`;
    } else if (metrics.consecutiveLosses >= 2) {
      status = 'degraded';
      message = `${metrics.consecutiveLosses} consecutive losses`;
    } else if (metrics.dailyPnL < -5000) {
      status = 'critical';
      message = `High daily loss: ₹${metrics.dailyPnL.toFixed(2)}`;
    }

    const winRate = metrics.totalTrades > 0 
      ? (metrics.winningTrades / metrics.totalTrades * 100).toFixed(1)
      : 0;

    this.healthChecks.push({
      component: 'Risk Management',
      status,
      message,
      lastCheck: new Date(),
      metrics: {
        winRate: `${winRate}%`,
        consecutiveLosses: metrics.consecutiveLosses,
        dailyPnL: `₹${metrics.dailyPnL.toFixed(2)}`,
        exposure: `₹${metrics.currentExposure.toFixed(2)}`,
        availableCapital: `₹${metrics.availableCapital.toFixed(2)}`
      }
    });
  }

  /**
   * Check price data freshness
   */
  private async checkPriceDataFreshness() {
    const now = Date.now();
    const priceData = Array.from(priceMonitor['lastPrices'].entries());
    
    let oldestUpdate = now;
    let stalePrices = 0;
    
    priceData.forEach(([exchange, data]) => {
      const age = now - data.timestamp;
      if (age > 60000) { // More than 1 minute old
        stalePrices++;
      }
      if (data.timestamp < oldestUpdate) {
        oldestUpdate = data.timestamp;
      }
    });

    const dataAge = Math.floor((now - oldestUpdate) / 1000);
    
    let status: 'healthy' | 'degraded' | 'critical' = 'healthy';
    let message = `Data fresh (${dataAge}s old)`;

    if (stalePrices === priceData.length) {
      status = 'critical';
      message = 'All price data stale';
    } else if (stalePrices > 0 || dataAge > 60) {
      status = 'degraded';
      message = `${stalePrices} stale prices`;
    }

    this.healthChecks.push({
      component: 'Price Data',
      status,
      message,
      lastCheck: new Date(),
      metrics: {
        oldestData: `${dataAge}s`,
        stalePrices,
        totalPrices: priceData.length
      }
    });
  }

  /**
   * Check API rate limits
   */
  private async checkAPIRateLimits() {
    // Simulated rate limit check - in production, check actual API limits
    const limits = {
      zebpay: { used: 45, limit: 100 },
      binance: { used: 180, limit: 1200 },
      coindcx: { used: 30, limit: 60 }
    };

    let status: 'healthy' | 'degraded' | 'critical' = 'healthy';
    let message = 'API limits normal';
    const warnings: string[] = [];

    Object.entries(limits).forEach(([exchange, limit]) => {
      const usage = (limit.used / limit.limit) * 100;
      if (usage > 90) {
        status = 'critical';
        warnings.push(`${exchange}: ${usage.toFixed(0)}%`);
      } else if (usage > 80) {
        if (status === 'healthy') status = 'degraded';
        warnings.push(`${exchange}: ${usage.toFixed(0)}%`);
      }
    });

    if (warnings.length > 0) {
      message = `High usage: ${warnings.join(', ')}`;
    }

    this.healthChecks.push({
      component: 'API Rate Limits',
      status,
      message,
      lastCheck: new Date(),
      metrics: limits
    });
  }

  /**
   * Check disk space
   */
  private async checkDiskSpace() {
    try {
      const stats = await fs.stat(process.cwd());
      // This is a simplified check - in production use proper disk space library
      
      let status: 'healthy' | 'degraded' | 'critical' = 'healthy';
      let message = 'Disk space adequate';

      // Check log file size
      try {
        const logStats = await fs.stat(this.logFile);
        const logSizeMB = logStats.size / 1024 / 1024;
        
        if (logSizeMB > 100) {
          status = 'degraded';
          message = `Large log file: ${logSizeMB.toFixed(1)}MB`;
        }
      } catch (error) {
        // Log file doesn't exist yet
      }

      this.healthChecks.push({
        component: 'Disk Space',
        status,
        message,
        lastCheck: new Date()
      });
    } catch (error) {
      this.healthChecks.push({
        component: 'Disk Space',
        status: 'degraded',
        message: 'Unable to check disk space',
        lastCheck: new Date()
      });
    }
  }

  /**
   * Display health status
   */
  private displayHealthStatus() {
    console.clear();
    console.log(chalk.bgGreen.black('\n 🏥 SYSTEM HEALTH MONITOR \n'));
    console.log(chalk.gray(`Last update: ${new Date().toLocaleTimeString()}`));
    console.log(chalk.gray(`Uptime: ${Math.floor((Date.now() - this.startTime) / 1000 / 60)} minutes\n`));

    const table = new Table({
      head: ['Component', 'Status', 'Message', 'Metrics'],
      colWidths: [20, 12, 30, 40],
      style: {
        head: ['cyan']
      }
    });

    let hasWarnings = false;
    let hasCritical = false;

    this.healthChecks.forEach(check => {
      let statusDisplay = '';
      switch (check.status) {
        case 'healthy':
          statusDisplay = chalk.green('✅ Healthy');
          break;
        case 'degraded':
          statusDisplay = chalk.yellow('⚠️  Degraded');
          hasWarnings = true;
          break;
        case 'critical':
          statusDisplay = chalk.red('❌ Critical');
          hasCritical = true;
          break;
      }

      const metricsDisplay = check.metrics 
        ? Object.entries(check.metrics)
            .map(([key, value]) => `${key}: ${value}`)
            .join('\n')
        : '';

      table.push([
        check.component,
        statusDisplay,
        check.message,
        metricsDisplay
      ]);
    });

    console.log(table.toString());

    // Overall system status
    console.log('\n' + chalk.cyan('━'.repeat(80)));
    if (hasCritical) {
      console.log(chalk.bgRed.white('\n 🚨 SYSTEM STATUS: CRITICAL ISSUES DETECTED \n'));
    } else if (hasWarnings) {
      console.log(chalk.bgYellow.black('\n ⚠️  SYSTEM STATUS: DEGRADED PERFORMANCE \n'));
    } else {
      console.log(chalk.bgGreen.black('\n ✅ SYSTEM STATUS: ALL SYSTEMS OPERATIONAL \n'));
    }

    // Recommendations
    if (hasCritical || hasWarnings) {
      console.log(chalk.yellow('\n💡 Recommendations:'));
      
      this.healthChecks
        .filter(check => check.status !== 'healthy')
        .forEach(check => {
          switch (check.component) {
            case 'System Resources':
              console.log('  • Consider restarting the application to free memory');
              break;
            case 'Database':
              console.log('  • Check database server status and connection pool');
              break;
            case 'WebSocket Connections':
              console.log('  • Restart price monitor to reconnect WebSockets');
              break;
            case 'Risk Management':
              console.log('  • Review recent trades and consider pausing trading');
              break;
            case 'Price Data':
              console.log('  • Check network connectivity and WebSocket status');
              break;
            case 'API Rate Limits':
              console.log('  • Reduce API call frequency or wait for limit reset');
              break;
          }
        });
    }

    console.log('\n' + chalk.gray('Press Ctrl+C to stop monitoring'));
  }

  /**
   * Set up alert thresholds
   */
  private setupAlertThresholds() {
    // In production, these would trigger actual alerts
    setInterval(() => {
      const critical = this.healthChecks.filter(c => c.status === 'critical');
      if (critical.length > 0) {
        console.log(chalk.red('\n🚨 ALERT: Critical issues detected!'));
        critical.forEach(c => {
          console.log(chalk.red(`  - ${c.component}: ${c.message}`));
        });
      }
    }, 60000); // Check every minute
  }

  /**
   * Log health status to file
   */
  private async logHealthStatus() {
    const logEntry = {
      timestamp: new Date().toISOString(),
      summary: {
        healthy: this.healthChecks.filter(c => c.status === 'healthy').length,
        degraded: this.healthChecks.filter(c => c.status === 'degraded').length,
        critical: this.healthChecks.filter(c => c.status === 'critical').length
      },
      checks: this.healthChecks
    };

    try {
      await fs.appendFile(
        this.logFile,
        JSON.stringify(logEntry) + '\n',
        'utf-8'
      );
    } catch (error) {
      console.error(chalk.red('Failed to write health log:', error.message));
    }
  }

  /**
   * Ensure log directory exists
   */
  private async ensureLogDirectory() {
    const logDir = path.dirname(this.logFile);
    try {
      await fs.mkdir(logDir, { recursive: true });
    } catch (error) {
      console.error(chalk.red('Failed to create log directory:', error.message));
    }
  }

  /**
   * Stop monitoring
   */
  stop() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }
    console.log(chalk.yellow('\n🛑 Health monitoring stopped'));
  }
}

// Start health monitor
const monitor = new SystemHealthMonitor();
monitor.start().catch(console.error);

// Handle graceful shutdown
process.on('SIGINT', () => {
  monitor.stop();
  process.exit(0);
});