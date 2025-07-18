#!/usr/bin/env node
import { p2pOrderManager } from '../services/p2p/orderManager';
import { logger } from '../utils/logger';
import { config } from 'dotenv';

config();

console.log(`
🌟 BUILD 100% SELLER RATING ON BINANCE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🎯 Strategy for Perfect Rating:
   1. Price competitively (0.5% profit = ₹89.45)
   2. Quick response to buyers
   3. Clear payment instructions
   4. Fast crypto release after payment
   5. Professional communication

📊 Your Setup:
   - UPI: srijanaryay@okaxis
   - Amount: 11.5 USDT per order
   - Target: Build reputation first
   - Focus: Complete trades successfully

`);

async function setupForRatingBuilding() {
  // Configure exchange first
  p2pOrderManager.addExchangeConfig({
    name: 'binance',
    apiKey: process.env.BINANCE_API_KEY || '',
    apiSecret: process.env.BINANCE_API_SECRET || '',
    sandbox: false
  });

  console.log('✅ Binance P2P configured\n');

  // Create manual P2P order for rating building
  console.log('📝 Creating P2P Sell Order:');
  console.log('   Amount: 11.5 USDT');
  console.log('   Price: ₹89.45 (0.5% profit)');
  console.log('   Payment: UPI (srijanaryay@okaxis)');
  console.log('   Strategy: Quick sales for rating\n');

  try {
    const order = await p2pOrderManager.createSellOrder({
      exchange: 'binance',
      amount: 11.5,
      price: 89.45,
      paymentMethod: 'UPI',
      paymentDetails: {
        upiId: 'srijanaryay@okaxis',
        accountHolderName: 'Srijan Arya',
        instructions: 'Please pay exact amount and share screenshot'
      },
      autoRelease: false  // Manual release for safety
    });

    console.log('✅ Order created successfully!');
    console.log(`   Order ID: ${order.id}`);
    console.log(`   Status: ${order.status}\n`);

    console.log('📱 NEXT STEPS FOR 100% RATING:\n');
    console.log('1. Open Binance App → P2P → My Ads');
    console.log('2. Check your new sell order');
    console.log('3. When buyer initiates trade:');
    console.log('   - Respond within 2 minutes');
    console.log('   - Share clear UPI details');
    console.log('   - Monitor srijanaryay@okaxis for payment');
    console.log('4. After receiving payment:');
    console.log('   - Verify amount matches exactly');
    console.log('   - Release crypto immediately');
    console.log('   - Thank buyer professionally\n');

    console.log('💡 TIPS FOR 100% RATING:');
    console.log('   • Keep app notifications ON');
    console.log('   • Respond fast (< 2 minutes)');
    console.log('   • Be polite and professional');
    console.log('   • Release crypto promptly');
    console.log('   • Ask buyer to rate you 5 stars\n');

    console.log('🎯 RATING BUILDING PLAN:');
    console.log('   Week 1: Complete 5-10 trades at break-even');
    console.log('   Week 2: Increase volume with good rating');
    console.log('   Week 3: Optimize prices for profit');
    console.log('   Goal: 50+ trades with 100% positive\n');

    // Monitor order status
    console.log('⏳ Monitoring order status...\n');
    
    setInterval(async () => {
      const activeOrders = p2pOrderManager.getActiveOrders();
      if (activeOrders.length > 0) {
        console.log(`[${new Date().toLocaleTimeString()}] Active orders: ${activeOrders.length}`);
        activeOrders.forEach(o => {
          console.log(`   - ${o.amount} USDT @ ₹${o.price} (${o.status})`);
        });
      }
    }, 30000);

  } catch (error) {
    console.error('❌ Failed to create order:', error.message);
    console.log('\n💡 MANUAL ALTERNATIVE:');
    console.log('1. Open Binance App');
    console.log('2. Go to P2P → Post Ads → Sell USDT');
    console.log('3. Set price: ₹89.45');
    console.log('4. Amount: 11.5 USDT');
    console.log('5. Payment: UPI only');
    console.log('6. Add UPI: srijanaryay@okaxis');
  }
}

// Handle shutdown
process.on('SIGINT', () => {
  console.log('\n\n✅ Good luck building your 100% rating!');
  console.log('Remember: Customer service is key!\n');
  process.exit(0);
});

// Run
setupForRatingBuilding().catch(console.error);