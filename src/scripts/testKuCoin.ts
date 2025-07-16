import { config } from 'dotenv';
import { KuCoinClient } from '../api/exchanges/kucoin';

config();

async function testKuCoin() {
  console.log('=== Testing KuCoin API ===\n');

  // Note: KuCoin doesn't have USDT/INR, so we'll test with USDT/USDC
  console.log('Note: KuCoin uses USDT/USDC pair for stablecoin arbitrage\n');

  const client = new KuCoinClient({
    apiKey: process.env.KUCOIN_API_KEY || '',
    apiSecret: process.env.KUCOIN_API_SECRET || '',
    passphrase: process.env.KUCOIN_PASSPHRASE || ''
  });

  try {
    // Test 1: Get ticker (public endpoint - no auth needed)
    console.log('1. Testing getTicker() [Public]...');
    const ticker = await client.getTicker('USDT-USDC');
    console.log('USDT/USDC Ticker:');
    console.log(`  Best Bid: $${ticker.bestBid}`);
    console.log(`  Best Ask: $${ticker.bestAsk}`);
    console.log(`  Last Price: $${ticker.price}`);
    console.log(`  Spread: $${(parseFloat(ticker.bestAsk) - parseFloat(ticker.bestBid)).toFixed(6)}\n`);

    // Test 2: Get order book (public endpoint)
    console.log('2. Testing getOrderBook() [Public]...');
    const orderBook = await client.getOrderBook('USDT-USDC');
    console.log('Order Book:');
    console.log(`  Best Bid: $${orderBook.bids[0][0]} (${orderBook.bids[0][1]} USDT)`);
    console.log(`  Best Ask: $${orderBook.asks[0][0]} (${orderBook.asks[0][1]} USDT)`);
    console.log(`  Spread: $${(parseFloat(orderBook.asks[0][0]) - parseFloat(orderBook.bids[0][0])).toFixed(6)}\n`);

    // Test 3: Get 24hr stats (public endpoint)
    console.log('3. Testing get24hrStats() [Public]...');
    const stats = await client.get24hrStats('USDT-USDC');
    console.log('24hr Stats:');
    console.log(`  Volume: ${stats.vol} USDT`);
    console.log(`  High: $${stats.high}`);
    console.log(`  Low: $${stats.low}`);
    console.log(`  Change: ${stats.changeRate}%\n`);

    // Test authenticated endpoints only if API keys are provided
    if (process.env.KUCOIN_API_KEY && process.env.KUCOIN_API_SECRET && process.env.KUCOIN_PASSPHRASE) {
      // Test 4: Get balance
      console.log('4. Testing getBalance() [Private]...');
      try {
        const usdtBalance = await client.getUSDTBalance();
        const usdcBalance = await client.getUSDCBalance();
        console.log(`  USDT Balance: ${usdtBalance}`);
        console.log(`  USDC Balance: ${usdcBalance}\n`);
      } catch (error: any) {
        console.log(`  Balance check failed: ${error.message}\n`);
      }

      // Test 5: Get active orders
      console.log('5. Testing getActiveOrders() [Private]...');
      try {
        const activeOrders = await client.getActiveOrders('USDT-USDC');
        console.log(`  Active Orders: ${activeOrders.length}\n`);
      } catch (error: any) {
        console.log(`  Active orders check failed: ${error.message}\n`);
      }
    } else {
      console.log('\n⚠️  Skipping authenticated endpoints (API keys not found in .env)');
      console.log('To test authenticated endpoints, add to your .env:');
      console.log('  KUCOIN_API_KEY=your_api_key');
      console.log('  KUCOIN_API_SECRET=your_api_secret');
      console.log('  KUCOIN_PASSPHRASE=your_passphrase\n');
    }

    // Test WebSocket connection
    console.log('6. Testing WebSocket connection...');
    
    client.on('connected', () => {
      console.log('✓ WebSocket connected successfully');
    });

    client.on('ticker', (data) => {
      console.log('✓ Received ticker update:', {
        bid: data.bestBid,
        ask: data.bestAsk,
        price: data.price,
        timestamp: new Date().toISOString()
      });
    });

    client.on('orderbook', () => {
      console.log('✓ Received orderbook update');
    });

    client.on('error', (error) => {
      console.error('WebSocket error:', error.message);
    });

    // Connect to WebSocket
    await client.connect();

    // Keep the script running for 10 seconds to receive WebSocket updates
    console.log('\nListening for WebSocket updates for 10 seconds...');
    await new Promise(resolve => setTimeout(resolve, 10000));

    // Disconnect
    client.disconnect();
    console.log('\n✅ All KuCoin API tests completed!');

  } catch (error) {
    console.error('\n❌ Test failed:', error);
  }
}

// Run the test
testKuCoin().catch(console.error);