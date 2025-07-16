import { config } from 'dotenv';
import { CoinSwitchClient } from '../api/exchanges/coinSwitch';

config();

async function testCoinSwitch() {
  console.log('=== Testing CoinSwitch API ===\n');

  const client = new CoinSwitchClient({
    apiKey: process.env.COINSWITCH_API_KEY || '',
    apiSecret: process.env.COINSWITCH_API_SECRET || ''
  });

  try {
    // Test 1: Get all tickers first to see available symbols
    console.log('1. Testing getAllTickers()...');
    const allTickers = await client.getAllTickers();
    console.log('Available tickers:', allTickers.slice(0, 3)); // Show first 3
    
    // Test 2: Get specific ticker
    console.log('\n2. Testing getTicker()...');
    const ticker = await client.getTicker();
    console.log('USDT/INR Ticker:');
    console.log(`  Ask: ₹${ticker.ask}`);
    console.log(`  Bid: ₹${ticker.bid}`);
    console.log(`  Last: ₹${ticker.last}`);
    console.log(`  24h High: ₹${ticker.high}`);
    console.log(`  24h Low: ₹${ticker.low}`);
    console.log(`  24h Volume: ${ticker.volume} USDT`);
    console.log(`  24h Change: ${ticker.change_percent}%\n`);

    // Test 2: Get order book (public endpoint)
    console.log('2. Testing getOrderBook()...');
    const orderBook = await client.getOrderBook();
    console.log('Order Book:');
    console.log(`  Best Ask: ₹${orderBook.asks[0][0]} (${orderBook.asks[0][1]} USDT)`);
    console.log(`  Best Bid: ₹${orderBook.bids[0][0]} (${orderBook.bids[0][1]} USDT)`);
    console.log(`  Spread: ₹${(parseFloat(orderBook.asks[0][0]) - parseFloat(orderBook.bids[0][0])).toFixed(2)}\n`);

    // Test authenticated endpoints only if API keys are provided
    if (process.env.COINSWITCH_API_KEY && process.env.COINSWITCH_API_SECRET) {
      // Test 3: Get balance
      console.log('3. Testing getBalance()...');
      const usdtBalance = await client.getUSDTBalance();
      const inrBalance = await client.getINRBalance();
      console.log(`  USDT Balance: ${usdtBalance}`);
      console.log(`  INR Balance: ₹${inrBalance}\n`);

      // Test 4: Get open orders
      console.log('4. Testing getOpenOrders()...');
      const openOrders = await client.getOpenOrders('USDT/INR');
      console.log(`  Open Orders: ${openOrders.length}\n`);

      // Test 5: Get trade history
      console.log('5. Testing getTradeHistory()...');
      const trades = await client.getTradeHistory('USDT/INR', 5);
      console.log(`  Recent Trades: ${trades.length}`);
      if (trades.length > 0) {
        console.log('  Last Trade:');
        const lastTrade = trades[0];
        console.log(`    Side: ${lastTrade.side}`);
        console.log(`    Price: ₹${lastTrade.price}`);
        console.log(`    Quantity: ${lastTrade.quantity} USDT`);
        console.log(`    Time: ${new Date(lastTrade.timestamp).toLocaleString()}`);
      }

      // Test 6: Get USDT/INR price helper
      console.log('\n6. Testing getUSDTINRPrice()...');
      const price = await client.getUSDTINRPrice();
      console.log(`  Current Price: Bid: ₹${price.bid}, Ask: ₹${price.ask}, Last: ₹${price.last}`);
    } else {
      console.log('\n⚠️  Skipping authenticated endpoints (API keys not found in .env)');
    }

    // Test WebSocket connection
    console.log('\n7. Testing WebSocket connection...');
    
    client.on('connected', () => {
      console.log('✓ WebSocket connected successfully');
    });

    client.on('ticker', (data) => {
      console.log('✓ Received ticker update:', {
        bid: data.bid,
        ask: data.ask,
        last: data.last,
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
testCoinSwitch().catch(console.error);