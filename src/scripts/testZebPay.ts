import { ZebPayClient } from '../api/exchanges/zebPay';

async function testZebPay() {
  console.log('=== Testing ZebPay API ===\n');
  
  const client = new ZebPayClient();
  
  try {
    // Test 1: Get price
    console.log('1. Testing getPrice()...');
    const price = await client.getPrice('USDT-INR');
    console.log(`   Current USDT/INR price: ₹${price}\n`);
    
    // Test 2: Get ticker
    console.log('2. Testing getTicker()...');
    const ticker = await client.getTicker('USDT-INR');
    console.log('   Ticker data:');
    console.log(`   - Buy: ₹${ticker.buy}`);
    console.log(`   - Sell: ₹${ticker.sell}`);
    console.log(`   - Market: ₹${ticker.market}`);
    console.log(`   - 24h Volume: ${ticker.volume} USDT`);
    console.log(`   - 24h High: ₹${ticker['24hoursHigh']}`);
    console.log(`   - 24h Low: ₹${ticker['24hoursLow']}\n`);
    
    // Test 3: Get order book
    console.log('3. Testing getOrderBook()...');
    const orderBook = await client.getOrderBook('USDT-INR');
    console.log('   Order Book:');
    console.log(`   - Best Bid: ₹${orderBook.bids[0].price} (${(orderBook.bids[0].amount / 100000000).toFixed(2)} USDT)`);
    console.log(`   - Best Ask: ₹${orderBook.asks[0].price} (${(orderBook.asks[0].amount / 100000000).toFixed(2)} USDT)`);
    console.log(`   - Spread: ₹${(parseFloat(orderBook.asks[0].price) - parseFloat(orderBook.bids[0].price)).toFixed(4)}\n`);
    
    // Test 4: Price monitoring
    console.log('4. Testing price monitoring...');
    client.on('priceUpdate', (data) => {
      console.log(`   Price update: Buy: ₹${data.bid.toFixed(2)}, Sell: ₹${data.ask.toFixed(2)}, Last: ₹${data.last.toFixed(2)}`);
    });
    
    client.on('error', (error) => {
      console.error('   Price monitoring error:', error.message);
    });
    
    client.startPriceMonitoring('USDT-INR', 5000);
    console.log('   Monitoring prices for 15 seconds...');
    
    // Wait for 15 seconds to see price updates
    await new Promise(resolve => setTimeout(resolve, 15000));
    
    console.log('   Price monitoring completed.\n');
    
    console.log('✅ All ZebPay API tests passed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
testZebPay().catch(console.error);