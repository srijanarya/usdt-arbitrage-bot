import { config } from 'dotenv';
import { CoinDCXClient } from '../api/exchanges/coinDCX';

config();

async function testCoinDCX() {
  console.log('=== Testing CoinDCX API ===\n');

  const client = new CoinDCXClient({
    apiKey: process.env.COINDCX_API_KEY || '',
    apiSecret: process.env.COINDCX_API_SECRET || ''
  });

  try {
    // Test 1: Get ticker (public endpoint)
    console.log('1. Testing getTicker()...');
    const ticker = await client.getTicker();
    console.log('USDT/INR Ticker:');
    console.log(`  Ask: ₹${ticker.ask}`);
    console.log(`  Bid: ₹${ticker.bid}`);
    console.log(`  24h High: ₹${ticker.high}`);
    console.log(`  24h Low: ₹${ticker.low}`);
    console.log(`  24h Volume: ${ticker.volume} USDT\n`);

    // Test 2: Get order book (public endpoint)
    console.log('2. Testing getOrderBook()...');
    const orderBook = await client.getOrderBook();
    console.log('Order Book:');
    console.log(`  Best Ask: ₹${orderBook.asks[0][0]} (${orderBook.asks[0][1]} USDT)`);
    console.log(`  Best Bid: ₹${orderBook.bids[0][0]} (${orderBook.bids[0][1]} USDT)`);
    console.log(`  Spread: ₹${(parseFloat(orderBook.asks[0][0]) - parseFloat(orderBook.bids[0][0])).toFixed(2)}\n`);

    // Test authenticated endpoints only if API keys are provided
    if (process.env.COINDCX_API_KEY && process.env.COINDCX_API_SECRET) {
      // Test 3: Get balance
      console.log('3. Testing getBalance()...');
      const usdtBalance = await client.getUSDTBalance();
      const inrBalance = await client.getINRBalance();
      console.log(`  USDT Balance: ${usdtBalance}`);
      console.log(`  INR Balance: ₹${inrBalance}\n`);

      // Test 4: Get active orders
      console.log('4. Testing getActiveOrders()...');
      const activeOrders = await client.getActiveOrders('I-USDT_INR');
      console.log(`  Active Orders: ${activeOrders.length}\n`);

      // Test 5: Get trade history
      console.log('5. Testing getTradeHistory()...');
      const trades = await client.getTradeHistory('I-USDT_INR', 5);
      console.log(`  Recent Trades: ${trades.length}`);
      if (trades.length > 0) {
        console.log('  Last Trade:');
        const lastTrade = trades[0];
        console.log(`    Side: ${lastTrade.side}`);
        console.log(`    Price: ₹${lastTrade.price}`);
        console.log(`    Quantity: ${lastTrade.quantity} USDT`);
        console.log(`    Time: ${new Date(lastTrade.timestamp).toLocaleString()}`);
      }
    } else {
      console.log('\n⚠️  Skipping authenticated endpoints (API keys not found in .env)');
    }

    // Test WebSocket connection
    console.log('\n6. Testing WebSocket connection...');
    
    client.on('connected', () => {
      console.log('✓ WebSocket connected successfully');
    });

    client.on('ticker', (data) => {
      console.log('✓ Received ticker update:', {
        ask: data.ask,
        bid: data.bid,
        timestamp: new Date().toISOString()
      });
    });

    client.on('orderbook', (_data) => {
      console.log('✓ Received orderbook update');
    });

    client.on('error', (error) => {
      console.error('WebSocket error:', error.message);
    });

    // Connect to WebSocket
    client.connect();

    // Keep the script running for 10 seconds to receive WebSocket updates
    console.log('\nListening for WebSocket updates for 10 seconds...');
    await new Promise(resolve => setTimeout(resolve, 10000));

    // Disconnect
    client.disconnect();
    console.log('\n✅ All tests completed successfully!');

  } catch (error) {
    console.error('\n❌ Test failed:', error);
  }
}

// Run the test
testCoinDCX().catch(console.error);