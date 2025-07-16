# 🚀 Production Deployment Guide

## Overview
This guide will help you deploy your USDT Arbitrage Bot to production using multiple deployment options.

## 🎯 Deployment Options

### Option 1: VPS Deployment (Recommended)
- **Cost**: ₹500-2000/month
- **Control**: Full control over server
- **Best for**: 24/7 monitoring and trading

### Option 2: Docker Deployment
- **Cost**: ₹300-1500/month
- **Ease**: Easy to deploy and scale
- **Best for**: Consistent environment

### Option 3: Static Hosting (Dashboards Only)
- **Cost**: Free - ₹200/month
- **Limitation**: No server-side features
- **Best for**: Dashboard access only

## 📋 Pre-Deployment Checklist

### ✅ Required Files
- [ ] `.env` file with all credentials
- [ ] `package.json` with all dependencies
- [ ] `Dockerfile` and `docker-compose.yml`
- [ ] All HTML dashboards
- [ ] Source code in `src/` directory

### ✅ Security Checklist
- [ ] Never commit `.env` files to Git
- [ ] Use environment variables for all secrets
- [ ] Enable SSL/HTTPS in production
- [ ] Set up firewall rules
- [ ] Regular security updates

### ✅ Monitoring Setup
- [ ] Telegram bot configured
- [ ] Error logging enabled
- [ ] Performance monitoring
- [ ] Uptime monitoring

---

## 🖥️ VPS Deployment (Ubuntu 22.04)

### Step 1: Server Setup
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PM2 for process management
sudo npm install -g pm2

# Install PostgreSQL
sudo apt install postgresql postgresql-contrib -y

# Create database user
sudo -u postgres createuser --interactive
sudo -u postgres createdb arbitrage_bot
```

### Step 2: Application Setup
```bash
# Clone repository
git clone https://github.com/your-username/usdt-arbitrage-bot.git
cd usdt-arbitrage-bot

# Install dependencies
npm install

# Copy environment file
cp .env.example .env
nano .env  # Edit with your credentials

# Build TypeScript
npm run build

# Start with PM2
pm2 start dist/index.js --name "arbitrage-bot"
pm2 startup
pm2 save
```

### Step 3: Nginx Setup (Optional)
```bash
# Install Nginx
sudo apt install nginx -y

# Create site config
sudo nano /etc/nginx/sites-available/arbitrage-bot
```

Nginx configuration:
```nginx
server {
    listen 80;
    server_name your-domain.com;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
    
    # Serve static dashboards
    location /dashboards/ {
        alias /var/www/arbitrage-bot/;
        try_files $uri $uri/ =404;
    }
}
```

Enable site:
```bash
sudo ln -s /etc/nginx/sites-available/arbitrage-bot /etc/nginx/sites-enabled/
sudo systemctl reload nginx
```

---

## 🐳 Docker Deployment

### Step 1: Build Image
```bash
# Build Docker image
docker build -t arbitrage-bot .

# Or use docker-compose
docker-compose up -d
```

### Step 2: Production Docker Compose
```yaml
version: '3.8'

services:
  arbitrage-bot:
    build: .
    environment:
      - NODE_ENV=production
      - DB_HOST=postgres
      - DB_NAME=arbitrage_bot
      - DB_USER=arbitrage_user
      - DB_PASSWORD=${DB_PASSWORD}
      - TELEGRAM_BOT_TOKEN=${TELEGRAM_BOT_TOKEN}
      - TELEGRAM_CHAT_ID=${TELEGRAM_CHAT_ID}
    depends_on:
      - postgres
    restart: unless-stopped
    ports:
      - "3000:3000"
    volumes:
      - ./logs:/app/logs

  postgres:
    image: postgres:14
    environment:
      - POSTGRES_DB=arbitrage_bot
      - POSTGRES_USER=arbitrage_user
      - POSTGRES_PASSWORD=${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    restart: unless-stopped

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./dashboards:/usr/share/nginx/html/dashboards
    depends_on:
      - arbitrage-bot
    restart: unless-stopped

volumes:
  postgres_data:
```

### Step 3: Environment Variables
Create `.env.production`:
```bash
NODE_ENV=production
DB_HOST=postgres
DB_PORT=5432
DB_NAME=arbitrage_bot
DB_USER=arbitrage_user
DB_PASSWORD=your_secure_password

# API Keys
ZEBPAY_API_KEY=your_zebpay_key
ZEBPAY_API_SECRET=your_zebpay_secret
COINDCX_API_KEY=your_coindcx_key
COINDCX_API_SECRET=your_coindcx_secret
COINSWITCH_API_KEY=your_coinswitch_key
COINSWITCH_API_SECRET=your_coinswitch_secret
KUCOIN_API_KEY=your_kucoin_key
KUCOIN_API_SECRET=your_kucoin_secret
KUCOIN_PASSPHRASE=your_kucoin_passphrase
BINANCE_API_KEY=your_binance_key
BINANCE_API_SECRET=your_binance_secret

# Telegram
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_CHAT_ID=your_chat_id
TELEGRAM_ENABLED=true

# App Settings
PORT=3000
LOG_LEVEL=info
```

---

## 🌐 Static Hosting (Dashboards Only)

### Netlify Deployment
1. Build static files:
```bash
# Copy all HTML files to build directory
mkdir build
cp *.html build/
cp -r assets build/ # if any
```

2. Deploy to Netlify:
```bash
# Install Netlify CLI
npm install -g netlify-cli

# Deploy
netlify deploy --prod --dir=build
```

### Vercel Deployment
1. Install Vercel CLI:
```bash
npm install -g vercel

# Deploy
vercel --prod
```

### GitHub Pages
1. Create `gh-pages` branch
2. Push HTML files to branch
3. Enable GitHub Pages in repository settings

---

## 🔧 Production Configuration

### PM2 Ecosystem File
Create `ecosystem.config.js`:
```javascript
module.exports = {
  apps: [{
    name: 'arbitrage-bot',
    script: 'dist/index.js',
    instances: 1,
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'development'
    },
    env_production: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    log_file: './logs/combined.log',
    out_file: './logs/out.log',
    error_file: './logs/error.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    restart_delay: 1000,
    max_restarts: 10,
    min_uptime: '10s'
  }]
};
```

### Production Environment Variables
```bash
# Security
NODE_ENV=production
SESSION_SECRET=your_session_secret
JWT_SECRET=your_jwt_secret

# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=arbitrage_bot
DB_USER=arbitrage_user
DB_PASSWORD=secure_password
DB_SSL=true

# Rate Limiting
RATE_LIMIT_WINDOW=15
RATE_LIMIT_MAX_REQUESTS=100

# Monitoring
SENTRY_DSN=your_sentry_dsn
LOG_LEVEL=warn
```

---

## 🔒 Security Hardening

### 1. Server Security
```bash
# Setup UFW firewall
sudo ufw enable
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Disable root login
sudo nano /etc/ssh/sshd_config
# Set: PermitRootLogin no

# Install fail2ban
sudo apt install fail2ban -y
```

### 2. SSL Certificate (Let's Encrypt)
```bash
# Install certbot
sudo apt install certbot python3-certbot-nginx -y

# Get certificate
sudo certbot --nginx -d your-domain.com

# Auto-renewal
sudo crontab -e
# Add: 0 12 * * * /usr/bin/certbot renew --quiet
```

### 3. Application Security
```bash
# Install helmet for security headers
npm install helmet

# Rate limiting
npm install express-rate-limit

# Input validation
npm install joi
```

---

## 📊 Monitoring & Alerts

### 1. Health Check Endpoint
Add to your application:
```javascript
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});
```

### 2. Uptime Monitoring
- **UptimeRobot**: Free monitoring service
- **Pingdom**: Professional monitoring
- **StatusCake**: Multiple location monitoring

### 3. Error Tracking
```bash
# Install Sentry
npm install @sentry/node
```

### 4. Performance Monitoring
```bash
# Install New Relic
npm install newrelic
```

---

## 🚀 Deployment Scripts

### Deploy Script (`deploy.sh`)
```bash
#!/bin/bash
set -e

echo "🚀 Starting deployment..."

# Pull latest changes
git pull origin main

# Install dependencies
npm ci --production

# Build application
npm run build

# Run database migrations
npm run migrate

# Restart application
pm2 restart arbitrage-bot

# Run health check
sleep 10
curl -f http://localhost:3000/health || exit 1

echo "✅ Deployment completed successfully!"
```

### Make executable:
```bash
chmod +x deploy.sh
```

---

## 🔄 Backup Strategy

### 1. Database Backup
```bash
# Create backup script
cat > backup.sh << 'EOF'
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
pg_dump arbitrage_bot > /backups/arbitrage_bot_${DATE}.sql
# Keep only last 7 days
find /backups -name "arbitrage_bot_*.sql" -mtime +7 -delete
EOF

# Schedule daily backup
crontab -e
# Add: 0 2 * * * /path/to/backup.sh
```

### 2. Application Backup
```bash
# Backup configuration and logs
tar -czf app_backup_$(date +%Y%m%d).tar.gz \
  .env \
  logs/ \
  dist/ \
  package.json
```

---

## 🎯 Post-Deployment Checklist

### ✅ Functionality Testing
- [ ] All dashboards accessible
- [ ] Telegram notifications working
- [ ] Database connections stable
- [ ] API integrations functioning
- [ ] Error handling working

### ✅ Performance Testing
- [ ] Response times < 2 seconds
- [ ] Memory usage stable
- [ ] CPU usage reasonable
- [ ] No memory leaks

### ✅ Security Testing
- [ ] SSL certificate valid
- [ ] Security headers present
- [ ] Rate limiting working
- [ ] Input validation active

### ✅ Monitoring Setup
- [ ] Uptime monitoring active
- [ ] Error tracking configured
- [ ] Performance monitoring enabled
- [ ] Backup schedule working

---

## 🆘 Troubleshooting

### Common Issues

1. **Port Already in Use**
```bash
# Find process using port
sudo netstat -tulpn | grep :3000
# Kill process
sudo kill -9 <PID>
```

2. **Database Connection Issues**
```bash
# Check PostgreSQL status
sudo systemctl status postgresql
# Reset password
sudo -u postgres psql
\password arbitrage_user
```

3. **PM2 Issues**
```bash
# Check logs
pm2 logs arbitrage-bot
# Restart
pm2 restart arbitrage-bot
# Monitor
pm2 monit
```

4. **Memory Issues**
```bash
# Check memory usage
free -h
# Check process memory
ps aux --sort=-%mem | head
```

---

## 🎉 Production Ready!

Your USDT Arbitrage Bot is now production-ready with:

✅ **Scalable deployment** options
✅ **Comprehensive monitoring** 
✅ **Security hardening**
✅ **Automated backups**
✅ **Health checks**
✅ **Error handling**

Choose the deployment option that best fits your needs and budget!