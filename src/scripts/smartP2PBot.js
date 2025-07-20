const puppeteer = require('puppeteer');
const axios = require('axios');
require('dotenv').config();

class SmartP2PBot {
  constructor() {
    this.email = process.env.BINANCE_EMAIL;
    this.password = process.env.BINANCE_PASSWORD;
    this.browser = null;
    this.page = null;
  }

  async init() {
    console.log('🚀 Launching browser...\n');
    
    this.browser = await puppeteer.launch({
      headless: false,
      defaultViewport: null,
      args: ['--start-maximized']
    });

    this.page = await this.browser.newPage();
  }

  async navigateToP2P() {
    console.log('📍 Going directly to P2P trading...');
    
    // Go directly to P2P page
    await this.page.goto('https://p2p.binance.com/en/trade/sell/USDT?fiat=INR&payment=UPI', {
      waitUntil: 'networkidle0',
      timeout: 60000
    });
    
    // Check if we need to login
    const currentUrl = this.page.url();
    if (currentUrl.includes('login') || currentUrl.includes('accounts.binance')) {
      console.log('🔐 Login required...');
      await this.handleLogin();
    } else {
      console.log('✅ Already logged in!');
    }
  }

  async handleLogin() {
    console.log('🔑 Attempting login...');
    console.log('   Looking for login form...');
    
    // Wait a bit for page to load
    await new Promise(r => setTimeout(r, 3000));
    
    // Try to find and fill email
    try {
      // Multiple possible selectors for email field
      const emailSelectors = [
        'input[name="email"]',
        'input[type="email"]',
        'input[placeholder*="Email"]',
        'input[id*="email"]',
        '#username'
      ];
      
      let emailFilled = false;
      for (const selector of emailSelectors) {
        try {
          await this.page.waitForSelector(selector, { timeout: 5000 });
          await this.page.type(selector, this.email, { delay: 100 });
          console.log('   ✓ Email entered');
          emailFilled = true;
          break;
        } catch (e) {
          // Try next selector
        }
      }
      
      if (!emailFilled) {
        console.log('   ❌ Could not find email field');
        console.log('   Please login manually in the browser');
        return;
      }
      
      // Look for continue/next button
      await new Promise(r => setTimeout(r, 1000));
      const nextButtonSelectors = [
        'button[type="submit"]',
        'button:contains("Next")',
        'button:contains("Continue")',
        '#click_login_submit'
      ];
      
      for (const selector of nextButtonSelectors) {
        try {
          await this.page.click(selector);
          console.log('   ✓ Clicked next');
          break;
        } catch (e) {
          // Try next
        }
      }
      
      // Wait for password field
      await new Promise(r => setTimeout(r, 2000));
      
      // Try password field
      const passwordSelectors = [
        'input[name="password"]',
        'input[type="password"]',
        'input[placeholder*="Password"]'
      ];
      
      let passwordFilled = false;
      for (const selector of passwordSelectors) {
        try {
          await this.page.waitForSelector(selector, { timeout: 5000 });
          await this.page.type(selector, this.password, { delay: 100 });
          console.log('   ✓ Password entered');
          passwordFilled = true;
          break;
        } catch (e) {
          // Try next
        }
      }
      
      if (passwordFilled) {
        // Submit login
        await new Promise(r => setTimeout(r, 1000));
        await this.page.keyboard.press('Enter');
        console.log('   ✓ Login submitted');
        console.log('\n⏳ Waiting for 2FA if required...');
        console.log('   Complete 2FA in the browser window');
      }
      
    } catch (error) {
      console.log('\n⚠️  Auto-login failed');
      console.log('Please login manually in the browser window');
    }
    
    // Wait for user to complete login/2FA
    console.log('\nWaiting for login to complete...');
    await this.page.waitForFunction(
      () => !window.location.href.includes('login') && !window.location.href.includes('accounts.binance'),
      { timeout: 300000 } // 5 minute timeout
    );
    
    console.log('✅ Login successful!');
  }

  async getCurrentPrice() {
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
      return parseFloat(response.data.data[0]?.adv?.price || 94.5);
    } catch (error) {
      return 94.5;
    }
  }

  async createAd() {
    console.log('\n📝 Creating P2P sell ad...');
    
    // Get current market price
    const marketPrice = await this.getCurrentPrice();
    const ourPrice = (marketPrice - 0.05).toFixed(2);
    
    console.log(`   Market price: ₹${marketPrice}`);
    console.log(`   Our price: ₹${ourPrice}`);
    console.log(`   Expected profit: ₹${((ourPrice - 89) * 11.54).toFixed(2)}`);
    
    // Navigate to create ad
    await this.page.goto('https://p2p.binance.com/en/myads');
    await new Promise(r => setTimeout(r, 3000));
    
    // Click Post new Ad
    console.log('\n   Looking for Post new Ad button...');
    await this.page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const postButton = buttons.find(btn => 
        btn.textContent.includes('Post new Ad') || 
        btn.textContent.includes('Post New Ad')
      );
      if (postButton) postButton.click();
    });
    
    await new Promise(r => setTimeout(r, 3000));
    
    // Fill form using page evaluation
    console.log('   Filling form...');
    
    await this.page.evaluate((price, amount) => {
      // Fill by input order
      const inputs = Array.from(document.querySelectorAll('input[type="text"], input[type="number"], input:not([type])')).filter(i => i.offsetHeight > 0);
      
      // Price (usually first)
      if (inputs[0]) {
        inputs[0].focus();
        inputs[0].value = price;
        inputs[0].dispatchEvent(new Event('input', { bubbles: true }));
        inputs[0].dispatchEvent(new Event('change', { bubbles: true }));
      }
      
      // Amount (usually second)
      if (inputs[1]) {
        inputs[1].focus();
        inputs[1].value = amount;
        inputs[1].dispatchEvent(new Event('input', { bubbles: true }));
        inputs[1].dispatchEvent(new Event('change', { bubbles: true }));
      }
      
      // Min order (usually third)
      if (inputs[2]) {
        inputs[2].focus();
        inputs[2].value = '500';
        inputs[2].dispatchEvent(new Event('input', { bubbles: true }));
      }
      
      // Max order (usually fourth)
      if (inputs[3]) {
        inputs[3].focus();
        inputs[3].value = '11000';
        inputs[3].dispatchEvent(new Event('input', { bubbles: true }));
      }
      
      // Click UPI
      const labels = document.querySelectorAll('label');
      for (const label of labels) {
        if (label.textContent.includes('UPI')) {
          label.click();
          break;
        }
      }
    }, ourPrice, '11.54');
    
    console.log('\n✅ Form filled!');
    console.log('📋 Order details:');
    console.log(`   Price: ₹${ourPrice}`);
    console.log(`   Amount: 11.54 USDT`);
    console.log(`   Total: ₹${(parseFloat(ourPrice) * 11.54).toFixed(2)}`);
    console.log(`   Profit: ₹${((parseFloat(ourPrice) - 89) * 11.54).toFixed(2)}`);
    console.log('\n⚠️  Please review and click the Post button to create your ad!');
  }

  async run() {
    try {
      await this.init();
      await this.navigateToP2P();
      
      // Wait a bit to ensure we're on P2P page
      await new Promise(r => setTimeout(r, 3000));
      
      // Create ad
      await this.createAd();
      
      console.log('\n✅ Bot completed! Browser will stay open.');
      console.log('   Monitor your ads and handle buyer communication.');
      
    } catch (error) {
      console.error('Error:', error.message);
      console.log('\nPlease complete the process manually in the browser.');
    }
  }
}

// Main execution
console.log(`
🤖 SMART P2P AUTOMATION BOT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

This bot will:
1. Open Binance P2P
2. Help you login (or use existing session)
3. Create optimized sell orders
4. Fill all details automatically

Starting...
`);

const bot = new SmartP2PBot();
bot.run().catch(console.error);