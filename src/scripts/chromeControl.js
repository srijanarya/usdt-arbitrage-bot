const CDP = require('chrome-remote-interface');
const axios = require('axios');
require('dotenv').config();

class ChromeController {
  constructor() {
    this.client = null;
    this.target = null;
  }

  async connect() {
    console.log('🔌 Connecting to Chrome...\n');
    
    try {
      // List all tabs
      const targets = await CDP.List();
      
      // Find Binance tab
      this.target = targets.find(t => t.url.includes('binance.com')) || targets[0];
      
      if (!this.target) {
        console.log('❌ No Chrome tabs found. Make sure Chrome is running.');
        return false;
      }
      
      console.log(`✅ Found tab: ${this.target.title}`);
      console.log(`   URL: ${this.target.url}\n`);
      
      // Connect to the tab
      this.client = await CDP({ target: this.target });
      const { Page, Runtime, DOM } = this.client;
      
      await Page.enable();
      await Runtime.enable();
      await DOM.enable();
      
      return true;
    } catch (error) {
      console.log('❌ Could not connect to Chrome');
      console.log('   Make sure Chrome is running with:');
      console.log('   /Applications/Google\\ Chrome.app/Contents/MacOS/Google\\ Chrome --remote-debugging-port=9222');
      return false;
    }
  }

  async readPage() {
    if (!this.client) return;
    
    const { Runtime } = this.client;
    
    console.log('📄 Reading page...\n');
    
    // Get current URL
    const urlResult = await Runtime.evaluate({ expression: 'window.location.href' });
    console.log(`URL: ${urlResult.result.value}\n`);
    
    // Read form inputs
    const formResult = await Runtime.evaluate({
      expression: `
        Array.from(document.querySelectorAll('input, select, textarea'))
          .filter(e => e.offsetHeight > 0)
          .map((e, i) => ({
            index: i,
            tag: e.tagName,
            type: e.type,
            name: e.name,
            placeholder: e.placeholder,
            value: e.value,
            id: e.id,
            className: e.className.substring(0, 50)
          }))
      `
    });
    
    const formData = JSON.parse(formResult.result.value);
    console.log('Form fields:');
    formData.forEach(field => {
      console.log(`[${field.index}] ${field.tag} ${field.type || ''} - ${field.placeholder || field.name || 'unnamed'} = "${field.value}"`);
    });
    
    return formData;
  }

  async fillForm(values) {
    if (!this.client) return;
    
    const { Runtime } = this.client;
    
    console.log('\n✏️ Filling form...');
    
    // Fill each field
    const fillScript = `
      const inputs = Array.from(document.querySelectorAll('input')).filter(e => e.offsetHeight > 0);
      
      // Price
      if (inputs[0]) {
        inputs[0].focus();
        inputs[0].value = '${values.price || '94.73'}';
        inputs[0].dispatchEvent(new Event('input', { bubbles: true }));
        inputs[0].dispatchEvent(new Event('change', { bubbles: true }));
      }
      
      // Amount
      setTimeout(() => {
        if (inputs[1]) {
          inputs[1].focus();
          inputs[1].value = '${values.amount || '11.54'}';
          inputs[1].dispatchEvent(new Event('input', { bubbles: true }));
        }
      }, 500);
      
      // Min
      setTimeout(() => {
        if (inputs[2]) {
          inputs[2].focus();
          inputs[2].value = '${values.min || '500'}';
          inputs[2].dispatchEvent(new Event('input', { bubbles: true }));
        }
      }, 1000);
      
      // Max
      setTimeout(() => {
        if (inputs[3]) {
          inputs[3].focus();
          inputs[3].value = '${values.max || '11000'}';
          inputs[3].dispatchEvent(new Event('input', { bubbles: true }));
        }
      }, 1500);
      
      // UPI
      setTimeout(() => {
        document.querySelectorAll('label').forEach(l => {
          if (l.textContent.includes('UPI')) l.click();
        });
      }, 2000);
      
      'Form filled';
    `;
    
    await Runtime.evaluate({ expression: fillScript });
    
    console.log('✅ Form filled with:');
    console.log(`   Price: ₹${values.price || '94.73'}`);
    console.log(`   Amount: ${values.amount || '11.54'} USDT`);
    console.log(`   Min: ₹${values.min || '500'}`);
    console.log(`   Max: ₹${values.max || '11000'}`);
  }

  async navigateTo(url) {
    if (!this.client) return;
    
    const { Page } = this.client;
    await Page.navigate({ url });
    console.log(`📍 Navigated to: ${url}`);
  }

  async clickButton(text) {
    if (!this.client) return;
    
    const { Runtime } = this.client;
    
    const clickScript = `
      const buttons = Array.from(document.querySelectorAll('button'));
      const btn = buttons.find(b => b.textContent.includes('${text}'));
      if (btn) {
        btn.click();
        'Clicked: ${text}';
      } else {
        'Button not found: ${text}';
      }
    `;
    
    const result = await Runtime.evaluate({ expression: clickScript });
    console.log(result.result.value);
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
      return parseFloat(response.data.data[0]?.adv?.price || '94.5');
    } catch {
      return 94.5;
    }
  }

  async disconnect() {
    if (this.client) {
      await this.client.close();
    }
  }
}

// Main execution
async function main() {
  const controller = new ChromeController();
  
  console.log(`
🎮 CHROME DIRECT CONTROL
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

This tool directly controls your existing Chrome.
Make sure Chrome is running with debugging enabled.

`);

  const connected = await controller.connect();
  if (!connected) {
    process.exit(1);
  }

  const command = process.argv[2] || 'read';

  switch (command) {
    case 'read':
      await controller.readPage();
      break;
      
    case 'fill':
      const marketPrice = await controller.getCurrentPrice();
      const ourPrice = (marketPrice - 0.05).toFixed(2);
      
      console.log(`Market price: ₹${marketPrice}`);
      console.log(`Our price: ₹${ourPrice}`);
      
      await controller.fillForm({
        price: ourPrice,
        amount: '11.54',
        min: '500',
        max: '11000'
      });
      break;
      
    case 'post':
      await controller.navigateTo('https://p2p.binance.com/en/myads');
      setTimeout(async () => {
        await controller.clickButton('Post new Ad');
      }, 3000);
      break;
      
    case 'nav':
      const url = process.argv[3] || 'https://p2p.binance.com';
      await controller.navigateTo(url);
      break;
      
    default:
      console.log('Commands: read, fill, post, nav <url>');
  }

  await controller.disconnect();
}

// Check if Chrome needs to be restarted
console.log('First, let me check if Chrome is ready for remote control...\n');

CDP.List((err, targets) => {
  if (err) {
    console.log('❌ Chrome is not set up for remote control.');
    console.log('\nTo enable it:');
    console.log('1. Close Chrome completely');
    console.log('2. Run this command:\n');
    console.log('   /Applications/Google\\ Chrome.app/Contents/MacOS/Google\\ Chrome --remote-debugging-port=9222\n');
    console.log('3. Then run this script again');
  } else {
    console.log('✅ Chrome is ready!\n');
    main().catch(console.error);
  }
});