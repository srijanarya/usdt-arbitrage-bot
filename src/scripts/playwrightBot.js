const { chromium } = require('playwright');
const axios = require('axios');
require('dotenv').config();

class PlaywrightP2PBot {
  constructor() {
    this.browser = null;
    this.context = null;
    this.page = null;
  }

  async init() {
    console.log('🚀 Connecting to your Chrome...\n');
    
    try {
      // Connect to existing Chrome
      this.browser = await chromium.connectOverCDP('http://localhost:9222');
      
      // Get existing context and page
      const contexts = this.browser.contexts();
      this.context = contexts[0];
      const pages = this.context.pages();
      
      // Find Binance tab or use current
      this.page = pages.find(p => p.url().includes('binance')) || pages[0];
      
      console.log('✅ Connected to Chrome');
      console.log(`📄 Current page: ${this.page.url()}\n`);
      
      return true;
    } catch (error) {
      console.log('❌ Could not connect to Chrome');
      console.log('   Using new browser instance instead...\n');
      
      // Fallback to new browser
      this.browser = await chromium.launch({ 
        headless: false,
        channel: 'chrome'
      });
      this.page = await this.browser.newPage();
      return true;
    }
  }

  async readPage() {
    console.log('📖 Reading current page...\n');
    
    const url = this.page.url();
    console.log(`URL: ${url}\n`);
    
    // Get all form elements
    const formData = await this.page.evaluate(() => {
      const elements = Array.from(document.querySelectorAll('input, select, textarea, button'));
      return elements.map((el, index) => {
        const rect = el.getBoundingClientRect();
        return {
          index,
          tag: el.tagName.toLowerCase(),
          type: el.type || '',
          name: el.name || '',
          id: el.id || '',
          placeholder: el.placeholder || '',
          value: el.value || '',
          text: el.textContent || '',
          visible: rect.height > 0 && rect.width > 0,
          className: el.className.substring(0, 50)
        };
      }).filter(e => e.visible);
    });
    
    console.log('Visible form elements:');
    console.log('─'.repeat(80));
    
    // Group by type
    const inputs = formData.filter(e => e.tag === 'input');
    const buttons = formData.filter(e => e.tag === 'button');
    const selects = formData.filter(e => e.tag === 'select');
    
    if (inputs.length > 0) {
      console.log('\n📝 INPUT FIELDS:');
      inputs.forEach(field => {
        console.log(`[${field.index}] ${field.type.padEnd(10)} | ${(field.placeholder || field.name || 'unnamed').padEnd(30)} | value: "${field.value}"`);
      });
    }
    
    if (buttons.length > 0) {
      console.log('\n🔘 BUTTONS:');
      buttons.forEach(btn => {
        if (btn.text.trim()) {
          console.log(`[${btn.index}] "${btn.text.trim()}"`);
        }
      });
    }
    
    if (selects.length > 0) {
      console.log('\n📋 DROPDOWNS:');
      selects.forEach(sel => {
        console.log(`[${sel.index}] ${sel.name || 'unnamed'}`);
      });
    }
    
    return formData;
  }

  async fillForm(values = {}) {
    console.log('\n✏️ Filling form...\n');
    
    const defaultValues = {
      price: '94.73',
      amount: '11.54', 
      min: '500',
      max: '11000'
    };
    
    const finalValues = { ...defaultValues, ...values };
    
    // Get current market price if not provided
    if (!values.price) {
      const marketPrice = await this.getMarketPrice();
      finalValues.price = (marketPrice - 0.05).toFixed(2);
      console.log(`📊 Market price: ₹${marketPrice}`);
      console.log(`📉 Our price: ₹${finalValues.price}\n`);
    }
    
    // Fill visible inputs in order
    const inputs = await this.page.$$('input:visible');
    
    if (inputs[0]) {
      await inputs[0].fill(finalValues.price);
      console.log(`✓ Price: ₹${finalValues.price}`);
    }
    
    if (inputs[1]) {
      await this.page.waitForTimeout(500);
      await inputs[1].fill(finalValues.amount);
      console.log(`✓ Amount: ${finalValues.amount} USDT`);
    }
    
    if (inputs[2]) {
      await this.page.waitForTimeout(500);
      await inputs[2].fill(finalValues.min);
      console.log(`✓ Min order: ₹${finalValues.min}`);
    }
    
    if (inputs[3]) {
      await this.page.waitForTimeout(500);
      await inputs[3].fill(finalValues.max);
      console.log(`✓ Max order: ₹${finalValues.max}`);
    }
    
    // Click UPI
    await this.page.waitForTimeout(500);
    try {
      await this.page.click('label:has-text("UPI")');
      console.log('✓ UPI selected');
    } catch {
      // Try alternative method
      await this.page.evaluate(() => {
        const labels = document.querySelectorAll('label');
        for (const label of labels) {
          if (label.textContent.includes('UPI')) {
            label.click();
            break;
          }
        }
      });
    }
    
    const total = (parseFloat(finalValues.price) * parseFloat(finalValues.amount)).toFixed(2);
    const profit = ((parseFloat(finalValues.price) - 89) * parseFloat(finalValues.amount)).toFixed(2);
    
    console.log('\n💰 Summary:');
    console.log(`   Total: ₹${total}`);
    console.log(`   Profit: ₹${profit} (${((parseFloat(finalValues.price) - 89) / 89 * 100).toFixed(1)}%)`);
  }

  async clickButton(text) {
    console.log(`\n🖱️ Clicking "${text}"...`);
    
    try {
      // Method 1: Direct text selector
      await this.page.click(`button:has-text("${text}")`, { timeout: 5000 });
      console.log('✓ Clicked successfully');
      return true;
    } catch {
      try {
        // Method 2: Evaluate
        const clicked = await this.page.evaluate((btnText) => {
          const buttons = Array.from(document.querySelectorAll('button'));
          const btn = buttons.find(b => b.textContent.includes(btnText));
          if (btn) {
            btn.click();
            return true;
          }
          return false;
        }, text);
        
        if (clicked) {
          console.log('✓ Clicked successfully');
          return true;
        }
      } catch {}
    }
    
    console.log('❌ Button not found');
    return false;
  }

  async navigateTo(url) {
    console.log(`\n📍 Navigating to: ${url}`);
    await this.page.goto(url, { waitUntil: 'domcontentloaded' });
    await this.page.waitForTimeout(2000);
    console.log('✓ Page loaded');
  }

  async getMarketPrice() {
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
      return parseFloat(response.data.data[0]?.adv?.price || '94.5');
    } catch {
      return 94.5;
    }
  }

  async createAd() {
    console.log('\n🤖 Creating P2P Ad...\n');
    
    // Navigate to My Ads
    await this.navigateTo('https://p2p.binance.com/en/myads');
    
    // Click Post new Ad
    const clicked = await this.clickButton('Post new Ad');
    if (!clicked) {
      console.log('⚠️  Please click "Post new Ad" manually');
      return;
    }
    
    await this.page.waitForTimeout(3000);
    
    // Fill the form
    await this.fillForm();
    
    console.log('\n✅ Form ready! Review and click Post.');
  }
}

// Main execution
async function main() {
  const bot = new PlaywrightP2PBot();
  
  console.log(`
🎯 PLAYWRIGHT P2P BOT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Commands:
  read    - Read current page
  fill    - Fill current form
  create  - Create new P2P ad
  nav     - Navigate to URL
  click   - Click button by text

`);

  await bot.init();

  const command = process.argv[2] || 'read';
  const arg = process.argv[3];

  switch (command) {
    case 'read':
      await bot.readPage();
      break;
      
    case 'fill':
      await bot.fillForm();
      break;
      
    case 'create':
      await bot.createAd();
      break;
      
    case 'nav':
      const url = arg || 'https://p2p.binance.com';
      await bot.navigateTo(url);
      break;
      
    case 'click':
      const text = arg || 'Post new Ad';
      await bot.clickButton(text);
      break;
      
    default:
      console.log('Unknown command. Use: read, fill, create, nav, click');
  }
  
  // Keep browser open
  console.log('\n🔄 Browser stays open. Press Ctrl+C to exit.');
  process.stdin.resume();
}

main().catch(console.error);