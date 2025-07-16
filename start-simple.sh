#!/bin/bash

echo "🚀 Starting Simple USDT Arbitrage Monitor..."
echo "📊 This version works without API keys using public data"
echo ""
echo "Dashboard will be available at: http://localhost:3000"
echo "Press Ctrl+C to stop"
echo ""

# Copy the simple dashboard to public folder
mkdir -p public
cp simple-dashboard.html public/index.html

# Start the simple monitor
node simple-arbitrage-monitor.js