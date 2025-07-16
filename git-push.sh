#!/bin/bash

echo "🚀 Git Push Script for USDT Arbitrage Bot"
echo "========================================="
echo ""

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: Not in the project directory"
    echo "Please run: cd /Users/srijan/Desktop/usdt-arbitrage-bot"
    exit 1
fi

# Check if git is initialized
if [ ! -d ".git" ]; then
    echo "Initializing Git repository..."
    git init
fi

# Add all files
echo "📁 Adding all files to Git..."
git add .

# Create commit
echo "💾 Creating commit..."
git commit -m "feat: Initial commit - ZebPay API integration complete

- Implemented ZebPay API client with authentication
- Created price monitoring system
- Added mock CoinDCX prices for testing
- Implemented arbitrage detection with fee calculations
- Set up project structure with TypeScript
- Added comprehensive error handling
- Created test scripts and monitoring tools"

# Check if remote exists
if git remote | grep -q "origin"; then
    echo "Remote 'origin' already exists"
else
    # Ask for GitHub username
    echo ""
    read -p "Enter your GitHub username: " GITHUB_USERNAME
    
    # Add remote
    echo "🔗 Adding GitHub remote..."
    git remote add origin "https://github.com/$GITHUB_USERNAME/usdt-arbitrage-bot.git"
fi

# Set main branch
git branch -M main

# Push to GitHub
echo ""
echo "🚀 Pushing to GitHub..."
echo "You may be prompted for your GitHub credentials."
echo ""

git push -u origin main

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Successfully pushed to GitHub!"
    echo ""
    echo "Your repository is now live at:"
    git remote -v | grep origin | grep push | awk '{print $2}' | sed 's/\.git$//'
else
    echo ""
    echo "❌ Push failed. Please check:"
    echo "1. Your GitHub username is correct"
    echo "2. The repository exists on GitHub"
    echo "3. You have the correct permissions"
    echo ""
    echo "You can try again with:"
    echo "git push -u origin main"
fi