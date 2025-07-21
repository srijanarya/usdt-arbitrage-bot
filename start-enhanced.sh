#!/bin/bash

echo "🚀 Starting Enhanced USDT Arbitrage Bot v2.0"
echo "==========================================="
echo ""
echo "Features:"
echo "✅ CCXT Integration (5+ exchanges)"
echo "✅ WebSocket Real-time Updates"
echo "✅ Triangular Arbitrage Detection"
echo "✅ Advanced Risk Management"
echo "✅ Professional Dashboard"
echo ""

# Check if Redis is running (optional for caching)
if command -v redis-cli &> /dev/null; then
    if redis-cli ping > /dev/null 2>&1; then
        echo "✅ Redis is running (caching enabled)"
    else
        echo "⚠️  Redis not running (caching disabled)"
    fi
fi

# Create logs directory
mkdir -p logs

# Kill any existing processes
pkill -f "enhanced-monitor" 2>/dev/null
lsof -ti:3000 | xargs kill -9 2>/dev/null || true
sleep 2

# Start the enhanced monitor
echo "Starting enhanced arbitrage monitor..."
npx tsx src/enhanced-monitor.ts

# The monitor runs in foreground for easy monitoring