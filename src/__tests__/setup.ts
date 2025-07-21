import dotenv from 'dotenv';

// Load test environment variables
dotenv.config({ path: '.env.test' });

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
};

// Set test timeout
jest.setTimeout(10000);

// Mock process.exit to prevent tests from exiting
jest.spyOn(process, 'exit').mockImplementation((code?: number) => {
  throw new Error(`Process.exit called with code ${code}`);
});

// Clean up after each test
afterEach(() => {
  jest.clearAllMocks();
});

// Global test utilities
global.testUtils = {
  mockDate: (date: Date | string) => {
    const mockDate = new Date(date);
    jest.useFakeTimers();
    jest.setSystemTime(mockDate);
    return mockDate;
  },
  
  restoreDate: () => {
    jest.useRealTimers();
  },
  
  createMockWebSocket: () => ({
    send: jest.fn(),
    close: jest.fn(),
    on: jest.fn(),
    removeAllListeners: jest.fn(),
    readyState: 1, // OPEN
  }),
  
  createMockDatabase: () => ({
    query: jest.fn(),
    connect: jest.fn().mockResolvedValue(true),
    end: jest.fn(),
  }),
  
  sleep: (ms: number) => new Promise(resolve => setTimeout(resolve, ms)),
};

// Declare global test utilities type
declare global {
  var testUtils: {
    mockDate: (date: Date | string) => Date;
    restoreDate: () => void;
    createMockWebSocket: () => any;
    createMockDatabase: () => any;
    sleep: (ms: number) => Promise<void>;
  };
}