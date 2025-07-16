#!/bin/bash

echo "🧪 Running USDT Arbitrage Bot Test Suite"
echo "========================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}Installing dependencies...${NC}"
    npm install
fi

# Install test dependencies if missing
if [ ! -d "node_modules/ts-jest" ]; then
    echo -e "${YELLOW}Installing test dependencies...${NC}"
    npm install --save-dev ts-jest
fi

# Run tests with different options based on argument
case "$1" in
    "watch")
        echo -e "${GREEN}Running tests in watch mode...${NC}"
        npm run test:watch
        ;;
    "coverage")
        echo -e "${GREEN}Running tests with coverage...${NC}"
        npm run test:coverage
        echo -e "${YELLOW}Coverage report generated in ./coverage/index.html${NC}"
        ;;
    "ci")
        echo -e "${GREEN}Running tests in CI mode...${NC}"
        npm run test:ci
        ;;
    *)
        echo -e "${GREEN}Running all tests...${NC}"
        npm test
        ;;
esac

# Check test results
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ All tests passed!${NC}"
else
    echo -e "${RED}❌ Some tests failed. Check the output above.${NC}"
    exit 1
fi