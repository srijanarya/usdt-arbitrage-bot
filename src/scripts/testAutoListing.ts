import { autoListingManager } from '../services/p2p/autoListingManager';
import { logger } from '../utils/logger';

async function testAutoListing() {
  console.log('🤖 AUTO-LISTING MANAGER TEST\n');
  console.log('━'.repeat(60));
  
  // Configure for your testing phase requirements
  const config = {
    enabled: true,
    checkInterval: 20000, // Check every 20 seconds
    maxOrders: 3, // Maintain 3 active orders
    minBalance: 0.5, // Keep at least 0.5 USDT
    priceStrategy: 'competitive' as const,
    priceOffset: 0.3, // 0.3% below market for quick sales
    expiryTime: 15, // 15 minute order expiry
    autoRelistDelay: 3000 // Relist after 3 seconds
  };
  
  console.log('📋 Configuration:');
  console.log(`- Max Orders: ${config.maxOrders}`);
  console.log(`- Price Strategy: ${config.priceStrategy} (${config.priceOffset}% below market)`);
  console.log(`- Order Expiry: ${config.expiryTime} minutes`);
  console.log(`- Check Interval: ${config.checkInterval/1000} seconds`);
  console.log(`- Min Balance: ${config.minBalance} USDT\n`);
  
  // Update configuration
  autoListingManager.updateConfig(config);
  
  // Set up event listeners
  autoListingManager.on('balanceUpdated', (balance) => {
    console.log(`\n💰 Balance Update:`);
    console.log(`   Total: ${balance.total} USDT`);
    console.log(`   Available: ${balance.available} USDT`);
    console.log(`   Locked: ${balance.locked} USDT`);
  });
  
  autoListingManager.on('orderCreated', (order) => {
    console.log(`\n✅ Order Created:`);
    console.log(`   ID: ${order.id}`);
    console.log(`   Amount: ${order.amount} USDT @ ₹${order.price}`);
    console.log(`   Expires in: ${config.expiryTime} minutes`);
  });
  
  autoListingManager.on('orderExpired', (order) => {
    console.log(`\n⏰ Order Expired: ${order.id}`);
  });
  
  autoListingManager.on('orderRelisted', ({ oldOrder, newOrder, relistCount }) => {
    console.log(`\n🔄 Order Relisted:`);
    console.log(`   Old Price: ₹${oldOrder.price}`);
    console.log(`   New Price: ₹${newOrder.price}`);
    console.log(`   Relist Count: ${relistCount}`);
  });
  
  autoListingManager.on('orderCancelled', (order) => {
    console.log(`\n❌ Order Cancelled: ${order.id} (Low balance)`);
  });
  
  autoListingManager.on('error', ({ type, error }) => {
    console.error(`\n⚠️ Error (${type}):`, error.message);
  });
  
  // Start the manager
  console.log('🚀 Starting auto-listing manager...\n');
  await autoListingManager.start();
  
  // Display initial status
  const status = autoListingManager.getStatus();
  console.log('📊 Initial Status:');
  console.log(`- Running: ${status.isRunning}`);
  console.log(`- Balance: ${status.balance.total} USDT`);
  console.log(`- Active Orders: ${status.activeOrders}`);
  
  // Monitor for 5 minutes then show summary
  console.log('\n⏳ Monitoring for 5 minutes...');
  console.log('   (Press Ctrl+C to stop)\n');
  
  // Show status every minute
  const statusInterval = setInterval(() => {
    const currentStatus = autoListingManager.getStatus();
    console.log(`\n📈 Status Update (${new Date().toLocaleTimeString()}):`);
    console.log(`- Active Orders: ${currentStatus.activeOrders}`);
    console.log(`- Total Locked: ${currentStatus.totalLocked} USDT`);
    console.log(`- Available: ${currentStatus.balance.available} USDT`);
    
    if (currentStatus.orders.length > 0) {
      console.log('\nActive Orders:');
      currentStatus.orders.forEach((order, index) => {
        console.log(`  ${index + 1}. ${order.amount} USDT @ ₹${order.price} (expires in ${order.expiresIn.toFixed(1)} min)`);
      });
    }
  }, 60000);
  
  // Handle graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n\n🛑 Stopping auto-listing manager...');
    clearInterval(statusInterval);
    autoListingManager.stop();
    
    // Final summary
    const finalStatus = autoListingManager.getStatus();
    console.log('\n📊 Final Summary:');
    console.log(`- Total Orders Created: ${finalStatus.orders.length}`);
    console.log(`- Current Balance: ${finalStatus.balance.total} USDT`);
    console.log(`- Orders Still Active: ${finalStatus.activeOrders}`);
    
    process.exit(0);
  });
}

// Run the test
testAutoListing().catch(console.error);