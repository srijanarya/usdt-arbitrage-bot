#!/usr/bin/env node
import puppeteer, { Browser, Page } from 'puppeteer';
import { config } from 'dotenv';
import axios from 'axios';
import fs from 'fs';
import path from 'path';

config();

const COOKIES_PATH = path.join(process.cwd(), 'binance-cookies.json');

interface P2PConfig {
  email: string;
  password: string;
  amount: number;
  minOrder: number;
  maxOrder: number;
  priceStrategy: 'competitive' | 'fixed';
  fixedPrice?: number;
  priceOffset?: number;
  paymentMethod: string;
  timeLimit: number;
  maxAds: number;
  checkInterval: number;
}

class BinanceP2PBot {
  private browser: Browser | null = null;
  private page: Page | null = null;
  private config: P2PConfig;
  private activeAds: number = 0;

  constructor(config: P2PConfig) {
    this.config = config;
  }

  async init() {
    console.log('🚀 Starting Binance P2P Bot...\n');
    
    this.browser = await puppeteer.launch({
      headless: false, // Set to true for production
      args: [
        '--disable-blink-features=AutomationControlled',
        '--disable-features=IsolateOrigins,site-per-process',
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-web-security',
        '--user-agent=Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      ]
    });

    this.page = await this.browser.newPage();
    
    // Anti-detection measures
    await this.page.evaluateOnNewDocument(() => {
      Object.defineProperty((window as any).navigator, 'webdriver', { get: () => false });
      Object.defineProperty((window as any).navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
      Object.defineProperty((window as any).navigator, 'languages', { get: () => ['en-US', 'en'] });
    });

    await this.page.setViewport({ width: 1920, height: 1080 });
  }

  async loadCookies() {
    if (fs.existsSync(COOKIES_PATH)) {
      console.log('📂 Loading saved cookies...');
      const cookies = JSON.parse(fs.readFileSync(COOKIES_PATH, 'utf-8'));
      await this.page!.setCookie(...cookies);
      return true;
    }
    return false;
  }

  async saveCookies() {
    const cookies = await this.page!.cookies();
    fs.writeFileSync(COOKIES_PATH, JSON.stringify(cookies, null, 2));
    console.log('💾 Cookies saved');
  }

  async login() {
    console.log('🔐 Logging into Binance...');
    
    await this.page!.goto('https://accounts.binance.com/en/login', { waitUntil: 'networkidle0' });
    
    // Check if already logged in
    if (this.page!.url().includes('p2p.binance.com')) {
      console.log('✅ Already logged in!');
      return;
    }

    // Wait for email input
    await this.page!.waitForSelector('input[name="email"]', { timeout: 30000 });
    await this.page!.type('input[name="email"]', this.config.email, { delay: 100 });
    
    // Click Next
    await this.page!.click('button[type="submit"]');
    await this.page!.waitForTimeout(2000);
    
    // Enter password
    await this.page!.waitForSelector('input[name="password"]', { timeout: 30000 });
    await this.page!.type('input[name="password"]', this.config.password, { delay: 100 });
    
    // Click Login
    await this.page!.click('button[type="submit"]');
    
    console.log('⏳ Waiting for 2FA if needed...');
    console.log('   Complete 2FA in the browser if prompted');
    
    // Wait for redirect to main page
    await this.page!.waitForFunction(
      () => (window as any).location.href.includes('binance.com') && !(window as any).location.href.includes('login'),
      { timeout: 120000 } // 2 minute timeout for 2FA
    );
    
    await this.saveCookies();
    console.log('✅ Login successful!');
  }

  async getCurrentMarketPrice(): Promise<number> {
    try {
      const response = await axios.post(
        'https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search',
        {
          page: 1,
          rows: 5,
          payTypes: ["UPI"],
          tradeType: "SELL",
          asset: "USDT",
          fiat: "INR"
        }
      );
      
      const ads = response.data.data || [];
      return ads.length > 0 ? parseFloat(ads[0].adv.price) : 94.5;
    } catch (error) {
      console.error('Error fetching market price:', error);
      return 94.5; // Default fallback
    }
  }

  async postAd() {
    console.log('\n📝 Creating new P2P ad...');
    
    // Navigate to post ad page
    await this.page!.goto('https://p2p.binance.com/en/myads', { waitUntil: 'networkidle0' });
    await this.page!.waitForTimeout(2000);
    
    // Click "Post new Ad"
    const postButton = await this.page!.$('button:has-text("Post new Ad"), button:contains("Post new Ad")') ||
                      await this.page!.$('button.css-1pcqseb');
    
    if (!postButton) {
      console.error('Could not find Post new Ad button');
      return false;
    }
    
    await postButton.click();
    await this.page!.waitForTimeout(2000);
    
    // Select "I want to sell"
    await this.page!.click('label:has-text("I want to sell")');
    await this.page!.waitForTimeout(1000);
    
    // Calculate price
    let price: number;
    if (this.config.priceStrategy === 'competitive') {
      const marketPrice = await this.getCurrentMarketPrice();
      price = marketPrice - (this.config.priceOffset || 0.05);
      console.log(`   Market price: ₹${marketPrice}, Our price: ₹${price.toFixed(2)}`);
    } else {
      price = this.config.fixedPrice || 94.75;
    }
    
    // Fill form fields
    await this.fillFormField('input[name="price"]', price.toFixed(2));
    await this.fillFormField('input[name="amount"]', this.config.amount.toString());
    await this.fillFormField('input[placeholder*="min" i]', this.config.minOrder.toString());
    await this.fillFormField('input[placeholder*="max" i]', this.config.maxOrder.toString());
    
    // Select UPI
    await this.page!.click('label:has-text("UPI")');
    await this.page!.waitForTimeout(500);
    
    // Set time limit (if dropdown exists)
    const timeSelect = await this.page!.$('select[name*="time"]');
    if (timeSelect) {
      await timeSelect.select(this.config.timeLimit.toString());
    }
    
    // Click Post button
    const submitButton = await this.page!.$('button[type="submit"]:has-text("Post")') ||
                        await this.page!.$('button:has-text("Post"):not(:has-text("Post new"))');
    
    if (!submitButton) {
      console.error('Could not find Post button');
      return false;
    }
    
    await submitButton.click();
    
    console.log('✅ Ad posted successfully!');
    console.log(`   Price: ₹${price.toFixed(2)}`);
    console.log(`   Amount: ${this.config.amount} USDT`);
    console.log(`   Total: ₹${(price * this.config.amount).toFixed(2)}`);
    
    this.activeAds++;
    return true;
  }

  private async fillFormField(selector: string, value: string) {
    const input = await this.page!.waitForSelector(selector, { timeout: 5000 });
    if (input) {
      await input.click({ clickCount: 3 }); // Select all
      await input.type(value, { delay: 50 });
    }
  }

  async checkActiveAds(): Promise<number> {
    await this.page!.goto('https://p2p.binance.com/en/myads', { waitUntil: 'networkidle0' });
    await this.page!.waitForTimeout(2000);
    
    const adElements = await this.page!.$$('[class*="css-"][class*="ad-item"], [data-testid="p2p-ad-item"]');
    return adElements.length;
  }

  async monitorAndRepost() {
    console.log('\n🔄 Starting monitoring loop...');
    console.log(`   Target: ${this.config.maxAds} active ads`);
    console.log(`   Check interval: ${this.config.checkInterval / 1000}s\n`);
    
    while (true) {
      try {
        const currentAds = await this.checkActiveAds();
        console.log(`[${new Date().toLocaleTimeString()}] Active ads: ${currentAds}/${this.config.maxAds}`);
        
        if (currentAds < this.config.maxAds) {
          const adsToCreate = this.config.maxAds - currentAds;
          console.log(`   Need to create ${adsToCreate} more ads`);
          
          for (let i = 0; i < adsToCreate; i++) {
            const success = await this.postAd();
            if (!success) {
              console.error('Failed to post ad, will retry later');
              break;
            }
            
            // Wait between posts to avoid rate limiting
            if (i < adsToCreate - 1) {
              console.log('   Waiting 30s before next ad...');
              await this.page!.waitForTimeout(30000);
            }
          }
        }
        
        // Wait before next check
        await this.page!.waitForTimeout(this.config.checkInterval);
        
      } catch (error) {
        console.error('Error in monitoring loop:', error);
        await this.page!.waitForTimeout(60000); // Wait 1 minute on error
      }
    }
  }

  async run() {
    try {
      await this.init();
      
      // Try to use saved cookies
      const hasCookies = await this.loadCookies();
      
      if (hasCookies) {
        await this.page!.goto('https://p2p.binance.com/en/myads', { waitUntil: 'networkidle0' });
        
        // Check if logged in
        if (this.page!.url().includes('login')) {
          console.log('Cookies expired, need to login again');
          await this.login();
        } else {
          console.log('✅ Logged in with saved cookies');
        }
      } else {
        await this.login();
      }
      
      // Start monitoring and posting
      await this.monitorAndRepost();
      
    } catch (error) {
      console.error('Bot error:', error);
    }
  }

  async stop() {
    if (this.browser) {
      await this.browser.close();
    }
  }
}

// Configuration
const botConfig: P2PConfig = {
  email: process.env.BINANCE_EMAIL || '',
  password: process.env.BINANCE_PASSWORD || '',
  amount: 11.54,
  minOrder: 500,
  maxOrder: 11000,
  priceStrategy: 'competitive',
  priceOffset: 0.05, // 5 paise below market
  paymentMethod: 'UPI',
  timeLimit: 15,
  maxAds: 3, // Maintain 3 active ads
  checkInterval: 300000 // Check every 5 minutes
};

// Run the bot
const bot = new BinanceP2PBot(botConfig);

console.log(`
🤖 BINANCE P2P AUTO-POSTER BOT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

This bot will:
✓ Login to Binance automatically
✓ Monitor your active ads
✓ Create new ads when needed
✓ Maintain ${botConfig.maxAds} active ads at all times
✓ Use competitive pricing (market - ₹0.05)

Press Ctrl+C to stop
`);

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n\n👋 Stopping bot...');
  await bot.stop();
  process.exit(0);
});

// Start the bot
bot.run().catch(console.error);