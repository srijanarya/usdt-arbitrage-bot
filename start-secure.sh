#!/bin/bash

echo "🚀 Starting USDT Arbitrage Bot (Secure Mode)"
echo "==========================================="
echo ""

# Check if encrypted credentials exist
if [ ! -f ".credentials.enc" ]; then
    echo "❌ Encrypted credentials not found!"
    echo "Please run ./secure-setup.sh first"
    exit 1
fi

# Start the secure bot
echo "🔐 Starting bot with encrypted credentials..."
npx ts-node start-secure-bot.ts
