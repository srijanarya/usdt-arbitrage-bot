#!/bin/bash

echo "⚠️  Starting USDT Arbitrage Bot (Development Mode)"
echo "================================================"
echo ""
echo "WARNING: This mode uses unencrypted credentials from .env"
echo "Only use this for development and testing!"
echo ""
read -p "Continue? (y/n): " CONTINUE

if [ "$CONTINUE" != "y" ]; then
    echo "Exiting..."
    exit 0
fi

# Check if .env has actual credentials (not ENCRYPTED placeholders)
if grep -q "BINANCE_API_KEY=ENCRYPTED" .env; then
    echo "❌ Credentials are encrypted. Use ./start-secure.sh instead"
    exit 1
fi

# Start in development mode
npm run bot
