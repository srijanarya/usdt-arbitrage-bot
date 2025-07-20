#!/usr/bin/env node
import puppeteer from 'puppeteer';

console.log(`
🌐 OPENING BINANCE P2P
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`);

async function openBinance() {
  let browser = null;
  try {
    console.log('🚀 Launching browser...\n');
    
    browser = await puppeteer.launch({
      headless: false, // MUST show browser
      defaultViewport: null,
      args: [
        '--start-maximized',
        '--window-size=1920,1080',
        '--no-sandbox',
        '--disable-setuid-sandbox'
      ],
      executablePath: process.platform === 'darwin' 
        ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
        : undefined
    });

    console.log('✅ Browser launched!\n');

    const page = await browser.newPage();
    
    console.log('📍 Navigating to Binance P2P...');
    await page.goto('https://p2p.binance.com/en/trade/sell/USDT?fiat=INR&payment=UPI', {
      waitUntil: 'domcontentloaded'
    });

    console.log('\n✅ Binance P2P page opened!');
    console.log('\n📋 Manual Steps:');
    console.log('1. Login to Binance');
    console.log('2. Click "Post new Ad"');
    console.log('3. Select "Sell"');
    console.log('4. Enter amount: 11.54 USDT');
    console.log('5. Enter price: ₹94.75');
    console.log('6. Select UPI payment');
    console.log('7. Post your ad');
    
    console.log('\n💡 Current market price: ₹94.80');
    console.log('   Suggested price: ₹94.75 (for quick sale)');
    console.log('   Expected profit: ₹66.36 (6.5%)');
    
    console.log('\n⚠️  Keep this script running to keep browser open.');
    console.log('Press Ctrl+C when done.\n');

    // Keep script and browser running
    console.log('Browser is open. Keeping it alive...');
    
    // Prevent browser from closing
    await page.evaluate(() => {
      console.log('P2P Helper Active');
    });
    
    // Keep the script running indefinitely
    setInterval(() => {
      // Just keep alive
    }, 1000);
    
    // Wait forever
    await new Promise((resolve) => {
      process.on('SIGINT', () => {
        console.log('\nClosing browser...');
        browser.close();
        resolve(true);
      });
    });
    
  } catch (error) {
    console.error('❌ Error:', error);
    console.log('\nTroubleshooting:');
    console.log('1. Make sure Chrome is installed');
    console.log('2. Try running with sudo if on Mac/Linux');
    console.log('3. Check if another Chrome is already running');
  }
}

openBinance();