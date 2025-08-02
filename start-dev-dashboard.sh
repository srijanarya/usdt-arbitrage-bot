#!/bin/bash

echo "🚀 Starting USDT Bot with Performance Dashboard (Dev Mode)"
echo "========================================================"
echo ""
echo "⚠️  WARNING: Running in development mode without encryption"
echo ""

# Check if .env exists
if [ ! -f ".env" ]; then
    echo "❌ .env file not found!"
    echo "Please create .env file with your API keys"
    exit 1
fi

# Check if required dependencies are installed
if ! command -v node >/dev/null 2>&1; then
    echo "❌ Node.js is not installed"
    exit 1
fi

echo "📊 Starting Performance Dashboard..."
echo ""

# Start the bot with monitoring
echo "Starting bot with performance monitoring..."
npx ts-node bot-with-monitoring.ts &
BOT_PID=$!

echo "✅ Bot started with PID: $BOT_PID"
echo ""

# Wait for services to start
sleep 3

# Display dashboard info
echo "📊 Performance Dashboard is running!"
echo "===================================="
echo ""
echo "🌐 Dashboard URL: http://localhost:3001"
echo ""
echo "📈 Features available:"
echo "  • Real-time profit tracking"
echo "  • Dynamic position sizing info"
echo "  • API latency monitoring"
echo "  • Trade history"
echo "  • Risk indicators"
echo "  • Emergency stop button"
echo ""
echo "📋 Useful commands:"
echo "  • View logs: tail -f logs/*.log"
echo "  • Stop bot: kill $BOT_PID"
echo "  • Health check: ./health-check.sh"
echo ""
echo "Press Ctrl+C to stop the bot..."
echo ""

# Keep the script running
wait $BOT_PID