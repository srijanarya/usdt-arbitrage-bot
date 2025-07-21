#!/bin/bash

# USDT Arbitrage Bot - Stop Script

echo "🛑 Stopping USDT Arbitrage Bot..."

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Function to stop a service
stop_service() {
    local name=$1
    local pid_file="pids/$name.pid"
    
    if [ -f "$pid_file" ]; then
        PID=$(cat "$pid_file")
        if ps -p $PID > /dev/null; then
            echo -e "${YELLOW}Stopping $name (PID: $PID)...${NC}"
            kill -TERM $PID
            sleep 2
            
            if ps -p $PID > /dev/null; then
                echo -e "${RED}Force killing $name...${NC}"
                kill -9 $PID
            fi
            
            echo -e "${GREEN}✅ $name stopped${NC}"
        else
            echo -e "${YELLOW}$name was not running${NC}"
        fi
        rm -f "$pid_file"
    else
        echo -e "${YELLOW}No PID file found for $name${NC}"
    fi
}

# Stop all services
stop_service "dashboard"
stop_service "monitor"
stop_service "mobile-api"
stop_service "health"

# Kill any remaining node processes related to the bot
echo -e "\n${YELLOW}Cleaning up any remaining processes...${NC}"
pkill -f "tsx src/" 2>/dev/null || true
pkill -f "node.*arbitrage" 2>/dev/null || true

echo -e "\n${GREEN}✅ All services stopped${NC}"

# Optional: Clean up logs
read -p "Do you want to clean up log files? (y/N) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    rm -f logs/*.log
    echo -e "${GREEN}✅ Log files cleaned${NC}"
fi