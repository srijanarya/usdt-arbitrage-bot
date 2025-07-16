#!/bin/bash

echo "🤖 AUTOMATED SETUP STARTING..."
echo "=================================="
echo "I'll do 90% of the work automatically!"
echo ""

# Change to project directory
cd /Users/srijan/Desktop/usdt-arbitrage-bot

# Step 1: Environment Setup
echo "📦 Step 1: Setting up environment..."
if [[ -f "/opt/homebrew/bin/brew" ]]; then
    eval "$(/opt/homebrew/bin/brew shellenv)"
fi

# Check and install dependencies
command -v node >/dev/null 2>&1 || brew install node
command -v psql >/dev/null 2>&1 || brew install postgresql@15

# Start PostgreSQL
brew services start postgresql@15 2>/dev/null

# Step 2: Project Initialization
echo "📁 Step 2: Initializing project..."
npm init -y

# Step 3: Install all dependencies
echo "📦 Step 3: Installing dependencies..."
npm install express axios ws pg dotenv cors helmet compression bcrypt jsonwebtoken
npm install --save-dev typescript @types/node @types/express @types/ws @types/pg @types/cors nodemon ts-node jest @types/jest

# Step 4: Create complete folder structure
echo "🏗️ Step 4: Creating folder structure..."
mkdir -p src/{api/exchanges,services/priceScanner,config,models,utils,types,scripts,routes,middleware}
mkdir -p tests/{unit,integration}
mkdir -p logs
mkdir -p public/{css,js,images}
mkdir -p docs

# Step 5: Create TypeScript configuration
echo "⚙️ Step 5: Creating TypeScript config..."
cat > tsconfig.json << 'EOF'
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "moduleResolution": "node",
    "allowJs": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "types": ["node", "jest"],
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
EOF

# Step 6: Create .gitignore
echo "📝 Step 6: Creating .gitignore..."
cat > .gitignore << 'EOF'
# Dependencies
node_modules/

# Environment
.env
.env.local
.env.*.local

# Build
dist/
build/

# Logs
logs/
*.log

# IDE
.vscode/
.idea/
*.swp
*.swo
.DS_Store

# Test coverage
coverage/
.nyc_output/

# Database
*.sqlite
*.db

# API Keys
**/api-keys.json
**/credentials.json
EOF

# Step 7: Create package.json scripts
echo "📜 Step 7: Updating package.json..."
npx json -I -f package.json -e 'this.scripts = {
  "dev": "nodemon --exec ts-node src/index.ts",
  "build": "tsc",
  "start": "node dist/index.js",
  "test": "jest",
  "test:watch": "jest --watch",
  "db:setup": "ts-node src/scripts/setupDatabase.ts",
  "db:migrate": "ts-node src/scripts/migrate.ts"
}'

# Step 8: Create all source files with starter code
echo "💻 Step 8: Creating source files..."

# Create types
cat > src/types/index.ts << 'EOF'
// READY FOR CURSOR: Press Cmd+K and say "Create comprehensive TypeScript types for crypto arbitrage trading"
export interface ExchangePrice {
  // Cursor will generate this
}
EOF

# Create database config
cat > src/config/database.ts << 'EOF'
// READY FOR CURSOR: Press Cmd+K and say "Create PostgreSQL configuration with connection pooling and migrations"
import { Pool } from 'pg';

export const pool = new Pool({
  // Cursor will complete this
});
EOF

# Create logger
cat > src/utils/logger.ts << 'EOF'
// READY FOR CURSOR: Press Cmd+K and say "Create a production logger with file rotation and log levels"
export const logger = {
  // Cursor will implement this
};
EOF

# Create main index
cat > src/index.ts << 'EOF'
// READY FOR CURSOR: Press Cmd+K and say "Create Express + WebSocket server for crypto arbitrage with graceful shutdown"
import express from 'express';

const app = express();
// Cursor will complete this
EOF

# Create exchange clients
cat > src/api/exchanges/coinDCX.ts << 'EOF'
// READY FOR CURSOR: Press Cmd+K and say "Create CoinDCX WebSocket client with reconnection, HMAC auth, and rate limiting"
export class CoinDCXClient {
  // Cursor will implement this
}
EOF

cat > src/api/exchanges/zebPay.ts << 'EOF'
// READY FOR CURSOR: Press Cmd+K and say "Create ZebPay REST client with polling, authentication, and error handling"
export class ZebPayClient {
  // Cursor will implement this
}
EOF

# Create price scanner
cat > src/services/priceScanner/index.ts << 'EOF'
// READY FOR CURSOR: Press Cmd+K and say "Create arbitrage scanner detecting opportunities with 1% TDS and all fees"
export class PriceScanner {
  // Cursor will implement this
}
EOF

# Create database setup script
cat > src/scripts/setupDatabase.ts << 'EOF'
// READY FOR CURSOR: Press Cmd+K and say "Create database tables for exchanges, prices, opportunities, and trades"
async function setupDatabase() {
  // Cursor will implement this
}
EOF

# Step 9: Create environment template
echo "🔐 Step 9: Creating .env.example..."
cat > .env.example << 'EOF'
# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=arbitrage_bot
DB_USER=postgres
DB_PASSWORD=your_password

# CoinDCX API (Get from: https://coindcx.com/api-dashboard)
COINDCX_API_KEY=your_api_key_here
COINDCX_API_SECRET=your_api_secret_here

# ZebPay API (Get from: https://zebpay.com/api)
ZEBPAY_API_KEY=your_api_key_here
ZEBPAY_API_SECRET=your_api_secret_here

# Telegram Bot (Optional - Week 1, Day 7)
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_CHAT_ID=your_chat_id

# Trading Configuration
MIN_PROFIT_THRESHOLD=100
MAX_TRADE_AMOUNT=10000
ENABLE_AUTO_TRADING=false

# Server
PORT=3000
NODE_ENV=development
LOG_LEVEL=debug
EOF

# Step 10: Create a simple dashboard
echo "🎨 Step 10: Creating dashboard..."
cat > public/index.html << 'EOF'
<!DOCTYPE html>
<html>
<head>
    <title>USDT Arbitrage Monitor</title>
    <style>
        body { font-family: Arial, sans-serif; background: #f0f0f0; margin: 0; padding: 20px; }
        .container { max-width: 1200px; margin: 0 auto; }
        .card { background: white; padding: 20px; margin: 10px 0; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .price-display { font-size: 24px; font-weight: bold; }
        .profit { color: green; }
        .loss { color: red; }
    </style>
</head>
<body>
    <div class="container">
        <h1>USDT Arbitrage Monitor</h1>
        <div class="card">
            <h2>Prices</h2>
            <div id="prices">Waiting for data...</div>
        </div>
        <div class="card">
            <h2>Opportunities</h2>
            <div id="opportunities">Scanning...</div>
        </div>
    </div>
    <script>
        // WebSocket connection will be added by Cursor
    </script>
</body>
</html>
EOF

# Step 11: Initialize Git
echo "🔧 Step 11: Initializing Git..."
git init
git add .
git commit -m "Initial commit: Automated project setup"

# Step 12: Create database
echo "🗄️ Step 12: Creating database..."
createdb arbitrage_bot 2>/dev/null || echo "Database might already exist"

# Step 13: Create helpful scripts
echo "📜 Step 13: Creating helper scripts..."

# Quick start script
cat > start.sh << 'EOF'
#!/bin/bash
echo "Starting USDT Arbitrage Bot..."
npm run dev
EOF
chmod +x start.sh

# API key setup reminder
cat > setup-api-keys.sh << 'EOF'
#!/bin/bash
echo "🔑 API KEY SETUP REMINDER"
echo "========================"
echo ""
echo "1. Copy .env.example to .env:"
echo "   cp .env.example .env"
echo ""
echo "2. Get your API keys:"
echo "   - CoinDCX: https://coindcx.com/api-dashboard"
echo "   - ZebPay: https://zebpay.com/api"
echo ""
echo "3. Edit .env and add your keys"
echo ""
echo "4. NEVER commit .env to Git!"
EOF
chmod +x setup-api-keys.sh

echo ""
echo "✅ AUTOMATED SETUP COMPLETE!"
echo "============================"
echo ""
echo "🎯 What I've done:"
echo "✓ Installed all dependencies"
echo "✓ Created complete folder structure"
echo "✓ Set up TypeScript configuration"
echo "✓ Created all source files with Cursor prompts"
echo "✓ Initialized Git repository"
echo "✓ Created PostgreSQL database"
echo "✓ Built a starter dashboard"
echo ""
echo "❗ What YOU need to do (30 minutes):"
echo "1. Open Cursor IDE"
echo "2. Open each file marked 'READY FOR CURSOR'"
echo "3. Press Cmd+K and use the provided prompt"
echo "4. Get API keys and add to .env"
echo "5. Run: npm run dev"
echo ""
echo "📂 Project location: /Users/srijan/Desktop/usdt-arbitrage-bot"
echo "🚀 Cursor is the key to making this work in 4 weeks!"
EOF