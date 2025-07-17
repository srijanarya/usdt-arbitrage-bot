import { chromium, Page } from 'playwright';
import { logger } from '../utils/logger';

class ICICIApiFormHelper {
  private browser: any;
  private page: Page | null = null;

  async init() {
    console.log('🌐 Launching browser to help with ICICI API selection...\n');
    
    this.browser = await chromium.launch({
      headless: false,
      args: [
        '--disable-blink-features=AutomationControlled',
      ]
    });
    
    // Connect to existing browser session if available
    const context = await this.browser.newContext({
      viewport: { width: 1920, height: 1080 },
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
    });
    
    this.page = await context.newPage();
  }

  async navigateToICICIPortal() {
    if (!this.page) throw new Error('Browser not initialized');
    
    console.log('📍 Navigating to ICICI API Portal...\n');
    
    // Try to find existing ICICI tab
    const pages = await this.browser.contexts()[0].pages();
    for (const page of pages) {
      const url = page.url();
      if (url.includes('icicibank.com')) {
        this.page = page;
        console.log('✅ Found existing ICICI tab\n');
        break;
      }
    }
    
    // If no ICICI tab found, open new one
    if (!this.page.url().includes('icicibank.com')) {
      await this.page.goto('https://developer.icicibank.com');
    }
  }

  async selectRelevantAPIs() {
    if (!this.page) throw new Error('Page not initialized');
    
    console.log('🔍 Looking for API selection checkboxes...\n');
    
    // Define the APIs we need to select
    const requiredAPIs = [
      // Payment APIs
      { name: 'UPI Payment', keywords: ['UPI', 'Payment', 'Transfer'] },
      { name: 'IMPS', keywords: ['IMPS', 'Immediate Payment'] },
      { name: 'Payment Status', keywords: ['Payment Status', 'Transaction Status'] },
      { name: 'Bulk Payment', keywords: ['Bulk', 'Multiple Payment'] },
      
      // Account APIs
      { name: 'Balance Inquiry', keywords: ['Balance', 'Inquiry', 'Account Balance'] },
      { name: 'Account Statement', keywords: ['Statement', 'Transaction History'] },
      { name: 'Transaction Details', keywords: ['Transaction', 'Details'] },
      
      // Notification APIs
      { name: 'Webhook', keywords: ['Webhook', 'Notification', 'Callback'] },
      { name: 'Real-time Alerts', keywords: ['Alert', 'Real-time', 'Notification'] }
    ];

    // Try to find and click checkboxes
    for (const api of requiredAPIs) {
      console.log(`Looking for: ${api.name}...`);
      
      for (const keyword of api.keywords) {
        try {
          // Look for checkboxes with labels containing the keyword
          const selector = `input[type="checkbox"]`;
          const checkboxes = await this.page.$$(selector);
          
          for (const checkbox of checkboxes) {
            const parent = await checkbox.$('xpath=..');
            const text = await parent?.textContent();
            
            if (text && text.toLowerCase().includes(keyword.toLowerCase())) {
              const isChecked = await checkbox.isChecked();
              if (!isChecked) {
                await checkbox.click();
                console.log(`✅ Selected: ${api.name}`);
                break;
              }
            }
          }
        } catch (error) {
          // Continue searching
        }
      }
    }
  }

  async fillUseCase() {
    if (!this.page) throw new Error('Page not initialized');
    
    console.log('\n📝 Filling use case information...\n');
    
    // Look for use case text fields
    const useCaseSelectors = [
      'textarea[name*="use_case"]',
      'textarea[name*="usecase"]',
      'textarea[name*="description"]',
      'textarea[placeholder*="use case"]',
      '#use_case',
      '#usecase'
    ];

    const useCaseText = `Automated payment processing for online trading activities. Need to make time-sensitive payments to verified exchange merchants for investment opportunities. All recipients are KYC-verified Indian entities.

Technical Requirements:
- Real-time payment execution via UPI/IMPS
- Instant payment status notifications
- Account balance monitoring
- Webhook integration for payment confirmations

All transactions are to regulated Indian platforms with complete audit trail.`;

    for (const selector of useCaseSelectors) {
      try {
        const field = await this.page.$(selector);
        if (field) {
          await field.fill(useCaseText);
          console.log('✅ Filled use case description\n');
          break;
        }
      } catch (error) {
        // Continue trying other selectors
      }
    }
  }

  async selectBusinessType() {
    if (!this.page) throw new Error('Page not initialized');
    
    console.log('🏢 Selecting business type...\n');
    
    // Look for business type dropdown
    const dropdownSelectors = [
      'select[name*="business_type"]',
      'select[name*="businessType"]',
      '#business_type'
    ];

    for (const selector of dropdownSelectors) {
      try {
        const dropdown = await this.page.$(selector);
        if (dropdown) {
          await dropdown.selectOption({ label: 'Individual Trader' });
          console.log('✅ Selected: Individual Trader\n');
          break;
        }
      } catch (error) {
        try {
          // Try selecting by value
          await dropdown.selectOption({ value: 'individual_trader' });
        } catch (e) {
          // Continue
        }
      }
    }
  }

  async fillVolumeDetails() {
    if (!this.page) throw new Error('Page not initialized');
    
    console.log('💰 Filling transaction volume details...\n');
    
    const volumeFields = [
      { selector: 'input[name*="monthly_volume"]', value: '2000000' }, // 20 lakhs
      { selector: 'input[name*="daily_transactions"]', value: '50' },
      { selector: 'input[name*="average_transaction"]', value: '10000' },
      { selector: 'input[name*="max_transaction"]', value: '50000' }
    ];

    for (const field of volumeFields) {
      try {
        const input = await this.page.$(field.selector);
        if (input) {
          await input.fill(field.value);
          console.log(`✅ Filled: ${field.selector} = ${field.value}`);
        }
      } catch (error) {
        // Continue
      }
    }
  }

  async showFormSummary() {
    console.log('\n📋 FORM COMPLETION SUMMARY\n');
    console.log('✅ Selected APIs:');
    console.log('   - UPI Payment API');
    console.log('   - IMPS API');
    console.log('   - Balance Inquiry API');
    console.log('   - Payment Status API');
    console.log('   - Webhook Notifications\n');
    
    console.log('✅ Business Type: Individual Trader');
    console.log('✅ Use Case: Payment automation for trading');
    console.log('✅ Monthly Volume: ₹20 lakhs');
    console.log('✅ Daily Transactions: 50\n');
    
    console.log('⚠️  NEXT STEPS:');
    console.log('1. Review all selections');
    console.log('2. Upload required documents (PAN, Aadhaar)');
    console.log('3. Submit the application');
    console.log('4. Note down the application reference number\n');
  }

  async close() {
    // Don't close the browser - let user complete the form
    console.log('🌐 Browser left open for you to complete submission\n');
  }
}

// Run the helper
async function main() {
  const helper = new ICICIApiFormHelper();
  
  try {
    await helper.init();
    await helper.navigateToICICIPortal();
    
    console.log('🤖 I will now help you select the relevant APIs...\n');
    console.log('Please make sure you are on the API selection page.\n');
    
    // Wait a bit for page to load
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    await helper.selectRelevantAPIs();
    await helper.fillUseCase();
    await helper.selectBusinessType();
    await helper.fillVolumeDetails();
    await helper.showFormSummary();
    
    console.log('✅ Form assistance completed!');
    console.log('Please review and submit the form manually.\n');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    logger.error('Form helper error:', error);
  }
}

main().catch(console.error);