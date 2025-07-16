#!/bin/bash

echo "🚀 USDT Arbitrage Bot - Quick Development Setup"
echo "============================================="
echo ""

# Add Homebrew to PATH for Apple Silicon Macs
if [[ -f "/opt/homebrew/bin/brew" ]]; then
    eval "$(/opt/homebrew/bin/brew shellenv)"
fi

# Function to check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

echo "✅ Homebrew is already installed!"

# Install Node.js if not installed
if ! command_exists node; then
    echo "📦 Installing Node.js..."
    brew install node
else
    echo "✅ Node.js is already installed ($(node --version))"
fi

# Install PostgreSQL if not installed
if ! command_exists psql; then
    echo "📦 Installing PostgreSQL..."
    brew install postgresql@15
    brew services start postgresql@15
    echo 'export PATH="/opt/homebrew/opt/postgresql@15/bin:$PATH"' >> ~/.zshrc
    
    # Create database
    createdb arbitrage_bot 2>/dev/null || echo "Database might already exist"
else
    echo "✅ PostgreSQL is already installed"
    # Ensure it's running
    brew services start postgresql@15 2>/dev/null || true
fi

echo ""
echo "✅ All prerequisites ready!"
echo ""
echo "Next: Open Cursor and follow CURSOR_QUICK_START.md"
