#!/usr/bin/env node
import { chromium, Page, Browser } from 'playwright';
import { config } from 'dotenv';
import axios from 'axios';
import fs from 'fs';
import path from 'path';

config();

class AdvancedP2PBot {
  private browser: Browser | null = null;
  private page: Page | null = null;
  private context: any = null;

  async init() {
    console.log('🚀 Starting Advanced P2P Bot...\n');
    
    // Use existing Chrome installation with your profile
    const userDataDir = path.join(process.env.HOME!, 'Library/Application Support/Google/Chrome');
    
    this.browser = await chromium.launchPersistentContext(userDataDir, {
      headless: false,
      channel: 'chrome',
      viewport: null,
      args: [
        '--disable-blink-features=AutomationControlled',
        '--disable-features=IsolateOrigins,site-per-process'
      ]
    });

    // Get the first page
    const pages = this.browser.pages();
    this.page = pages[0] || await this.browser.newPage();
    
    console.log('✅ Connected to your Chrome profile');
  }

  async navigateToP2P() {
    console.log('📍 Navigating to P2P...');
    await this.page!.goto('https://p2p.binance.com/en/trade/sell/USDT?fiat=INR&payment=UPI');
    await this.page!.waitForLoadState('networkidle');
  }

  async createAd() {
    console.log('📝 Creating P2P ad...\n');
    
    // Go to My Ads
    await this.page!.goto('https://p2p.binance.com/en/myads');
    await this.page!.waitForLoadState('networkidle');
    
    // Click Post new Ad - try multiple strategies
    const posted = await this.clickPostButton();
    if (!posted) {
      console.log('❌ Could not find Post button');
      return;
    }
    
    await this.page!.waitForTimeout(3000);
    
    // Get market price
    const marketPrice = await this.getMarketPrice();
    const ourPrice = (marketPrice - 0.05).toFixed(2);
    
    console.log(`Market price: ₹${marketPrice}`);
    console.log(`Our price: ₹${ourPrice}`);
    
    // Fill form
    await this.fillForm(ourPrice);
    
    console.log('\n✅ Form filled! Review and click Post.');
  }

  private async clickPostButton(): Promise<boolean> {
    // Method 1: Text selector
    try {
      await this.page!.click('button:has-text("Post new Ad")', { timeout: 5000 });
      return true;
    } catch {}
    
    // Method 2: Evaluate
    try {
      await this.page!.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const btn = buttons.find(b => b.textContent?.includes('Post new Ad'));
        if (btn) (btn as HTMLElement).click();
      });
      return true;
    } catch {}
    
    // Method 3: Force click
    try {
      const button = await this.page!.$('button >> text=/Post.*Ad/i');
      if (button) {
        await button.click({ force: true });
        return true;
      }
    } catch {}
    
    return false;
  }

  private async fillForm(price: string) {
    // Smart form filling
    const inputs = await this.page!.$$('input:visible');
    
    // Price (first visible input)
    if (inputs[0]) {
      await inputs[0].fill(price);
      console.log(`✓ Price: ₹${price}`);
    }
    
    // Amount (second visible input)
    if (inputs[1]) {
      await inputs[1].fill('11.54');
      console.log('✓ Amount: 11.54 USDT');
    }
    
    // Min order
    if (inputs[2]) {
      await inputs[2].fill('500');
      console.log('✓ Min: ₹500');
    }
    
    // Max order
    if (inputs[3]) {
      await inputs[3].fill('11000');
      console.log('✓ Max: ₹11,000');
    }
    
    // Select UPI
    await this.page!.click('label:has-text("UPI")').catch(() => {
      this.page!.evaluate(() => {
        document.querySelectorAll('label').forEach(l => {
          if (l.textContent?.includes('UPI')) l.click();
        });
      });
    });
    console.log('✓ UPI selected');
  }

  private async getMarketPrice(): Promise<number> {
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

  async monitorAndTrade() {
    await this.init();
    await this.navigateToP2P();
    
    console.log('🔄 Starting continuous monitoring...\n');
    
    while (true) {
      try {
        // Check for good prices
        const marketPrice = await this.getMarketPrice();
        console.log(`[${new Date().toLocaleTimeString()}] Market: ₹${marketPrice}`);
        
        if (marketPrice >= 94.5) {
          console.log('✅ Good price! Creating ad...');
          await this.createAd();
          
          // Wait 5 minutes before next check
          await this.page!.waitForTimeout(300000);
        } else {
          // Check every 30 seconds
          await this.page!.waitForTimeout(30000);
        }
        
      } catch (error) {
        console.error('Error:', error);
        await this.page!.waitForTimeout(60000);
      }
    }
  }

  async readCurrentPage() {
    console.log('\n📄 Reading current page...');
    
    const url = this.page!.url();
    console.log(`URL: ${url}`);
    
    // Get all form inputs
    const formData = await this.page!.evaluate(() => {
      const inputs = Array.from(document.querySelectorAll('input, select, textarea'));
      return inputs.map(el => ({
        tag: el.tagName,
        type: (el as any).type,
        name: (el as any).name,
        placeholder: (el as any).placeholder,
        value: (el as any).value,
        visible: (el as any).offsetHeight > 0
      })).filter(e => e.visible);
    });
    
    console.log('\nForm fields found:');
    formData.forEach((field, i) => {
      console.log(`${i}: ${field.tag} [${field.type}] ${field.placeholder || field.name || 'unnamed'} = "${field.value}"`);
    });
    
    return formData;
  }

  async fillCurrentForm(values: any) {
    console.log('\n✏️ Filling form...');
    
    const visibleInputs = await this.page!.$$('input:visible');
    
    if (values.price && visibleInputs[0]) {
      await visibleInputs[0].fill(values.price);
    }
    if (values.amount && visibleInputs[1]) {
      await visibleInputs[1].fill(values.amount);
    }
    if (values.min && visibleInputs[2]) {
      await visibleInputs[2].fill(values.min);
    }
    if (values.max && visibleInputs[3]) {
      await visibleInputs[3].fill(values.max);
    }
    
    console.log('✅ Form filled');
  }
}

// Export for use in other scripts
export { AdvancedP2PBot };

// Run if called directly
if (require.main === module) {
  const bot = new AdvancedP2PBot();
  
  console.log(`
🤖 ADVANCED P2P BOT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Commands:
1. monitor - Start auto-trading
2. read - Read current page
3. fill - Fill current form
4. create - Create single ad

`);

  const command = process.argv[2] || 'create';
  
  (async () => {
    await bot.init();
    
    switch (command) {
      case 'monitor':
        await bot.monitorAndTrade();
        break;
      case 'read':
        await bot.readCurrentPage();
        break;
      case 'fill':
        await bot.fillCurrentForm({
          price: '94.73',
          amount: '11.54',
          min: '500',
          max: '11000'
        });
        break;
      case 'create':
      default:
        await bot.createAd();
    }
  })().catch(console.error);
}