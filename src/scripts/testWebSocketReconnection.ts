import { BinanceEnhancedClient } from '../api/exchanges/binanceEnhanced';
import { WebSocketManager } from '../utils/websocketManager';
import chalk from 'chalk';
import dotenv from 'dotenv';

dotenv.config();

async function testWebSocketReconnection() {
  console.log(chalk.cyan.bold('Testing Enhanced WebSocket Reconnection\n'));

  // Create Binance client with enhanced WebSocket
  const client = new BinanceEnhancedClient(
    process.env.BINANCE_API_KEY || '',
    process.env.BINANCE_API_SECRET || '',
    false // Use production
  );

  // Track connection events
  let connectionCount = 0;
  let disconnectionCount = 0;
  let errorCount = 0;
  let messageCount = 0;

  // Setup event listeners
  client.on('wsConnected', () => {
    connectionCount++;
    console.log(chalk.green(`✓ WebSocket connected (Count: ${connectionCount})`));
  });

  client.on('wsDisconnected', (info) => {
    disconnectionCount++;
    console.log(chalk.yellow(`⚠ WebSocket disconnected (Count: ${disconnectionCount})`), info);
  });

  client.on('wsError', (error) => {
    errorCount++;
    console.log(chalk.red(`✗ WebSocket error (Count: ${errorCount}):`, error.message));
  });

  client.on('ticker', (data) => {
    messageCount++;
    console.log(chalk.blue(`📊 Ticker update #${messageCount}: ${data.symbol} @ ₹${(data.last * 87.5).toFixed(2)}`));
  });

  client.on('orderBook', (data) => {
    const spread = ((data.asks[0][0] - data.bids[0][0]) / data.bids[0][0] * 100).toFixed(3);
    console.log(chalk.magenta(`📖 Order book: ${data.symbol} Spread: ${spread}%`));
  });

  client.on('rateLimited', ({ retryAfter }) => {
    console.log(chalk.yellow(`⏱ Rate limited! Retry after ${retryAfter}s`));
  });

  client.on('wsMaxReconnectFailed', () => {
    console.log(chalk.red('❌ Maximum reconnection attempts reached!'));
  });

  try {
    // Connect to WebSocket
    console.log(chalk.cyan('Connecting to Binance WebSocket...\n'));
    await client.connect();

    // Wait for connection
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Subscribe to USDT pairs
    const symbols = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT'];
    
    for (const symbol of symbols) {
      await client.subscribe(symbol);
      console.log(chalk.green(`✓ Subscribed to ${symbol}`));
    }

    // Display connection stats every 10 seconds
    const statsInterval = setInterval(() => {
      const stats = client.getConnectionStats();
      if (stats) {
        console.log(chalk.cyan('\n📊 Connection Statistics:'));
        console.log(chalk.gray('━'.repeat(40)));
        console.log(`State: ${stats.state}`);
        console.log(`Reconnect Attempts: ${stats.reconnectAttempts}`);
        console.log(`Ping Failures: ${stats.pingFailures}`);
        console.log(`Queued Messages: ${stats.queuedMessages}`);
        console.log(`Uptime: ${(stats.uptime / 1000).toFixed(0)}s`);
        console.log(`Active Subscriptions: ${client.getSubscriptions().join(', ')}`);
        console.log(chalk.gray('━'.repeat(40)));
      }
    }, 10000);

    // Test reconnection after 30 seconds
    setTimeout(() => {
      console.log(chalk.yellow('\n🔄 Testing manual reconnection...'));
      const ws = (client as any).wsManager;
      if (ws) {
        ws.disconnect();
        // Should automatically reconnect
      }
    }, 30000);

    // Test REST API fallback
    setTimeout(async () => {
      console.log(chalk.cyan('\n🔍 Testing REST API fallback...'));
      try {
        const ticker = await client.getTicker('BTCUSDT');
        console.log(chalk.green(`✓ REST API ticker: BTCUSDT @ $${ticker.last.toFixed(2)}`));
      } catch (error: any) {
        console.log(chalk.red(`✗ REST API error: ${error.message}`));
      }
    }, 15000);

    // Run for 2 minutes
    setTimeout(() => {
      console.log(chalk.cyan('\n📈 Final Statistics:'));
      console.log(chalk.gray('━'.repeat(40)));
      console.log(`Total Connections: ${connectionCount}`);
      console.log(`Total Disconnections: ${disconnectionCount}`);
      console.log(`Total Errors: ${errorCount}`);
      console.log(`Total Messages: ${messageCount}`);
      console.log(chalk.gray('━'.repeat(40)));
      
      clearInterval(statsInterval);
      client.disconnect();
      
      console.log(chalk.green('\n✓ Test completed successfully!'));
      process.exit(0);
    }, 120000);

  } catch (error: any) {
    console.error(chalk.red('Fatal error:'), error);
    process.exit(1);
  }
}

// Test direct WebSocket manager
async function testWebSocketManager() {
  console.log(chalk.cyan.bold('\nTesting WebSocket Manager directly\n'));

  const manager = new WebSocketManager({
    url: 'wss://stream.binance.com:9443/ws/btcusdt@ticker',
    name: 'Test-Manager',
    reconnectInterval: 3000,
    maxReconnectAttempts: 5,
    pingInterval: 10000
  });

  manager.on('connected', () => {
    console.log(chalk.green('✓ Direct WebSocket connected'));
  });

  manager.on('message', (msg) => {
    console.log(chalk.blue('📨 Message received'), msg.type);
  });

  manager.on('disconnected', (info) => {
    console.log(chalk.yellow('⚠ Disconnected:'), info);
  });

  manager.on('maxReconnectAttemptsReached', () => {
    console.log(chalk.red('❌ Max reconnect attempts reached'));
  });

  manager.connect();

  // Simulate network interruption
  setTimeout(() => {
    console.log(chalk.yellow('\n🔌 Simulating network interruption...'));
    (manager as any).ws?.close();
  }, 5000);

  // Check stats
  setInterval(() => {
    const stats = manager.getStats();
    console.log(chalk.gray(`State: ${stats.state} | Attempts: ${stats.reconnectAttempts}`));
  }, 2000);
}

// Handle process termination
process.on('SIGINT', () => {
  console.log(chalk.red('\n\nReceived SIGINT, shutting down gracefully...'));
  process.exit(0);
});

// Run tests
console.log(chalk.cyan('Select test mode:'));
console.log('1. Test Enhanced Binance Client');
console.log('2. Test WebSocket Manager directly');
console.log('3. Run both tests\n');

const mode = process.argv[2] || '1';

switch (mode) {
  case '1':
    testWebSocketReconnection();
    break;
  case '2':
    testWebSocketManager();
    break;
  case '3':
    testWebSocketReconnection();
    setTimeout(() => testWebSocketManager(), 130000);
    break;
  default:
    console.log(chalk.red('Invalid mode. Please use 1, 2, or 3'));
    process.exit(1);
}