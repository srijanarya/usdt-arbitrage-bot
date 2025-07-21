import { ValidationUtils, ValidationError } from '../../../utils/ValidationUtils';

describe('ValidationUtils', () => {
  describe('validatePriceData', () => {
    it('should validate correct price data', () => {
      const validData = {
        buyPrice: 83.5,
        sellPrice: 84.2,
        exchange: 'zebpay',
        timestamp: new Date(),
        volume: 1000000,
      };

      const result = ValidationUtils.validatePriceData(validData);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject invalid buy price', () => {
      const invalidData = {
        buyPrice: -10,
        sellPrice: 84.2,
        exchange: 'zebpay',
        timestamp: new Date(),
      };

      const result = ValidationUtils.validatePriceData(invalidData);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Buy price must be a positive number');
    });

    it('should reject buy price greater than sell price', () => {
      const invalidData = {
        buyPrice: 85,
        sellPrice: 84,
        exchange: 'zebpay',
        timestamp: new Date(),
      };

      const result = ValidationUtils.validatePriceData(invalidData);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Buy price must be less than sell price');
    });

    it('should reject missing exchange name', () => {
      const invalidData = {
        buyPrice: 83.5,
        sellPrice: 84.2,
        timestamp: new Date(),
      };

      const result = ValidationUtils.validatePriceData(invalidData);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Exchange name is required');
    });

    it('should reject invalid volume', () => {
      const invalidData = {
        buyPrice: 83.5,
        sellPrice: 84.2,
        exchange: 'zebpay',
        timestamp: new Date(),
        volume: -100,
      };

      const result = ValidationUtils.validatePriceData(invalidData);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Volume must be a non-negative number');
    });
  });

  describe('validateArbitrageOpportunity', () => {
    it('should validate correct arbitrage opportunity', () => {
      const opportunity = {
        buyExchange: 'zebpay',
        sellExchange: 'coindcx',
        buyPrice: 83.5,
        sellPrice: 84.2,
        profit: 692.77, // Calculated for 100000 volume
        profitPercent: 0.69,
        volume: 100000,
      };

      expect(() => ValidationUtils.validateArbitrageOpportunity(opportunity))
        .not.toThrow();
    });

    it('should throw on missing required fields', () => {
      const opportunity = {
        buyExchange: 'zebpay',
        sellExchange: 'coindcx',
        // Missing other fields
      };

      expect(() => ValidationUtils.validateArbitrageOpportunity(opportunity))
        .toThrow(ValidationError);
    });

    it('should validate profit calculations', () => {
      const opportunity = {
        buyExchange: 'zebpay',
        sellExchange: 'coindcx',
        buyPrice: 83.5,
        sellPrice: 84.2,
        profit: 1000, // Incorrect profit
        profitPercent: 0.69,
        volume: 100000,
      };

      expect(() => ValidationUtils.validateArbitrageOpportunity(opportunity))
        .toThrow(/profit.*does not match calculation/);
    });
  });

  describe('validateTradeParams', () => {
    it('should validate correct trade parameters', () => {
      const params = {
        exchange: 'zebpay',
        type: 'buy' as const,
        amount: 5000,
        price: 83.5,
      };

      expect(() => ValidationUtils.validateTradeParams(params))
        .not.toThrow();
    });

    it('should reject invalid exchange', () => {
      const params = {
        exchange: '',
        type: 'buy' as const,
        amount: 5000,
        price: 83.5,
      };

      expect(() => ValidationUtils.validateTradeParams(params))
        .toThrow(ValidationError);
    });

    it('should reject invalid trade type', () => {
      const params = {
        exchange: 'zebpay',
        type: 'invalid' as any,
        amount: 5000,
        price: 83.5,
      };

      expect(() => ValidationUtils.validateTradeParams(params))
        .toThrow(/type.*must be either "buy" or "sell"/);
    });

    it('should reject amount below minimum', () => {
      const params = {
        exchange: 'zebpay',
        type: 'buy' as const,
        amount: 50, // Below minimum
        price: 83.5,
      };

      expect(() => ValidationUtils.validateTradeParams(params))
        .toThrow(/amount.*must be at least 100/);
    });
  });

  describe('validateEnvironment', () => {
    const originalEnv = process.env;

    beforeEach(() => {
      process.env = { ...originalEnv };
    });

    afterEach(() => {
      process.env = originalEnv;
    });

    it('should validate complete environment', () => {
      process.env.DB_HOST = 'localhost';
      process.env.DB_PORT = '5432';
      process.env.DB_NAME = 'test_db';
      process.env.DB_USER = 'postgres';
      process.env.DB_PASSWORD = 'password';

      const result = ValidationUtils.validateEnvironment();
      expect(result.isValid).toBe(true);
      expect(result.missing).toHaveLength(0);
    });

    it('should detect missing required variables', () => {
      delete process.env.DB_HOST;
      delete process.env.DB_PASSWORD;

      const result = ValidationUtils.validateEnvironment();
      expect(result.isValid).toBe(false);
      expect(result.missing).toContain('DB_HOST');
      expect(result.missing).toContain('DB_PASSWORD');
    });

    it('should provide warnings for optional variables', () => {
      process.env.DB_HOST = 'localhost';
      process.env.DB_PORT = '5432';
      process.env.DB_NAME = 'test_db';
      process.env.DB_USER = 'postgres';
      process.env.DB_PASSWORD = 'password';
      delete process.env.TELEGRAM_BOT_TOKEN;

      const result = ValidationUtils.validateEnvironment();
      expect(result.isValid).toBe(true);
      expect(result.warnings).toContain(
        'TELEGRAM_BOT_TOKEN not configured - some features may be limited'
      );
    });
  });

  describe('sanitizeInput', () => {
    it('should sanitize string input', () => {
      const input = "'; DROP TABLE users; --";
      const sanitized = ValidationUtils.sanitizeInput(input);
      expect(sanitized).toBe(' DROP TABLE users --');
      expect(sanitized).not.toContain("'");
      expect(sanitized).not.toContain(';');
    });

    it('should limit string length', () => {
      const longString = 'a'.repeat(2000);
      const sanitized = ValidationUtils.sanitizeInput(longString);
      expect(sanitized.length).toBe(1000);
    });

    it('should sanitize numbers', () => {
      expect(ValidationUtils.sanitizeInput(100)).toBe(100);
      expect(ValidationUtils.sanitizeInput(1e10)).toBe(1e9);
      expect(ValidationUtils.sanitizeInput(-1e10)).toBe(-1e9);
    });

    it('should throw on non-finite numbers', () => {
      expect(() => ValidationUtils.sanitizeInput(Infinity))
        .toThrow(ValidationError);
      expect(() => ValidationUtils.sanitizeInput(NaN))
        .toThrow(ValidationError);
    });

    it('should recursively sanitize objects', () => {
      const input = {
        name: "test'; DROP TABLE",
        value: 1e10,
        nested: {
          field: "another'; test",
        },
      };

      const sanitized = ValidationUtils.sanitizeInput(input);
      expect(sanitized.name).toBe("test DROP TABLE");
      expect(sanitized.value).toBe(1e9);
      expect(sanitized.nested.field).toBe("another test");
    });

    it('should sanitize arrays', () => {
      const input = ["test';", 1e10, { field: "value';" }];
      const sanitized = ValidationUtils.sanitizeInput(input);
      expect(sanitized[0]).toBe("test");
      expect(sanitized[1]).toBe(1e9);
      expect(sanitized[2].field).toBe("value");
    });
  });

  describe('validateApiResponse', () => {
    it('should validate correct API response', async () => {
      const response = {
        success: true,
        data: {
          price: 83.5,
          volume: 1000000,
        },
      };

      const schema = {
        required: ['success', 'data'],
        types: {
          success: 'boolean',
          data: 'object',
        },
      };

      await expect(ValidationUtils.validateApiResponse(response, schema))
        .resolves.not.toThrow();
    });

    it('should reject missing required fields', async () => {
      const response = {
        data: { price: 83.5 },
      };

      const schema = {
        required: ['success', 'data'],
      };

      await expect(ValidationUtils.validateApiResponse(response, schema))
        .rejects.toThrow(ValidationError);
    });

    it('should validate field types', async () => {
      const response = {
        price: '83.5', // String instead of number
        volume: 1000000,
      };

      const schema = {
        types: {
          price: 'number',
          volume: 'number',
        },
      };

      await expect(ValidationUtils.validateApiResponse(response, schema))
        .rejects.toThrow(/expected type number, got string/);
    });

    it('should validate numeric ranges', async () => {
      const response = {
        price: 150,
        volume: -100,
      };

      const schema = {
        ranges: {
          price: { min: 50, max: 100 },
          volume: { min: 0 },
        },
      };

      await expect(ValidationUtils.validateApiResponse(response, schema))
        .rejects.toThrow(/must be <= 100/);
    });
  });

  describe('createValidator', () => {
    it('should create a validator middleware', async () => {
      const validatePositive = ValidationUtils.createValidator<{ value: number }>(
        (data) => {
          if (data.value <= 0) {
            throw new Error('Value must be positive');
          }
        }
      );

      const validData = { value: 10 };
      await expect(validatePositive(validData)).resolves.toEqual(validData);

      const invalidData = { value: -5 };
      await expect(validatePositive(invalidData)).rejects.toThrow('Value must be positive');
    });

    it('should support async validation', async () => {
      const validateAsync = ValidationUtils.createValidator<{ id: string }>(
        async (data) => {
          // Simulate async validation
          await new Promise(resolve => setTimeout(resolve, 10));
          if (!data.id.match(/^[A-Z0-9]+$/)) {
            throw new Error('ID must be alphanumeric uppercase');
          }
        }
      );

      await expect(validateAsync({ id: 'ABC123' })).resolves.toEqual({ id: 'ABC123' });
      await expect(validateAsync({ id: 'abc123' })).rejects.toThrow();
    });
  });
});