const puppeteer = require('puppeteer');
require('dotenv').config();

async function openBinanceP2P() {
  console.log('🚀 Opening Binance P2P...\n');
  
  // Launch browser
  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: null,
    args: [
      '--start-maximized',
      '--disable-blink-features=AutomationControlled',
      '--no-sandbox'
    ]
  });

  const page = await browser.newPage();
  
  // Set user agent to avoid detection
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
  
  console.log('📍 Navigating to Binance...');
  
  // First go to main Binance page
  await page.goto('https://www.binance.com', { waitUntil: 'networkidle0' });
  await page.waitForTimeout(3000);
  
  // Then navigate to P2P
  await page.goto('https://p2p.binance.com/en/trade/sell/USDT?fiat=INR&payment=UPI', { 
    waitUntil: 'domcontentloaded',
    timeout: 60000 
  });
  
  console.log('✅ Binance P2P page loaded\n');
  
  // Check if login is needed
  await page.waitForTimeout(5000);
  const needsLogin = await page.evaluate(() => {
    return window.location.href.includes('login') || document.body.textContent.includes('Log In');
  });
  
  if (needsLogin) {
    console.log('🔐 Login required. Please login manually in the browser.');
    console.log('   Email: ' + process.env.BINANCE_EMAIL);
    console.log('\n   Steps:');
    console.log('   1. Enter your email and password');
    console.log('   2. Complete 2FA if required');
    console.log('   3. Once logged in, I\'ll help with P2P trading\n');
  } else {
    console.log('✅ Already logged in!');
    console.log('\n📝 To create a P2P ad:');
    console.log('   1. Click "Post new Ad" button');
    console.log('   2. I\'ll help fill the form\n');
  }
  
  // Form filling helper
  console.log('💡 Quick fill values:');
  console.log('   Price: 94.73');
  console.log('   Amount: 11.54');
  console.log('   Min: 500');
  console.log('   Max: 11000\n');
  
  // Keep checking for Post new Ad button
  let checkInterval = setInterval(async () => {
    try {
      const hasPostButton = await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        return buttons.some(btn => btn.textContent.includes('Post new Ad'));
      });
      
      if (hasPostButton) {
        console.log('\n🎯 Post new Ad button detected!');
        console.log('   Click it to open the form.');
        clearInterval(checkInterval);
        
        // Start form monitor
        setTimeout(() => monitorForm(page), 3000);
      }
    } catch (e) {
      // Page might have navigated
    }
  }, 2000);
  
  // Prevent browser from closing
  console.log('🔄 Browser will stay open. Press Ctrl+C to exit.\n');
  
  // Keep process alive
  process.stdin.resume();
  process.on('SIGINT', async () => {
    console.log('\n👋 Closing browser...');
    await browser.close();
    process.exit();
  });
}

async function monitorForm(page) {
  console.log('\n🔍 Monitoring for form...');
  
  const formCheckInterval = setInterval(async () => {
    try {
      // Check if we're on the form page
      const hasForm = await page.evaluate(() => {
        const inputs = document.querySelectorAll('input');
        return inputs.length > 3; // Form should have multiple inputs
      });
      
      if (hasForm) {
        console.log('\n📝 Form detected! Filling now...');
        clearInterval(formCheckInterval);
        
        // Fill the form
        await page.evaluate(() => {
          const inputs = Array.from(document.querySelectorAll('input')).filter(i => i.offsetHeight > 0);
          
          // Price
          if (inputs[0]) {
            inputs[0].focus();
            inputs[0].value = '94.73';
            inputs[0].dispatchEvent(new Event('input', { bubbles: true }));
            console.log('Price set');
          }
          
          // Amount
          setTimeout(() => {
            if (inputs[1]) {
              inputs[1].focus();
              inputs[1].value = '11.54';
              inputs[1].dispatchEvent(new Event('input', { bubbles: true }));
              console.log('Amount set');
            }
          }, 500);
          
          // Min
          setTimeout(() => {
            if (inputs[2]) {
              inputs[2].focus();
              inputs[2].value = '500';
              inputs[2].dispatchEvent(new Event('input', { bubbles: true }));
              console.log('Min set');
            }
          }, 1000);
          
          // Max
          setTimeout(() => {
            if (inputs[3]) {
              inputs[3].focus();
              inputs[3].value = '11000';
              inputs[3].dispatchEvent(new Event('input', { bubbles: true }));
              console.log('Max set');
            }
          }, 1500);
          
          // UPI
          setTimeout(() => {
            const labels = document.querySelectorAll('label');
            for (const label of labels) {
              if (label.textContent.includes('UPI')) {
                label.click();
                console.log('UPI selected');
                break;
              }
            }
          }, 2000);
        });
        
        console.log('\n✅ Form filled!');
        console.log('   Price: ₹94.73');
        console.log('   Amount: 11.54 USDT');
        console.log('   Total: ₹1,093.18');
        console.log('   Profit: ₹66.12');
        console.log('\n⚠️  Please review and click Post button!\n');
      }
    } catch (e) {
      // Ignore errors
    }
  }, 1000);
}

// Start the bot
console.log(`
🤖 BINANCE P2P HELPER
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Features:
✓ Opens Binance P2P
✓ Helps with login
✓ Auto-fills forms
✓ Keeps browser open
✓ Real-time assistance

`);

openBinanceP2P().catch(console.error);