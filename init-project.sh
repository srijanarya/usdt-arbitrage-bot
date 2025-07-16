#!/bin/bash

echo "🚀 Initializing USDT Arbitrage Bot Project"
echo "========================================"
echo ""

# Initialize npm project
echo "📦 Initializing npm project..."
npm init -y

# Install dependencies
echo "📦 Installing core dependencies..."
npm install express axios ws pg dotenv
npm install --save-dev typescript @types/node @types/express @types/ws @types/pg nodemon ts-node jest @types/jest

# Create TypeScript configuration
echo "⚙️ Creating TypeScript configuration..."
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

# Create folder structure
echo "📁 Creating project structure..."
mkdir -p src/{services/priceScanner,api/exchanges,models,config,types,utils}
mkdir -p tests
mkdir -p logs

# Create .gitignore
echo "📝 Creating .gitignore..."
cat > .gitignore << 'EOF'
# Dependencies
node_modules/

# Environment variables
.env
.env.local

# Build output
dist/
build/

# Logs
logs/
*.log
npm-debug.log*

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

# API Keys (extra safety)
**/api-keys.json
**/credentials.json
EOF

# Create .env.example
echo "📝 Creating .env.example..."
cat > .env.example << 'EOF'
# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=arbitrage_bot
DB_USER=your_db_user
DB_PASSWORD=your_db_password

# Exchange API Keys
COINDCX_API_KEY=your_coindcx_api_key
COINDCX_API_SECRET=your_coindcx_api_secret

ZEBPAY_API_KEY=your_zebpay_api_key
ZEBPAY_API_SECRET=your_zebpay_api_secret

# Telegram Bot (Week 1, Day 7)
TELEGRAM_BOT_TOKEN=your_telegram_bot_token
TELEGRAM_CHAT_ID=your_telegram_chat_id

# Server Configuration
PORT=3000
NODE_ENV=development

# Trading Configuration
MIN_PROFIT_THRESHOLD=100  # Minimum profit in INR to trigger alert
MAX_TRADE_AMOUNT=10000    # Maximum trade amount in INR
ENABLE_AUTO_TRADING=false # Set to true in Week 3
EOF

# Update package.json scripts
echo "📝 Updating package.json scripts..."
npx json -I -f package.json -e 'this.scripts = {
  "dev": "nodemon --exec ts-node src/index.ts",
  "build": "tsc",
  "start": "node dist/index.js",
  "test": "jest",
  "test:watch": "jest --watch",
  "db:setup": "ts-node src/scripts/setupDatabase.ts"
}'

# Initialize Git
echo "🔧 Initializing Git repository..."
git init
git add .
git commit -m "Initial commit: Project setup"

echo ""
echo "✅ Project initialization complete!"
echo ""
echo "Next steps:"
echo "1. Copy .env.example to .env and add your API keys"
echo "2. Run the setup script if you haven't: ./setup.sh"
echo "3. Source your shell: source ~/.zshrc"
echo "4. Start development: npm run dev"
