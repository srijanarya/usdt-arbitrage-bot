import { errorHandler, ErrorType, ErrorSeverity, ArbitrageError } from '../../../utils/errors/ErrorHandler';
import { telegramBot } from '../../../services/telegram/TelegramBotService';
import { databaseService } from '../../../services/database/DatabaseService';

// Mock dependencies
jest.mock('../../../services/telegram/TelegramBotService', () => ({
  telegramBot: {
    sendSystemAlert: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('../../../services/database/DatabaseService', () => ({
  databaseService: {
    executeQuery: jest.fn().mockResolvedValue(undefined),
  },
}));

describe('ErrorHandler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    errorHandler.clearErrors();
  });

  describe('handleError', () => {
    it('should handle a standard Error', async () => {
      const error = new Error('Test error');
      const context = {
        type: ErrorType.SYSTEM,
        severity: ErrorSeverity.MEDIUM,
      };

      await errorHandler.handleError(error, context);

      const stats = errorHandler.getErrorStats();
      expect(stats.total).toBe(1);
      expect(stats.byType.get(ErrorType.SYSTEM)).toBe(1);
    });

    it('should handle an ArbitrageError', async () => {
      const context = {
        type: ErrorType.WEBSOCKET_CONNECTION,
        severity: ErrorSeverity.HIGH,
        exchange: 'zebpay',
        timestamp: new Date(),
      };
      const error = new ArbitrageError('WebSocket failed', context);

      await errorHandler.handleError(error);

      const stats = errorHandler.getErrorStats();
      expect(stats.total).toBe(1);
      expect(stats.byType.get(ErrorType.WEBSOCKET_CONNECTION)).toBe(1);
    });

    it('should send alerts for high severity errors', async () => {
      const error = new Error('Critical error');
      const context = {
        type: ErrorType.DATABASE_CONNECTION,
        severity: ErrorSeverity.HIGH,
      };

      await errorHandler.handleError(error, context);

      expect(telegramBot.sendSystemAlert).toHaveBeenCalledWith(
        expect.stringContaining('DATABASE_CONNECTION'),
        expect.stringContaining('Critical error'),
        'high'
      );
    });

    it('should not send alerts for low severity errors', async () => {
      const error = new Error('Minor issue');
      const context = {
        type: ErrorType.PARSE_ERROR,
        severity: ErrorSeverity.LOW,
      };

      await errorHandler.handleError(error, context);

      expect(telegramBot.sendSystemAlert).not.toHaveBeenCalled();
    });

    it('should respect notification cooldown', async () => {
      const error = new Error('Repeated error');
      const context = {
        type: ErrorType.API_ERROR,
        severity: ErrorSeverity.HIGH,
      };

      // First error should send alert
      await errorHandler.handleError(error, context);
      expect(telegramBot.sendSystemAlert).toHaveBeenCalledTimes(1);

      // Second error within cooldown should not send alert
      await errorHandler.handleError(error, context);
      expect(telegramBot.sendSystemAlert).toHaveBeenCalledTimes(1);
    });

    it('should store errors in database', async () => {
      const error = new Error('Database test error');
      const context = {
        type: ErrorType.SYSTEM,
        severity: ErrorSeverity.MEDIUM,
      };

      await errorHandler.handleError(error, context);

      expect(databaseService.executeQuery).toHaveBeenCalledWith(
        expect.stringContaining('CREATE TABLE IF NOT EXISTS error_logs'),
        undefined
      );

      expect(databaseService.executeQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO error_logs'),
        expect.arrayContaining([
          ErrorType.SYSTEM,
          ErrorSeverity.MEDIUM,
          'Database test error',
        ])
      );
    });
  });

  describe('getErrorStats', () => {
    it('should return correct error statistics', async () => {
      // Add multiple errors
      await errorHandler.handleError(new Error('Error 1'), {
        type: ErrorType.WEBSOCKET_CONNECTION,
        severity: ErrorSeverity.MEDIUM,
      });

      await errorHandler.handleError(new Error('Error 2'), {
        type: ErrorType.WEBSOCKET_CONNECTION,
        severity: ErrorSeverity.HIGH,
      });

      await errorHandler.handleError(new Error('Error 3'), {
        type: ErrorType.DATABASE_CONNECTION,
        severity: ErrorSeverity.LOW,
      });

      const stats = errorHandler.getErrorStats();
      expect(stats.total).toBe(3);
      expect(stats.byType.get(ErrorType.WEBSOCKET_CONNECTION)).toBe(2);
      expect(stats.byType.get(ErrorType.DATABASE_CONNECTION)).toBe(1);
      expect(stats.recent).toHaveLength(3);
    });
  });

  describe('clearErrors', () => {
    it('should clear all error logs', async () => {
      await errorHandler.handleError(new Error('Test'), {
        type: ErrorType.SYSTEM,
        severity: ErrorSeverity.LOW,
      });

      let stats = errorHandler.getErrorStats();
      expect(stats.total).toBe(1);

      errorHandler.clearErrors();

      stats = errorHandler.getErrorStats();
      expect(stats.total).toBe(0);
      expect(stats.byType.size).toBe(0);
    });
  });

  describe('Error context validation', () => {
    it('should handle errors with exchange context', async () => {
      const error = new Error('Exchange specific error');
      const context = {
        type: ErrorType.API_ERROR,
        severity: ErrorSeverity.HIGH,
        exchange: 'coindcx',
        operation: 'placeOrder',
      };

      await errorHandler.handleError(error, context);

      expect(telegramBot.sendSystemAlert).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('Exchange: coindcx'),
        'high'
      );
    });

    it('should handle errors with custom data', async () => {
      const error = new Error('Rate limit exceeded');
      const context = {
        type: ErrorType.RATE_LIMIT,
        severity: ErrorSeverity.MEDIUM,
        data: {
          endpoint: '/api/v1/orders',
          limit: 100,
          window: '1m',
        },
      };

      await errorHandler.handleError(error, context);

      const stats = errorHandler.getErrorStats();
      expect(stats.recent[0].context.data).toEqual(context.data);
    });
  });

  describe('Recovery strategies', () => {
    it('should attempt recovery for database errors', async () => {
      const mockTestConnection = jest.spyOn(databaseService, 'testConnection' as any)
        .mockResolvedValue(true);

      const error = new Error('Database connection lost');
      const context = {
        type: ErrorType.DATABASE_CONNECTION,
        severity: ErrorSeverity.HIGH,
      };

      await errorHandler.handleError(error, context);

      // Recovery should be attempted
      expect(mockTestConnection).toHaveBeenCalled();
      
      mockTestConnection.mockRestore();
    });
  });
});