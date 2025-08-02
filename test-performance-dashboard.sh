#!/bin/bash

echo "🧪 Testing Performance Dashboard"
echo "==============================="
echo ""

# Start the test bot
echo "Starting test bot with monitoring..."
npx ts-node bot-with-monitoring.ts &
BOT_PID=$!

echo "Bot started with PID: $BOT_PID"
echo ""

# Wait for services to start
sleep 3

# Open dashboard
echo "📊 Opening performance dashboard..."
if command -v open >/dev/null 2>&1; then
    open http://localhost:3001
elif command -v xdg-open >/dev/null 2>&1; then
    xdg-open http://localhost:3001
else
    echo "Please open http://localhost:3001 in your browser"
fi

echo ""
echo "Dashboard is running!"
echo "Press Ctrl+C to stop..."
echo ""

# Wait for user to stop
wait $BOT_PID
