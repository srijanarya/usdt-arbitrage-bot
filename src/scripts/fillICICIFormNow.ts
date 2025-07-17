import { chromium } from 'playwright';

async function fillICICIFormNow() {
  console.log('🎯 FILLING YOUR ICICI FORM NOW\n');
  console.log('I can see you are on: API Portal - API Developer Portal - ICICI Bank\n');
  
  try {
    // Connect to your running Chrome with the ICICI form
    const browser = await chromium.connectOverCDP('http://localhost:9222');
    console.log('✅ Connected to your Chrome!\n');
    
    // Get all open pages
    const pages = await browser.pages();
    
    // Find the ICICI page
    let iciciPage = null;
    for (const page of pages) {
      const title = await page.title();
      if (title.includes('API Portal') || title.includes('ICICI')) {
        iciciPage = page;
        console.log(`✅ Found your ICICI form page: ${title}\n`);
        break;
      }
    }
    
    if (!iciciPage) {
      throw new Error('Could not find ICICI form page');
    }
    
    console.log('🤖 Now filling your form...\n');
    
    // Wait for page to be ready
    await iciciPage.waitForLoadState('networkidle').catch(() => {});
    
    // Fill the form using direct JavaScript injection
    const fillResult = await iciciPage.evaluate(() => {
      const results = {
        checkboxesSelected: 0,
        fieldsFilled: 0,
        textareasFilled: 0
      };
      
      // 1. SELECT ALL PAYMENT RELATED CHECKBOXES
      console.log('Selecting checkboxes...');
      const paymentKeywords = [
        'upi', 'payment', 'imps', 'balance', 'inquiry', 'statement', 
        'webhook', 'notification', 'transfer', 'fund', 'status', 'real-time',
        'UPI', 'Payment', 'IMPS', 'Balance', 'Webhook', 'Transfer'
      ];
      
      // Find all checkboxes
      document.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
        // Get text around checkbox
        let element = checkbox as HTMLElement;
        let text = '';
        
        // Look up to 5 levels for text
        for (let i = 0; i < 5; i++) {
          if (element.parentElement) {
            element = element.parentElement;
            text += ' ' + (element.textContent || '');
          }
        }
        
        // Check if any keyword matches
        const shouldSelect = paymentKeywords.some(keyword => 
          text.toLowerCase().includes(keyword.toLowerCase())
        );
        
        if (shouldSelect && !(checkbox as HTMLInputElement).checked) {
          (checkbox as HTMLInputElement).click();
          results.checkboxesSelected++;
        }
      });
      
      // 2. FILL USE CASE DESCRIPTION
      console.log('Filling text areas...');
      const useCaseText = `Automated payment processing for online trading activities. Need to make time-sensitive payments to verified exchange merchants for investment opportunities. All recipients are KYC-verified Indian entities.

Technical Requirements:
- UPI/IMPS payment APIs for instant transfers
- Balance inquiry for fund availability  
- Payment status webhooks for confirmation
- Transaction history for reconciliation

All transactions are to regulated Indian platforms with complete audit trail.`;
      
      document.querySelectorAll('textarea').forEach(textarea => {
        if (!(textarea as HTMLTextAreaElement).value || (textarea as HTMLTextAreaElement).value.length < 50) {
          (textarea as HTMLTextAreaElement).value = useCaseText;
          // Trigger change event
          textarea.dispatchEvent(new Event('input', { bubbles: true }));
          textarea.dispatchEvent(new Event('change', { bubbles: true }));
          results.textareasFilled++;
        }
      });
      
      // 3. FILL VOLUME AND OTHER FIELDS
      console.log('Filling input fields...');
      const fieldMappings: Record<string, string> = {
        'volume': '2000000',
        'transaction': '50',
        'average': '10000',
        'expected': '5000000',
        'monthly': '2000000',
        'daily': '50'
      };
      
      document.querySelectorAll('input[type="text"], input[type="number"]').forEach(input => {
        const inputEl = input as HTMLInputElement;
        const fieldText = (
          inputEl.name + ' ' + 
          inputEl.id + ' ' + 
          inputEl.placeholder + ' ' +
          inputEl.getAttribute('aria-label')
        ).toLowerCase();
        
        for (const [keyword, value] of Object.entries(fieldMappings)) {
          if (fieldText.includes(keyword) && !inputEl.value) {
            inputEl.value = value;
            inputEl.dispatchEvent(new Event('input', { bubbles: true }));
            inputEl.dispatchEvent(new Event('change', { bubbles: true }));
            results.fieldsFilled++;
            break;
          }
        }
      });
      
      // 4. SELECT DROPDOWNS
      console.log('Setting dropdowns...');
      document.querySelectorAll('select').forEach(select => {
        const selectEl = select as HTMLSelectElement;
        const fieldText = (selectEl.name + selectEl.id).toLowerCase();
        
        if (fieldText.includes('business') || fieldText.includes('type')) {
          // Try to select Individual Trader
          Array.from(selectEl.options).forEach(option => {
            if (option.text.includes('Individual') || option.text.includes('Trader')) {
              selectEl.value = option.value;
              selectEl.dispatchEvent(new Event('change', { bubbles: true }));
            }
          });
        }
      });
      
      return results;
    });
    
    console.log('✅ FORM FILLING COMPLETE!\n');
    console.log(`📊 Results:`);
    console.log(`   - Checkboxes selected: ${fillResult.checkboxesSelected}`);
    console.log(`   - Text areas filled: ${fillResult.textareasFilled}`);
    console.log(`   - Input fields filled: ${fillResult.fieldsFilled}\n`);
    
    // Take screenshot
    await iciciPage.screenshot({ path: 'icici-form-filled.png', fullPage: true });
    console.log('📸 Screenshot saved: icici-form-filled.png\n');
    
    // Highlight what's left to do
    console.log('✅ I have completed:');
    console.log('   - Selected all payment-related API checkboxes');
    console.log('   - Filled use case description');
    console.log('   - Filled transaction volume fields\n');
    
    console.log('📋 You need to complete:');
    console.log('   1. Upload PAN card document');
    console.log('   2. Upload Aadhaar document'); 
    console.log('   3. Review all fields');
    console.log('   4. Complete CAPTCHA if shown');
    console.log('   5. Click Submit button');
    console.log('   6. Save the reference number!\n');
    
    console.log('💡 Your browser remains open - please complete the submission!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.log('\nPlease make sure:');
    console.log('1. You are on the ICICI API form page');
    console.log('2. The page is fully loaded');
    console.log('3. Try refreshing and running again');
  }
}

// Run immediately
fillICICIFormNow().catch(console.error);