# 🧪 USDT Arbitrage Bot - Test Suite Documentation

## Overview

This comprehensive test suite ensures the reliability, performance, and security of the USDT arbitrage bot. The tests cover unit testing, integration testing, end-to-end testing, and performance testing.

## Test Structure

```
tests/
├── unit/                     # Unit tests for individual components
│   └── services/            # Service-specific tests
├── integration/             # Integration tests
├── e2e/                     # End-to-end tests
├── performance/             # Load and performance tests
├── utils/                   # Test utilities and helpers
├── mocks/                   # Mock data and services
├── jest.config.js          # Jest configuration
├── setup.ts                # Test setup and globals
└── README.md               # This file
```

## Running Tests

### Quick Start
```bash
# Run all tests
./run-tests.sh

# Or use npm scripts
npm test                    # Run all tests
npm run test:unit          # Unit tests only
npm run test:integration   # Integration tests only
npm run test:e2e           # E2E tests only
npm run test:coverage      # Generate coverage report
```

### Interactive Test Runner
The `run-tests.sh` script provides an interactive menu:
1. Unit Tests - Test individual components
2. Integration Tests - Test component interactions
3. E2E Tests - Test complete workflows
4. Performance Tests - Load and stress tests
5. All Tests - Run entire test suite
6. Test Coverage Report - Generate and view coverage
7. Watch Mode - Auto-run tests on file changes

## Test Categories

### 1. Unit Tests (`/unit`)

**Purpose**: Test individual components in isolation

**Key Tests**:
- `CredentialManager.test.ts` - Encryption and security
- `DynamicPositionSizer.test.ts` - Position sizing logic
- `PerformanceMonitorAPI.test.ts` - API endpoints

**Example**:
```typescript
describe('DynamicPositionSizer', () => {
  it('should calculate position size within bounds', () => {
    const result = positionSizer.calculatePositionSize(
      { expectedProfit: 2.5, confidence: 0.8 },
      { volatility: 30, liquidityDepth: 50000 }
    );
    expect(result.size).toBeWithinRange(100, 1500);
  });
});
```

### 2. Integration Tests (`/integration`)

**Purpose**: Test how components work together

**Key Tests**:
- `TradingWorkflow.test.ts` - Complete trading cycle
- `arbitrage.test.ts` - Arbitrage detection and execution

**Example**:
```typescript
describe('Trading Workflow Integration', () => {
  it('should execute full arbitrage workflow', async () => {
    // Market analysis → Position sizing → Execution → Monitoring
  });
});
```

### 3. E2E Tests (`/e2e`)

**Purpose**: Test the entire system from user perspective

**Key Tests**:
- `ArbitrageBot.e2e.test.ts` - Full bot operation

**Features Tested**:
- API endpoints availability
- WebSocket connections
- Trading simulation
- Performance monitoring
- Error recovery

### 4. Performance Tests (`/performance`)

**Purpose**: Ensure system performs under load

**Key Tests**:
- Load testing (100+ concurrent requests)
- Stress testing (sustained load)
- Memory leak detection
- Latency distribution analysis

**Metrics**:
- Response time < 100ms (average)
- 95% success rate under load
- 50+ requests per second
- Memory usage stable

## Test Utilities

### Mock Helpers (`/utils/testHelpers.ts`)

**Available Mocks**:
```typescript
// Exchange client mock
const mockExchange = new MockExchangeClient('binance');
await mockExchange.fetchTicker('USDT/INR');

// WebSocket mock
const mockWs = new MockWebSocketClient();
mockWs.connect();

// Gmail monitor mock
const mockGmail = new MockGmailMonitor();
await mockGmail.searchPaymentsByAmount(8850);

// Data generators
const marketData = generateMockMarketData(24); // 24 hours
const trades = generateMockTrades(100);
```

### Custom Matchers

```typescript
// Range matcher
expect(value).toBeWithinRange(min, max);

// Async condition waiter
await waitForCondition(() => server.isReady(), 5000);
```

## Test Coverage

### Current Coverage Goals
- **Branches**: 80%
- **Functions**: 80%
- **Lines**: 80%
- **Statements**: 80%

### Generating Coverage Report
```bash
# Generate report
npm run test:coverage

# View in browser
open coverage/lcov-report/index.html
```

### Critical Areas with 100% Coverage Target
- Security (CredentialManager)
- Risk Management (DynamicPositionSizer)
- Order Execution
- Payment Processing

## Test Environment

### Configuration
Test environment uses `.env.test` with:
- Mock API keys
- Test database
- Disabled live trading
- Reduced thresholds

### Database
Tests use isolated SQLite database that's cleared between test runs.

## CI/CD Integration

### GitHub Actions Example
```yaml
name: Test Suite
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
      - run: npm ci
      - run: npm test
      - run: npm run test:coverage
      - uses: codecov/codecov-action@v1
```

## Best Practices

### 1. Test Isolation
- Each test should be independent
- Clean up after tests
- Use `beforeEach`/`afterEach` for setup/teardown

### 2. Mock External Services
- Never call real APIs in tests
- Use mock implementations
- Test error scenarios

### 3. Descriptive Test Names
```typescript
// Good
it('should reduce position size by 50% after 3 consecutive losses')

// Bad
it('should work correctly')
```

### 4. Test Data
- Use realistic test data
- Test edge cases
- Test error conditions

### 5. Performance
- Keep unit tests fast (<100ms)
- Use timeouts for async tests
- Run heavy tests separately

## Troubleshooting

### Common Issues

**1. Tests timing out**
- Increase timeout in jest.config.js
- Check for unresolved promises
- Ensure mocks are properly configured

**2. Port conflicts**
```bash
# Kill processes on test ports
lsof -ti:3001 | xargs kill -9
lsof -ti:3002 | xargs kill -9
```

**3. Database locks**
- Clear test database: `rm -rf test-data/`
- Ensure proper cleanup in afterEach

**4. Memory issues**
```bash
# Run with increased memory
NODE_OPTIONS=--max-old-space-size=4096 npm test
```

## Adding New Tests

### 1. Create test file
```typescript
// tests/unit/services/NewService.test.ts
import { NewService } from '../../../src/services/NewService';

describe('NewService', () => {
  let service: NewService;
  
  beforeEach(() => {
    service = new NewService();
  });
  
  describe('methodName', () => {
    it('should do something specific', () => {
      // Test implementation
    });
  });
});
```

### 2. Add to appropriate category
- Unit: Individual functions/classes
- Integration: Multi-component flows
- E2E: User workflows
- Performance: Load/stress scenarios

### 3. Update coverage thresholds
If adding critical code, consider increasing coverage requirements.

## Continuous Improvement

### Regular Reviews
- Weekly test failure analysis
- Monthly coverage review
- Quarterly performance baseline update

### Metrics to Track
- Test execution time
- Flaky test frequency
- Coverage trends
- Performance regression

## Support

For test-related issues:
1. Check this README
2. Review failing test output
3. Check CI/CD logs
4. Create issue with test category label