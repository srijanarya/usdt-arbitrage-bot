import { chromium, Page } from 'playwright';
import readline from 'readline';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

class ICICIFormInteractive {
  private page: Page | null = null;
  
  async connectToExistingBrowser() {
    console.log('🔍 Looking for your open Chrome tab with ICICI form...\n');
    
    try {
      // Connect to existing Chrome instance
      const browser = await chromium.connectOverCDP('http://localhost:9222');
      const contexts = browser.contexts();
      
      // Find ICICI tab
      for (const context of contexts) {
        const pages = context.pages();
        for (const page of pages) {
          const url = page.url();
          if (url.includes('icicibank')) {
            this.page = page;
            console.log('✅ Found ICICI tab: ' + url);
            return true;
          }
        }
      }
    } catch (error) {
      console.log('⚠️  Could not connect to existing browser');
      console.log('Starting new browser instance...\n');
      
      // Launch new browser
      const browser = await chromium.launch({ 
        headless: false,
        args: ['--remote-debugging-port=9222']
      });
      this.page = await browser.newPage();
    }
    
    return false;
  }
  
  async analyzeForm() {
    if (!this.page) return;
    
    console.log('\n📋 Analyzing form fields on the page...\n');
    
    // Find all input fields
    const inputs = await this.page.$$eval('input, textarea, select', elements => 
      elements.map(el => ({
        type: el.tagName,
        name: el.getAttribute('name') || '',
        id: el.getAttribute('id') || '',
        placeholder: el.getAttribute('placeholder') || '',
        value: (el as HTMLInputElement).value || '',
        label: el.getAttribute('aria-label') || ''
      }))
    );
    
    console.log(`Found ${inputs.length} form fields\n`);
    
    // Group by filled/unfilled
    const filled = inputs.filter(i => i.value);
    const unfilled = inputs.filter(i => !i.value);
    
    console.log(`✅ Filled fields: ${filled.length}`);
    console.log(`❌ Empty fields: ${unfilled.length}\n`);
    
    return { filled, unfilled, all: inputs };
  }
  
  async fillField(selector: string, value: string) {
    if (!this.page) return;
    
    try {
      await this.page.fill(selector, value);
      console.log(`✅ Filled: ${selector}`);
      return true;
    } catch (error) {
      console.log(`❌ Could not fill: ${selector}`);
      return false;
    }
  }
  
  async selectDropdown(selector: string, value: string) {
    if (!this.page) return;
    
    try {
      await this.page.selectOption(selector, value);
      console.log(`✅ Selected: ${value} in ${selector}`);
      return true;
    } catch (error) {
      console.log(`❌ Could not select: ${selector}`);
      return false;
    }
  }
  
  async clickCheckbox(labelText: string) {
    if (!this.page) return;
    
    try {
      // Try multiple strategies
      const strategies = [
        // By label text
        async () => {
          const label = await this.page!.$(`label:has-text("${labelText}")`);
          if (label) {
            await label.click();
            return true;
          }
          return false;
        },
        // By aria-label
        async () => {
          const checkbox = await this.page!.$(`input[aria-label*="${labelText}"]`);
          if (checkbox) {
            await checkbox.click();
            return true;
          }
          return false;
        },
        // By nearby text
        async () => {
          const element = await this.page!.$(`text="${labelText}"`);
          if (element) {
            const checkbox = await element.$('xpath=preceding-sibling::input[@type="checkbox"][1] | following-sibling::input[@type="checkbox"][1]');
            if (checkbox) {
              await checkbox.click();
              return true;
            }
          }
          return false;
        }
      ];
      
      for (const strategy of strategies) {
        if (await strategy()) {
          console.log(`✅ Checked: ${labelText}`);
          return true;
        }
      }
      
      console.log(`❌ Could not find checkbox: ${labelText}`);
      return false;
    } catch (error) {
      console.log(`❌ Error clicking checkbox: ${labelText}`);
      return false;
    }
  }
  
  async interactiveFill() {
    console.log('\n🎯 INTERACTIVE FORM FILLING\n');
    console.log('I will help you fill the remaining fields.\n');
    
    // Business Type
    console.log('1️⃣ BUSINESS TYPE');
    console.log('Looking for business type dropdown...');
    const bizTypeSelectors = ['select[name*="business"]', 'select[name*="type"]', '#businessType', '#business_type'];
    for (const selector of bizTypeSelectors) {
      if (await this.page!.$(selector)) {
        await this.selectDropdown(selector, 'Individual Trader');
        break;
      }
    }
    
    // Use Case
    console.log('\n2️⃣ USE CASE / DESCRIPTION');
    const useCase = `Automated payment processing for online trading activities. Need to make time-sensitive payments to verified exchange merchants for investment opportunities. All recipients are KYC-verified Indian entities.`;
    
    const useCaseSelectors = ['textarea[name*="use"]', 'textarea[name*="case"]', 'textarea[name*="description"]', '#useCase', '#use_case'];
    for (const selector of useCaseSelectors) {
      if (await this.page!.$(selector)) {
        await this.fillField(selector, useCase);
        break;
      }
    }
    
    // APIs to select
    console.log('\n3️⃣ API SELECTION');
    const apisToSelect = [
      'UPI Payment',
      'UPI',
      'IMPS',
      'Payment Status',
      'Balance Inquiry',
      'Balance',
      'Account Statement',
      'Webhook',
      'Notification',
      'Real-time'
    ];
    
    for (const api of apisToSelect) {
      await this.clickCheckbox(api);
    }
    
    // Volume fields
    console.log('\n4️⃣ TRANSACTION VOLUME');
    const volumeFields = [
      { keywords: ['monthly', 'volume'], value: '2000000' },
      { keywords: ['daily', 'transaction'], value: '50' },
      { keywords: ['average', 'transaction'], value: '10000' },
      { keywords: ['expected', 'volume'], value: '5000000' }
    ];
    
    for (const field of volumeFields) {
      const selector = await this.findFieldByKeywords(field.keywords);
      if (selector) {
        await this.fillField(selector, field.value);
      }
    }
  }
  
  async findFieldByKeywords(keywords: string[]): Promise<string | null> {
    if (!this.page) return null;
    
    for (const keyword of keywords) {
      const selectors = [
        `input[name*="${keyword}"]`,
        `input[id*="${keyword}"]`,
        `input[placeholder*="${keyword}"]`
      ];
      
      for (const selector of selectors) {
        if (await this.page.$(selector)) {
          return selector;
        }
      }
    }
    
    return null;
  }
  
  async showCurrentStatus() {
    console.log('\n📊 CURRENT FORM STATUS\n');
    
    const formData = await this.analyzeForm();
    if (!formData) return;
    
    console.log('Filled fields:');
    formData.filled.forEach(field => {
      if (field.name || field.id) {
        console.log(`  ✅ ${field.name || field.id}: ${field.value.substring(0, 30)}...`);
      }
    });
    
    console.log('\nEmpty fields that might need filling:');
    formData.unfilled.forEach(field => {
      if (field.name || field.id || field.placeholder) {
        console.log(`  ❌ ${field.name || field.id || field.placeholder}`);
      }
    });
  }
}

async function main() {
  const helper = new ICICIFormInteractive();
  
  console.log('🏦 ICICI API FORM HELPER - INTERACTIVE MODE\n');
  
  const connected = await helper.connectToExistingBrowser();
  
  if (connected) {
    console.log('\n✅ Connected to your existing ICICI form tab!');
    console.log('I can see you already filled the account number.\n');
    
    await helper.showCurrentStatus();
    
    console.log('\n🤖 Now I will try to fill the remaining fields...\n');
    await helper.interactiveFill();
    
    console.log('\n✅ FORM FILLING ATTEMPTED!');
    console.log('\nPlease check the form and:');
    console.log('1. Verify all fields are correctly filled');
    console.log('2. Upload required documents (PAN, Aadhaar)');
    console.log('3. Complete any CAPTCHA if present');
    console.log('4. Submit the form');
    console.log('5. Save the reference number!\n');
  } else {
    console.log('❌ Could not find ICICI tab.');
    console.log('\nTo use this helper:');
    console.log('1. Make sure Chrome is open with ICICI form');
    console.log('2. You may need to start Chrome with: --remote-debugging-port=9222');
  }
  
  rl.close();
}

main().catch(console.error);