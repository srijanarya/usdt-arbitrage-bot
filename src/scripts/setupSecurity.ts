#!/usr/bin/env node
import { config } from 'dotenv';
import { logger } from '../utils/logger.js';
import { apiSecurityMonitor } from '../services/security/apiMonitor.js';
import { telegramNotifier } from '../services/telegram.js';

config();

async function setupSecurity() {
  console.log('🛡️  Setting up API Security Monitoring...\n');

  try {
    // 1. Test current security status
    console.log('1️⃣  Testing current security...');
    const { secure, issues } = await apiSecurityMonitor.testSecurity();
    
    if (!secure) {
      console.log('\n⚠️  Security issues found:');
      issues.forEach(issue => console.log(`   - ${issue}`));
    } else {
      console.log('   ✅ No immediate security issues detected');
    }

    // 2. Start monitoring
    console.log('\n2️⃣  Starting API monitoring...');
    apiSecurityMonitor.startMonitoring(5); // Check every 5 minutes
    console.log('   ✅ Monitoring started (checking every 5 minutes)');

    // 3. Set up alerts
    console.log('\n3️⃣  Setting up security alerts...');
    apiSecurityMonitor.on('suspicious_activity', async (event) => {
      console.log(`\n🚨 SECURITY ALERT: ${event.reason}`);
      
      // You could add more actions here:
      // - Temporarily disable trading
      // - Lock down API access
      // - Send email alerts
    });
    console.log('   ✅ Alert system configured');

    // 4. Telegram notifications
    if (process.env.TELEGRAM_ENABLED === 'true') {
      console.log('\n4️⃣  Testing Telegram notifications...');
      await telegramNotifier.sendMessage(
        '🛡️ API Security Monitoring Activated\n\n' +
        'I will alert you if any suspicious API activity is detected.\n' +
        'Monitoring your exchanges every 5 minutes.'
      );
      console.log('   ✅ Telegram notifications enabled');
    }

    console.log('\n✅ Security monitoring is now active!');
    console.log('\n📋 Security Recommendations:');
    console.log('1. Enable IP whitelist on all exchanges');
    console.log('2. Use read-only API keys where possible');
    console.log('3. Disable withdrawal permissions on trading keys');
    console.log('4. Set up 2FA on all exchange accounts');
    console.log('5. Monitor this security system regularly');

    // Keep the monitoring running
    console.log('\nMonitoring will continue running. Press Ctrl+C to stop.');
    
    // Handle graceful shutdown
    process.on('SIGINT', () => {
      console.log('\n\nStopping security monitoring...');
      apiSecurityMonitor.stopMonitoring();
      process.exit(0);
    });

  } catch (error) {
    console.error('\n❌ Failed to setup security:', error);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  setupSecurity();
}

export { setupSecurity };