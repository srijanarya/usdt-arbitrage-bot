import { binanceP2PMonitor } from '../services/p2p/binanceP2PMonitor';
import { imapPaymentMonitor } from '../services/payment/imapPaymentMonitor';
import { logger } from '../utils/logger';
import { config } from 'dotenv';
import readline from 'readline';

config();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

interface MonitorConfig {
  buyPrice: number;
  amount: number;
  targetProfit: number;
  autoCreate: boolean;
  maxOrders: number;
  aggressiveMode: boolean;
  minProfit: number;
}

let activeOrders = 0;
const config_: MonitorConfig = {
  buyPrice: 89, // Your buy price
  amount: 11.5, // Your USDT amount
  targetProfit: 1.5, // 1.5% minimum profit
  autoCreate: true, // Auto-create orders when profitable
  maxOrders: 3, // Max concurrent orders
  aggressiveMode: true, // Enable aggressive trading
  minProfit: 0.3 // Accept 0.3% minimum profit in aggressive mode
};

async function startP2PMonitoring() {
  console.log('\n🚀 BINANCE P2P SELL MONITORING\n');
  console.log('━'.repeat(50));
  console.log(`💰 Your position: ${config_.amount} USDT bought at ₹${config_.buyPrice}`);
  console.log(`🎯 Target profit: ${config_.targetProfit}%`);
  console.log(`📈 Target sell price: ₹${(config_.buyPrice * (1 + config_.targetProfit / 100)).toFixed(2)}`);
  console.log(`🤖 Auto-create orders: ${config_.autoCreate ? 'YES' : 'NO'}`);
  console.log(`🚀 Aggressive mode: ${config_.aggressiveMode ? 'ENABLED' : 'DISABLED'}`);
  if (config_.aggressiveMode) {
    console.log(`💰 Min profit in aggressive: ${config_.minProfit}%`);
  }
  console.log('━'.repeat(50));
  console.log('\n📊 Starting real-time monitoring...\n');

  // Set up event handlers
  binanceP2PMonitor.on('profitableOpportunity', async (opportunity) => {
    console.log('\n🎉 PROFITABLE OPPORTUNITY DETECTED!');
    console.log('━'.repeat(50));
    console.log(`💵 Price: ₹${opportunity.price}`);
    console.log(`📊 Profit: ₹${((opportunity.price - config_.buyPrice) * config_.amount).toFixed(2)}`);
    console.log(`📈 Profit %: ${(((opportunity.price - config_.buyPrice) / config_.buyPrice) * 100).toFixed(2)}%`);
    console.log(`👤 Top Advertiser: ${opportunity.advertiserName}`);
    console.log(`✅ Completion Rate: ${opportunity.completionRate}%`);
    console.log(`💳 Payment: ${opportunity.paymentMethods.join(', ')}`);
    console.log(`📏 Order Range: ₹${opportunity.minAmount} - ₹${opportunity.maxAmount}`);
    console.log('━'.repeat(50));

    // Auto-create order if enabled
    if (config_.autoCreate && activeOrders < config_.maxOrders) {
      console.log('\n🤖 Auto-creating sell order...');
      
      // Use the API to create order
      const orderData = {
        exchange: 'binance',
        amount: config_.amount,
        price: opportunity.price,
        type: 'sell',
        paymentMethod: 'UPI'
      };

      try {
        const response = await fetch('http://localhost:3001/api/p2p/execute', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(orderData)
        });

        if (response.ok) {
          const result = await response.json();
          console.log(`✅ Order created: ${(result as any).orderId || 'Success'}`);
          activeOrders++;
        } else {
          console.log('❌ Failed to create order');
        }
      } catch (error) {
        console.log('❌ Error creating order:', error.message);
      }
    } else {
      console.log('\n💡 Run this command to create order:');
      console.log(`curl -X POST http://localhost:3001/api/p2p/execute \\`);
      console.log(`  -H "Content-Type: application/json" \\`);
      console.log(`  -d '{"exchange":"binance","amount":${config_.amount},"price":${opportunity.price},"type":"sell","paymentMethod":"UPI"}'`);
    }
  });

  binanceP2PMonitor.on('marketUpdate', (data) => {
    const profit = ((data.bestPrice - config_.buyPrice) / config_.buyPrice) * 100;
    const profitAmount = (data.bestPrice - config_.buyPrice) * config_.amount;
    
    console.log(`\r📊 Best: ₹${data.bestPrice} | Profit: ${profit.toFixed(2)}% (₹${profitAmount.toFixed(2)}) | ${new Date().toLocaleTimeString()}`);
  });

  binanceP2PMonitor.on('priceChange', (data) => {
    console.log(`\n${data.change > 0 ? '📈' : '📉'} Price ${data.change > 0 ? 'UP' : 'DOWN'} ${Math.abs(data.change).toFixed(2)}% to ₹${data.newPrice}`);
  });

  // Start monitoring with aggressive settings
  binanceP2PMonitor.setTargetProfit(config_.targetProfit);
  if (config_.aggressiveMode) {
    binanceP2PMonitor.enableAggressiveMode(true);
    binanceP2PMonitor.setMinProfit(config_.minProfit);
  }
  await binanceP2PMonitor.start(config_.buyPrice);

  // Also start payment monitoring
  console.log('\n📧 Starting Gmail payment monitoring...');
  imapPaymentMonitor.on('paymentReceived', (payment) => {
    console.log(`\n💸 PAYMENT RECEIVED!`);
    console.log(`   Amount: ₹${payment.amount}`);
    console.log(`   From: ${payment.from}`);
    console.log(`   Reference: ${payment.reference}`);
    console.log(`   Time: ${payment.timestamp.toLocaleString()}`);
  });
  
  await imapPaymentMonitor.start();

  // Interactive commands
  console.log('\n📌 Commands:');
  console.log('   p <price> - Update your buy price');
  console.log('   t <percent> - Update target profit %');
  console.log('   a - Toggle auto-create orders');
  console.log('   g - Toggle aggressive mode');
  console.log('   m <percent> - Set minimum profit %');
  console.log('   s - Show current status');
  console.log('   q - Quit monitoring\n');

  rl.on('line', (input) => {
    const [cmd, value] = input.trim().split(' ');
    
    switch (cmd.toLowerCase()) {
      case 'p':
        if (value) {
          config_.buyPrice = parseFloat(value);
          console.log(`✅ Buy price updated to ₹${config_.buyPrice}`);
        }
        break;
        
      case 't':
        if (value) {
          config_.targetProfit = parseFloat(value);
          binanceP2PMonitor.setTargetProfit(config_.targetProfit);
          console.log(`✅ Target profit updated to ${config_.targetProfit}%`);
        }
        break;
        
      case 'a':
        config_.autoCreate = !config_.autoCreate;
        console.log(`✅ Auto-create orders: ${config_.autoCreate ? 'ENABLED' : 'DISABLED'}`);
        break;
        
      case 'g':
        config_.aggressiveMode = !config_.aggressiveMode;
        binanceP2PMonitor.enableAggressiveMode(config_.aggressiveMode);
        console.log(`✅ Aggressive mode: ${config_.aggressiveMode ? 'ENABLED' : 'DISABLED'}`);
        break;
        
      case 'm':
        if (value) {
          config_.minProfit = parseFloat(value);
          binanceP2PMonitor.setMinProfit(config_.minProfit);
          console.log(`✅ Minimum profit updated to ${config_.minProfit}%`);
        }
        break;
        
      case 's':
        console.log('\n📊 Current Status:');
        console.log(`   Buy price: ₹${config_.buyPrice}`);
        console.log(`   Amount: ${config_.amount} USDT`);
        console.log(`   Target profit: ${config_.targetProfit}%`);
        console.log(`   Auto-create: ${config_.autoCreate ? 'YES' : 'NO'}`);
        console.log(`   Aggressive mode: ${config_.aggressiveMode ? 'YES' : 'NO'}`);
        console.log(`   Min profit: ${config_.minProfit}%`);
        console.log(`   Active orders: ${activeOrders}`);
        break;
        
      case 'q':
        console.log('\n👋 Stopping monitoring...');
        binanceP2PMonitor.stop();
        imapPaymentMonitor.stop();
        process.exit(0);
        break;
        
      default:
        if (cmd) console.log('Unknown command. Use: p, t, a, s, or q');
    }
  });
}

// Handle cleanup
process.on('SIGINT', () => {
  console.log('\n\n🛑 Shutting down...');
  binanceP2PMonitor.stop();
  imapPaymentMonitor.stop();
  process.exit(0);
});

// Start monitoring
startP2PMonitoring().catch(error => {
  logger.error('Failed to start monitoring:', error);
  process.exit(1);
});