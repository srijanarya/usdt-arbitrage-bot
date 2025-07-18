import axios from 'axios';
import * as crypto from 'crypto';
import { config } from 'dotenv';

config();

async function checkActualBalance() {
  console.log('\n🔍 CHECKING ACTUAL BINANCE BALANCE\n');
  console.log('━'.repeat(60));
  
  const apiKey = process.env.BINANCE_API_KEY;
  const apiSecret = process.env.BINANCE_API_SECRET;
  
  if (!apiKey || !apiSecret) {
    console.log('❌ Binance API credentials not found in .env');
    console.log('\n📱 Please check your balance in the Binance app:');
    console.log('   1. Open Binance app');
    console.log('   2. Go to Wallet → Spot');
    console.log('   3. Search for USDT');
    console.log('   4. Check your available balance\n');
    return;
  }
  
  try {
    const timestamp = Date.now();
    const queryString = `timestamp=${timestamp}`;
    const signature = crypto
      .createHmac('sha256', apiSecret)
      .update(queryString)
      .digest('hex');
    
    const response = await axios.get(
      `https://api.binance.com/api/v3/account?${queryString}&signature=${signature}`,
      {
        headers: {
          'X-MBX-APIKEY': apiKey
        }
      }
    );
    
    const balances = response.data.balances;
    const usdtBalance = balances.find(b => b.asset === 'USDT');
    
    if (usdtBalance) {
      console.log('💰 USDT Balance:');
      console.log(`   Available: ${parseFloat(usdtBalance.free)} USDT`);
      console.log(`   Locked: ${parseFloat(usdtBalance.locked)} USDT`);
      console.log(`   Total: ${parseFloat(usdtBalance.free) + parseFloat(usdtBalance.locked)} USDT`);
      
      if (parseFloat(usdtBalance.locked) > 0) {
        console.log('\n⚠️  You have locked USDT - likely in active P2P orders');
      }
    } else {
      console.log('No USDT balance found');
    }
    
  } catch (error) {
    console.log('❌ Could not fetch balance from API');
    console.log('\n📱 Please check manually in Binance app:');
    console.log('   Wallet → Spot → USDT\n');
  }
  
  console.log('\n━'.repeat(60));
  console.log('💡 IMPORTANT CLARIFICATIONS:\n');
  console.log('1. The dashboards show DEMO DATA for visualization');
  console.log('2. "Sold" status in dashboards is NOT real');
  console.log('3. Your P2P orders from 2:13 PM are EXPIRED');
  console.log('4. Check Binance app for actual status');
  console.log('5. Expired orders return USDT to spot wallet');
  console.log('\n━'.repeat(60));
}

checkActualBalance().catch(console.error);