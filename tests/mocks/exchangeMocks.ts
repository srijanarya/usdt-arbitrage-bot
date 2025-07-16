export const createMockCoinDCXClient = () => ({
  getPrice: jest.fn(),
  getOrderBook: jest.fn(),
  getEffectivePrice: jest.fn(),
  getFees: jest.fn(),
  calculateTradeFees: jest.fn(),
  get24hStats: jest.fn(),
  subscribeToPriceUpdates: jest.fn(),
  createSignature: jest.fn()
});

export const createMockZebPayClient = () => ({
  getPrice: jest.fn(),
  getOrderBook: jest.fn(),
  calculateMarketImpact: jest.fn(),
  getFees: jest.fn(),
  calculateTotalFees: jest.fn(),
  getTradingLimits: jest.fn(),
  subscribeToPriceStream: jest.fn(),
  reconnectWebSocket: jest.fn()
});