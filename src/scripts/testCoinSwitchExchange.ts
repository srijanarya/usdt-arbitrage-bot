import axios from 'axios';

async function testCoinSwitchExchange() {
  console.log('=== Testing CoinSwitch with Exchange Parameter ===\n');

  const client = axios.create({
    baseURL: 'https://coinswitch.co',
    timeout: 10000,
    headers: {
      'Content-Type': 'application/json'
    }
  });

  // Test different exchange and symbol combinations
  const exchanges = ['coinswitchx', 'wazirx', 'c2c1', 'c2c2'];
  const symbols = ['USDT/INR', 'BTC/INR', 'ETH/INR', 'USDT/USDC'];

  console.log('Testing ticker endpoint with exchange parameter...\n');

  for (const exchange of exchanges) {
    console.log(`\n--- Testing exchange: ${exchange} ---`);
    
    for (const symbol of symbols) {
      try {
        const response = await client.get('/trade/api/v2/24hr/ticker', {
          params: { 
            symbol,
            exchange
          }
        });
        console.log(`✅ "${symbol}" on ${exchange} works!`);
        console.log('Response:', response.data);
        
        // Test depth endpoint if ticker works
        try {
          const depthResponse = await client.get('/trade/api/v2/depth', {
            params: { 
              symbol,
              exchange
            }
          });
          console.log(`✅ "${symbol}" depth on ${exchange} works!`);
          console.log('Best bid:', depthResponse.data.bids?.[0]);
          console.log('Best ask:', depthResponse.data.asks?.[0]);
        } catch (depthError: any) {
          console.log(`❌ "${symbol}" depth on ${exchange} failed:`, depthError.response?.status);
        }
        
        // Exit after first successful combination
        return;
        
      } catch (error: any) {
        console.log(`❌ "${symbol}" on ${exchange} failed: ${error.response?.status} - ${error.response?.data?.message || error.response?.statusText}`);
      }
    }
  }

  console.log('\n=== Testing single exchange parameter ===');
  
  // Test just with exchange parameter
  for (const exchange of exchanges) {
    try {
      const response = await client.get('/trade/api/v2/24hr/ticker', {
        params: { exchange }
      });
      console.log(`✅ Exchange "${exchange}" works:`, response.data);
      break;
    } catch (error: any) {
      console.log(`❌ Exchange "${exchange}" failed:`, error.response?.status, error.response?.data?.message);
    }
  }

  console.log('\n✅ Exchange parameter tests completed!');
}

// Run the test
testCoinSwitchExchange().catch(console.error);