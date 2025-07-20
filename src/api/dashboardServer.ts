import express from 'express';
import cors from 'cors';
import { WebSocketServer } from 'ws';
import http from 'http';
import path from 'path';
import { priceMonitor } from '../services/websocket/SimpleWebSocketMonitor';
import { PostgresService } from '../services/database/postgresService';
import { arbitrageCalculator } from '../services/arbitrage/USDTArbitrageCalculator';
import chalk from 'chalk';

const app = express();
const PORT = process.env.DASHBOARD_PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../../public')));

// Create HTTP server
const server = http.createServer(app);

// Create WebSocket server
const wss = new WebSocketServer({ server });

// Store connected clients
const clients = new Set<any>();

// API Routes
app.get('/api/status', (req, res) => {
  const prices = priceMonitor.getCurrentPrices();
  const status = {
    monitoring: true,
    exchanges: Array.from(prices.keys()).map(key => {
      const [exchange] = key.split('_');
      return exchange;
    }),
    timestamp: new Date()
  };
  res.json(status);
});

app.get('/api/prices', (req, res) => {
  const prices = priceMonitor.getCurrentPrices();
  const priceData = Array.from(prices.entries()).map(([key, value]) => ({
    key,
    exchange: value.exchange,
    symbol: value.symbol,
    bid: value.bid,
    ask: value.ask,
    timestamp: value.timestamp
  }));
  res.json(priceData);
});

app.get('/api/opportunities', async (req, res) => {
  try {
    const opportunities = await PostgresService.getRecentOpportunities(20);
    res.json(opportunities);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch opportunities' });
  }
});

app.get('/api/calculate', (req, res) => {
  const { buyPrice, sellPrice, amount = 100, exchange = 'zebpay' } = req.query;
  
  if (!buyPrice || !sellPrice) {
    return res.status(400).json({ error: 'Missing buyPrice or sellPrice' });
  }

  const analysis = arbitrageCalculator.calculateProfit(
    parseFloat(buyPrice as string),
    parseFloat(sellPrice as string),
    parseFloat(amount as string),
    exchange as string
  );

  res.json(analysis);
});

// WebSocket connection handling
wss.on('connection', (ws) => {
  console.log(chalk.green('New WebSocket client connected'));
  clients.add(ws);

  // Send current prices immediately
  const prices = priceMonitor.getCurrentPrices();
  ws.send(JSON.stringify({
    type: 'prices',
    data: Array.from(prices.entries()).map(([key, value]) => ({
      key,
      ...value
    }))
  }));

  ws.on('close', () => {
    clients.delete(ws);
    console.log(chalk.yellow('WebSocket client disconnected'));
  });

  ws.on('error', (error) => {
    console.error(chalk.red('WebSocket error:', error));
  });
});

// Broadcast updates to all connected clients
function broadcastUpdate(type: string, data: any) {
  const message = JSON.stringify({ type, data, timestamp: new Date() });
  
  clients.forEach((client) => {
    if (client.readyState === 1) { // WebSocket.OPEN
      client.send(message);
    }
  });
}

// Listen to price monitor events
priceMonitor.on('priceUpdate', (priceUpdate) => {
  broadcastUpdate('priceUpdate', priceUpdate);
});

priceMonitor.on('arbitrageFound', (opportunity) => {
  broadcastUpdate('arbitrage', opportunity);
});

// Start monitoring if not already started
async function startServices() {
  try {
    // Start price monitoring
    await priceMonitor.start();
    console.log(chalk.green('Price monitoring started'));

    // Start server
    server.listen(PORT, () => {
      console.log(chalk.bgGreen.black(` 🚀 Dashboard server running at http://localhost:${PORT} `));
      console.log(chalk.cyan(`WebSocket endpoint: ws://localhost:${PORT}`));
    });
  } catch (error) {
    console.error(chalk.red('Failed to start services:', error));
  }
}

// Error handling
app.use((err: any, req: any, res: any, next: any) => {
  console.error(chalk.red('Server error:', err));
  res.status(500).json({ error: 'Internal server error' });
});

// Start services
startServices().catch(console.error);

// Graceful shutdown
process.on('SIGINT', () => {
  console.log(chalk.yellow('\nShutting down dashboard server...'));
  
  // Close WebSocket connections
  clients.forEach(client => client.close());
  wss.close();
  
  // Stop monitoring
  priceMonitor.stop();
  
  // Close server
  server.close(() => {
    console.log(chalk.green('Dashboard server shut down'));
    process.exit(0);
  });
});