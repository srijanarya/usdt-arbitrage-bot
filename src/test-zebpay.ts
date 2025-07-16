import { ZebPayClient } from './api/exchanges/zebPay';
import dotenv from 'dotenv';

dotenv.config();

async function testZebPayAPI() {
  console.log('🚀 Testing ZebPay API...\n');
  
  const client = new ZebPayClient();
  
  try {
    // Test 1: Get current price
    console.log('📊 Test 1: Getting USDT/INR price...');
    const price = await client.getPrice('USDT-INR');
    console.log(`✅ Current price: ₹${price}`);
    
    // Test 2: Get full ticker
    console.log('\n📈 Test 2: Getting full ticker data...');
    const ticker = await client.getTicker('USDT-INR');
    console.log('✅ Ticker data:');
    console.log(`   Buy: ₹${ticker.buy}`);
    console.log(`   Sell: ₹${ticker.sell}`);
    console.log(`   Last: ₹${ticker.market}`);
    console.log(`   Volume: ${ticker.volume}`);
    
    // Test 3: Get order book
    console.log('\n📚 Test 3: Getting order book...');
    const orderBook = await client.getOrderBook('USDT-INR');
    console.log('✅ Order book retrieved');
    console.log(`   Best bid: ₹${orderBook.bids[0]?.price || 'N/A'}`);
    console.log(`   Best ask: ₹${orderBook.asks[0]?.price || 'N/A'}`);
    
    // Test 4: Test authenticated endpoint (balance)
    console.log('\n💰 Test 4: Getting account balance...');
    try {
      const balance = await client.getBalance();
      console.log('✅ Authentication successful!');
      const usdtBalance = balance.find((b: any) => b.currency === 'USDT');
      const inrBalance = balance.find((b: any) => b.currency === 'INR');
      
      if (usdtBalance) {
        console.log(`   USDT: ${usdtBalance.balance}`);
      }
      if (inrBalance) {
        console.log(`   INR: ₹${inrBalance.balance}`);
      }
    } catch (authError) {
      console.log('⚠️  Authentication failed (check API credentials)');
    }
    
    // Test 5: Price monitoring
    console.log('\n📡 Test 5: Starting price monitoring (10 seconds)...');
    client.on('priceUpdate', (data) => {
      console.log(`[${data.timestamp.toLocaleTimeString()}] Price update: ₹${data.last}`);
    });
    
    client.on('error', (error) => {
      console.error('Error:', error.message);
    });
    
    client.startPriceMonitoring('USDT-INR', 2000); // Update every 2 seconds
    
    // Stop after 10 seconds
    setTimeout(() => {
      console.log('\n✅ All tests completed!');
      process.exit(0);
    }, 10000);
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// Run tests
testZebPayAPI();