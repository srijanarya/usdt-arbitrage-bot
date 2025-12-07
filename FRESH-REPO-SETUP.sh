#!/bin/bash

# Fresh Repository Setup Script
# This creates a clean repo without any secret history for Upwork portfolio

echo "🚀 Creating Fresh Repository (Clean for Upwork)"
echo "================================================"
echo ""

# Step 1: Instructions for GitHub
echo "📋 STEP 1: Create New GitHub Repository"
echo "----------------------------------------"
echo "1. Go to: https://github.com/new"
echo "2. Repository name: usdt-arbitrage-bot"
echo "3. Description: Production-ready USDT arbitrage trading bot with multi-exchange support"
echo "4. Choose: Public"
echo "5. Do NOT initialize with README (we have our own)"
echo "6. Click 'Create repository'"
echo ""
echo "Press ENTER when you've created the repo on GitHub..."
read

# Step 2: Get the repo URL
echo ""
echo "📝 STEP 2: Enter Your GitHub Repository URL"
echo "-------------------------------------------"
echo "Example: https://github.com/yourusername/usdt-arbitrage-bot.git"
echo -n "Paste your repo URL: "
read REPO_URL

# Validate URL
if [[ ! $REPO_URL =~ ^https://github.com/.+/.+\.git$ ]]; then
    echo "❌ Invalid URL format. Should be: https://github.com/username/repo.git"
    exit 1
fi

# Step 3: Create clean copy
echo ""
echo "📦 STEP 3: Creating Clean Copy"
echo "-------------------------------"

cd /Users/srijan
CLEAN_DIR="usdt-arbitrage-bot-clean"

# Remove if exists
if [ -d "$CLEAN_DIR" ]; then
    echo "Removing old clean directory..."
    rm -rf "$CLEAN_DIR"
fi

mkdir "$CLEAN_DIR"
cd "$CLEAN_DIR"

# Copy files (excluding git history and sensitive files)
echo "Copying files..."
cp -r ../usdt-arbitrage-bot/* . 2>/dev/null || true
cp ../usdt-arbitrage-bot/.gitignore . 2>/dev/null || true
cp ../usdt-arbitrage-bot/.dockerignore . 2>/dev/null || true
cp ../usdt-arbitrage-bot/.env.example . 2>/dev/null || true
cp ../usdt-arbitrage-bot/.env.template . 2>/dev/null || true
cp ../usdt-arbitrage-bot/.github/workflows/ci.yml .github/workflows/ 2>/dev/null || true

# Remove git history and sensitive files
echo "Removing old git history..."
rm -rf .git
rm -f .env .env.local .env.backup .current-ip 2>/dev/null || true

# Step 4: Initialize fresh repo
echo ""
echo "🎯 STEP 4: Initializing Fresh Repository"
echo "----------------------------------------"

git init
git add .
git commit -m "feat: Production-ready USDT arbitrage trading bot

Complete automated trading system for cryptocurrency arbitrage:

Features:
- Multi-exchange integration (ZebPay, Binance, CoinDCX, CoinSwitch, KuCoin)
- Real-time opportunity detection with WebSocket connections
- Telegram alerts and notifications
- Web dashboard and mobile interface
- P2P trading automation
- Comprehensive risk management
- Performance monitoring and analytics

Tech Stack:
- TypeScript/Node.js
- PostgreSQL database
- Express.js REST API
- WebSocket real-time updates
- Docker deployment ready
- Comprehensive test coverage

Includes complete documentation for setup, deployment, and usage."

# Step 5: Push to GitHub
echo ""
echo "📤 STEP 5: Pushing to GitHub"
echo "----------------------------"

git branch -M main
git remote add origin "$REPO_URL"
git push -u origin main

# Step 6: Success message
echo ""
echo "✅ SUCCESS! Fresh Repository Created"
echo "===================================="
echo ""
echo "Your new repository is at:"
echo "$REPO_URL"
echo ""
echo "📋 Next Steps for Upwork:"
echo "1. Copy the URL above"
echo "2. Go to Upwork → Profile → Portfolio"
echo "3. Find your project → Click 'Edit'"
echo "4. Update GitHub link with new URL"
echo "5. Save changes"
echo ""
echo "⚠️  You can now DELETE the old repository:"
echo "   Old: https://github.com/YOUR_USERNAME/usdt-arbitrage-bot"
echo "   1. Go to old repo → Settings (bottom)"
echo "   2. Scroll down → 'Delete this repository'"
echo "   3. Type repo name to confirm"
echo ""
echo "The clean directory is at: /Users/srijan/$CLEAN_DIR"
echo "You can use this going forward (no secret history!)"
echo ""
