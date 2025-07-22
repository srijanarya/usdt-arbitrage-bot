#!/bin/bash

# Deploy Exchange Rate Monitor to Oracle Cloud
# Run this on your Oracle Cloud instance (150.230.235.0)

echo "🚀 Deploying USDT Exchange Rate Monitor..."

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if running on Oracle Cloud
if [[ ! -f /etc/oracle-cloud-agent/oracle-cloud-agent.conf ]]; then
    echo -e "${YELLOW}Warning: This doesn't appear to be an Oracle Cloud instance${NC}"
fi

# Install dependencies
echo -e "\n${GREEN}Installing dependencies...${NC}"
sudo apt-get update -y
sudo apt-get install -y nodejs npm nginx certbot python3-certbot-nginx

# Create application directory
APP_DIR="/home/ubuntu/usdt-monitor"
mkdir -p $APP_DIR
cd $APP_DIR

# Copy monitor files
echo -e "\n${GREEN}Setting up monitor files...${NC}"
cat > package.json << 'EOF'
{
  "name": "usdt-exchange-monitor",
  "version": "1.0.0",
  "description": "USDT Exchange Rate Monitor with Alerts",
  "main": "exchange-rate-monitor.js",
  "scripts": {
    "start": "node exchange-rate-monitor.js",
    "server": "node monitor-server.js",
    "pm2": "pm2 start ecosystem.config.js"
  },
  "dependencies": {
    "axios": "^1.6.0",
    "chalk": "^4.1.2",
    "cli-table3": "^0.6.3",
    "sound-play": "^1.1.0",
    "nodemailer": "^6.9.7",
    "ws": "^8.14.2",
    "express": "^4.18.2",
    "cors": "^2.8.5"
  }
}
EOF

# Create PM2 ecosystem file
cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [
    {
      name: 'exchange-monitor',
      script: './exchange-rate-monitor.js',
      args: '--amount 13.78 --price 87.0 --alert 86.5',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production'
      }
    },
    {
      name: 'monitor-server',
      script: './monitor-server.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '200M',
      env: {
        PORT: 3005,
        NODE_ENV: 'production'
      }
    }
  ]
}
EOF

# Create Express server for web dashboard
cat > monitor-server.js << 'EOF'
const express = require('express');
const cors = require('cors');
const path = require('path');
const ExchangeRateMonitor = require('./exchange-rate-monitor');

const app = express();
const PORT = process.env.PORT || 3005;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Create monitor instance
const monitor = new ExchangeRateMonitor({
  amount: 13.78,
  buyPrice: 87.0,
  alertThreshold: 86.5
});

// API endpoints
app.get('/api/rates', async (req, res) => {
  try {
    await monitor.fetchAllRates();
    res.json({
      success: true,
      exchanges: Array.from(monitor.exchangeRates),
      p2p: monitor.p2pRates.slice(0, 10),
      timestamp: new Date()
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/opportunities', (req, res) => {
  const opportunities = monitor.findArbitrageOpportunities();
  res.json({
    success: true,
    count: opportunities.length,
    opportunities: opportunities.slice(0, 10)
  });
});

app.get('/api/config', (req, res) => {
  res.json({
    success: true,
    config: monitor.config
  });
});

app.post('/api/config', (req, res) => {
  const { amount, buyPrice, alertThreshold } = req.body;
  if (amount) monitor.config.amount = parseFloat(amount);
  if (buyPrice) monitor.config.buyPrice = parseFloat(buyPrice);
  if (alertThreshold) monitor.config.alertThreshold = parseFloat(alertThreshold);
  res.json({ success: true, config: monitor.config });
});

// Start server
app.listen(PORT, () => {
  console.log(`Monitor server running on port ${PORT}`);
  console.log(`Dashboard: http://localhost:${PORT}`);
  
  // Start monitor
  monitor.start();
});

// Listen for monitor events
monitor.on('priceAlert', (data) => {
  console.log('Price Alert:', data);
});

monitor.on('profitOpportunity', (data) => {
  console.log('Profit Opportunity:', data);
});
EOF

# Install npm packages
echo -e "\n${GREEN}Installing npm packages...${NC}"
npm install

# Install PM2 globally
sudo npm install -g pm2

# Copy the monitor script
cp /home/ubuntu/usdt-arbitrage-bot/exchange-rate-monitor.js . 2>/dev/null || true

# Create public directory for web files
mkdir -p public
cp /home/ubuntu/usdt-arbitrage-bot/exchange-monitor-dashboard.html public/index.html 2>/dev/null || true

# Create sounds directory
mkdir -p sounds
echo -e "${YELLOW}Note: Add alert sound files to $APP_DIR/sounds/${NC}"

# Configure Nginx
echo -e "\n${GREEN}Configuring Nginx...${NC}"
sudo tee /etc/nginx/sites-available/usdt-monitor << EOF
server {
    listen 80;
    server_name _;
    
    location / {
        proxy_pass http://localhost:3005;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    }
}
EOF

# Enable the site
sudo ln -sf /etc/nginx/sites-available/usdt-monitor /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl restart nginx

# Start with PM2
echo -e "\n${GREEN}Starting services with PM2...${NC}"
pm2 start ecosystem.config.js
pm2 save
pm2 startup systemd -u ubuntu --hp /home/ubuntu

# Open firewall ports
echo -e "\n${GREEN}Configuring firewall...${NC}"
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 3005 -j ACCEPT
sudo netfilter-persistent save

# Create systemd service as backup
sudo tee /etc/systemd/system/usdt-monitor.service << EOF
[Unit]
Description=USDT Exchange Rate Monitor
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=$APP_DIR
ExecStart=/usr/bin/node exchange-rate-monitor.js --amount 13.78 --price 87.0 --alert 86.5
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

# Show status
echo -e "\n${GREEN}✅ Deployment Complete!${NC}"
echo -e "\nAccess your monitor at:"
echo -e "  ${GREEN}http://150.230.235.0${NC} (Web Dashboard)"
echo -e "  ${GREEN}http://150.230.235.0/api/rates${NC} (API)"
echo -e "\nUseful commands:"
echo -e "  ${YELLOW}pm2 status${NC} - Check service status"
echo -e "  ${YELLOW}pm2 logs${NC} - View logs"
echo -e "  ${YELLOW}pm2 restart all${NC} - Restart services"
echo -e "  ${YELLOW}pm2 monit${NC} - Monitor resources"

# Create update script
cat > update-monitor.sh << 'EOF'
#!/bin/bash
echo "Updating USDT Monitor..."
git pull
npm install
pm2 restart all
echo "Update complete!"
EOF
chmod +x update-monitor.sh

echo -e "\n${YELLOW}Note: To enable email alerts, edit the config in monitor-server.js${NC}"