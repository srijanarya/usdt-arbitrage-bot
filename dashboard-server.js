const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const PORT = 37849;

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// API endpoints
app.get('/api/system-status', (req, res) => {
  res.json({
    success: true,
    data: {
      status: 'operational',
      uptime: {
        ms: Date.now() - startTime,
        formatted: formatUptime(Date.now() - startTime)
      },
      memory: {
        rss: `${(process.memoryUsage().rss / 1024 / 1024).toFixed(2)} MB`,
        heapUsed: `${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)} MB`,
        heapTotal: `${(process.memoryUsage().heapTotal / 1024 / 1024).toFixed(2)} MB`
      },
      nodeVersion: process.version,
      timestamp: new Date()
    }
  });
});

app.get('/api/exchanges', (req, res) => {
  res.json({
    success: true,
    data: {
      exchanges: [
        {
          name: 'ZebPay',
          status: 'connected',
          pair: 'USDT/INR',
          features: ['spot', 'public_data'],
          lastUpdate: new Date()
        },
        {
          name: 'KuCoin',
          status: 'connected',
          pair: 'USDT/USDC',
          features: ['spot', 'public_data', 'trading_ready'],
          lastUpdate: new Date()
        },
        {
          name: 'Binance',
          status: 'connected',
          pair: 'USDC/USDT',
          features: ['spot', 'public_data', 'trading_ready', 'websocket'],
          lastUpdate: new Date()
        }
      ],
      total: 3,
      connected: 3
    }
  });
});

// WebSocket handling
wss.on('connection', (ws) => {
  console.log('New WebSocket client connected');
  
  // Send initial connection message
  ws.send(JSON.stringify({ 
    message: 'WebSocket connection established',
    type: 'connection',
    timestamp: new Date()
  }));
  
  // Send mock price updates every 3 seconds
  const priceInterval = setInterval(() => {
    // ZebPay USDT/INR
    ws.send(JSON.stringify({
      type: 'price_update',
      data: {
        exchange: 'ZebPay',
        pair: 'USDT/INR',
        bid: 88.20 + (Math.random() - 0.5) * 0.1,
        ask: 88.25 + (Math.random() - 0.5) * 0.1,
        last: 88.22 + (Math.random() - 0.5) * 0.1,
        timestamp: new Date()
      }
    }));
    
    // KuCoin USDT/USDC
    ws.send(JSON.stringify({
      type: 'price_update',
      data: {
        exchange: 'KuCoin',
        pair: 'USDT/USDC',
        bid: 1.0001 + (Math.random() - 0.5) * 0.0001,
        ask: 1.0002 + (Math.random() - 0.5) * 0.0001,
        last: 1.00015 + (Math.random() - 0.5) * 0.0001,
        timestamp: new Date()
      }
    }));
    
    // Binance USDC/USDT
    ws.send(JSON.stringify({
      type: 'price_update',
      data: {
        exchange: 'Binance',
        pair: 'USDC/USDT',
        bid: 0.9998 + (Math.random() - 0.5) * 0.0001,
        ask: 0.9999 + (Math.random() - 0.5) * 0.0001,
        last: 0.99985 + (Math.random() - 0.5) * 0.0001,
        timestamp: new Date()
      }
    }));
    
    // Occasionally send arbitrage opportunity
    if (Math.random() > 0.8) {
      ws.send(JSON.stringify({
        type: 'arbitrage_opportunity',
        data: {
          strategy: 'USDT → USDC → USDT',
          route: 'KuCoin → Binance',
          grossProfit: 0.25 + Math.random() * 0.1,
          netProfit: 0.05 + Math.random() * 0.05,
          timestamp: new Date()
        }
      }));
    }
  }, 3000);
  
  ws.on('close', () => {
    console.log('WebSocket client disconnected');
    clearInterval(priceInterval);
  });
});

const startTime = Date.now();

function formatUptime(ms) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  
  if (hours > 0) {
    return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
}

server.listen(PORT, () => {
  console.log(`\n✅ Dashboard server is running!`);
  console.log(`📊 Open dashboard: http://localhost:${PORT}`);
  console.log(`🔌 API Status: http://localhost:${PORT}/api/system-status`);
  console.log(`📡 WebSocket: ws://localhost:${PORT}\n`);
});