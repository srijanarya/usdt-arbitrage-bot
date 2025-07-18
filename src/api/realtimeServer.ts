import express from 'express';
import cors from 'cors';
import { p2pOrderManager } from '../services/p2p/orderManager';
import { autoListingManager } from '../services/p2p/autoListingManager';
import { logger } from '../utils/logger';
import http from 'http';
import { WebSocketServer } from 'ws';

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

app.use(cors());
app.use(express.json());

// Store active WebSocket connections
const clients = new Set<any>();

// WebSocket connection handler
wss.on('connection', (ws) => {
  clients.add(ws);
  logger.info('New WebSocket client connected');
  
  // Send initial data
  sendRealtimeUpdate();
  
  ws.on('close', () => {
    clients.delete(ws);
    logger.info('WebSocket client disconnected');
  });
});

// Send real-time updates to all connected clients
function sendRealtimeUpdate() {
  const data = {
    timestamp: new Date().toISOString(),
    orders: {
      active: p2pOrderManager.getActiveOrders().map(order => ({
        id: order.id,
        amount: order.amount,
        price: order.price,
        status: order.status,
        createdAt: order.createdAt,
        expectedAmount: order.expectedAmount,
        paymentReceived: order.paymentReceived,
        actualAmount: order.actualAmount,
        expiresAt: order.expiresAt
      })),
      completed: p2pOrderManager.getOrdersByStatus('completed').length,
      total: p2pOrderManager.getAllOrders().length
    },
    autoListing: autoListingManager.getStatus(),
    balance: autoListingManager.getBalance(),
    stats: {
      totalProfit: 0, // Calculate from completed orders
      successRate: 0, // Calculate from orders
      avgCompletionTime: 0 // Calculate from order history
    }
  };
  
  const message = JSON.stringify(data);
  clients.forEach(client => {
    if (client.readyState === 1) { // WebSocket.OPEN
      client.send(message);
    }
  });
}

// Update interval - send updates every 2 seconds
setInterval(sendRealtimeUpdate, 2000);

// Listen for order events and send immediate updates
p2pOrderManager.on('orderCreated', () => sendRealtimeUpdate());
p2pOrderManager.on('orderStatusChanged', () => sendRealtimeUpdate());
p2pOrderManager.on('paymentReceived', () => sendRealtimeUpdate());
p2pOrderManager.on('orderCompleted', () => sendRealtimeUpdate());
p2pOrderManager.on('orderCancelled', () => sendRealtimeUpdate());

autoListingManager.on('balanceUpdated', () => sendRealtimeUpdate());
autoListingManager.on('orderCreated', () => sendRealtimeUpdate());
autoListingManager.on('orderRelisted', () => sendRealtimeUpdate());

// REST endpoints for manual actions
app.post('/api/refresh', (req, res) => {
  sendRealtimeUpdate();
  res.json({ success: true, message: 'Update sent' });
});

app.get('/api/status', (req, res) => {
  res.json({
    success: true,
    orders: p2pOrderManager.getActiveOrders(),
    autoListing: autoListingManager.getStatus(),
    balance: autoListingManager.getBalance()
  });
});

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    clients: clients.size,
    uptime: process.uptime() 
  });
});

export function startRealtimeServer(port: number = 4001) {
  server.listen(port, () => {
    logger.info(`🌐 Real-time server started on http://localhost:${port}`);
    logger.info(`🔌 WebSocket available on ws://localhost:${port}`);
  });
  
  return server;
}

// Auto-start if run directly
if (require.main === module) {
  startRealtimeServer();
}