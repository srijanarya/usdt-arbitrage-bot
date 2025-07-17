import { CryptoWalletAutomation } from '../services/browserAutomation/cryptoWalletAutomation';
import { logger } from '../utils/logger';
import { config } from 'dotenv';
import readline from 'readline';

config();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

interface AutoBuyConfig {
  exchange: 'binance' | 'zebpay';
  targetPrice: number;
  buyAmount: number;
  maxSpend: number;
  checkInterval: number;
}

async function main() {
  console.log('🤖 AUTOMATED CRYPTO BUYING WITH BROWSER AUTOMATION\n');
  console.log('⚠️  WARNING: This will control your browser and perform real transactions!');
  console.log('━'.repeat(60));
  
  // Get configuration from user
  const exchange = await question('Which exchange? (binance/zebpay): ') as 'binance' | 'zebpay';
  const targetPrice = parseFloat(await question('Target USDT price in INR (e.g., 88.5): '));
  const buyAmount = parseFloat(await question('How much USDT to buy when price hits target: '));
  const maxSpend = parseFloat(await question('Maximum INR to spend: '));
  
  const config: AutoBuyConfig = {
    exchange,
    targetPrice,
    buyAmount,
    maxSpend,
    checkInterval: 60000 // Check every minute
  };

  console.log('\n📋 CONFIGURATION SUMMARY');
  console.log('━'.repeat(60));
  console.log(`Exchange: ${config.exchange.toUpperCase()}`);
  console.log(`Target Price: ₹${config.targetPrice}`);
  console.log(`Buy Amount: ${config.buyAmount} USDT`);
  console.log(`Max Spend: ₹${config.maxSpend}`);
  console.log(`Check Interval: ${config.checkInterval / 1000}s`);
  console.log('━'.repeat(60));

  const confirm = await question('\nProceed with automated buying? (yes/no): ');
  if (confirm.toLowerCase() !== 'yes') {
    console.log('Cancelled.');
    process.exit(0);
  }

  // Initialize browser automation
  const automation = new CryptoWalletAutomation();
  
  try {
    console.log('\n🚀 Starting browser automation...');
    await automation.init({ headless: false }); // Show browser for transparency
    
    // Login to exchange
    console.log(`\n🔐 Logging into ${config.exchange}...`);
    const credentials = {
      email: process.env[`${config.exchange.toUpperCase()}_EMAIL`] || '',
      password: process.env[`${config.exchange.toUpperCase()}_PASSWORD`] || ''
    };
    
    if (!credentials.email || !credentials.password) {
      console.error('❌ Missing credentials in .env file!');
      console.log(`Please add ${config.exchange.toUpperCase()}_EMAIL and ${config.exchange.toUpperCase()}_PASSWORD to your .env file`);
      await automation.close();
      process.exit(1);
    }
    
    await automation.login(config.exchange, credentials);
    console.log('✅ Login successful!');
    
    // Check current balance
    console.log('\n💰 Checking wallet balance...');
    const balance = await automation.checkBalance(config.exchange);
    console.log(`INR Balance: ₹${balance.INR || 0}`);
    console.log(`USDT Balance: ${balance.USDT || 0}`);
    
    if ((balance.INR || 0) < config.buyAmount * config.targetPrice) {
      console.log('\n⚠️  Insufficient INR balance for planned purchase!');
      const proceed = await question('Continue monitoring anyway? (yes/no): ');
      if (proceed.toLowerCase() !== 'yes') {
        await automation.close();
        process.exit(0);
      }
    }
    
    // Start price monitoring
    console.log('\n📊 Starting price monitoring...');
    console.log('Press Ctrl+C to stop\n');
    
    let totalSpent = 0;
    let totalBought = 0;
    let isMonitoring = true;
    
    const monitorPrices = async () => {
      while (isMonitoring && totalSpent < config.maxSpend) {
        try {
          const currentPrice = await automation.getPrice(config.exchange, 'USDT', 'buy');
          const timestamp = new Date().toLocaleTimeString();
          
          console.log(`[${timestamp}] Current USDT price: ₹${currentPrice}`);
          
          if (currentPrice <= config.targetPrice) {
            console.log(`\n🎯 TARGET PRICE HIT! Current: ₹${currentPrice}, Target: ₹${config.targetPrice}`);
            
            // Calculate actual buy amount based on remaining budget
            const remainingBudget = config.maxSpend - totalSpent;
            const maxAffordable = remainingBudget / currentPrice;
            const actualBuyAmount = Math.min(config.buyAmount, maxAffordable);
            
            if (actualBuyAmount < 0.1) {
              console.log('❌ Remaining budget too low to continue');
              break;
            }
            
            console.log(`💸 Buying ${actualBuyAmount.toFixed(2)} USDT at ₹${currentPrice}...`);
            
            try {
              const success = await automation.buyAsset(
                config.exchange,
                'USDT',
                actualBuyAmount,
                currentPrice
              );
              
              if (success) {
                const cost = actualBuyAmount * currentPrice;
                totalSpent += cost;
                totalBought += actualBuyAmount;
                
                console.log('✅ BUY ORDER SUCCESSFUL!');
                console.log(`   Amount: ${actualBuyAmount.toFixed(2)} USDT`);
                console.log(`   Price: ₹${currentPrice}`);
                console.log(`   Total Cost: ₹${cost.toFixed(2)}`);
                console.log(`   Total Spent: ₹${totalSpent.toFixed(2)} / ₹${config.maxSpend}`);
                console.log(`   Total Bought: ${totalBought.toFixed(2)} USDT\n`);
                
                // Log transaction
                logger.info('Auto-buy executed', {
                  exchange: config.exchange,
                  amount: actualBuyAmount,
                  price: currentPrice,
                  cost,
                  totalSpent,
                  totalBought
                });
              } else {
                console.log('❌ Buy order failed! Check browser for details.');
              }
            } catch (error) {
              console.error('❌ Error during buy execution:', error.message);
            }
          } else {
            const priceDiff = currentPrice - config.targetPrice;
            const percentDiff = (priceDiff / config.targetPrice * 100).toFixed(2);
            console.log(`   ↳ ${percentDiff}% above target (₹${priceDiff.toFixed(2)} difference)`);
          }
          
          // Wait for next check
          await new Promise(resolve => setTimeout(resolve, config.checkInterval));
          
        } catch (error) {
          console.error('❌ Error during monitoring:', error.message);
          await new Promise(resolve => setTimeout(resolve, 10000)); // Wait 10s on error
        }
      }
    };
    
    // Handle graceful shutdown
    process.on('SIGINT', async () => {
      console.log('\n\n🛑 Shutting down...');
      isMonitoring = false;
      
      console.log('\n📊 SESSION SUMMARY');
      console.log('━'.repeat(60));
      console.log(`Total USDT Bought: ${totalBought.toFixed(2)}`);
      console.log(`Total INR Spent: ₹${totalSpent.toFixed(2)}`);
      if (totalBought > 0) {
        console.log(`Average Price: ₹${(totalSpent / totalBought).toFixed(2)}`);
      }
      console.log('━'.repeat(60));
      
      await automation.close();
      process.exit(0);
    });
    
    // Start monitoring
    await monitorPrices();
    
  } catch (error) {
    logger.error('Fatal error:', error);
    console.error('❌ Fatal error:', error.message);
    await automation.close();
    process.exit(1);
  }
}

function question(prompt: string): Promise<string> {
  return new Promise(resolve => {
    rl.question(prompt, resolve);
  });
}

// Run the automated buyer
main().catch(console.error);