import chalk from 'chalk';
import { telegramBot } from '../../services/telegram/TelegramBotService';
import { databaseService } from '../../services/database/DatabaseService';

export enum ErrorType {
  WEBSOCKET_CONNECTION = 'WEBSOCKET_CONNECTION',
  DATABASE_CONNECTION = 'DATABASE_CONNECTION',
  API_ERROR = 'API_ERROR',
  PARSE_ERROR = 'PARSE_ERROR',
  TRADE_EXECUTION = 'TRADE_EXECUTION',
  AUTHENTICATION = 'AUTHENTICATION',
  RATE_LIMIT = 'RATE_LIMIT',
  NETWORK = 'NETWORK',
  SYSTEM = 'SYSTEM'
}

export enum ErrorSeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL'
}

export interface ErrorContext {
  type: ErrorType;
  severity: ErrorSeverity;
  exchange?: string;
  operation?: string;
  data?: any;
  timestamp: Date;
}

export class ArbitrageError extends Error {
  public readonly context: ErrorContext;
  public readonly originalError?: Error;

  constructor(message: string, context: ErrorContext, originalError?: Error) {
    super(message);
    this.name = 'ArbitrageError';
    this.context = context;
    this.originalError = originalError;
  }
}

export class ErrorHandler {
  private static instance: ErrorHandler;
  private errorLog: ArbitrageError[] = [];
  private maxErrorLogSize = 1000;
  private errorCounters: Map<ErrorType, number> = new Map();
  private lastNotificationTime: Map<string, number> = new Map();
  private notificationCooldown = 300000; // 5 minutes
  private recoveryStrategies: Map<ErrorType, () => Promise<void>> = new Map();

  private constructor() {
    this.setupRecoveryStrategies();
    this.startErrorMonitoring();
  }

  static getInstance(): ErrorHandler {
    if (!ErrorHandler.instance) {
      ErrorHandler.instance = new ErrorHandler();
    }
    return ErrorHandler.instance;
  }

  /**
   * Handle error with appropriate logging and recovery
   */
  async handleError(error: Error | ArbitrageError, context?: Partial<ErrorContext>): Promise<void> {
    const arbitrageError = this.normalizeError(error, context);
    
    // Log error
    this.logError(arbitrageError);
    
    // Display error based on severity
    this.displayError(arbitrageError);
    
    // Send alerts for high severity errors
    if (this.shouldSendAlert(arbitrageError)) {
      await this.sendErrorAlert(arbitrageError);
    }
    
    // Attempt recovery
    await this.attemptRecovery(arbitrageError);
    
    // Store in database for analysis
    await this.storeErrorInDatabase(arbitrageError);
  }

  /**
   * Normalize error to ArbitrageError
   */
  private normalizeError(error: Error | ArbitrageError, context?: Partial<ErrorContext>): ArbitrageError {
    if (error instanceof ArbitrageError) {
      return error;
    }

    const errorContext: ErrorContext = {
      type: context?.type || ErrorType.SYSTEM,
      severity: context?.severity || ErrorSeverity.MEDIUM,
      timestamp: new Date(),
      ...context
    };

    return new ArbitrageError(error.message, errorContext, error);
  }

  /**
   * Log error to memory buffer
   */
  private logError(error: ArbitrageError): void {
    this.errorLog.push(error);
    
    // Maintain log size
    if (this.errorLog.length > this.maxErrorLogSize) {
      this.errorLog.shift();
    }
    
    // Update counters
    const count = this.errorCounters.get(error.context.type) || 0;
    this.errorCounters.set(error.context.type, count + 1);
  }

  /**
   * Display error based on severity
   */
  private displayError(error: ArbitrageError): void {
    const timestamp = error.context.timestamp.toLocaleTimeString('en-IN');
    const prefix = `[${timestamp}] ${error.context.type}`;
    
    switch (error.context.severity) {
      case ErrorSeverity.CRITICAL:
        console.error(chalk.bgRed.white(`\n⚠️  CRITICAL ERROR: ${prefix}`));
        console.error(chalk.red(error.message));
        if (error.originalError?.stack) {
          console.error(chalk.gray(error.originalError.stack));
        }
        break;
      
      case ErrorSeverity.HIGH:
        console.error(chalk.red(`\n❌ ERROR: ${prefix}`));
        console.error(chalk.red(error.message));
        break;
      
      case ErrorSeverity.MEDIUM:
        console.warn(chalk.yellow(`⚠️  Warning: ${prefix}`));
        console.warn(chalk.yellow(error.message));
        break;
      
      case ErrorSeverity.LOW:
        console.log(chalk.gray(`ℹ️  Info: ${prefix} - ${error.message}`));
        break;
    }
  }

  /**
   * Check if alert should be sent
   */
  private shouldSendAlert(error: ArbitrageError): boolean {
    if (error.context.severity === ErrorSeverity.LOW) {
      return false;
    }

    const key = `${error.context.type}-${error.context.severity}`;
    const lastNotification = this.lastNotificationTime.get(key) || 0;
    const now = Date.now();

    if (now - lastNotification < this.notificationCooldown) {
      return false;
    }

    this.lastNotificationTime.set(key, now);
    return true;
  }

  /**
   * Send error alert via Telegram
   */
  private async sendErrorAlert(error: ArbitrageError): Promise<void> {
    const emoji = {
      [ErrorSeverity.CRITICAL]: '🚨',
      [ErrorSeverity.HIGH]: '❌',
      [ErrorSeverity.MEDIUM]: '⚠️',
      [ErrorSeverity.LOW]: 'ℹ️'
    };

    const priority = {
      [ErrorSeverity.CRITICAL]: 'high' as const,
      [ErrorSeverity.HIGH]: 'high' as const,
      [ErrorSeverity.MEDIUM]: 'medium' as const,
      [ErrorSeverity.LOW]: 'low' as const
    };

    const title = `${emoji[error.context.severity]} ${error.context.type}`;
    let message = error.message;

    if (error.context.exchange) {
      message += `\n\nExchange: ${error.context.exchange}`;
    }
    if (error.context.operation) {
      message += `\nOperation: ${error.context.operation}`;
    }

    await telegramBot.sendSystemAlert(title, message, priority[error.context.severity]);
  }

  /**
   * Setup recovery strategies for different error types
   */
  private setupRecoveryStrategies(): void {
    // WebSocket connection recovery
    this.recoveryStrategies.set(ErrorType.WEBSOCKET_CONNECTION, async () => {
      console.log(chalk.blue('🔄 Attempting WebSocket recovery...'));
      // Recovery logic will be handled by the WebSocket service itself
    });

    // Database connection recovery
    this.recoveryStrategies.set(ErrorType.DATABASE_CONNECTION, async () => {
      console.log(chalk.blue('🔄 Attempting database recovery...'));
      const connected = await databaseService.testConnection();
      if (!connected) {
        throw new Error('Database recovery failed');
      }
    });

    // Rate limit recovery
    this.recoveryStrategies.set(ErrorType.RATE_LIMIT, async () => {
      console.log(chalk.blue('🔄 Rate limit hit, waiting before retry...'));
      await new Promise(resolve => setTimeout(resolve, 60000)); // Wait 1 minute
    });
  }

  /**
   * Attempt recovery based on error type
   */
  private async attemptRecovery(error: ArbitrageError): Promise<void> {
    const strategy = this.recoveryStrategies.get(error.context.type);
    if (!strategy) {
      return;
    }

    try {
      await strategy();
      console.log(chalk.green(`✅ Recovery successful for ${error.context.type}`));
    } catch (recoveryError) {
      console.error(chalk.red(`Recovery failed for ${error.context.type}:`, recoveryError));
    }
  }

  /**
   * Store error in database for analysis
   */
  private async storeErrorInDatabase(error: ArbitrageError): Promise<void> {
    try {
      // Create error log table if not exists
      await databaseService.executeQuery(`
        CREATE TABLE IF NOT EXISTS error_logs (
          id SERIAL PRIMARY KEY,
          error_type VARCHAR(50) NOT NULL,
          severity VARCHAR(20) NOT NULL,
          message TEXT NOT NULL,
          context JSONB,
          stack_trace TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Insert error log
      await databaseService.executeQuery(
        `INSERT INTO error_logs (error_type, severity, message, context, stack_trace)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          error.context.type,
          error.context.severity,
          error.message,
          JSON.stringify(error.context),
          error.originalError?.stack || null
        ]
      );
    } catch (dbError) {
      // Don't throw here to avoid infinite loop
      console.error(chalk.red('Failed to store error in database:', dbError));
    }
  }

  /**
   * Start periodic error monitoring
   */
  private startErrorMonitoring(): void {
    // Check error rates every 5 minutes
    setInterval(() => {
      this.checkErrorRates();
    }, 300000);

    // Clean old errors every hour
    setInterval(() => {
      this.cleanOldErrors();
    }, 3600000);
  }

  /**
   * Check error rates and alert if too high
   */
  private async checkErrorRates(): Promise<void> {
    const threshold = 50; // Alert if more than 50 errors in 5 minutes
    const recentErrors = this.errorLog.filter(
      error => Date.now() - error.context.timestamp.getTime() < 300000
    );

    if (recentErrors.length > threshold) {
      const errorBreakdown = new Map<ErrorType, number>();
      recentErrors.forEach(error => {
        const count = errorBreakdown.get(error.context.type) || 0;
        errorBreakdown.set(error.context.type, count + 1);
      });

      let message = `High error rate detected: ${recentErrors.length} errors in last 5 minutes\n\nBreakdown:`;
      errorBreakdown.forEach((count, type) => {
        message += `\n${type}: ${count}`;
      });

      await telegramBot.sendSystemAlert('High Error Rate', message, 'high');
    }
  }

  /**
   * Clean old errors from memory
   */
  private cleanOldErrors(): void {
    const oneHourAgo = Date.now() - 3600000;
    this.errorLog = this.errorLog.filter(
      error => error.context.timestamp.getTime() > oneHourAgo
    );
  }

  /**
   * Get error statistics
   */
  getErrorStats(): {
    total: number;
    byType: Map<ErrorType, number>;
    recent: ArbitrageError[];
  } {
    return {
      total: this.errorLog.length,
      byType: new Map(this.errorCounters),
      recent: this.errorLog.slice(-10)
    };
  }

  /**
   * Clear all error logs
   */
  clearErrors(): void {
    this.errorLog = [];
    this.errorCounters.clear();
    console.log(chalk.yellow('Error logs cleared'));
  }
}

// Export singleton instance
export const errorHandler = ErrorHandler.getInstance();