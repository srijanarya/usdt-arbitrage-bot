import axios from 'axios';

async function testCoinSwitchBasic() {
  console.log('=== Testing CoinSwitch API Basic ===\n');

  const client = axios.create({
    baseURL: 'https://coinswitch.co',
    timeout: 10000,
    headers: {
      'Content-Type': 'application/json'
    }
  });

  try {
    // Test 1: Server time
    console.log('1. Testing server time...');
    try {
      const timeResponse = await client.get('/trade/api/v2/time');
      console.log('Server time:', timeResponse.data);
    } catch (error: any) {
      console.log('Time endpoint error:', error.response?.status, error.response?.statusText);
    }

    // Test 2: Ping
    console.log('\n2. Testing ping...');
    try {
      const pingResponse = await client.get('/trade/api/v2/ping');
      console.log('Ping response:', pingResponse.data);
    } catch (error: any) {
      console.log('Ping endpoint error:', error.response?.status, error.response?.statusText);
    }

    // Test 3: All tickers
    console.log('\n3. Testing all tickers...');
    try {
      const tickersResponse = await client.get('/trade/api/v2/24hr/ticker');
      console.log('Tickers response:', tickersResponse.data);
    } catch (error: any) {
      console.log('Tickers endpoint error:', error.response?.status, error.response?.statusText);
      if (error.response?.data) {
        console.log('Error data:', error.response.data);
      }
    }

    // Test 4: Specific ticker with different symbol formats
    console.log('\n4. Testing specific ticker formats...');
    const symbolFormats = ['USDT/INR', 'USDTINR', 'usdt/inr', 'usdtinr'];
    
    for (const symbol of symbolFormats) {
      try {
        const tickerResponse = await client.get('/trade/api/v2/24hr/ticker', {
          params: { symbol }
        });
        console.log(`✓ Symbol "${symbol}" works:`, tickerResponse.data);
        break;
      } catch (error: any) {
        console.log(`✗ Symbol "${symbol}" failed:`, error.response?.status);
      }
    }

    // Test 5: Depth/OrderBook
    console.log('\n5. Testing depth/orderbook...');
    try {
      const depthResponse = await client.get('/trade/api/v2/depth', {
        params: { symbol: 'USDTINR' }
      });
      console.log('Depth response:', depthResponse.data);
    } catch (error: any) {
      console.log('Depth endpoint error:', error.response?.status, error.response?.statusText);
      if (error.response?.data) {
        console.log('Error data:', error.response.data);
      }
    }

    console.log('\n✅ Basic API tests completed!');

  } catch (error) {
    console.error('\n❌ Test failed:', error);
  }
}

// Run the test
testCoinSwitchBasic().catch(console.error);