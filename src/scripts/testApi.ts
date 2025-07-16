import axios from 'axios';

const baseURL = 'http://localhost:3000/api';

async function testAPIEndpoints() {
  console.log('🧪 Testing API Endpoints...\n');

  const endpoints = [
    { method: 'GET', path: '/historical', description: 'Historical arbitrage data' },
    { method: 'GET', path: '/system-status', description: 'System health metrics' },
    { method: 'GET', path: '/metrics', description: 'Performance statistics' },
    { method: 'GET', path: '/opportunities', description: 'Current arbitrage opportunities' },
    { method: 'GET', path: '/exchanges', description: 'Exchange connection status' },
    { method: 'GET', path: '/trades', description: 'Trade execution history' }
  ];

  for (const endpoint of endpoints) {
    try {
      console.log(`\n📍 Testing ${endpoint.method} ${endpoint.path}`);
      console.log(`   ${endpoint.description}`);
      
      const response = await axios({
        method: endpoint.method,
        url: `${baseURL}${endpoint.path}`,
        timeout: 5000
      });

      console.log(`   ✅ Status: ${response.status}`);
      console.log(`   📊 Response:`, JSON.stringify(response.data, null, 2).substring(0, 200) + '...');
      
    } catch (error: any) {
      console.log(`   ❌ Error: ${error.message}`);
      if (error.response) {
        console.log(`   Status: ${error.response.status}`);
        console.log(`   Data:`, error.response.data);
      }
    }
  }

  console.log('\n\n📊 Testing with query parameters...\n');

  // Test with query parameters
  try {
    console.log('📍 Testing GET /api/historical?limit=5&offset=0');
    const response = await axios.get(`${baseURL}/historical?limit=5&offset=0`);
    console.log('   ✅ Success:', {
      total: response.data.total,
      returned: response.data.data.length,
      limit: response.data.limit,
      offset: response.data.offset
    });
  } catch (error: any) {
    console.log('   ❌ Error:', error.message);
  }

  try {
    console.log('\n📍 Testing GET /api/trades?status=completed&limit=10');
    const response = await axios.get(`${baseURL}/trades?status=completed&limit=10`);
    console.log('   ✅ Success:', {
      total: response.data.total,
      returned: response.data.data.length
    });
  } catch (error: any) {
    console.log('   ❌ Error:', error.message);
  }

  console.log('\n✅ API testing completed!');
}

// Wait a bit for server to be ready if just started
setTimeout(() => {
  testAPIEndpoints().catch(console.error);
}, 2000);