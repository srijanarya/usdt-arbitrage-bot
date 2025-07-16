#!/bin/bash

echo "🚀 USDT Arbitrage Bot - Development Environment Setup"
echo "=================================================="
echo ""

# Function to check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Install Homebrew if not installed
if ! command_exists brew; then
    echo "📦 Installing Homebrew..."
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
    
    # Add Homebrew to PATH for Apple Silicon Macs
    if [[ -f "/opt/homebrew/bin/brew" ]]; then
        echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> ~/.zprofile
        eval "$(/opt/homebrew/bin/brew shellenv)"
    fi
else
    echo "✅ Homebrew is already installed"
fi

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
else
    echo "✅ PostgreSQL is already installed"
fi

# Install Git if not installed
if ! command_exists git; then
    echo "📦 Installing Git..."
    brew install git
else
    echo "✅ Git is already installed"
fi

echo ""
echo "✅ All prerequisites installed successfully!"
echo ""
echo "Please run: source ~/.zshrc"
echo "Then run: ./init-project.sh"
