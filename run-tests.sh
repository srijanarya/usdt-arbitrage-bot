#!/bin/bash

echo "🧪 USDT Arbitrage Bot - Comprehensive Test Suite"
echo "=============================================="
echo ""

# Check if required dependencies are installed
if ! command -v jest >/dev/null 2>&1; then
    echo "📦 Installing test dependencies..."
    npm install --save-dev jest @types/jest ts-jest supertest @types/supertest
    npm install --save-dev @types/ws ws axios
fi

# Create test environment file if it doesn't exist
if [ ! -f ".env.test" ]; then
    echo "📝 Creating test environment..."
    cat > .env.test << EOF
NODE_ENV=test
ENABLE_LIVE_TRADING=false
MIN_PROFIT_THRESHOLD=0.5
MAX_POSITION_SIZE=10
INITIAL_CAPITAL=10000

# Test API Keys (not real)
BINANCE_API_KEY=test-binance-key
BINANCE_API_SECRET=test-binance-secret
ZEBPAY_API_KEY=test-zebpay-key
ZEBPAY_API_SECRET=test-zebpay-secret
COINDCX_API_KEY=test-coindcx-key
COINDCX_API_SECRET=test-coindcx-secret

# Test Gmail (not real)
GMAIL_CLIENT_ID=test-gmail-client-id
GMAIL_CLIENT_SECRET=test-gmail-client-secret
GMAIL_REFRESH_TOKEN=test-refresh-token

# Test Database
DATABASE_URL=sqlite:./test-data/test-arbitrage.db
EOF
    echo "✅ Test environment created"
fi

# Menu for test selection
echo "Select test suite to run:"
echo "1. Unit Tests"
echo "2. Integration Tests"
echo "3. E2E Tests"
echo "4. Performance Tests"
echo "5. All Tests"
echo "6. Test Coverage Report"
echo "7. Watch Mode (Unit Tests)"
echo ""
read -p "Enter your choice (1-7): " choice

case $choice in
    1)
        echo "🔧 Running Unit Tests..."
        npx jest tests/unit --config=tests/jest.config.js
        ;;
    2)
        echo "🔗 Running Integration Tests..."
        npx jest tests/integration --config=tests/jest.config.js
        ;;
    3)
        echo "🌐 Running E2E Tests..."
        echo "Starting test server..."
        npm run dashboard:test &
        SERVER_PID=$!
        sleep 5
        npx jest tests/e2e --config=tests/jest.config.js
        kill $SERVER_PID
        ;;
    4)
        echo "⚡ Running Performance Tests..."
        echo "Starting test server..."
        npm run dashboard:test &
        SERVER_PID=$!
        sleep 5
        npx jest tests/performance --config=tests/jest.config.js
        kill $SERVER_PID
        ;;
    5)
        echo "🚀 Running All Tests..."
        npx jest --config=tests/jest.config.js
        ;;
    6)
        echo "📊 Generating Test Coverage Report..."
        npx jest --coverage --config=tests/jest.config.js
        echo ""
        echo "📂 Coverage report saved to: coverage/lcov-report/index.html"
        echo "Opening coverage report..."
        if command -v open >/dev/null 2>&1; then
            open coverage/lcov-report/index.html
        elif command -v xdg-open >/dev/null 2>&1; then
            xdg-open coverage/lcov-report/index.html
        fi
        ;;
    7)
        echo "👀 Running Tests in Watch Mode..."
        npx jest tests/unit --watch --config=tests/jest.config.js
        ;;
    *)
        echo "❌ Invalid choice"
        exit 1
        ;;
esac

echo ""
echo "✅ Test run complete!"