import { RetryMechanism, retry, createCircuitBreaker } from '../../../utils/RetryMechanism';

describe('RetryMechanism', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('execute', () => {
    it('should succeed on first attempt', async () => {
      const fn = jest.fn().mockResolvedValue('success');
      
      const result = await retry(fn);
      
      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should retry on failure and eventually succeed', async () => {
      const fn = jest.fn()
        .mockRejectedValueOnce(new Error('Fail 1'))
        .mockRejectedValueOnce(new Error('Fail 2'))
        .mockResolvedValue('success');

      const result = await retry(fn, {
        maxAttempts: 3,
        initialDelay: 10,
        onRetry: jest.fn(),
      });

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(3);
    });

    it('should fail after max attempts', async () => {
      const fn = jest.fn().mockRejectedValue(new Error('Always fails'));

      await expect(
        retry(fn, { maxAttempts: 3, initialDelay: 10 })
      ).rejects.toThrow('Always fails');

      expect(fn).toHaveBeenCalledTimes(3);
    });

    it('should apply exponential backoff', async () => {
      let timestamps: number[] = [];
      const fn = jest.fn().mockImplementation(() => {
        timestamps.push(Date.now());
        if (timestamps.length < 3) {
          return Promise.reject(new Error('Fail'));
        }
        return Promise.resolve('success');
      });

      await retry(fn, {
        maxAttempts: 3,
        initialDelay: 100,
        backoffMultiplier: 2,
      });

      // Check delays are increasing
      const delay1 = timestamps[1] - timestamps[0];
      const delay2 = timestamps[2] - timestamps[1];
      
      expect(delay1).toBeGreaterThanOrEqual(90); // ~100ms
      expect(delay2).toBeGreaterThanOrEqual(190); // ~200ms
    });

    it('should respect maxDelay', async () => {
      let attempts = 0;
      const fn = jest.fn().mockImplementation(() => {
        attempts++;
        if (attempts < 5) {
          return Promise.reject(new Error('Fail'));
        }
        return Promise.resolve('success');
      });

      const start = Date.now();
      await retry(fn, {
        maxAttempts: 5,
        initialDelay: 100,
        maxDelay: 150,
        backoffMultiplier: 10, // Would exceed maxDelay
      });

      const duration = Date.now() - start;
      // 4 retries with max 150ms each = 600ms max
      expect(duration).toBeLessThan(800);
    });

    it('should use custom shouldRetry function', async () => {
      const fn = jest.fn()
        .mockRejectedValueOnce(new Error('Retryable error'))
        .mockRejectedValueOnce(new Error('Non-retryable error'));

      const shouldRetry = jest.fn((error: Error) => 
        !error.message.includes('Non-retryable')
      );

      await expect(
        retry(fn, {
          maxAttempts: 3,
          initialDelay: 10,
          shouldRetry,
        })
      ).rejects.toThrow('Non-retryable error');

      expect(fn).toHaveBeenCalledTimes(2);
      expect(shouldRetry).toHaveBeenCalledTimes(2);
    });

    it('should call onRetry callback', async () => {
      const fn = jest.fn()
        .mockRejectedValueOnce(new Error('Fail 1'))
        .mockRejectedValueOnce(new Error('Fail 2'))
        .mockResolvedValue('success');

      const onRetry = jest.fn();

      await retry(fn, {
        maxAttempts: 3,
        initialDelay: 10,
        onRetry,
      });

      expect(onRetry).toHaveBeenCalledTimes(2);
      expect(onRetry).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Fail 1' }),
        1,
        expect.any(Number)
      );
      expect(onRetry).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Fail 2' }),
        2,
        expect.any(Number)
      );
    });
  });

  describe('createCircuitBreaker', () => {
    it('should allow calls when circuit is closed', async () => {
      const fn = jest.fn().mockResolvedValue('success');
      const wrapped = createCircuitBreaker(fn);

      const result = await wrapped();
      
      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should open circuit after failure threshold', async () => {
      const fn = jest.fn().mockRejectedValue(new Error('Service error'));
      const onOpen = jest.fn();
      
      const wrapped = createCircuitBreaker(fn, {
        failureThreshold: 3,
        onOpen,
      });

      // First 2 failures
      for (let i = 0; i < 2; i++) {
        await expect(wrapped()).rejects.toThrow('Service error');
      }
      expect(onOpen).not.toHaveBeenCalled();

      // Third failure opens circuit
      await expect(wrapped()).rejects.toThrow('Service error');
      expect(onOpen).toHaveBeenCalled();

      // Subsequent calls fail fast
      fn.mockClear();
      await expect(wrapped()).rejects.toThrow('Circuit breaker is OPEN');
      expect(fn).not.toHaveBeenCalled();
    });

    it('should reset circuit after timeout', async () => {
      const fn = jest.fn()
        .mockRejectedValueOnce(new Error('Error 1'))
        .mockRejectedValueOnce(new Error('Error 2'))
        .mockRejectedValueOnce(new Error('Error 3'))
        .mockResolvedValue('success');

      const onClose = jest.fn();
      
      const wrapped = createCircuitBreaker(fn, {
        failureThreshold: 3,
        resetTimeout: 100,
        onClose,
      });

      // Open the circuit
      for (let i = 0; i < 3; i++) {
        await expect(wrapped()).rejects.toThrow();
      }

      // Circuit is open
      await expect(wrapped()).rejects.toThrow('Circuit breaker is OPEN');

      // Wait for reset timeout
      await new Promise(resolve => setTimeout(resolve, 150));

      // Circuit should be closed now
      const result = await wrapped();
      expect(result).toBe('success');
      expect(onClose).toHaveBeenCalled();
    });

    it('should reset failure count on success', async () => {
      const fn = jest.fn()
        .mockRejectedValueOnce(new Error('Error 1'))
        .mockRejectedValueOnce(new Error('Error 2'))
        .mockResolvedValueOnce('success')
        .mockRejectedValueOnce(new Error('Error 3'))
        .mockRejectedValueOnce(new Error('Error 4'))
        .mockRejectedValueOnce(new Error('Error 5'));

      const wrapped = createCircuitBreaker(fn, {
        failureThreshold: 3,
      });

      // Two failures
      await expect(wrapped()).rejects.toThrow('Error 1');
      await expect(wrapped()).rejects.toThrow('Error 2');
      
      // Success resets counter
      await expect(wrapped()).resolves.toBe('success');
      
      // Need 3 more failures to open circuit
      await expect(wrapped()).rejects.toThrow('Error 3');
      await expect(wrapped()).rejects.toThrow('Error 4');
      await expect(wrapped()).rejects.toThrow('Error 5');
      
      // Now circuit is open
      await expect(wrapped()).rejects.toThrow('Circuit breaker is OPEN');
    });
  });

  describe('retryWithStrategy', () => {
    it('should use aggressive strategy', async () => {
      const fn = jest.fn()
        .mockRejectedValueOnce(new Error('Fail'))
        .mockResolvedValue('success');

      const result = await RetryMechanism.retryWithStrategy(
        'test-operation',
        fn,
        'aggressive'
      );

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should use conservative strategy', async () => {
      const fn = jest.fn()
        .mockRejectedValueOnce(new Error('Fail'))
        .mockResolvedValue('success');

      const start = Date.now();
      const result = await RetryMechanism.retryWithStrategy(
        'test-operation',
        fn,
        'conservative'
      );
      const duration = Date.now() - start;

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(2);
      expect(duration).toBeGreaterThanOrEqual(4900); // ~5000ms initial delay
    });
  });

  describe('batchRetry', () => {
    it('should execute batch operations', async () => {
      const operations = [
        {
          name: 'op1',
          fn: jest.fn().mockResolvedValue('result1'),
        },
        {
          name: 'op2',
          fn: jest.fn().mockResolvedValue('result2'),
        },
        {
          name: 'op3',
          fn: jest.fn().mockResolvedValue('result3'),
        },
      ];

      const results = await RetryMechanism.batchRetry(operations);

      expect(results).toHaveLength(3);
      expect(results[0]).toEqual({ name: 'op1', result: 'result1' });
      expect(results[1]).toEqual({ name: 'op2', result: 'result2' });
      expect(results[2]).toEqual({ name: 'op3', result: 'result3' });
    });

    it('should handle failures with continueOnError', async () => {
      const operations = [
        {
          name: 'op1',
          fn: jest.fn().mockResolvedValue('result1'),
        },
        {
          name: 'op2',
          fn: jest.fn().mockRejectedValue(new Error('Failed')),
        },
        {
          name: 'op3',
          fn: jest.fn().mockResolvedValue('result3'),
        },
      ];

      const results = await RetryMechanism.batchRetry(operations, {
        continueOnError: true,
      });

      expect(results).toHaveLength(3);
      expect(results[0].result).toBe('result1');
      expect(results[1].error).toBeDefined();
      expect(results[1].error?.message).toBe('Failed');
      expect(results[2].result).toBe('result3');
    });

    it('should stop on critical failure when continueOnError is false', async () => {
      const operations = [
        {
          name: 'op1',
          fn: jest.fn().mockResolvedValue('result1'),
        },
        {
          name: 'op2',
          fn: jest.fn().mockRejectedValue(new Error('Critical')),
          critical: true,
        },
        {
          name: 'op3',
          fn: jest.fn().mockResolvedValue('result3'),
        },
      ];

      await expect(
        RetryMechanism.batchRetry(operations, {
          continueOnError: false,
        })
      ).rejects.toThrow('Critical');
    });

    it('should respect maxConcurrent limit', async () => {
      let concurrent = 0;
      let maxConcurrent = 0;

      const createOperation = (name: string) => ({
        name,
        fn: jest.fn().mockImplementation(async () => {
          concurrent++;
          maxConcurrent = Math.max(maxConcurrent, concurrent);
          await new Promise(resolve => setTimeout(resolve, 50));
          concurrent--;
          return name;
        }),
      });

      const operations = Array.from({ length: 10 }, (_, i) => 
        createOperation(`op${i}`)
      );

      await RetryMechanism.batchRetry(operations, {
        maxConcurrent: 3,
      });

      expect(maxConcurrent).toBeLessThanOrEqual(3);
    });
  });

  describe('retryable decorator', () => {
    it('should retry class methods', async () => {
      let attempts = 0;

      class TestService {
        @RetryMechanism.retryable({ maxAttempts: 3, initialDelay: 10 })
        async fetchData(): Promise<string> {
          attempts++;
          if (attempts < 3) {
            throw new Error('Temporary failure');
          }
          return 'success';
        }
      }

      const service = new TestService();
      const result = await service.fetchData();

      expect(result).toBe('success');
      expect(attempts).toBe(3);
    });
  });
});