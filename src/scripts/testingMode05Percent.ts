#!/usr/bin/env node
import { autoListingManager } from '../services/p2p/autoListingManager';
import { binanceP2PMonitor } from '../services/p2p/binanceP2PMonitor';
import { logger } from '../utils/logger';
import { config } from 'dotenv';

config();

console.log(`
🧪 TESTING MODE: 0.5% PROFIT TARGET
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📊 Test Configuration:
   - Target Profit: 0.5% (₹89.00 → ₹89.45)
   - Focus: Maximum transaction volume
   - Goal: Gather trading data
   - Orders: 3 concurrent maximum
   - Strategy: Fixed price for consistency

💡 Testing Benefits:
   - More trades = more data
   - Lower profit = faster sales
   - Test system reliability
   - Validate automation flow

`);

async function startTestingMode() {
  // Configure for 0.5% profit testing
  const testConfig = {
    enabled: true,
    checkInterval: 10000, // 10 seconds - very frequent
    maxOrders: 3,
    minBalance: 0.5,
    priceStrategy: 'fixed' as const,
    targetPrice: 89.45, // Exactly 0.5% profit
    expiryTime: 10, // 10 minute expiry
    autoRelistDelay: 1000 // 1 second relist
  };

  console.log('🎯 Setting up 0.5% profit testing mode...\n');
  
  autoListingManager.updateConfig(testConfig);

  // Track statistics
  let stats = {
    ordersCreated: 0,
    ordersCompleted: 0,
    ordersExpired: 0,
    ordersRelisted: 0,
    totalProfit: 0,
    startTime: new Date()
  };

  // Event handlers with statistics
  autoListingManager.on('orderCreated', (order) => {
    stats.ordersCreated++;
    console.log(`\n✅ ORDER #${stats.ordersCreated}: ${order.amount} USDT @ ₹${order.price}`);
    console.log(`   Expected profit: ₹${((order.price - 89) * order.amount).toFixed(2)} (${((order.price - 89) / 89 * 100).toFixed(2)}%)`);
  });

  autoListingManager.on('orderCompleted', (order) => {
    stats.ordersCompleted++;
    const profit = (order.price - 89) * order.amount;
    stats.totalProfit += profit;
    
    console.log(`\n🎉 SALE #${stats.ordersCompleted} COMPLETED!`);
    console.log(`   Amount: ${order.amount} USDT @ ₹${order.price}`);
    console.log(`   Profit: ₹${profit.toFixed(2)}`);
    console.log(`   Total profit so far: ₹${stats.totalProfit.toFixed(2)}`);
  });

  autoListingManager.on('orderRelisted', ({ oldOrder, newOrder, relistCount }) => {
    stats.ordersRelisted++;
    console.log(`\n🔄 RELIST #${stats.ordersRelisted}: Order relisted (attempt ${relistCount})`);
  });

  autoListingManager.on('orderExpired', (order) => {
    stats.ordersExpired++;
    console.log(`\n⏰ Order expired after 10 minutes`);
  });

  // Start the system
  await autoListingManager.start();
  
  console.log('🚀 Testing mode started!\n');
  console.log('📊 Real-time Statistics:');

  // Show statistics every minute
  const statsInterval = setInterval(() => {
    const runtime = Math.floor((Date.now() - stats.startTime.getTime()) / 1000 / 60);
    const status = autoListingManager.getStatus();
    
    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`⏱️  Runtime: ${runtime} minutes`);
    console.log(`📈 Orders Created: ${stats.ordersCreated}`);
    console.log(`✅ Sales Completed: ${stats.ordersCompleted}`);
    console.log(`🔄 Times Relisted: ${stats.ordersRelisted}`);
    console.log(`💰 Total Profit: ₹${stats.totalProfit.toFixed(2)}`);
    console.log(`📊 Success Rate: ${stats.ordersCompleted > 0 ? (stats.ordersCompleted / stats.ordersCreated * 100).toFixed(1) : 0}%`);
    console.log(`🎯 Active Orders: ${status.activeOrders}`);
    console.log(`💳 Available Balance: ${status.balance.available} USDT`);
    
    if (stats.ordersCompleted > 0) {
      console.log(`\n💡 Insights:`);
      console.log(`   - Avg time to sell: ~${Math.floor(runtime / stats.ordersCompleted)} minutes`);
      console.log(`   - Profit per trade: ₹${(stats.totalProfit / stats.ordersCompleted).toFixed(2)}`);
      console.log(`   - Trades per hour: ${(stats.ordersCompleted / runtime * 60).toFixed(1)}`);
    }
  }, 60000);

  // Monitor market for reference
  setInterval(async () => {
    try {
      const { default: axios } = await import('axios');
      const response = await axios.post(
        'https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search',
        {
          page: 1,
          rows: 3,
          payTypes: ["UPI"],
          tradeType: "SELL",
          asset: "USDT",
          fiat: "INR"
        },
        { headers: { 'Content-Type': 'application/json' } }
      );
      
      const ads = response.data.data || [];
      if (ads.length > 0) {
        const topPrice = parseFloat(ads[0].adv.price);
        console.log(`\n📊 Market Update: Top price ₹${topPrice} (Our price: ₹89.45)`);
        if (topPrice < 89.45) {
          console.log(`   ⚠️  Market below our price - sales may be slower`);
        } else {
          console.log(`   ✅ We're ${((topPrice - 89.45) / topPrice * 100).toFixed(1)}% below market`);
        }
      }
    } catch (error) {
      // Ignore market check errors
    }
  }, 120000); // Every 2 minutes

  // Graceful shutdown
  process.on('SIGINT', () => {
    clearInterval(statsInterval);
    autoListingManager.stop();
    
    const runtime = Math.floor((Date.now() - stats.startTime.getTime()) / 1000 / 60);
    
    console.log('\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 FINAL TEST RESULTS');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log(`Runtime: ${runtime} minutes`);
    console.log(`Orders Created: ${stats.ordersCreated}`);
    console.log(`Sales Completed: ${stats.ordersCompleted}`);
    console.log(`Success Rate: ${stats.ordersCompleted > 0 ? (stats.ordersCompleted / stats.ordersCreated * 100).toFixed(1) : 0}%`);
    console.log(`Total Profit: ₹${stats.totalProfit.toFixed(2)}`);
    
    if (stats.ordersCompleted > 0) {
      console.log(`\nAverage Metrics:`);
      console.log(`- Time to sell: ~${Math.floor(runtime / stats.ordersCompleted)} minutes`);
      console.log(`- Profit per trade: ₹${(stats.totalProfit / stats.ordersCompleted).toFixed(2)}`);
      console.log(`- Trades per hour: ${(stats.ordersCompleted / runtime * 60).toFixed(1)}`);
      console.log(`- Projected daily profit: ₹${(stats.totalProfit / runtime * 60 * 24).toFixed(2)}`);
    }
    
    console.log('\n✅ Testing session complete!\n');
    process.exit(0);
  });
}

// Run testing mode
startTestingMode().catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});