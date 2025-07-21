#!/bin/bash

# Production Deployment Script for USDT Arbitrage Bot
# This script helps deploy the bot to a production server

set -e  # Exit on error

echo "🚀 USDT Arbitrage Bot - Production Deployment"
echo "============================================"

# Check if running as root
if [ "$EUID" -eq 0 ]; then 
   echo "❌ Please do not run as root"
   exit 1
fi

# Function to check command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check prerequisites
echo "📋 Checking prerequisites..."

if ! command_exists node; then
    echo "❌ Node.js not found. Please install Node.js 18+"
    exit 1
fi

if ! command_exists pm2; then
    echo "📦 Installing PM2..."
    npm install -g pm2
fi

if ! command_exists psql; then
    echo "⚠️  PostgreSQL not found. Make sure it's installed on your server"
fi

# Create necessary directories
echo "📁 Creating directories..."
mkdir -p logs
mkdir -p reports
mkdir -p backups
mkdir -p .env-backups

# Backup existing .env if exists
if [ -f .env ]; then
    echo "💾 Backing up existing .env..."
    cp .env .env-backups/.env.$(date +%Y%m%d_%H%M%S)
fi

# Check for .env file
if [ ! -f .env ]; then
    echo "❌ .env file not found!"
    echo "Please create .env with required configuration"
    exit 1
fi

# Validate critical environment variables
echo "🔍 Validating environment variables..."
required_vars=(
    "DB_HOST"
    "DB_PORT"
    "DB_NAME"
    "DB_USER"
    "DB_PASSWORD"
    "TELEGRAM_BOT_TOKEN"
    "TELEGRAM_CHAT_ID"
    "MOBILE_PIN"
    "JWT_SECRET"
)

source .env
missing_vars=()

for var in "${required_vars[@]}"; do
    if [ -z "${!var}" ]; then
        missing_vars+=("$var")
    fi
done

if [ ${#missing_vars[@]} -ne 0 ]; then
    echo "❌ Missing required environment variables:"
    printf '%s\n' "${missing_vars[@]}"
    exit 1
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm ci --production

# Build TypeScript
echo "🔨 Building application..."
npm run build

# Database setup
echo "🗄️  Setting up database..."
npm run db:setup || echo "⚠️  Database setup failed - ensure PostgreSQL is running"

# Create PM2 ecosystem file
echo "📝 Creating PM2 configuration..."
cat > ecosystem.config.js << EOF
module.exports = {
  apps: [
    {
      name: 'arbitrage-bot',
      script: './dist/scripts/runAutoTrading.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      error_file: './logs/error.log',
      out_file: './logs/out.log',
      log_file: './logs/combined.log',
      time: true,
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      }
    },
    {
      name: 'price-monitor',
      script: './dist/scripts/integratedMonitoring.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      error_file: './logs/monitor-error.log',
      out_file: './logs/monitor-out.log',
      time: true
    },
    {
      name: 'mobile-server',
      script: './dist/api/mobileTradingServer.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      error_file: './logs/mobile-error.log',
      out_file: './logs/mobile-out.log',
      time: true,
      env: {
        PORT: 3333
      }
    },
    {
      name: 'health-monitor',
      script: './dist/scripts/systemHealthMonitor.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '200M',
      error_file: './logs/health-error.log',
      out_file: './logs/health-out.log',
      time: true
    }
  ]
};
EOF

# Create systemd service (optional)
echo "🔧 Creating systemd service..."
sudo tee /etc/systemd/system/arbitrage-bot.service > /dev/null << EOF
[Unit]
Description=USDT Arbitrage Trading Bot
After=network.target

[Service]
Type=forking
User=$USER
WorkingDirectory=$PWD
ExecStart=/usr/bin/pm2 start ecosystem.config.js
ExecReload=/usr/bin/pm2 reload ecosystem.config.js
ExecStop=/usr/bin/pm2 stop ecosystem.config.js
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

# Create monitoring script
echo "📊 Creating monitoring script..."
cat > monitor.sh << 'EOF'
#!/bin/bash
# Quick monitoring script

echo "📊 USDT Arbitrage Bot - System Status"
echo "===================================="
echo ""
echo "🔄 PM2 Process Status:"
pm2 status
echo ""
echo "💾 Memory Usage:"
pm2 monit
echo ""
echo "📈 Recent Logs:"
pm2 logs --lines 20
EOF
chmod +x monitor.sh

# Create backup script
echo "💾 Creating backup script..."
cat > backup.sh << 'EOF'
#!/bin/bash
# Daily backup script

BACKUP_DIR="backups/$(date +%Y%m%d)"
mkdir -p "$BACKUP_DIR"

# Backup database
pg_dump $DB_NAME > "$BACKUP_DIR/database.sql"

# Backup reports
cp -r reports "$BACKUP_DIR/"

# Backup logs
tar -czf "$BACKUP_DIR/logs.tar.gz" logs/

echo "✅ Backup completed: $BACKUP_DIR"
EOF
chmod +x backup.sh

# Setup cron jobs
echo "⏰ Setting up cron jobs..."
(crontab -l 2>/dev/null; echo "0 0 * * * $PWD/backup.sh") | crontab -
(crontab -l 2>/dev/null; echo "0 */6 * * * pm2 flush") | crontab -

# Start services
echo "🚀 Starting services..."
pm2 start ecosystem.config.js
pm2 save
pm2 startup

echo ""
echo "✅ Deployment completed!"
echo ""
echo "📋 Next steps:"
echo "1. Configure firewall to allow ports 3000 (API) and 3333 (Mobile)"
echo "2. Set up reverse proxy (nginx) for HTTPS"
echo "3. Configure domain name for mobile access"
echo "4. Test all services: ./monitor.sh"
echo "5. Enable systemd service: sudo systemctl enable arbitrage-bot"
echo ""
echo "🔍 Useful commands:"
echo "- Monitor status: pm2 status"
echo "- View logs: pm2 logs"
echo "- Restart service: pm2 restart all"
echo "- Stop service: pm2 stop all"
echo "- Monitor resources: pm2 monit"
echo ""
echo "⚠️  IMPORTANT: Start in test mode and monitor closely!"
EOF