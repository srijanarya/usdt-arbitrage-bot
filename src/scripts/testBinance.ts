import { config } from 'dotenv';
import { BinanceClient } from '../api/exchanges/binance';

config();

async function testBinance() {
  console.log('=== Testing Binance API ===\n');

  const client = new BinanceClient({
    apiKey: process.env.BINANCE_API_KEY || '',
    apiSecret: process.env.BINANCE_API_SECRET || ''
  });

  try {
    // Test 1: Get ticker for BUSD/USDT (public endpoint)
    console.log('1. Testing getTicker(BUSDUSDT) [Public]...');
    const busdUsdtTicker = await client.getTicker('BUSDUSDT');
    console.log('BUSD/USDT Ticker:');
    console.log(`  Bid: $${busdUsdtTicker.bidPrice} (${parseFloat(busdUsdtTicker.bidQty).toLocaleString()} BUSD)`);
    console.log(`  Ask: $${busdUsdtTicker.askPrice} (${parseFloat(busdUsdtTicker.askQty).toLocaleString()} BUSD)`);
    console.log(`  Last: $${busdUsdtTicker.lastPrice}`);
    console.log(`  24h Volume: ${parseFloat(busdUsdtTicker.volume).toLocaleString()} BUSD\n`);

    // Test 2: Get ticker for USDC/USDT (public endpoint)
    console.log('2. Testing getTicker(USDCUSDT) [Public]...');
    const usdcUsdtTicker = await client.getTicker('USDCUSDT');
    console.log('USDC/USDT Ticker:');
    console.log(`  Bid: $${usdcUsdtTicker.bidPrice}`);
    console.log(`  Ask: $${usdcUsdtTicker.askPrice}`);
    console.log(`  Last: $${usdcUsdtTicker.lastPrice}`);
    console.log(`  Spread: $${(parseFloat(usdcUsdtTicker.askPrice) - parseFloat(usdcUsdtTicker.bidPrice)).toFixed(6)}\n`);

    // Test 3: Get order book (public endpoint)
    console.log('3. Testing getOrderBook(BUSDUSDT) [Public]...');
    const orderBook = await client.getOrderBook('BUSDUSDT', 5);
    console.log('Order Book (Top 5):');
    console.log('  Bids:');
    orderBook.bids.slice(0, 3).forEach(([price, qty]) => {
      console.log(`    $${price} - ${parseFloat(qty).toLocaleString()} USDT`);
    });
    console.log('  Asks:');
    orderBook.asks.slice(0, 3).forEach(([price, qty]) => {
      console.log(`    $${price} - ${parseFloat(qty).toLocaleString()} USDT`);
    });
    console.log();

    // Test authenticated endpoints only if API keys are provided
    if (process.env.BINANCE_API_KEY && process.env.BINANCE_API_SECRET) {
      // Test 4: Get account info
      console.log('4. Testing getAccount() [Private]...');
      try {
        const account = await client.getAccount();
        console.log(`  Account Type: ${account.accountType}`);
        console.log(`  Can Trade: ${account.canTrade}`);
        console.log(`  Can Withdraw: ${account.canWithdraw}`);
        console.log(`  Can Deposit: ${account.canDeposit}\n`);
      } catch (error: any) {
        console.log(`  Account info failed: ${error.message}\n`);
      }

      // Test 5: Get balances
      console.log('5. Testing getBalance() [Private]...');
      try {
        const usdtBalance = await client.getUSDTBalance();
        const busdBalance = await client.getBUSDBalance();
        const usdcBalance = await client.getUSDCBalance();
        
        console.log(`  USDT Balance: ${usdtBalance.toFixed(4)}`);
        console.log(`  BUSD Balance: ${busdBalance.toFixed(4)}`);
        console.log(`  USDC Balance: ${usdcBalance.toFixed(4)}\n`);

        // Show all non-zero balances
        const allBalances = await client.getBalance();
        if (allBalances.length > 3) {
          console.log('  Other balances:');
          allBalances
            .filter(b => !['USDT', 'BUSD', 'USDC'].includes(b.asset))
            .slice(0, 5)
            .forEach(b => {
              console.log(`    ${b.asset}: ${parseFloat(b.free).toFixed(4)}`);
            });
          console.log();
        }
      } catch (error: any) {
        console.log(`  Balance check failed: ${error.message}\n`);
      }

      // Test 6: Get open orders
      console.log('6. Testing getOpenOrders() [Private]...');
      try {
        const openOrders = await client.getOpenOrders();
        console.log(`  Open Orders: ${openOrders.length}\n`);
      } catch (error: any) {
        console.log(`  Open orders check failed: ${error.message}\n`);
      }
    } else {
      console.log('\n⚠️  Skipping authenticated endpoints (API keys not found in .env)\n');
    }

    // Test WebSocket connection
    console.log('7. Testing WebSocket connection...');
    
    client.on('connected', () => {
      console.log('✓ WebSocket connected successfully');
    });

    client.on('ticker', (data) => {
      console.log('✓ Received ticker update:', {
        symbol: data.symbol,
        bid: data.bidPrice,
        ask: data.askPrice,
        last: data.lastPrice
      });
    });

    client.on('orderbook', (data) => {
      console.log('✓ Received orderbook update for', data.symbol || 'USDTBUSD');
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
    console.log('\n✅ All Binance API tests completed!');

  } catch (error) {
    console.error('\n❌ Test failed:', error);
  }
}

// Run the test
testBinance().catch(console.error);