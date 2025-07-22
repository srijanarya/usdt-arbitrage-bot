#!/bin/bash

# Quick deployment script for USDT Exchange Monitor
# Run this after copying files to your Oracle Cloud server

echo "🚀 Quick Deploy - USDT Exchange Monitor"
echo "======================================"

# Create directory
mkdir -p ~/usdt-monitor
cd ~/usdt-monitor

# Check if files exist
if [ ! -f "exchange-rate-monitor.js" ]; then
    echo "❌ Error: exchange-rate-monitor.js not found!"
    echo "Please copy all files to ~/usdt-monitor first"
    exit 1
fi

# Install Node.js if not present
if ! command -v node &> /dev/null; then
    echo "📦 Installing Node.js..."
    curl -sL https://deb.nodesource.com/setup_18.x | sudo -E bash -
    sudo apt-get install -y nodejs
fi

# Create package.json
cat > package.json << 'EOF'
{
  "name": "usdt-exchange-monitor",
  "version": "1.0.0",
  "description": "USDT Exchange Rate Monitor",
  "main": "exchange-rate-monitor.js",
  "scripts": {
    "start": "node exchange-rate-monitor.js",
    "server": "node server.js"
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

# Create simple Express server
cat > server.js << 'EOF'
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = 3005;

app.use(cors());
app.use(express.static('.'));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'exchange-monitor-dashboard.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Dashboard running at http://150.230.235.0:${PORT}`);
  console.log(`✅ Local: http://localhost:${PORT}`);
});
EOF

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Install PM2 if not present
if ! command -v pm2 &> /dev/null; then
    echo "📦 Installing PM2..."
    sudo npm install -g pm2
fi

# Start services
echo "🚀 Starting services..."
pm2 start exchange-rate-monitor.js --name "usdt-monitor" -- --amount 13.78 --price 87.0 --alert 86.5
pm2 start server.js --name "monitor-dashboard"
pm2 save
pm2 startup systemd -u ubuntu --hp /home/ubuntu

# Open firewall ports
echo "🔧 Configuring firewall..."
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 3005 -j ACCEPT
sudo netfilter-persistent save 2>/dev/null || true

# Show status
echo ""
echo "✅ Deployment Complete!"
echo "======================"
echo ""
echo "📊 Access your monitor at:"
echo "   http://150.230.235.0:3005"
echo ""
echo "🔧 Useful commands:"
echo "   pm2 status          - Check status"
echo "   pm2 logs            - View logs"
echo "   pm2 restart all     - Restart services"
echo "   pm2 logs usdt-monitor --lines 50"
echo ""
echo "📝 To run monitor in terminal:"
echo "   node exchange-rate-monitor.js"
echo ""