# 🚀 Deploy Exchange Monitor to Oracle Cloud

## Method 1: Quick Copy & Deploy (Recommended)

1. **Copy files to your server:**
```bash
# From your local machine
scp exchange-rate-monitor.js exchange-monitor-dashboard.html quick-deploy.sh ubuntu@150.230.235.0:~/

# Or use the tar file
scp monitor-deployment.tar.gz ubuntu@150.230.235.0:~/
```

2. **SSH to your server and run:**
```bash
ssh ubuntu@150.230.235.0

# If you used tar file, extract it first
tar -xzf monitor-deployment.tar.gz

# Run quick deploy
chmod +x quick-deploy.sh
./quick-deploy.sh
```

## Method 2: Direct Setup Commands

If you prefer to run commands directly:

```bash
# SSH to your server
ssh ubuntu@150.230.235.0

# Create directory
mkdir -p ~/usdt-monitor
cd ~/usdt-monitor

# Create the monitor file
cat > exchange-rate-monitor.js << 'EOFILE'
[PASTE THE CONTENT OF exchange-rate-monitor.js HERE]
EOFILE

# Create the dashboard
cat > exchange-monitor-dashboard.html << 'EOFILE'
[PASTE THE CONTENT OF exchange-monitor-dashboard.html HERE]
EOFILE

# Install Node.js
curl -sL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Create package.json
cat > package.json << 'EOF'
{
  "name": "usdt-exchange-monitor",
  "version": "1.0.0",
  "dependencies": {
    "axios": "^1.6.0",
    "chalk": "^4.1.2",
    "cli-table3": "^0.6.3",
    "ws": "^8.14.2",
    "express": "^4.18.2",
    "cors": "^2.8.5"
  }
}
EOF

# Install dependencies
npm install

# Install PM2
sudo npm install -g pm2

# Start monitor
pm2 start exchange-rate-monitor.js --name "usdt-monitor" -- --amount 13.78 --price 87.0 --alert 86.5

# Create simple web server
cat > server.js << 'EOF'
const express = require('express');
const app = express();
app.use(express.static('.'));
app.listen(3005, '0.0.0.0', () => {
  console.log('Dashboard at http://150.230.235.0:3005');
});
EOF

# Start web server
pm2 start server.js --name "monitor-dashboard"
pm2 save

# Open firewall port
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 3005 -j ACCEPT
```

## Method 3: Using Git (If you have a repo)

```bash
ssh ubuntu@150.230.235.0
cd ~
git clone https://github.com/yourusername/usdt-arbitrage-bot.git
cd usdt-arbitrage-bot
./quick-deploy.sh
```

## 🎯 After Deployment

Access your monitor at:
- **Web Dashboard**: http://150.230.235.0:3005
- **Terminal Monitor**: `pm2 logs usdt-monitor`

## 📊 Check Status

```bash
# View all processes
pm2 status

# View monitor logs
pm2 logs usdt-monitor --lines 100

# Restart services
pm2 restart all

# Monitor resources
pm2 monit
```

## 🔧 Configure Alerts

To set different alert thresholds:
```bash
pm2 restart usdt-monitor --update-env -- --amount 13.78 --price 87.0 --alert 86.0
```

## 🚨 Troubleshooting

If dashboard doesn't load:
```bash
# Check if services are running
pm2 status

# Check logs for errors
pm2 logs

# Ensure port 3005 is open
sudo netstat -tlnp | grep 3005

# Restart everything
pm2 restart all
```

---

**Note**: The monitor will start immediately and begin checking exchange rates every 30 seconds. You'll see alerts in the PM2 logs when prices drop below your threshold!