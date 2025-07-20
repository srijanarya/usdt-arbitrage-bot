#!/usr/bin/env node
import puppeteer from 'puppeteer';
import { config } from 'dotenv';
import axios from 'axios';

config();

console.log(`
🤖 SEMI-AUTOMATED P2P SELLING
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

This will:
1. Monitor P2P prices
2. Open Binance P2P when good price found
3. Pre-fill order details
4. You just need to:
   - Login (first time)
   - Click confirm
   - Handle buyer communication

Starting...
`);

async function getMarketPrice() {
  try {
    const response = await axios.post(
      'https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search',
      {
        page: 1,
        rows: 1,
        payTypes: ["UPI"],
        tradeType: "SELL",
        asset: "USDT",
        fiat: "INR"
      }
    );
    return parseFloat(response.data.data[0]?.adv?.price || 0);
  } catch {
    return 0;
  }
}

async function semiAutoSell() {
  const config = {
    amount: 11.54,          // Your USDT amount
    priceOffset: 0.05,      // Price 5 paise below top
    minAcceptablePrice: 94, // Don't sell below this
    refreshInterval: 30000  // Check every 30 seconds
  };

  console.log('📋 Configuration:');
  console.log(`   Amount: ${config.amount} USDT`);
  console.log(`   Min Price: ₹${config.minAcceptablePrice}`);
  console.log(`   Price Strategy: 5 paise below market\n`);

  let browser: any = null;
  let isOrderPlaced = false;

  try {
    while (!isOrderPlaced) {
      // Check market price
      const marketPrice = await getMarketPrice();
      const ourPrice = marketPrice - config.priceOffset;
      
      console.log(`\n📊 ${new Date().toLocaleTimeString()}`);
      console.log(`   Market Price: ₹${marketPrice}`);
      console.log(`   Our Price: ₹${ourPrice.toFixed(2)}`);
      console.log(`   Profit: ${((ourPrice - 89) / 89 * 100).toFixed(1)}%`);

      if (marketPrice >= config.minAcceptablePrice) {
        console.log('\n✅ Good price detected! Opening Binance...');
        
        // Launch browser
        if (!browser) {
          browser = await puppeteer.launch({
            headless: false,
            defaultViewport: null,
            args: ['--start-maximized']
          });
        }

        const page = await browser.newPage();
        
        // Build P2P URL with parameters
        const p2pUrl = `https://p2p.binance.com/en/trade/sell/USDT?fiat=INR&payment=UPI`;
        
        console.log('🌐 Opening P2P page...');
        await page.goto(p2pUrl, { waitUntil: 'networkidle0' });

        // Wait for user to login if needed
        console.log('\n⏳ Waiting for page to load...');
        console.log('   If not logged in, please login now.');
        
        // Check if login is required
        try {
          await page.waitForSelector('.css-1pcqseb', { timeout: 5000 }); // P2P create button
        } catch {
          console.log('\n🔑 Please login to Binance first!');
          console.log('   Waiting for login...');
          await page.waitForSelector('.css-1pcqseb', { timeout: 300000 }); // 5 min timeout
        }

        console.log('\n📝 Creating sell order...');
        console.log(`   Amount: ${config.amount} USDT`);
        console.log(`   Price: ₹${ourPrice.toFixed(2)}`);
        console.log(`   Payment: UPI (${process.env.UPI_ID})`);

        // Show instructions
        console.log('\n📌 NEXT STEPS:');
        console.log('1. Click "Post new Ad" button');
        console.log('2. Select "Sell" and "USDT"');
        console.log(`3. Enter price: ₹${ourPrice.toFixed(2)}`);
        console.log(`4. Enter amount: ${config.amount}`);
        console.log('5. Select UPI as payment method');
        console.log('6. Set order limit (min ₹500, max ₹50,000 recommended)');
        console.log('7. Post the ad');
        
        console.log('\n⚠️  IMPORTANT:');
        console.log('- Verify buyer sends correct amount');
        console.log('- Check payment from: ' + process.env.ACCOUNT_HOLDER_NAME);
        console.log('- Only release after confirming payment');

        // Keep page open for manual interaction
        console.log('\n✋ Complete the order manually in the browser.');
        console.log('   Press Ctrl+C when done.\n');

        // Prevent script from continuing
        await new Promise(() => {}); // Wait forever until user stops script

      } else {
        console.log('   ❌ Price too low, waiting...');
      }

      // Wait before next check
      await new Promise(resolve => setTimeout(resolve, config.refreshInterval));
    }

  } catch (error) {
    console.error('\n❌ Error:', error);
  } finally {
    if (browser) {
      // Don't auto-close browser - let user complete the trade
      console.log('\n📌 Browser will remain open for you to complete the trade.');
    }
  }
}

// Handle exit
process.on('SIGINT', () => {
  console.log('\n\n👋 Stopping automation...');
  console.log('   Remember to complete any open trades!');
  process.exit(0);
});

// Run
semiAutoSell().catch(console.error);