// READY FOR CURSOR: Press Cmd+K and say "Create Express + WebSocket server for crypto arbitrage with graceful shutdown"
import express from 'express';
import http from 'http';
import { WebSocketServer } from 'ws';
import dotenv from 'dotenv';
import helmet from 'helmet';
import compression from 'compression';
import cors from 'cors';
import path from 'path';
// import { PriceScanner } from './services/priceScanner';
import { MultiExchangeMonitor } from './monitorMultiExchange';
import apiRoutes, { setMonitor, addHistoricalDataPoint } from './routes/api';
import { telegramNotifier } from './services/telegram';

// Load environment variables
dotenv.config();

// Validate environment
import { validateEnvironment } from './config/validateEnv.js';
const envValidation = validateEnvironment();
if (!envValidation.isValid) {
  console.error('Environment validation failed:', envValidation.errors);
  process.exit(1);
}

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

app.use(helmet());
app.use(compression());
app.use(cors());
app.use(express.json());

// Serve static files from public directory
const publicPath = path.resolve(process.cwd(), 'public');
app.use(express.static(publicPath));

// API routes
app.use('/api', apiRoutes);

// Health check endpoint
app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Start monitoring
const monitor = new MultiExchangeMonitor();
setMonitor(monitor);

// WebSocket connection handling
wss.on('connection', (ws) => {
  ws.send(JSON.stringify({ message: 'WebSocket connection established' }));
  console.log('New WebSocket client connected');
  console.log('Total connected clients:', wss.clients.size);
  
  ws.on('close', () => {
    console.log('WebSocket client disconnected');
    console.log('Total connected clients:', wss.clients.size);
  });
});

// Broadcast price updates to all connected clients
function broadcastToClients(type: string, data: any) {
  const message = JSON.stringify({ type, data });
  wss.clients.forEach((client) => {
    if (client.readyState === 1) {
      client.send(message);
    }
  });
}

// Monitor events
monitor.on('priceUpdate', (data) => {
  broadcastToClients('price_update', data);
});

monitor.on('arbitrageOpportunity', (data) => {
  broadcastToClients('arbitrage_opportunity', data);
  
  // Store historical data
  const opportunities = [data];
  const metrics = {
    timestamp: new Date(),
    profitPercentage: data.netProfit
  };
  addHistoricalDataPoint(opportunities, metrics);
  
  // Send Telegram notification for profitable opportunities
  if (data.netProfit > 0.1 && telegramNotifier.isEnabled()) {
    telegramNotifier.sendArbitrageAlert({
      type: data.strategy || 'USDT/USDC',
      buyExchange: data.route?.split(' → ')[0] || 'Exchange A',
      sellExchange: data.route?.split(' → ')[1] || 'Exchange B',
      pair: 'USDT/USDC',
      buyPrice: 1 - (data.netProfit / 100),
      sellPrice: 1,
      netProfit: data.netProfit,
      timestamp: new Date()
    });
  }
});

monitor.on('error', (error) => {
  broadcastToClients('error', { message: error.message });
});

// Start monitoring after server is ready
const PORT = parseInt(process.env.PORT || '3000', 10);
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Dashboard: http://localhost:${PORT}`);
  console.log(`API Status: http://localhost:${PORT}/api/system-status`);
  
  // Test Telegram connection if enabled
  if (process.env.TELEGRAM_ENABLED === 'true') {
    telegramNotifier.testConnection().then(connected => {
      if (connected) {
        console.log('✅ Telegram notifications enabled');
      }
    });
  }
  
  // Start monitoring after server is listening
  monitor.start().catch(console.error);
});

// Graceful shutdown
const shutdown = () => {
  server.close(() => {
    process.exit(0);
  });
  wss.close();
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
