#!/usr/bin/env node
import { autoListingManager } from '../services/p2p/autoListingManager';
import { logger } from '../utils/logger';
import { config } from 'dotenv';

config();

console.log(`
🤖 AUTO-LISTING QUICK START
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📊 Your Setup:
   - USDT Balance: 11.5 USDT
   - Buy Price: ₹89
   - Strategy: Competitive pricing for maximum transactions
   - Goal: Rapid buy-transfer-sell cycles

🎯 Configuration:
   - Max Active Orders: 3
   - Price: 0.3% below market (quick sales)
   - Order Expiry: 15 minutes
   - Auto-relist: Yes
   - Balance Protection: Enabled

`);

async function quickStart() {
  // Configure for aggressive testing - 0.5% profit target
  autoListingManager.updateConfig({
    enabled: true,
    checkInterval: 15000, // 15 seconds - faster checks
    maxOrders: 3,
    minBalance: 0.5,
    priceStrategy: 'fixed',
    targetPrice: 89.45, // 0.5% profit (89 * 1.005)
    expiryTime: 10, // Shorter expiry for faster relisting
    autoRelistDelay: 2000 // 2 seconds - quick relist
  });

  // Set up monitoring
  autoListingManager.on('balanceUpdated', (balance) => {
    console.log(`\n💰 Balance: ${balance.total} USDT (Available: ${balance.available})`);
  });

  autoListingManager.on('orderCreated', (order) => {
    console.log(`\n✅ NEW ORDER: ${order.amount} USDT @ ₹${order.price}`);
    console.log(`   Profit if sold: ₹${((order.price - 89) * order.amount).toFixed(2)}`);
  });

  autoListingManager.on('orderRelisted', ({ oldOrder, newOrder }) => {
    console.log(`\n🔄 RELISTED: ₹${oldOrder.price} → ₹${newOrder.price}`);
  });

  autoListingManager.on('orderCompleted', (order) => {
    console.log(`\n🎉 SOLD: ${order.amount} USDT @ ₹${order.price}`);
    console.log(`   Profit: ₹${((order.price - 89) * order.amount).toFixed(2)}`);
  });

  // Start the system
  console.log('🚀 Starting Auto-Listing Manager...\n');
  await autoListingManager.start();

  // Show initial status
  const status = autoListingManager.getStatus();
  console.log('📈 System Status:');
  console.log(`   - Running: ${status.isRunning ? '✅' : '❌'}`);
  console.log(`   - Balance: ${status.balance.total} USDT`);
  console.log(`   - Active Orders: ${status.activeOrders}`);
  console.log(`   - Check Interval: ${status.config.checkInterval / 1000}s`);

  console.log('\n⏳ Monitoring active... Press Ctrl+C to stop\n');

  // Show summary every 30 seconds
  setInterval(() => {
    const currentStatus = autoListingManager.getStatus();
    if (currentStatus.activeOrders > 0) {
      console.log(`\n📊 [${new Date().toLocaleTimeString()}] Active Orders:`);
      currentStatus.orders.forEach((order, i) => {
        const profit = ((order.price - 89) / 89 * 100).toFixed(2);
        console.log(`   ${i+1}. ${order.amount} USDT @ ₹${order.price} (${profit}% profit, expires in ${order.expiresIn.toFixed(0)}m)`);
      });
    }
  }, 30000);

  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n\n🛑 Shutting down...');
    autoListingManager.stop();
    
    const finalStatus = autoListingManager.getStatus();
    console.log('\n📊 Final Summary:');
    console.log(`   - Total USDT: ${finalStatus.balance.total}`);
    console.log(`   - Orders Active: ${finalStatus.activeOrders}`);
    
    process.exit(0);
  });
}

// Run
quickStart().catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});