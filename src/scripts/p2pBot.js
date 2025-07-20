const puppeteer = require('puppeteer');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const COOKIES_PATH = path.join(process.cwd(), 'binance-cookies.json');

class BinanceP2PBot {
  constructor(config) {
    this.config = config;
    this.browser = null;
    this.page = null;
    this.activeAds = 0;
  }

  async init() {
    console.log('🚀 Starting Binance P2P Bot...\n');
    
    this.browser = await puppeteer.launch({
      headless: false,
      args: [
        '--disable-blink-features=AutomationControlled',
        '--no-sandbox',
        '--disable-setuid-sandbox'
      ]
    });

    this.page = await this.browser.newPage();
    await this.page.setViewport({ width: 1920, height: 1080 });
  }

  async loadCookies() {
    if (fs.existsSync(COOKIES_PATH)) {
      console.log('📂 Loading saved cookies...');
      const cookies = JSON.parse(fs.readFileSync(COOKIES_PATH, 'utf-8'));
      await this.page.setCookie(...cookies);
      return true;
    }
    return false;
  }

  async saveCookies() {
    const cookies = await this.page.cookies();
    fs.writeFileSync(COOKIES_PATH, JSON.stringify(cookies, null, 2));
    console.log('💾 Cookies saved');
  }

  async login() {
    console.log('🔐 Logging into Binance...');
    
    await this.page.goto('https://accounts.binance.com/en/login', { waitUntil: 'networkidle0' });
    
    // Check if already logged in
    if (this.page.url().includes('myaccount')) {
      console.log('✅ Already logged in!');
      return;
    }

    // Wait for email input
    await this.page.waitForSelector('input[name="email"]', { timeout: 30000 });
    await this.page.type('input[name="email"]', this.config.email, { delay: 100 });
    
    // Click Next
    await this.page.click('#click_login_submit');
    await new Promise(r => setTimeout(r, 2000));
    
    // Enter password
    await this.page.waitForSelector('input[name="password"]', { timeout: 30000 });
    await this.page.type('input[name="password"]', this.config.password, { delay: 100 });
    
    // Click Login
    await this.page.click('#click_login_submit');
    
    console.log('⏳ Waiting for 2FA if needed...');
    console.log('   Complete 2FA in the browser if prompted');
    
    // Wait for successful login
    try {
      await this.page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 120000 });
      await this.saveCookies();
      console.log('✅ Login successful!');
    } catch (e) {
      console.log('⚠️  Login timeout - please complete 2FA manually');
    }
  }

  async getCurrentMarketPrice() {
    try {
      const response = await axios.post(
        'https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search',
        {
          page: 1,
          rows: 3,
          payTypes: ["UPI"],
          tradeType: "SELL",
          asset: "USDT",
          fiat: "INR"
        }
      );
      
      const ads = response.data.data || [];
      return ads.length > 0 ? parseFloat(ads[0].adv.price) : 94.5;
    } catch (error) {
      return 94.5;
    }
  }

  async postAd() {
    console.log('\n📝 Creating new P2P ad...');
    
    // Navigate to post ad page
    await this.page.goto('https://p2p.binance.com/en/myads', { waitUntil: 'networkidle0' });
    await new Promise(r => setTimeout(r, 3000));
    
    // Try multiple selectors for Post button
    const postButtonSelectors = [
      'button:has-text("Post new Ad")',
      'button[class*="css-"][class*="pcqseb"]',
      'button[data-e2e="createAdButton"]',
      '.css-1pcqseb',
      'button.css-vurnku'
    ];
    
    let clicked = false;
    for (const selector of postButtonSelectors) {
      try {
        await this.page.click(selector);
        clicked = true;
        console.log('   Clicked Post new Ad button');
        break;
      } catch (e) {
        // Try next selector
      }
    }
    
    if (!clicked) {
      console.log('   Could not find Post button - trying JavaScript click');
      await this.page.evaluate(() => {
        const buttons = document.querySelectorAll('button');
        for (const btn of buttons) {
          if (btn.textContent.includes('Post new Ad')) {
            btn.click();
            return;
          }
        }
      });
    }
    
    await new Promise(r => setTimeout(r, 3000));
    
    // Fill the form
    console.log('   Filling form...');
    
    // Price
    const marketPrice = await this.getCurrentMarketPrice();
    const ourPrice = marketPrice - 0.05;
    
    await this.page.evaluate((price) => {
      const inputs = document.querySelectorAll('input');
      if (inputs[0]) {
        inputs[0].value = price;
        inputs[0].dispatchEvent(new Event('input', { bubbles: true }));
      }
    }, ourPrice.toFixed(2));
    
    // Amount
    await new Promise(r => setTimeout(r, 500));
    await this.page.evaluate((amount) => {
      const inputs = document.querySelectorAll('input');
      if (inputs[1]) {
        inputs[1].value = amount;
        inputs[1].dispatchEvent(new Event('input', { bubbles: true }));
      }
    }, this.config.amount.toString());
    
    // Min order
    await new Promise(r => setTimeout(r, 500));
    await this.page.evaluate((min) => {
      const inputs = document.querySelectorAll('input');
      if (inputs[2]) {
        inputs[2].value = min;
        inputs[2].dispatchEvent(new Event('input', { bubbles: true }));
      }
    }, this.config.minOrder.toString());
    
    // Max order
    await new Promise(r => setTimeout(r, 500));
    await this.page.evaluate((max) => {
      const inputs = document.querySelectorAll('input');
      if (inputs[3]) {
        inputs[3].value = max;
        inputs[3].dispatchEvent(new Event('input', { bubbles: true }));
      }
    }, this.config.maxOrder.toString());
    
    // Select UPI
    await this.page.evaluate(() => {
      const labels = document.querySelectorAll('label');
      for (const label of labels) {
        if (label.textContent.includes('UPI')) {
          label.click();
          break;
        }
      }
    });
    
    console.log(`   Price: ₹${ourPrice.toFixed(2)} (Market: ₹${marketPrice})`);
    console.log(`   Amount: ${this.config.amount} USDT`);
    console.log('   ⚠️  Please review and click Post button manually');
    
    return true;
  }

  async run() {
    try {
      await this.init();
      
      // Try to use saved cookies
      const hasCookies = await this.loadCookies();
      
      if (hasCookies) {
        await this.page.goto('https://p2p.binance.com/en/myads');
        await new Promise(r => setTimeout(r, 3000));
        
        // Check if logged in
        const needsLogin = await this.page.evaluate(() => {
          return window.location.href.includes('login');
        });
        
        if (needsLogin) {
          console.log('Cookies expired, need to login again');
          await this.login();
        } else {
          console.log('✅ Logged in with saved cookies');
        }
      } else {
        await this.login();
      }
      
      // Post first ad
      await this.postAd();
      
      // Keep browser open
      console.log('\n✅ Bot ready! Keep this running.');
      console.log('   The browser will stay open for manual review.');
      
    } catch (error) {
      console.error('Bot error:', error);
    }
  }
}

// Configuration
const config = {
  email: process.env.BINANCE_EMAIL || '',
  password: process.env.BINANCE_PASSWORD || '',
  amount: 11.54,
  minOrder: 500,
  maxOrder: 11000
};

console.log(`
🤖 BINANCE P2P AUTO-POSTER BOT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Email: ${config.email}
Amount: ${config.amount} USDT
Limits: ₹${config.minOrder} - ₹${config.maxOrder}

Starting in 3 seconds...
`);

// Check credentials
if (!config.email || !config.password) {
  console.error('\n❌ Please add to your .env file:');
  console.error('BINANCE_EMAIL=your_email@gmail.com');
  console.error('BINANCE_PASSWORD=your_password');
  process.exit(1);
}

setTimeout(() => {
  const bot = new BinanceP2PBot(config);
  bot.run().catch(console.error);
}, 3000);