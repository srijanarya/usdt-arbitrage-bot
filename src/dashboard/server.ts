import express from 'express';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import path from 'path';
import chalk from 'chalk';
import { priceStreamService } from '../services/websocket/PriceStreamService';
import { databaseService } from '../services/database/DatabaseService';

const app = express();
const server = http.createServer(app);
const io = new SocketIOServer(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// API endpoints
app.get('/api/status', async (req, res) => {
  const connectionStatus = priceStreamService.getConnectionStatus();
  const latestPrices = await databaseService.getLatestPrices();
  const recentOpportunities = await databaseService.getRecentOpportunities(5);
  
  res.json({
    websocket: connectionStatus,
    prices: latestPrices,
    opportunities: recentOpportunities,
    uptime: process.uptime()
  });
});

app.get('/api/performance', async (req, res) => {
  const dailyPerformance = await databaseService.getDailyPerformance(7);
  const exchangeStats = await databaseService.getExchangeStats(24);
  
  res.json({
    daily: dailyPerformance,
    exchanges: exchangeStats
  });
});

// Socket.IO real-time updates
io.on('connection', (socket) => {
  console.log(chalk.blue('Dashboard client connected'));
  
  // Send initial data
  sendDashboardUpdate();
  
  socket.on('disconnect', () => {
    console.log(chalk.yellow('Dashboard client disconnected'));
  });
});

// Send updates to dashboard
async function sendDashboardUpdate() {
  const connectionStatus = priceStreamService.getConnectionStatus();
  const currentPrices = Array.from(priceStreamService.getCurrentPrices().values());
  const latestOpportunities = await databaseService.getRecentOpportunities(10);
  
  io.emit('update', {
    timestamp: new Date(),
    connections: connectionStatus,
    prices: currentPrices,
    opportunities: latestOpportunities
  });
}

// Listen for price updates
priceStreamService.on('priceUpdate', () => {
  sendDashboardUpdate();
});

// Listen for arbitrage opportunities
priceStreamService.on('arbitrageOpportunity', (opportunity) => {
  io.emit('opportunity', opportunity);
});

// Update dashboard every 5 seconds
setInterval(sendDashboardUpdate, 5000);

const PORT = process.env.DASHBOARD_PORT || 3001;

export function startDashboardServer() {
  server.listen(PORT, () => {
    console.log(chalk.green(`📊 Dashboard server running on http://localhost:${PORT}`));
  });
}

// Start if run directly
if (require.main === module) {
  startDashboardServer();
}