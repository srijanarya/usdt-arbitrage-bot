// Server-only startup (without console spam from monitor)
import express from 'express';
import http from 'http';
import { WebSocketServer } from 'ws';
import dotenv from 'dotenv';
import helmet from 'helmet';
import compression from 'compression';
import cors from 'cors';
import path from 'path';
import { MultiExchangeMonitor } from './monitorMultiExchange';
import apiRoutes, { setMonitor, addHistoricalDataPoint } from './routes/api';

// Load environment variables
dotenv.config();

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

// Override console.log for monitor to prevent spam
const originalLog = console.log;
console.log = (...args) => {
  // Only show important messages
  const message = args.join(' ');
  if (message.includes('Server running') || 
      message.includes('Error') || 
      message.includes('WebSocket') ||
      message.includes('connected')) {
    originalLog(...args);
  }
};

// WebSocket connection handling
wss.on('connection', (ws) => {
  ws.send(JSON.stringify({ message: 'WebSocket connection established' }));
  originalLog('New WebSocket client connected');
  
  ws.on('close', () => {
    originalLog('WebSocket client disconnected');
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
});

monitor.on('error', (error) => {
  broadcastToClients('error', { message: error.message });
});

// Start server
const PORT = parseInt(process.env.PORT || '3000', 10);
server.listen(PORT, '0.0.0.0', () => {
  originalLog(`\n✅ Server running on http://localhost:${PORT}`);
  originalLog(`📊 Dashboard: http://localhost:${PORT}`);
  originalLog(`🔌 API Status: http://localhost:${PORT}/api/system-status`);
  originalLog(`📡 WebSocket: ws://localhost:${PORT}\n`);
  
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