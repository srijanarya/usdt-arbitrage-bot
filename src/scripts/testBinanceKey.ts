#!/usr/bin/env node
import axios from 'axios';
import crypto from 'crypto';
import { config } from 'dotenv';

config();

async function testKey() {
  console.log('Testing Binance API Key...\n');

  const apiKey = process.env.BINANCE_API_KEY;
  const apiSecret = process.env.BINANCE_API_SECRET;

  if (!apiKey || !apiSecret) {
    console.log('❌ API keys not found in environment');
    return;
  }

  console.log(`API Key: ${apiKey.substring(0, 10)}...${apiKey.substring(apiKey.length - 10)}`);
  
  try {
    // Test 1: Simple authenticated request
    const timestamp = Date.now();
    const queryString = `timestamp=${timestamp}`;
    const signature = crypto
      .createHmac('sha256', apiSecret)
      .update(queryString)
      .digest('hex');

    console.log('\n1️⃣ Testing account endpoint...');
    const response = await axios.get(
      `https://api.binance.com/api/v3/account?${queryString}&signature=${signature}`,
      {
        headers: {
          'X-MBX-APIKEY': apiKey
        }
      }
    );

    console.log('✅ API Key is valid!');
    console.log('Account type:', response.data.accountType);
    console.log('Can trade:', response.data.canTrade);
    
    // Check balances
    const balances = response.data.balances.filter((b: any) => parseFloat(b.free) > 0 || parseFloat(b.locked) > 0);
    console.log('\nBalances:');
    balances.forEach((b: any) => {
      console.log(`  ${b.asset}: ${b.free} (free) + ${b.locked} (locked)`);
    });

  } catch (error: any) {
    console.log('❌ API Key test failed');
    console.log('Status:', error.response?.status);
    console.log('Error:', error.response?.data?.msg || error.message);
    
    if (error.response?.status === 401) {
      console.log('\nPossible reasons:');
      console.log('1. API key has been deleted/regenerated on Binance');
      console.log('2. API secret is incorrect');
      console.log('3. IP restriction is blocking this IP');
      console.log('4. API key permissions changed');
    }

    // Test if it's an IP restriction
    if (error.response?.status === 401 && error.response?.data?.msg?.includes('IP')) {
      console.log('\n🔒 This appears to be an IP restriction issue.');
      console.log('Your API key might be restricted to specific IPs.');
    }
  }

  // Test 2: Check API permissions
  console.log('\n2️⃣ Testing API restrictions endpoint...');
  try {
    const timestamp = Date.now();
    const queryString = `timestamp=${timestamp}`;
    const signature = crypto
      .createHmac('sha256', apiSecret)
      .update(queryString)
      .digest('hex');

    const response = await axios.get(
      `https://api.binance.com/sapi/v1/account/apiRestrictions?${queryString}&signature=${signature}`,
      {
        headers: {
          'X-MBX-APIKEY': apiKey
        }
      }
    );

    console.log('API Key Restrictions:');
    console.log('- IP Restrict:', response.data.ipRestrict);
    console.log('- Enable Withdrawals:', response.data.enableWithdrawals);
    console.log('- Enable Trading:', response.data.enableReading);
    
  } catch (error: any) {
    console.log('Could not check API restrictions');
  }
}

testKey().catch(console.error);