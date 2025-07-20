#!/usr/bin/env node
import puppeteer from 'puppeteer';

console.log('🌐 Opening Binance P2P and keeping browser open...\n');

(async () => {
  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: null,
    args: [
      '--start-maximized',
      '--disable-blink-features=AutomationControlled',
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage'
    ],
    ignoreDefaultArgs: ['--enable-automation'],
    executablePath: process.platform === 'darwin' 
      ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
      : puppeteer.executablePath()
  });

  const page = await browser.newPage();
  
  // Navigate to Binance P2P
  await page.goto('https://p2p.binance.com/en/trade/sell/USDT?fiat=INR&payment=UPI', {
    waitUntil: 'networkidle2',
    timeout: 60000
  });

  console.log('✅ Browser opened successfully!\n');
  console.log('📋 Steps to create P2P order:');
  console.log('1. Login if needed');
  console.log('2. Click "Post new Ad"'); 
  console.log('3. Enter: ₹94.75 price, 11.54 USDT');
  console.log('4. Select UPI payment\n');
  console.log('⚠️  DO NOT close this terminal!\n');

  // Critical: Keep process alive
  process.stdin.resume();
  process.on('SIGINT', async () => {
    console.log('\nClosing browser...');
    await browser.close();
    process.exit();
  });

  // Prevent any automatic closure
  setInterval(() => {
    // Keep alive ping
  }, 1000);

  // Add disconnect handler
  browser.on('disconnected', () => {
    console.log('Browser was closed');
    process.exit();
  });

})().catch(err => {
  console.error('Error:', err);
  console.log('\nTry this instead:');
  console.log('1. Open Chrome manually');
  console.log('2. Go to: https://p2p.binance.com');
  console.log('3. Login and create order');
  process.exit(1);
});