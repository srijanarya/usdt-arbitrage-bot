import { errorHandler, ErrorType, ErrorSeverity } from './errors/ErrorHandler';

export class ValidationError extends Error {
  constructor(field: string, value: any, constraint: string) {
    super(`Validation failed for ${field}: ${constraint}. Got: ${JSON.stringify(value)}`);
    this.name = 'ValidationError';
  }
}

export class ValidationUtils {
  /**
   * Validate price data
   */
  static validatePriceData(data: any): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (typeof data.buyPrice !== 'number' || data.buyPrice <= 0) {
      errors.push('Buy price must be a positive number');
    }

    if (typeof data.sellPrice !== 'number' || data.sellPrice <= 0) {
      errors.push('Sell price must be a positive number');
    }

    if (data.buyPrice && data.sellPrice && data.buyPrice >= data.sellPrice) {
      errors.push('Buy price must be less than sell price');
    }

    if (!data.exchange || typeof data.exchange !== 'string') {
      errors.push('Exchange name is required');
    }

    if (!data.timestamp || !(data.timestamp instanceof Date)) {
      errors.push('Valid timestamp is required');
    }

    if (data.volume !== undefined && (typeof data.volume !== 'number' || data.volume < 0)) {
      errors.push('Volume must be a non-negative number');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate arbitrage opportunity
   */
  static validateArbitrageOpportunity(opportunity: any): void {
    const requiredFields = [
      'buyExchange',
      'sellExchange',
      'buyPrice',
      'sellPrice',
      'profit',
      'profitPercent',
      'volume'
    ];

    for (const field of requiredFields) {
      if (opportunity[field] === undefined || opportunity[field] === null) {
        throw new ValidationError(field, opportunity[field], 'is required');
      }
    }

    // Validate profit calculations
    const expectedProfit = (opportunity.sellPrice - opportunity.buyPrice) * (opportunity.volume / opportunity.buyPrice);
    const tolerance = 0.01; // 1% tolerance for floating point

    if (Math.abs(opportunity.profit - expectedProfit) / expectedProfit > tolerance) {
      throw new ValidationError('profit', opportunity.profit, 
        `does not match calculation. Expected: ${expectedProfit.toFixed(2)}`);
    }

    // Validate profit percentage
    const expectedProfitPercent = (opportunity.profit / opportunity.volume) * 100;
    if (Math.abs(opportunity.profitPercent - expectedProfitPercent) > tolerance) {
      throw new ValidationError('profitPercent', opportunity.profitPercent,
        `does not match calculation. Expected: ${expectedProfitPercent.toFixed(2)}`);
    }
  }

  /**
   * Validate trade parameters
   */
  static validateTradeParams(params: {
    exchange: string;
    type: 'buy' | 'sell';
    amount: number;
    price: number;
  }): void {
    if (!params.exchange || typeof params.exchange !== 'string') {
      throw new ValidationError('exchange', params.exchange, 'must be a valid string');
    }

    if (params.type !== 'buy' && params.type !== 'sell') {
      throw new ValidationError('type', params.type, 'must be either "buy" or "sell"');
    }

    if (typeof params.amount !== 'number' || params.amount <= 0) {
      throw new ValidationError('amount', params.amount, 'must be a positive number');
    }

    if (typeof params.price !== 'number' || params.price <= 0) {
      throw new ValidationError('price', params.price, 'must be a positive number');
    }

    // Validate minimum trade amounts (exchange specific)
    const minAmounts: Record<string, number> = {
      zebpay: 100,    // ₹100 minimum
      coindcx: 50,    // ₹50 minimum
      wazirx: 100,    // ₹100 minimum
      coinswitch: 100 // ₹100 minimum
    };

    const minAmount = minAmounts[params.exchange.toLowerCase()];
    if (minAmount && params.amount < minAmount) {
      throw new ValidationError('amount', params.amount, 
        `must be at least ${minAmount} for ${params.exchange}`);
    }
  }

  /**
   * Validate environment configuration
   */
  static validateEnvironment(): {
    isValid: boolean;
    missing: string[];
    warnings: string[];
  } {
    const required = [
      'DB_HOST',
      'DB_PORT',
      'DB_NAME',
      'DB_USER',
      'DB_PASSWORD'
    ];

    const optional = [
      'TELEGRAM_BOT_TOKEN',
      'TELEGRAM_CHAT_ID',
      'ZEBPAY_API_KEY',
      'ZEBPAY_API_SECRET',
      'COINDCX_API_KEY',
      'COINDCX_API_SECRET'
    ];

    const missing: string[] = [];
    const warnings: string[] = [];

    for (const key of required) {
      if (!process.env[key]) {
        missing.push(key);
      }
    }

    for (const key of optional) {
      if (!process.env[key]) {
        warnings.push(`${key} not configured - some features may be limited`);
      }
    }

    return {
      isValid: missing.length === 0,
      missing,
      warnings
    };
  }

  /**
   * Sanitize input data
   */
  static sanitizeInput(input: any): any {
    if (typeof input === 'string') {
      // Remove any potential SQL injection attempts
      return input
        .replace(/[';\\]/g, '')
        .trim()
        .substring(0, 1000); // Limit length
    }

    if (typeof input === 'number') {
      // Ensure number is finite and within reasonable bounds
      if (!isFinite(input)) {
        throw new ValidationError('number', input, 'must be finite');
      }
      return Math.min(Math.max(input, -1e9), 1e9);
    }

    if (Array.isArray(input)) {
      return input.map(item => this.sanitizeInput(item));
    }

    if (input && typeof input === 'object') {
      const sanitized: any = {};
      for (const [key, value] of Object.entries(input)) {
        sanitized[this.sanitizeInput(key)] = this.sanitizeInput(value);
      }
      return sanitized;
    }

    return input;
  }

  /**
   * Validate API response
   */
  static async validateApiResponse(
    response: any,
    schema: {
      required?: string[];
      types?: Record<string, string>;
      ranges?: Record<string, { min?: number; max?: number }>;
    }
  ): Promise<void> {
    try {
      // Check required fields
      if (schema.required) {
        for (const field of schema.required) {
          if (response[field] === undefined || response[field] === null) {
            throw new ValidationError(field, response[field], 'is required in API response');
          }
        }
      }

      // Check types
      if (schema.types) {
        for (const [field, expectedType] of Object.entries(schema.types)) {
          const actualType = typeof response[field];
          if (response[field] !== undefined && actualType !== expectedType) {
            throw new ValidationError(field, response[field], 
              `expected type ${expectedType}, got ${actualType}`);
          }
        }
      }

      // Check ranges
      if (schema.ranges) {
        for (const [field, range] of Object.entries(schema.ranges)) {
          const value = response[field];
          if (typeof value === 'number') {
            if (range.min !== undefined && value < range.min) {
              throw new ValidationError(field, value, `must be >= ${range.min}`);
            }
            if (range.max !== undefined && value > range.max) {
              throw new ValidationError(field, value, `must be <= ${range.max}`);
            }
          }
        }
      }
    } catch (error) {
      await errorHandler.handleError(error as Error, {
        type: ErrorType.API_ERROR,
        severity: ErrorSeverity.MEDIUM,
        operation: 'validateApiResponse',
        data: { response, schema }
      });
      throw error;
    }
  }

  /**
   * Create validator middleware
   */
  static createValidator<T>(
    validationFn: (data: T) => void | Promise<void>
  ): (data: T) => Promise<T> {
    return async (data: T): Promise<T> => {
      try {
        await validationFn(data);
        return data;
      } catch (error) {
        await errorHandler.handleError(error as Error, {
          type: ErrorType.PARSE_ERROR,
          severity: ErrorSeverity.MEDIUM,
          operation: 'validation',
          data
        });
        throw error;
      }
    };
  }
}