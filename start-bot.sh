#!/bin/bash

# USDT Arbitrage Bot - Master Startup Script
# This script starts all components of the arbitrage bot

echo "🚀 USDT ARBITRAGE BOT - STARTING ALL SYSTEMS"
echo "==========================================="

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Function to check if a port is in use
check_port() {
    if lsof -Pi :$1 -sTCP:LISTEN -t >/dev/null ; then
        echo -e "${RED}❌ Port $1 is already in use${NC}"
        return 1
    else
        echo -e "${GREEN}✅ Port $1 is available${NC}"
        return 0
    fi
}

# Function to start a service
start_service() {
    local name=$1
    local command=$2
    local log_file=$3
    
    echo -e "${YELLOW}Starting $name...${NC}"
    nohup $command > logs/$log_file 2>&1 &
    echo $! > pids/$name.pid
    sleep 2
    
    if ps -p $(cat pids/$name.pid) > /dev/null; then
        echo -e "${GREEN}✅ $name started successfully (PID: $(cat pids/$name.pid))${NC}"
    else
        echo -e "${RED}❌ Failed to start $name${NC}"
        return 1
    fi
}

# Create necessary directories
mkdir -p logs pids

# Check prerequisites
echo -e "\n${YELLOW}Checking prerequisites...${NC}"
check_port 3000 || exit 1
check_port 3001 || exit 1
check_port 3002 || exit 1

# Check if PostgreSQL is running
if pg_isready > /dev/null 2>&1; then
    echo -e "${GREEN}✅ PostgreSQL is running${NC}"
else
    echo -e "${RED}❌ PostgreSQL is not running. Please start it first.${NC}"
    echo "   On macOS: brew services start postgresql"
    echo "   On Linux: sudo systemctl start postgresql"
    exit 1
fi

# Check environment variables
if [ ! -f .env ]; then
    echo -e "${RED}❌ .env file not found${NC}"
    echo "   Please copy .env.example to .env and configure it"
    exit 1
fi

source .env

echo -e "\n${YELLOW}Configuration:${NC}"
echo "  Auto Trading: ${ENABLE_AUTO_TRADING:-false}"
echo "  Min Profit: ₹${MIN_PROFIT_THRESHOLD:-100}"
echo "  Max Trade: ₹${MAX_TRADE_AMOUNT:-10000}"
echo "  Telegram: ${TELEGRAM_ENABLED:-false}"

# Start services
echo -e "\n${YELLOW}Starting services...${NC}"

# 1. Dashboard Server
start_service "dashboard" "npm run dashboard" "dashboard.log"

# 2. Integrated Monitor
start_service "monitor" "npm run monitor:integrated" "monitor.log"

# 3. Mobile API (optional)
if [ "${ENABLE_MOBILE_API:-false}" = "true" ]; then
    start_service "mobile-api" "npm run mobile:trading" "mobile-api.log"
fi

# 4. Health Monitor
start_service "health" "npm run monitor:health" "health.log"

# Display status
echo -e "\n${GREEN}============================================${NC}"
echo -e "${GREEN}✅ ALL SYSTEMS OPERATIONAL!${NC}"
echo -e "${GREEN}============================================${NC}"
echo ""
echo "📊 Dashboard: http://localhost:3001"
echo "📱 Mobile API: http://localhost:3002"
echo "🤖 Telegram Bot: ${TELEGRAM_ENABLED:-false}"
echo "💹 Auto Trading: ${ENABLE_AUTO_TRADING:-false}"
echo ""
echo "📁 Logs are in the 'logs' directory"
echo "🔧 PIDs are in the 'pids' directory"
echo ""
echo "To stop all services: ./stop-bot.sh"
echo "To view logs: tail -f logs/*.log"
echo ""

# Open dashboard in browser
if command -v open &> /dev/null; then
    echo -e "${YELLOW}Opening dashboard in browser...${NC}"
    sleep 3
    open http://localhost:3001
elif command -v xdg-open &> /dev/null; then
    sleep 3
    xdg-open http://localhost:3001
fi

# Monitor logs
echo -e "\n${YELLOW}Monitoring logs (Press Ctrl+C to exit)...${NC}"
tail -f logs/*.log