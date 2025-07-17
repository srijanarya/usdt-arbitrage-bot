import { chromium } from 'playwright';
import { execSync } from 'child_process';
import * as fs from 'fs';

class ICICIFormAutomation {
  private browser: any = null;
  private page: any = null;

  async setupBrowserConnection() {
    console.log('🔧 Setting up browser connection...\n');
    
    // Method 1: Try connecting to existing Chrome with debugging
    try {
      // First, check if Chrome is running with debugging
      try {
        execSync('lsof -i :9222', { stdio: 'ignore' });
        console.log('✅ Found Chrome with debugging on port 9222');
        
        this.browser = await chromium.connectOverCDP('http://localhost:9222');
        return true;
      } catch (e) {
        console.log('❌ Chrome not running with debugging');
      }
      
      // Method 2: Launch Chrome with your profile
      console.log('🚀 Launching Chrome with your profile...\n');
      
      const userDataDir = `/Users/${process.env.USER}/Library/Application Support/Google/Chrome`;
      
      this.browser = await chromium.launchPersistentContext(userDataDir, {
        headless: false,
        channel: 'chrome',
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage'
        ]
      });
      
      return true;
    } catch (error) {
      console.log('⚠️  Could not use existing Chrome profile');
      
      // Method 3: Launch new Chrome instance
      console.log('🚀 Launching new Chrome instance...\n');
      this.browser = await chromium.launch({
        headless: false,
        args: ['--no-sandbox']
      });
      
      return true;
    }
  }

  async findICICITab() {
    console.log('🔍 Looking for ICICI tab...\n');
    
    const pages = await this.browser.pages();
    
    for (const page of pages) {
      const url = page.url();
      const title = await page.title().catch(() => '');
      
      if (url.includes('icici') || title.toLowerCase().includes('icici') || 
          url.includes('bank') || title.toLowerCase().includes('api')) {
        this.page = page;
        console.log(`✅ Found ICICI page: ${title}\n`);
        return true;
      }
    }
    
    // If no ICICI tab found, ask user to navigate
    if (pages.length > 0) {
      this.page = pages[0];
      console.log('⚠️  No ICICI tab found. Please navigate to the ICICI API form.\n');
      console.log('Waiting for you to open ICICI API form...\n');
      
      // Wait for navigation to ICICI
      await this.page.waitForURL(/icici|bank/i, { timeout: 60000 });
      console.log('✅ ICICI page detected!\n');
      return true;
    }
    
    return false;
  }

  async fillForm() {
    console.log('📝 Starting automated form filling...\n');
    
    // Take screenshot for reference
    await this.page.screenshot({ path: 'icici-form-before.png', fullPage: true });
    
    // Step 1: Select all payment-related checkboxes
    console.log('1️⃣ Selecting API checkboxes...\n');
    
    const checkboxPatterns = [
      // Direct patterns
      'UPI', 'Payment', 'IMPS', 'Balance', 'Statement', 'Webhook', 'Notification',
      'Fund Transfer', 'Transaction', 'Real-time', 'Status', 'Inquiry',
      // Variations
      'upi', 'payment', 'imps', 'balance', 'webhook', 'transfer'
    ];
    
    // Get all checkboxes
    const checkboxes = await this.page.$$('input[type="checkbox"]');
    console.log(`Found ${checkboxes.length} checkboxes\n`);
    
    let selectedCount = 0;
    for (const checkbox of checkboxes) {
      try {
        // Get surrounding text
        const text = await this.page.evaluate((cb: HTMLInputElement) => {
          // Look for text in parent elements
          let parent = cb.parentElement;
          let depth = 0;
          while (parent && depth < 5) {
            if (parent.textContent) {
              return parent.textContent;
            }
            parent = parent.parentElement;
            depth++;
          }
          return '';
        }, checkbox);
        
        // Check if this checkbox matches our patterns
        const shouldSelect = checkboxPatterns.some(pattern => 
          text.toLowerCase().includes(pattern.toLowerCase())
        );
        
        if (shouldSelect) {
          const isChecked = await checkbox.isChecked();
          if (!isChecked) {
            await checkbox.click();
            await this.page.waitForTimeout(100); // Small delay between clicks
            selectedCount++;
            console.log(`  ✅ Selected: ${text.substring(0, 50)}...`);
          }
        }
      } catch (e) {
        // Skip problematic checkboxes
      }
    }
    
    console.log(`\n✅ Selected ${selectedCount} checkboxes\n`);
    
    // Step 2: Fill use case description
    console.log('2️⃣ Filling use case description...\n');
    
    const useCaseText = `Automated payment processing for online trading activities. Need to make time-sensitive payments to verified exchange merchants for investment opportunities. All recipients are KYC-verified Indian entities.

Technical Requirements:
- UPI/IMPS payment APIs for instant transfers
- Balance inquiry for fund availability
- Payment status webhooks for confirmation
- Transaction history for reconciliation

All transactions are to regulated Indian platforms with complete audit trail.`;
    
    // Find and fill all textareas
    const textareas = await this.page.$$('textarea');
    for (const textarea of textareas) {
      const value = await textarea.inputValue();
      if (!value || value.length < 50) {
        await textarea.fill(useCaseText);
        console.log('  ✅ Filled use case textarea\n');
        break;
      }
    }
    
    // Step 3: Fill volume and other fields
    console.log('3️⃣ Filling transaction volume fields...\n');
    
    const fieldValues = {
      'monthly.*volume': '2000000',
      'daily.*transaction': '50',
      'average.*transaction': '10000',
      'expected.*volume': '5000000',
      'max.*transaction': '50000',
      'min.*transaction': '1000'
    };
    
    const inputs = await this.page.$$('input[type="text"], input[type="number"]');
    
    for (const input of inputs) {
      try {
        const attributes = await this.page.evaluate((el: HTMLInputElement) => ({
          name: el.name || '',
          id: el.id || '',
          placeholder: el.placeholder || '',
          label: document.querySelector(`label[for="${el.id}"]`)?.textContent || ''
        }), input);
        
        const fieldText = Object.values(attributes).join(' ').toLowerCase();
        
        for (const [pattern, value] of Object.entries(fieldValues)) {
          if (new RegExp(pattern).test(fieldText)) {
            const currentValue = await input.inputValue();
            if (!currentValue) {
              await input.fill(value);
              console.log(`  ✅ Filled ${pattern} field: ${value}`);
            }
          }
        }
      } catch (e) {
        // Skip
      }
    }
    
    // Step 4: Select dropdowns
    console.log('\n4️⃣ Selecting dropdown options...\n');
    
    const dropdowns = await this.page.$$('select');
    for (const dropdown of dropdowns) {
      try {
        const name = await dropdown.getAttribute('name') || '';
        const id = await dropdown.getAttribute('id') || '';
        
        if ((name + id).toLowerCase().includes('business')) {
          await dropdown.selectOption({ label: 'Individual Trader' });
          console.log('  ✅ Selected: Individual Trader');
        } else if ((name + id).toLowerCase().includes('industry')) {
          await dropdown.selectOption({ label: 'Financial Services' });
          console.log('  ✅ Selected: Financial Services');
        }
      } catch (e) {
        // Skip
      }
    }
    
    // Take final screenshot
    await this.page.screenshot({ path: 'icici-form-after.png', fullPage: true });
    console.log('\n📸 Screenshots saved: icici-form-before.png and icici-form-after.png\n');
  }

  async completeWorkflow() {
    try {
      // Step 1: Connect to browser
      await this.setupBrowserConnection();
      
      // Step 2: Find ICICI tab
      const found = await this.findICICITab();
      if (!found) {
        throw new Error('Could not find ICICI tab');
      }
      
      // Step 3: Fill the form
      await this.fillForm();
      
      console.log('✅ FORM FILLING COMPLETE!\n');
      console.log('📋 Final steps for you:');
      console.log('1. Review all filled fields');
      console.log('2. Upload documents (PAN, Aadhaar)');
      console.log('3. Complete any CAPTCHA');
      console.log('4. Click Submit');
      console.log('5. Save the reference number\n');
      
      console.log('💡 The browser will remain open for you to complete submission.\n');
      
    } catch (error) {
      console.error('❌ Error:', error.message);
      console.log('\nTroubleshooting:');
      console.log('1. Make sure Chrome is open');
      console.log('2. Navigate to ICICI API application form');
      console.log('3. Run this script again');
    }
  }
}

// Create workflow that handles everything
async function runCompleteWorkflow() {
  console.log('🤖 ICICI FORM COMPLETE AUTOMATION WORKFLOW\n');
  console.log('This will:');
  console.log('1. Connect to your Chrome browser');
  console.log('2. Find the ICICI form');
  console.log('3. Select all relevant APIs');
  console.log('4. Fill all required fields\n');
  
  const automation = new ICICIFormAutomation();
  await automation.completeWorkflow();
}

// Add instruction for running Chrome with debugging if needed
console.log('💡 TIP: For best results, start Chrome with debugging enabled:\n');
console.log('1. Close all Chrome windows');
console.log('2. Run this command:');
console.log('   /Applications/Google\\ Chrome.app/Contents/MacOS/Google\\ Chrome --remote-debugging-port=9222\n');
console.log('3. Navigate to ICICI API form');
console.log('4. Run this script\n');

console.log('Starting automation in 3 seconds...\n');

setTimeout(() => {
  runCompleteWorkflow().catch(console.error);
}, 3000);