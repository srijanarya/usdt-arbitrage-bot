import axios from 'axios';
import { ZebPayClient } from './api/exchanges/zebPay';
import dotenv from 'dotenv';

dotenv.config();

async function testZebPayAuth() {
  console.log('🔍 Testing ZebPay API Authentication...\n');
  
  // Test 1: Direct API call without authentication
  console.log('📡 Test 1: Direct API call without authentication...');
  try {
    const response = await axios.get('https://api.zebpay.com/api/v1/market/ticker/USDT-INR');
    console.log('✅ Success! Public endpoint does not require auth');
    console.log('Response:', response.data);
  } catch (error: any) {
    console.log('❌ Failed:', error.response?.status, error.response?.statusText);
    console.log('Response:', error.response?.data);
  }
  
  // Test 2: Try with just API key header
  console.log('\n📡 Test 2: API call with just API key...');
  try {
    const response = await axios.get('https://api.zebpay.com/api/v1/market/ticker/USDT-INR', {
      headers: {
        'X-AUTH-APIKEY': process.env.ZEBPAY_API_KEY || ''
      }
    });
    console.log('✅ Success! Only API key needed');
    console.log('Response:', response.data);
  } catch (error: any) {
    console.log('❌ Failed:', error.response?.status, error.response?.statusText);
  }
  
  // Test 3: Try with full authentication
  console.log('\n📡 Test 3: API call with full authentication...');
  const client = new ZebPayClient();
  try {
    const ticker = await client.getTicker('USDT-INR');
    console.log('✅ Success! Full auth working');
    console.log('Ticker:', ticker);
  } catch (error: any) {
    console.log('❌ Failed:', error.response?.status, error.response?.statusText);
  }
  
  // Test 4: Try alternate endpoint formats
  console.log('\n📡 Test 4: Testing alternate endpoint formats...');
  const alternateEndpoints = [
    'https://api.zebpay.com/v1/market/ticker/USDT-INR',
    'https://api.zebpay.com/market/ticker/USDT-INR',
    'https://www.zebpay.com/api/v1/market/ticker/USDT-INR',
    'https://zebapi.com/api/v1/market/ticker/USDT-INR'
  ];
  
  for (const endpoint of alternateEndpoints) {
    try {
      console.log(`\nTrying: ${endpoint}`);
      const response = await axios.get(endpoint, { timeout: 5000 });
      console.log('✅ Success!');
      console.log('Response:', response.data);
      break;
    } catch (error: any) {
      console.log('❌ Failed:', error.response?.status || error.code);
    }
  }
}

// Run tests
testZebPayAuth();