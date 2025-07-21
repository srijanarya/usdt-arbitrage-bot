#!/bin/bash

echo "🚀 STARTING USDT ARBITRAGE BOT"
echo "=============================="
echo ""
echo "This will start:"
echo "1. Web Dashboard (http://localhost:3001)"
echo "2. Price Monitoring with Telegram Alerts"
echo "3. Arbitrage Detection"
echo ""

# Kill any existing processes
echo "Cleaning up old processes..."
pkill -f "dashboard" 2>/dev/null
pkill -f "monitor" 2>/dev/null
lsof -ti:3001 | xargs kill -9 2>/dev/null
sleep 2

# Start dashboard
echo "Starting dashboard..."
npm run dashboard > dashboard.log 2>&1 &
echo "Dashboard PID: $!"
sleep 3

# Start monitor
echo "Starting arbitrage monitor..."
npx tsx simple-monitor.ts

# The monitor will run in foreground so you can see the output