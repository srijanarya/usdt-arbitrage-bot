#!/usr/bin/env node
import axios from 'axios';
import fs from 'fs';
import path from 'path';

const IP_LOG_FILE = path.join(process.cwd(), 'ip-history.log');

async function checkIPChange() {
  try {
    // Get current IP
    const response = await axios.get('https://api.ipify.org?format=json');
    const currentIP = response.data.ip;
    const timestamp = new Date().toISOString();
    
    // Read previous IPs
    let previousIPs: string[] = [];
    if (fs.existsSync(IP_LOG_FILE)) {
      const content = fs.readFileSync(IP_LOG_FILE, 'utf-8');
      previousIPs = content.trim().split('\n').filter(line => line);
    }
    
    // Check if IP changed
    const lastEntry = previousIPs[previousIPs.length - 1];
    const lastIP = lastEntry ? lastEntry.split(' | ')[1] : null;
    
    console.log(`\n📍 IP CHECK - ${new Date().toLocaleString()}`);
    console.log(`Current IP: ${currentIP}`);
    
    if (lastIP && lastIP !== currentIP) {
      console.log(`⚠️  IP CHANGED! Was: ${lastIP}`);
      console.log('\nYou need to update Binance API whitelist!');
    } else if (lastIP) {
      console.log('✅ IP unchanged since last check');
    }
    
    // Log current IP
    fs.appendFileSync(IP_LOG_FILE, `${timestamp} | ${currentIP}\n`);
    
    // Show IP history
    console.log('\n📊 Recent IP History:');
    const recentEntries = previousIPs.slice(-5);
    recentEntries.forEach(entry => {
      const [time, ip] = entry.split(' | ');
      console.log(`   ${new Date(time).toLocaleString()} - ${ip}`);
    });
    
    // Analyze pattern
    const uniqueIPs = new Set(previousIPs.map(e => e.split(' | ')[1]));
    console.log(`\n📈 IP Statistics:`);
    console.log(`   Total checks: ${previousIPs.length}`);
    console.log(`   Unique IPs: ${uniqueIPs.size}`);
    
    if (uniqueIPs.size > 1) {
      console.log('\n⚠️  Your IP changes regularly!');
      console.log('Options:');
      console.log('1. Disable IP restriction on Binance (less secure)');
      console.log('2. Use a VPN with static IP');
      console.log('3. Deploy bot to cloud server');
    } else {
      console.log('\n✅ Your IP appears stable');
    }
    
  } catch (error) {
    console.error('Error checking IP:', error);
  }
}

// Check now
checkIPChange();

// If running as continuous monitor
if (process.argv.includes('--monitor')) {
  console.log('\n🔄 Monitoring IP changes every hour...');
  setInterval(checkIPChange, 60 * 60 * 1000); // Every hour
}