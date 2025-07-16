import { config } from 'dotenv';
import { KuCoinClient } from '../api/exchanges/kucoin';

config();

async function testAuth() {
  console.log('Testing KuCoin Authentication...\n');
  
  const client = new KuCoinClient({
    apiKey: process.env.KUCOIN_API_KEY || '',
    apiSecret: process.env.KUCOIN_API_SECRET || '',
    passphrase: process.env.KUCOIN_PASSPHRASE || ''
  });

  console.log('API Key:', process.env.KUCOIN_API_KEY);
  console.log('Has Secret:', !!process.env.KUCOIN_API_SECRET);
  console.log('Has Passphrase:', !!process.env.KUCOIN_PASSPHRASE);
  
  try {
    console.log('\nTrying to get account balance...');
    const balances = await client.getBalance();
    console.log('✅ Authentication successful!');
    console.log('Account balances:', balances);
  } catch (error: any) {
    console.log('❌ Authentication failed:', error.message);
    
    if (error.message.includes('Invalid request ip')) {
      console.log('\n📌 IP Address Issue:');
      console.log('The API is detecting your IP as:', error.message.match(/clientIp is:(.+)/)?.[1]);
      console.log('\nPlease ensure this exact IP is whitelisted in KuCoin API settings.');
      console.log('Note: IPv6 addresses must be added exactly as shown.');
    }
  }
}

testAuth().catch(console.error);