import chalk from 'chalk';
import { errorHandler, ErrorType, ErrorSeverity } from './errors/ErrorHandler';

export interface RetryOptions {
  maxAttempts?: number;
  initialDelay?: number;
  maxDelay?: number;
  backoffMultiplier?: number;
  shouldRetry?: (error: Error, attempt: number) => boolean;
  onRetry?: (error: Error, attempt: number, nextDelay: number) => void;
}

export class RetryMechanism {
  private static defaultOptions: Required<RetryOptions> = {
    maxAttempts: 3,
    initialDelay: 1000,
    maxDelay: 30000,
    backoffMultiplier: 2,
    shouldRetry: (error: Error) => {
      // Don't retry on specific errors
      const nonRetriableMessages = [
        'Invalid API key',
        'Insufficient balance',
        'Order not found',
        'Market closed'
      ];
      
      return !nonRetriableMessages.some(msg => 
        error.message.toLowerCase().includes(msg.toLowerCase())
      );
    },
    onRetry: (error: Error, attempt: number, nextDelay: number) => {
      console.log(chalk.yellow(
        `Retry attempt ${attempt}: ${error.message}. Next retry in ${nextDelay}ms`
      ));
    }
  };

  /**
   * Execute function with retry logic
   */
  static async execute<T>(
    fn: () => Promise<T>,
    options: RetryOptions = {}
  ): Promise<T> {
    const config = { ...this.defaultOptions, ...options };
    let lastError: Error;

    for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error as Error;

        if (attempt === config.maxAttempts || !config.shouldRetry(lastError, attempt)) {
          throw lastError;
        }

        const delay = Math.min(
          config.initialDelay * Math.pow(config.backoffMultiplier, attempt - 1),
          config.maxDelay
        );

        config.onRetry(lastError, attempt, delay);
        await this.delay(delay);
      }
    }

    throw lastError!;
  }

  /**
   * Execute function with circuit breaker pattern
   */
  static createCircuitBreaker<T>(
    fn: (...args: any[]) => Promise<T>,
    options: {
      failureThreshold?: number;
      resetTimeout?: number;
      onOpen?: () => void;
      onClose?: () => void;
    } = {}
  ): (...args: any[]) => Promise<T> {
    const config = {
      failureThreshold: 5,
      resetTimeout: 60000, // 1 minute
      ...options
    };

    let failureCount = 0;
    let lastFailureTime = 0;
    let circuitOpen = false;

    return async (...args: any[]): Promise<T> => {
      // Check if circuit should be reset
      if (circuitOpen && Date.now() - lastFailureTime > config.resetTimeout) {
        circuitOpen = false;
        failureCount = 0;
        config.onClose?.();
        console.log(chalk.green('Circuit breaker closed'));
      }

      // If circuit is open, fail fast
      if (circuitOpen) {
        throw new Error('Circuit breaker is OPEN - service unavailable');
      }

      try {
        const result = await fn(...args);
        
        // Reset failure count on success
        if (failureCount > 0) {
          failureCount = 0;
          console.log(chalk.green('Circuit breaker: Success - failure count reset'));
        }
        
        return result;
      } catch (error) {
        failureCount++;
        lastFailureTime = Date.now();

        if (failureCount >= config.failureThreshold) {
          circuitOpen = true;
          config.onOpen?.();
          
          await errorHandler.handleError(error as Error, {
            type: ErrorType.SYSTEM,
            severity: ErrorSeverity.HIGH,
            operation: 'Circuit breaker opened',
            data: { failureCount, function: fn.name }
          });

          console.log(chalk.red(
            `Circuit breaker OPEN after ${failureCount} failures`
          ));
        }

        throw error;
      }
    };
  }

  /**
   * Retry with different strategies for specific operations
   */
  static async retryWithStrategy<T>(
    operation: string,
    fn: () => Promise<T>,
    strategy: 'aggressive' | 'conservative' | 'exponential' = 'exponential'
  ): Promise<T> {
    const strategies: Record<string, RetryOptions> = {
      aggressive: {
        maxAttempts: 5,
        initialDelay: 100,
        maxDelay: 5000,
        backoffMultiplier: 1.5
      },
      conservative: {
        maxAttempts: 3,
        initialDelay: 5000,
        maxDelay: 60000,
        backoffMultiplier: 3
      },
      exponential: {
        maxAttempts: 4,
        initialDelay: 1000,
        maxDelay: 30000,
        backoffMultiplier: 2
      }
    };

    try {
      return await this.execute(fn, {
        ...strategies[strategy],
        onRetry: (error, attempt, nextDelay) => {
          console.log(chalk.yellow(
            `[${operation}] Retry ${attempt} after error: ${error.message}`
          ));
        }
      });
    } catch (error) {
      await errorHandler.handleError(error as Error, {
        type: ErrorType.SYSTEM,
        severity: ErrorSeverity.MEDIUM,
        operation,
        data: { strategy, finalError: true }
      });
      throw error;
    }
  }

  /**
   * Batch retry for multiple operations
   */
  static async batchRetry<T>(
    operations: Array<{
      name: string;
      fn: () => Promise<T>;
      critical?: boolean;
    }>,
    options: {
      continueOnError?: boolean;
      maxConcurrent?: number;
    } = {}
  ): Promise<Array<{ name: string; result?: T; error?: Error }>> {
    const config = {
      continueOnError: true,
      maxConcurrent: 5,
      ...options
    };

    const results: Array<{ name: string; result?: T; error?: Error }> = [];
    
    // Process in batches
    for (let i = 0; i < operations.length; i += config.maxConcurrent) {
      const batch = operations.slice(i, i + config.maxConcurrent);
      
      const batchResults = await Promise.all(
        batch.map(async (op) => {
          try {
            const result = await this.execute(op.fn, {
              maxAttempts: op.critical ? 5 : 3
            });
            return { name: op.name, result };
          } catch (error) {
            const err = error as Error;
            
            if (!config.continueOnError && op.critical) {
              throw err;
            }
            
            await errorHandler.handleError(err, {
              type: ErrorType.SYSTEM,
              severity: op.critical ? ErrorSeverity.HIGH : ErrorSeverity.MEDIUM,
              operation: `Batch operation: ${op.name}`
            });
            
            return { name: op.name, error: err };
          }
        })
      );
      
      results.push(...batchResults);
    }

    return results;
  }

  /**
   * Helper to delay execution
   */
  private static delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Create a retry wrapper for a class method
   */
  static retryable(options: RetryOptions = {}) {
    return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
      const originalMethod = descriptor.value;

      descriptor.value = async function (...args: any[]) {
        return RetryMechanism.execute(
          () => originalMethod.apply(this, args),
          options
        );
      };

      return descriptor;
    };
  }
}

// Export convenience functions
export const retry = RetryMechanism.execute;
export const retryWithStrategy = RetryMechanism.retryWithStrategy;
export const createCircuitBreaker = RetryMechanism.createCircuitBreaker;
export const batchRetry = RetryMechanism.batchRetry;
export const retryable = RetryMechanism.retryable;