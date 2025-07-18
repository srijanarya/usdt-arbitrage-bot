import axios from 'axios';
import crypto from 'crypto';
import { config } from 'dotenv';

config();

interface SecurityCheckResult {
  exchange: string;
  status: 'SAFE' | 'COMPROMISED' | 'ERROR' | 'CHECKING';
  message: string;
  lastActivity?: Date;
  suspiciousActivity?: boolean;
}

async function checkBinanceKey(): Promise<SecurityCheckResult> {
  try {
    const apiKey = process.env.BINANCE_API_KEY;
    const apiSecret = process.env.BINANCE_API_SECRET;
    
    if (!apiKey || !apiSecret) {
      return { exchange: 'Binance', status: 'ERROR', message: 'API keys not found' };
    }

    // Check account status
    const timestamp = Date.now();
    const queryString = `timestamp=${timestamp}`;
    const signature = crypto
      .createHmac('sha256', apiSecret)
      .update(queryString)
      .digest('hex');

    const response = await axios.get(
      `https://api.binance.com/api/v3/account?${queryString}&signature=${signature}`,
      {
        headers: { 'X-MBX-APIKEY': apiKey }
      }
    );

    // Check for recent trades
    const tradesQuery = `timestamp=${timestamp}&limit=10`;
    const tradesSignature = crypto
      .createHmac('sha256', apiSecret)
      .update(tradesQuery)
      .digest('hex');

    const trades = await axios.get(
      `https://api.binance.com/api/v3/myTrades?${tradesQuery}&signature=${tradesSignature}`,
      {
        headers: { 'X-MBX-APIKEY': apiKey }
      }
    ).catch(() => ({ data: [] }));

    const recentTrades = trades.data || [];
    const hasRecentActivity = recentTrades.length > 0;
    
    return {
      exchange: 'Binance',
      status: hasRecentActivity ? 'COMPROMISED' : 'SAFE',
      message: hasRecentActivity 
        ? `Found ${recentTrades.length} recent trades - CHECK IMMEDIATELY!`
        : 'No recent trading activity detected',
      suspiciousActivity: hasRecentActivity
    };

  } catch (error: any) {
    if (error.response?.status === 401) {
      return { exchange: 'Binance', status: 'SAFE', message: 'API key is invalid (possibly already rotated)' };
    }
    return { exchange: 'Binance', status: 'ERROR', message: error.message };
  }
}

async function checkKuCoinKey(): Promise<SecurityCheckResult> {
  try {
    const apiKey = process.env.KUCOIN_API_KEY;
    const apiSecret = process.env.KUCOIN_API_SECRET;
    const passphrase = process.env.KUCOIN_PASSPHRASE;
    
    if (!apiKey || !apiSecret || !passphrase) {
      return { exchange: 'KuCoin', status: 'ERROR', message: 'API keys not found' };
    }

    const timestamp = Date.now();
    const method = 'GET';
    const endpoint = '/api/v1/accounts';
    const str = timestamp + method + endpoint;
    const signature = crypto
      .createHmac('sha256', apiSecret)
      .update(str)
      .digest('base64');

    const passphraseEncrypted = crypto
      .createHmac('sha256', apiSecret)
      .update(passphrase)
      .digest('base64');

    const response = await axios.get(
      `https://api.kucoin.com${endpoint}`,
      {
        headers: {
          'KC-API-KEY': apiKey,
          'KC-API-SIGN': signature,
          'KC-API-TIMESTAMP': timestamp.toString(),
          'KC-API-PASSPHRASE': passphraseEncrypted,
          'KC-API-KEY-VERSION': '2'
        }
      }
    );

    const accounts = response.data.data || [];
    const hasBalance = accounts.some((acc: any) => parseFloat(acc.balance) > 0);
    
    return {
      exchange: 'KuCoin',
      status: 'CHECKING',
      message: hasBalance ? 'Active balances found - check for unauthorized activity' : 'Account accessible',
      suspiciousActivity: false
    };

  } catch (error: any) {
    if (error.response?.status === 401) {
      return { exchange: 'KuCoin', status: 'SAFE', message: 'API key is invalid (possibly already rotated)' };
    }
    return { exchange: 'KuCoin', status: 'ERROR', message: error.message };
  }
}

async function checkZebPayKey(): Promise<SecurityCheckResult> {
  try {
    const apiKey = process.env.ZEBPAY_API_KEY;
    const apiSecret = process.env.ZEBPAY_API_SECRET;
    
    if (!apiKey || !apiSecret) {
      return { exchange: 'ZebPay', status: 'ERROR', message: 'API keys not found' };
    }

    const timestamp = Date.now();
    const method = 'GET';
    const path = '/api/v1/user/wallet/balances';
    const body = '';
    
    const message = method + path + body + timestamp;
    const signature = crypto
      .createHmac('sha256', apiSecret)
      .update(message)
      .digest('hex');

    const response = await axios.get(
      `https://api.zebpay.com${path}`,
      {
        headers: {
          'X-API-KEY': apiKey,
          'X-SIGNATURE': signature,
          'X-TIMESTAMP': timestamp.toString()
        }
      }
    );

    return {
      exchange: 'ZebPay',
      status: 'CHECKING',
      message: 'Account accessible - check for unauthorized activity',
      suspiciousActivity: false
    };

  } catch (error: any) {
    if (error.response?.status === 401) {
      return { exchange: 'ZebPay', status: 'SAFE', message: 'API key is invalid (possibly already rotated)' };
    }
    return { exchange: 'ZebPay', status: 'ERROR', message: error.message };
  }
}

async function checkAllKeys() {
  console.log('🔍 Checking API Key Security...\n');
  
  const checks = await Promise.all([
    checkBinanceKey(),
    checkKuCoinKey(),
    checkZebPayKey()
  ]);

  console.log('📊 Security Check Results:\n');
  
  let compromisedCount = 0;
  let safeCount = 0;
  
  checks.forEach(result => {
    const emoji = result.status === 'SAFE' ? '✅' : 
                  result.status === 'COMPROMISED' ? '🚨' :
                  result.status === 'CHECKING' ? '⚠️' : '❌';
    
    console.log(`${emoji} ${result.exchange}: ${result.message}`);
    
    if (result.status === 'COMPROMISED') compromisedCount++;
    if (result.status === 'SAFE') safeCount++;
  });

  console.log('\n' + '='.repeat(50));
  
  if (compromisedCount > 0) {
    console.log('\n🚨 URGENT: COMPROMISED KEYS DETECTED! 🚨');
    console.log('Take immediate action:');
    console.log('1. Login to affected exchanges NOW');
    console.log('2. Revoke/delete the exposed API keys');
    console.log('3. Check your recent trade history');
    console.log('4. Enable withdrawal whitelist');
    console.log('5. Create new API keys with IP restrictions');
  } else if (safeCount === checks.length) {
    console.log('\n✅ All checked keys appear to be safe or already rotated');
  } else {
    console.log('\n⚠️  Some keys need manual verification');
    console.log('Login to your exchanges and check:');
    console.log('- Recent API activity logs');
    console.log('- Any unauthorized trades or withdrawals');
    console.log('- Consider rotating keys as a precaution');
  }

  // Check Gmail
  console.log('\n📧 Gmail App Password:');
  console.log('⚠️  Cannot automatically check - please:');
  console.log('1. Go to https://myaccount.google.com/apppasswords');
  console.log('2. Revoke the exposed app password');
  console.log('3. Generate a new one');
}

// Run the security check
checkAllKeys().catch(console.error);