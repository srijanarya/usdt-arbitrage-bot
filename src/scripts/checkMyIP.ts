#!/usr/bin/env node
import axios from 'axios';
import fs from 'fs';

async function checkIP() {
  try {
    const response = await axios.get('https://api.ipify.org?format=json');
    const currentIP = response.data.ip;
    
    console.log(`\n📍 Your Current IP: ${currentIP}`);
    console.log('\n📋 Quick Copy for Binance:');
    console.log(`   ${currentIP}`);
    
    // Check if it matches stored IP
    if (fs.existsSync('.current-ip')) {
      const storedIP = fs.readFileSync('.current-ip', 'utf-8').trim();
      if (storedIP !== currentIP) {
        console.log(`\n⚠️  IP Changed! Was: ${storedIP}`);
        console.log('\n🔧 Update Binance Whitelist:');
        console.log('   1. Login to Binance');
        console.log('   2. Go to API Management');
        console.log(`   3. Add: ${currentIP}`);
        console.log(`   4. Remove: ${storedIP}`);
      } else {
        console.log('\n✅ IP matches Binance whitelist');
      }
    }
    
    // Save current IP
    fs.writeFileSync('.current-ip', currentIP);
    
  } catch (error) {
    console.error('Error:', error);
  }
}

checkIP();