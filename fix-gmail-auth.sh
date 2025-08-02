#!/bin/bash

echo "🔧 Fixing Gmail Authentication for USDT Arbitrage Bot"
echo "=================================================="

# Check if .env file exists
if [ ! -f .env ]; then
    echo "❌ .env file not found! Creating from example..."
    if [ -f .env.example ]; then
        cp .env.example .env
        echo "✅ Created .env file from example"
    else
        echo "❌ No .env.example found. Creating basic .env file..."
        cat > .env << 'EOF'
# Gmail OAuth Configuration
GMAIL_CLIENT_ID=
GMAIL_CLIENT_SECRET=
GMAIL_REDIRECT_URI=http://localhost:3000/auth/gmail/callback
GMAIL_REFRESH_TOKEN=

# Exchange API Keys (ENCRYPTED - DO NOT COMMIT)
BINANCE_API_KEY=
BINANCE_API_SECRET=
ZEBPAY_API_KEY=
ZEBPAY_API_SECRET=
COINDCX_API_KEY=
COINDCX_API_SECRET=

# Telegram Configuration
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=

# Database
DATABASE_URL=sqlite:./data/arbitrage.db

# Trading Configuration
MIN_PROFIT_THRESHOLD=0.5
MAX_POSITION_SIZE=10
ENABLE_LIVE_TRADING=false
EOF
        echo "✅ Created basic .env file"
    fi
fi

echo ""
echo "📋 Step 1: Setting up Gmail OAuth Credentials"
echo "--------------------------------------------"
echo "You need to create a Gmail OAuth app to monitor payment emails."
echo ""
echo "1. Go to: https://console.cloud.google.com/apis/credentials"
echo "2. Create a new project or select existing"
echo "3. Click 'Create Credentials' > 'OAuth client ID'"
echo "4. Choose 'Web application'"
echo "5. Add authorized redirect URI: http://localhost:3000/auth/gmail/callback"
echo "6. Copy Client ID and Client Secret"
echo ""
read -p "Enter your Gmail Client ID: " CLIENT_ID
read -p "Enter your Gmail Client Secret: " CLIENT_SECRET

# Update .env file with credentials
sed -i.bak "s/GMAIL_CLIENT_ID=.*/GMAIL_CLIENT_ID=$CLIENT_ID/" .env
sed -i.bak "s/GMAIL_CLIENT_SECRET=.*/GMAIL_CLIENT_SECRET=$CLIENT_SECRET/" .env

echo ""
echo "✅ Gmail credentials saved to .env file"
echo ""
echo "📋 Step 2: Running Gmail Authentication Setup"
echo "--------------------------------------------"

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Run the Gmail auth setup
echo "🚀 Starting Gmail authentication process..."
echo ""
npx ts-node src/scripts/setupGmailAuth.ts

echo ""
echo "✅ Gmail authentication setup complete!"
echo ""
echo "📋 Next: Setting up credential encryption..."
echo "Press any key to continue..."
read -n 1