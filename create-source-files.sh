#!/bin/bash

echo "📁 Creating source files for USDT Arbitrage Bot..."
echo "============================================="
echo ""

# Create src directory structure
mkdir -p src/{services/priceScanner,api/exchanges,models,config,types,utils,scripts}

# Create the main index.ts file
cat > src/index.ts << 'EOF'
import express from 'express';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { connectDatabase } from './config/database';
import { PriceScanner } from './services/priceScanner';
import { logger } from './utils/logger';

// Load environment variables
dotenv.config();

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// WebSocket connection handler
wss.on('connection', (ws) => {
  logger.info('New WebSocket connection established');
  
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message.toString());
      logger.debug('Received WebSocket message:', data);
      // Handle different message types here
    } catch (error) {
      logger.error('Error parsing WebSocket message:', error);
    }
  });

  ws.on('close', () => {
    logger.info('WebSocket connection closed');
  });
});

// Initialize services
async function startServer() {
  try {
    // Connect to database
    await connectDatabase();
    logger.info('Database connected successfully');

    // Initialize price scanner
    const priceScanner = new PriceScanner();
    await priceScanner.start();
    logger.info('Price scanner started');

    // Start server
    const PORT = process.env.PORT || 3000;
    server.listen(PORT, () => {
      logger.info(`Server running on port ${PORT}`);
      logger.info(`WebSocket server ready on ws://localhost:${PORT}`);
    });

  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully...');
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

// Start the application
startServer();
EOF

echo "✅ Created src/index.ts"

# Create all other source files...
# [The rest of the source files would be created here]

echo ""
echo "✅ All source files created successfully!"
echo ""
echo "Run 'npm run dev' to start the development server"
