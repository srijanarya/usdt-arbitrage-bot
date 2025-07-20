#!/usr/bin/env node
import axios from 'axios';
import fs from 'fs';
import { config } from 'dotenv';
import { telegramNotifier } from '../services/telegram';

config();

const IP_FILE = '.current-ip';

async function checkIPAndAlert() {
  try {
    // Get current IP
    const response = await axios.get('https://api.ipify.org?format=json');
    const currentIP = response.data.ip;
    
    // Read stored IP
    let storedIP = '';
    if (fs.existsSync(IP_FILE)) {
      storedIP = fs.readFileSync(IP_FILE, 'utf-8').trim();
    }
    
    if (storedIP && storedIP !== currentIP) {
      console.log(`\n🚨 IP CHANGED!`);
      console.log(`Old IP: ${storedIP}`);
      console.log(`New IP: ${currentIP}`);
      
      // Send Telegram alert
      const message = `🚨 IP Address Changed!\n\nOld: ${storedIP}\nNew: ${currentIP}\n\nAction Required:\n1. Login to Binance\n2. Go to API Management\n3. Add new IP: ${currentIP}\n4. Remove old IP: ${storedIP}`;
      
      if (process.env.TELEGRAM_ENABLED === 'true') {
        await telegramNotifier.sendMessage(message);
        console.log('📱 Telegram alert sent!');
      }
      
      // Test if API still works
      console.log('\nTesting API access...');
      const testResult = await testBinanceAPI();
      if (!testResult) {
        console.log('❌ API access blocked - update IP whitelist NOW!');
      }
    } else {
      console.log(`✅ IP unchanged: ${currentIP}`);
    }
    
    // Save current IP
    fs.writeFileSync(IP_FILE, currentIP);
    
  } catch (error) {
    console.error('Error checking IP:', error);
  }
}

async function testBinanceAPI(): Promise<boolean> {
  try {
    const crypto = await import('crypto');
    const timestamp = Date.now();
    const queryString = `timestamp=${timestamp}`;
    const signature = crypto.default
      .createHmac('sha256', process.env.BINANCE_API_SECRET!)
      .update(queryString)
      .digest('hex');

    await axios.get(
      `https://api.binance.com/api/v3/account?${queryString}&signature=${signature}`,
      {
        headers: { 'X-MBX-APIKEY': process.env.BINANCE_API_KEY }
      }
    );
    return true;
  } catch {
    return false;
  }
}

// Check every 30 minutes
console.log('🔄 Starting IP monitor...');
checkIPAndAlert(); // Initial check

setInterval(checkIPAndAlert, 30 * 60 * 1000); // Every 30 minutes

// Keep process running
process.on('SIGINT', () => {
  console.log('\nStopping IP monitor...');
  process.exit(0);
});