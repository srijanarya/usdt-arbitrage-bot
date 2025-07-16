#!/bin/bash

echo "🚀 Starting USDT Arbitrage Bot Development Session"
echo "================================================"
echo ""

# Function to open new Terminal tab
new_tab() {
    osascript -e "tell application \"Terminal\" to do script \"$1\""
}

echo "📂 Project Directory: /Users/srijan/Desktop/usdt-arbitrage-bot"
echo ""

# Check if PostgreSQL is running
if pgrep -x "postgres" > /dev/null; then
    echo "✅ PostgreSQL is running"
else
    echo "⚠️  PostgreSQL is not running"
    echo "   Run: brew services start postgresql"
fi

echo ""
echo "Opening development windows..."

# Tab 1: Price Monitor
new_tab "cd /Users/srijan/Desktop/usdt-arbitrage-bot && echo '💰 Price Monitor' && echo '===============' && npx ts-node src/monitor.ts"

# Tab 2: Development Server (when ready)
# new_tab "cd /Users/srijan/Desktop/usdt-arbitrage-bot && echo '🔧 Development Server' && echo '==================' && npm run dev"

# Tab 3: Git status
new_tab "cd /Users/srijan/Desktop/usdt-arbitrage-bot && echo '📊 Git Status' && echo '============' && git status && echo '' && echo 'Quick commands:' && echo './quick-commit.sh - Quick commit and push' && echo 'npm test - Run tests' && echo 'npx ts-node src/test-zebpay.ts - Test API'"

echo ""
echo "✅ Development session started!"
echo ""
echo "📋 Quick Reference:"
echo "   Monitor: See real-time arbitrage opportunities"
echo "   Git Tab: Track changes and commit progress"
echo "   "
echo "🎯 Today's Goals:"
echo "   1. ✅ ZebPay API integration"
echo "   2. ✅ Price monitoring"
echo "   3. [ ] WebSocket implementation"
echo "   4. [ ] Database logging"
echo "   5. [ ] Telegram alerts"
echo ""
echo "💡 Remember to commit every 30 minutes!"