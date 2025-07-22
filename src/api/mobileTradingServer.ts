import express from 'express';
import cors from 'cors';
import { networkInterfaces } from 'os';
import http from 'http';
import { WebSocketServer } from 'ws';
import qrcode from 'qrcode-terminal';
import chalk from 'chalk';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';

// Import services
import { priceMonitor } from '../services/websocket/SimpleWebSocketMonitor';
import { autoTrader } from '../services/trading/AutomatedTradingService';
import { riskManager } from '../services/trading/RiskManagementService';
import { profitTracker } from '../services/reporting/ProfitTrackingService';
import { telegramAlert } from '../services/telegram/TelegramAlertService';

dotenv.config();

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// WebSocket clients
const clients = new Set<any>();

// Simple auth (in production, use proper auth)
const MOBILE_PIN = process.env.MOBILE_PIN || '1234';
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Middleware for API authentication
function authenticate(req: any, res: any, next: any) {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
}

// WebSocket connection
wss.on('connection', (ws) => {
  clients.add(ws);
  console.log(chalk.green('📱 Mobile client connected'));
  
  // Send initial data
  sendUpdate();
  
  ws.on('close', () => {
    clients.delete(ws);
    console.log(chalk.yellow('📱 Mobile client disconnected'));
  });
  
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message.toString());
      handleWebSocketMessage(ws, data);
    } catch (error) {
      ws.send(JSON.stringify({ error: 'Invalid message' }));
    }
  });
});

// Handle WebSocket messages
function handleWebSocketMessage(ws: any, data: any) {
  switch (data.type) {
    case 'auth':
      // Simple auth check
      if (data.pin === MOBILE_PIN) {
        const token = jwt.sign({ authenticated: true }, JWT_SECRET);
        ws.send(JSON.stringify({ type: 'auth', success: true, token }));
        ws.authenticated = true;
      } else {
        ws.send(JSON.stringify({ type: 'auth', success: false }));
      }
      break;
      
    case 'command':
      if (ws.authenticated) {
        handleCommand(data.command, data.params);
      }
      break;
  }
}

// Send updates to all clients
function sendUpdate() {
  const tradingStats = autoTrader.getStats();
  const riskMetrics = riskManager.getMetrics();
  
  const update = {
    type: 'update',
    timestamp: new Date().toISOString(),
    trading: {
      enabled: tradingStats.isRunning,
      config: tradingStats.config,
      dailyVolume: tradingStats.dailyVolume,
      dailyProfit: tradingStats.dailyProfit,
      dailyLimit: tradingStats.dailyLimit,
      activeExecutions: tradingStats.activeExecutions
    },
    risk: {
      totalTrades: riskMetrics.totalTrades,
      winRate: riskMetrics.totalTrades > 0 
        ? (riskMetrics.winningTrades / riskMetrics.totalTrades * 100).toFixed(2) 
        : 0,
      consecutiveLosses: riskMetrics.consecutiveLosses,
      dailyPnL: riskMetrics.dailyPnL,
      currentExposure: riskMetrics.currentExposure
    },
    prices: Array.from(priceMonitor['lastPrices'].entries()).map(([exchange, data]) => ({
      exchange,
      buyPrice: data.buyPrice,
      sellPrice: data.sellPrice,
      timestamp: data.timestamp
    })),
    opportunities: [] // Will be populated by price monitor events
  };
  
  const message = JSON.stringify(update);
  clients.forEach(client => {
    if (client.readyState === 1 && client.authenticated) {
      client.send(message);
    }
  });
}

// Handle commands from mobile
async function handleCommand(command: string, params: any) {
  switch (command) {
    case 'toggleTrading':
      if (autoTrader.getStats().isRunning) {
        await autoTrader.stop();
      } else {
        await autoTrader.start();
      }
      sendUpdate();
      break;
      
    case 'updateConfig':
      autoTrader.updateConfig(params);
      sendUpdate();
      break;
      
    case 'generateReport':
      const report = await profitTracker.generateDailyReport();
      clients.forEach(client => {
        if (client.authenticated) {
          client.send(JSON.stringify({ type: 'report', data: report }));
        }
      });
      break;
  }
}

// REST API endpoints
app.post('/api/auth', async (req, res) => {
  const { pin } = req.body;
  
  if (pin === MOBILE_PIN) {
    const token = jwt.sign({ authenticated: true }, JWT_SECRET);
    res.json({ success: true, token });
  } else {
    res.status(401).json({ error: 'Invalid PIN' });
  }
});

app.get('/api/status', authenticate, async (req, res) => {
  const tradingStats = autoTrader.getStats();
  const riskMetrics = riskManager.getMetrics();
  const dailyReport = await profitTracker.generateDailyReport();
  
  res.json({
    trading: tradingStats,
    risk: riskMetrics,
    dailyReport,
    timestamp: new Date().toISOString()
  });
});

app.post('/api/trading/toggle', authenticate, async (req, res) => {
  try {
    if (autoTrader.getStats().isRunning) {
      await autoTrader.stop();
      res.json({ success: true, status: 'stopped' });
    } else {
      await autoTrader.start();
      res.json({ success: true, status: 'started' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/trading/config', authenticate, (req, res) => {
  try {
    autoTrader.updateConfig(req.body);
    res.json({ success: true, config: autoTrader.getStats().config });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/report/daily', authenticate, async (req, res) => {
  try {
    const report = await profitTracker.generateDailyReport();
    res.json(report);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/report/weekly', authenticate, async (req, res) => {
  try {
    const report = await profitTracker.generateWeeklySummary();
    res.json({ summary: report });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    clients: clients.size,
    uptime: process.uptime()
  });
});

// Serve mobile dashboard
app.get('/', (req, res) => {
  res.send(`
<!DOCTYPE html>
<html>
<head>
  <title>Mobile Trading Dashboard</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <script>
    // Redirect to mobile dashboard if exists
    window.location.href = '/mobile-dashboard.html';
  </script>
</head>
<body>
  <p>Redirecting to mobile dashboard...</p>
</body>
</html>
  `);
});

// Setup price monitor listeners
function setupEventListeners() {
  // Listen for arbitrage opportunities
  priceMonitor.on('arbitrageFound', (opportunity) => {
    const message = JSON.stringify({
      type: 'opportunity',
      data: opportunity
    });
    
    clients.forEach(client => {
      if (client.authenticated) {
        client.send(message);
      }
    });
  });
  
  // Listen for trade executions
  autoTrader.on('executionStarted', (execution) => {
    const message = JSON.stringify({
      type: 'execution',
      status: 'started',
      data: execution
    });
    
    clients.forEach(client => {
      if (client.authenticated) {
        client.send(message);
      }
    });
  });
  
  autoTrader.on('executionCompleted', (execution) => {
    const message = JSON.stringify({
      type: 'execution',
      status: 'completed',
      data: execution
    });
    
    clients.forEach(client => {
      if (client.authenticated) {
        client.send(message);
      }
    });
  });
}

// Get local IP
function getLocalIP() {
  const nets = networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]!) {
      if (net.family === 'IPv4' && !net.internal) {
        return net.address;
      }
    }
  }
  return 'localhost';
}

// Start server
export function startMobileTradingServer(port: number = 3333) {
  // Setup event listeners
  setupEventListeners();
  
  // Start price monitor
  priceMonitor.start().catch(console.error);
  
  // Update interval
  setInterval(sendUpdate, 5000);
  
  server.listen(port, '0.0.0.0', () => {
    const localIP = getLocalIP();
    const url = `http://${localIP}:${port}`;
    
    console.log(chalk.bgCyan.black('\n 📱 MOBILE TRADING SERVER STARTED \n'));
    console.log(chalk.cyan('━'.repeat(50)));
    
    console.log(chalk.yellow('\n🌐 Access from your phone:'));
    console.log(chalk.white(`   ${url}\n`));
    
    console.log(chalk.yellow('📲 QR Code:\n'));
    qrcode.generate(url, { small: true });
    
    console.log(chalk.cyan('\n━'.repeat(50)));
    
    console.log(chalk.yellow('\n🔐 Security:'));
    console.log(`   PIN: ${MOBILE_PIN}`);
    console.log('   Change PIN by setting MOBILE_PIN in .env\n');
    
    console.log(chalk.yellow('📱 Features:'));
    console.log('   • Real-time price monitoring');
    console.log('   • Live arbitrage opportunities');
    console.log('   • Trading control (start/stop)');
    console.log('   • Risk metrics & P&L tracking');
    console.log('   • Daily/weekly reports');
    console.log('   • Push notifications for trades\n');
    
    console.log(chalk.yellow('💡 Setup:'));
    console.log('   1. Connect phone to same WiFi');
    console.log('   2. Scan QR code or enter URL');
    console.log('   3. Enter PIN to authenticate');
    console.log('   4. Save to home screen for app-like experience\n');
    
    console.log(chalk.gray('Press Ctrl+C to stop server\n'));
  });
  
  return server;
}

// Auto-start if run directly
startMobileTradingServer();