#!/bin/bash

# USDT Arbitrage Bot - Quick Start Script
# This script helps you get started quickly with the arbitrage bot

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Banner
echo -e "${BLUE}"
echo "╔═══════════════════════════════════════════╗"
echo "║      USDT Arbitrage Bot Quick Start       ║"
echo "╚═══════════════════════════════════════════╝"
echo -e "${NC}"

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Step 1: Check prerequisites
echo -e "${YELLOW}📋 Checking prerequisites...${NC}"

if ! command_exists node; then
    echo -e "${RED}❌ Node.js not found. Please install Node.js 18+${NC}"
    echo "Visit: https://nodejs.org/"
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo -e "${RED}❌ Node.js version 18+ required (found: $(node -v))${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Node.js $(node -v)${NC}"

if ! command_exists npm; then
    echo -e "${RED}❌ npm not found${NC}"
    exit 1
fi
echo -e "${GREEN}✅ npm $(npm -v)${NC}"

if ! command_exists psql; then
    echo -e "${YELLOW}⚠️  PostgreSQL not found (required for production)${NC}"
else
    echo -e "${GREEN}✅ PostgreSQL found${NC}"
fi

# Step 2: Install dependencies
echo -e "\n${YELLOW}📦 Installing dependencies...${NC}"
npm install

# Step 3: Setup environment
echo -e "\n${YELLOW}🔧 Setting up environment...${NC}"

if [ ! -f .env ]; then
    if [ -f .env.example ]; then
        cp .env.example .env
        echo -e "${GREEN}✅ Created .env from .env.example${NC}"
    else
        cp .env.production .env
        echo -e "${GREEN}✅ Created .env from .env.production${NC}"
    fi
    echo -e "${YELLOW}⚠️  Please edit .env and add your configuration${NC}"
else
    echo -e "${GREEN}✅ .env already exists${NC}"
fi

# Step 4: Build TypeScript
echo -e "\n${YELLOW}🔨 Building TypeScript...${NC}"
npm run build

# Step 5: Run tests
echo -e "\n${YELLOW}🧪 Running system tests...${NC}"
npm run test:system || echo -e "${YELLOW}⚠️  Some tests failed - check configuration${NC}"

# Step 6: Create directories
echo -e "\n${YELLOW}📁 Creating necessary directories...${NC}"
mkdir -p logs reports backups public
echo -e "${GREEN}✅ Directories created${NC}"

# Step 7: Show available commands
echo -e "\n${BLUE}═══════════════════════════════════════════${NC}"
echo -e "${GREEN}✅ Setup Complete!${NC}"
echo -e "${BLUE}═══════════════════════════════════════════${NC}"

echo -e "\n${YELLOW}🚀 Quick Start Commands:${NC}"
echo -e "  ${BLUE}Test Mode:${NC}"
echo -e "    npm run trading:auto          # Start automated trading (test mode)"
echo -e "    npm run monitor:integrated    # Start monitoring dashboard"
echo -e "    npm run mobile:trading        # Start mobile server"
echo -e ""
echo -e "  ${BLUE}Monitoring:${NC}"
echo -e "    npm run monitor:health        # System health monitor"
echo -e "    npm run test:system          # Run all tests"
echo -e "    npm run trading:report       # Generate reports"
echo -e ""
echo -e "  ${BLUE}Production:${NC}"
echo -e "    ./scripts/deploy-production.sh  # Deploy to production"

echo -e "\n${YELLOW}📚 Next Steps:${NC}"
echo -e "1. Edit ${BLUE}.env${NC} with your configuration:"
echo -e "   - Add exchange API keys"
echo -e "   - Configure Telegram bot"
echo -e "   - Set secure MOBILE_PIN"
echo -e ""
echo -e "2. Test the system:"
echo -e "   ${BLUE}npm run test:system${NC}"
echo -e ""
echo -e "3. Start in test mode:"
echo -e "   ${BLUE}npm run trading:auto${NC}"
echo -e ""
echo -e "4. Access from mobile:"
echo -e "   ${BLUE}npm run mobile:trading${NC}"

echo -e "\n${YELLOW}⚠️  Important:${NC}"
echo -e "- Always start in TEST MODE"
echo -e "- Monitor closely for first 24-48 hours"
echo -e "- Start with small amounts (1-5 USDT)"
echo -e "- Read PRODUCTION-CHECKLIST.md before going live"

echo -e "\n${GREEN}Happy Trading! 🚀${NC}"

# Optional: Open documentation
read -p "$(echo -e ${YELLOW}Open documentation in browser? [y/N]: ${NC})" -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    if command_exists open; then
        open README.md
        open PRODUCTION-CHECKLIST.md
    elif command_exists xdg-open; then
        xdg-open README.md
        xdg-open PRODUCTION-CHECKLIST.md
    else
        echo -e "${YELLOW}Please open README.md and PRODUCTION-CHECKLIST.md manually${NC}"
    fi
fi