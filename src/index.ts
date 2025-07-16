// READY FOR CURSOR: Press Cmd+K and say "Create Express + WebSocket server for crypto arbitrage with graceful shutdown"
import express from 'express';
import http from 'http';
import { WebSocketServer } from 'ws';
import dotenv from 'dotenv';
import helmet from 'helmet';
import compression from 'compression';
import cors from 'cors';
import { PriceScanner } from './services/priceScanner';

// Load environment variables
dotenv.config();

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

app.use(helmet());
app.use(compression());
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// WebSocket connection handling
wss.on('connection', (ws) => {
  ws.send(JSON.stringify({ message: 'WebSocket connection established' }));
  // Integrate with PriceScanner events here
});

// Integrate PriceScanner service
const priceScanner = new PriceScanner();
priceScanner.on('opportunity', (data) => {
  // Broadcast arbitrage opportunities to all connected clients
  wss.clients.forEach((client) => {
    if (client.readyState === 1) {
      client.send(JSON.stringify({ type: 'arbitrage_opportunity', data }));
    }
  });
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

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
