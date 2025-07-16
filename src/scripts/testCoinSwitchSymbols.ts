import axios from 'axios';

async function testCoinSwitchSymbols() {
  console.log('=== Testing CoinSwitch Symbol Formats ===\n');

  const client = axios.create({
    baseURL: 'https://coinswitch.co',
    timeout: 10000,
    headers: {
      'Content-Type': 'application/json'
    }
  });

  // Common symbol formats to test
  const symbolFormats = [
    'USDT-INR',
    'USDT_INR', 
    'USDT/INR',
    'USDTINR',
    'usdt-inr',
    'usdt_inr',
    'usdt/inr',
    'usdtinr',
    'USDT',
    'BTC-INR',
    'BTC_INR',
    'BTCINR',
    'ETH-INR',
    'ETH_INR',
    'ETHINR'
  ];

  console.log('Testing ticker endpoint with different symbol formats...\n');

  for (const symbol of symbolFormats) {
    try {
      const response = await client.get('/trade/api/v2/24hr/ticker', {
        params: { symbol }
      });
      console.log(`✅ "${symbol}" works! Response:`, response.data);
      
      // If we found a working symbol, test the depth endpoint too
      try {
        const depthResponse = await client.get('/trade/api/v2/depth', {
          params: { symbol }
        });
        console.log(`✅ "${symbol}" depth works! Bids:`, depthResponse.data.bids?.slice(0, 2));
        console.log(`✅ "${symbol}" depth works! Asks:`, depthResponse.data.asks?.slice(0, 2));
      } catch (depthError: any) {
        console.log(`❌ "${symbol}" depth failed:`, depthError.response?.status);
      }
      
      break; // Exit after first successful format
    } catch (error: any) {
      console.log(`❌ "${symbol}" failed: ${error.response?.status} - ${error.response?.data?.message || error.response?.statusText}`);
    }
  }

  console.log('\n=== Testing without symbol parameter ===');
  
  // Test if endpoints work without symbol parameter
  try {
    const response = await client.get('/trade/api/v2/24hr/ticker');
    console.log('✅ No symbol parameter works:', response.data);
  } catch (error: any) {
    console.log('❌ No symbol parameter failed:', error.response?.status, error.response?.data?.message);
  }

  console.log('\n✅ Symbol format tests completed!');
}

// Run the test
testCoinSwitchSymbols().catch(console.error);