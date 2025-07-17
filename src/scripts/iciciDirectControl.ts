import { chromium } from 'playwright';

async function controlICICIForm() {
  console.log('🎯 ICICI Form Direct Control\n');
  console.log('This will directly interact with your open Chrome tab.\n');
  
  try {
    // Launch a new browser that will find existing Chrome
    const browser = await chromium.launch({
      headless: false,
      channel: 'chrome',
    });
    
    // Get all pages
    const pages = await browser.pages();
    console.log(`Found ${pages.length} open tabs\n`);
    
    // Find ICICI page or use the active one
    let targetPage = null;
    for (const page of pages) {
      const url = page.url();
      const title = await page.title();
      console.log(`Tab: ${title.substring(0, 50)}...`);
      
      if (url.includes('icici') || title.toLowerCase().includes('icici')) {
        targetPage = page;
        console.log(`  ✅ This is the ICICI tab!\n`);
        break;
      }
    }
    
    if (!targetPage && pages.length > 0) {
      targetPage = pages[pages.length - 1];
      console.log('\nUsing the last active tab\n');
    }
    
    if (!targetPage) {
      throw new Error('No tabs found');
    }
    
    // Take screenshot to see what we're working with
    await targetPage.screenshot({ path: 'icici-form-current.png' });
    console.log('📸 Screenshot saved as icici-form-current.png\n');
    
    // Get all checkboxes on the page
    const checkboxes = await targetPage.$$('input[type="checkbox"]');
    console.log(`Found ${checkboxes.length} checkboxes on the page\n`);
    
    // Keywords to look for in the entire checkbox container
    const apiKeywords = [
      'upi', 'payment', 'imps', 'balance', 'inquiry', 'statement', 
      'webhook', 'notification', 'status', 'transfer', 'fund'
    ];
    
    console.log('Selecting checkboxes for payment APIs...\n');
    
    let selectedCount = 0;
    for (let i = 0; i < checkboxes.length; i++) {
      const checkbox = checkboxes[i];
      
      try {
        // Get the parent element to find associated text
        const parent = await checkbox.evaluateHandle(el => el.parentElement?.parentElement || el.parentElement);
        const text = await parent.evaluate(el => el.textContent || '');
        
        // Check if this checkbox is related to our APIs
        const isRelevant = apiKeywords.some(keyword => 
          text.toLowerCase().includes(keyword)
        );
        
        if (isRelevant) {
          const isChecked = await checkbox.isChecked();
          if (!isChecked) {
            await checkbox.click();
            selectedCount++;
            console.log(`✅ Selected checkbox ${i + 1}: ${text.substring(0, 50)}...`);
          }
        }
      } catch (e) {
        // Skip problematic checkboxes
      }
    }
    
    console.log(`\n✅ Selected ${selectedCount} checkboxes\n`);
    
    // Fill text areas
    console.log('Looking for description/use case fields...\n');
    
    const textareas = await targetPage.$$('textarea');
    console.log(`Found ${textareas.length} text areas\n`);
    
    const useCaseText = `Automated payment processing for online trading activities. Need to make time-sensitive payments to verified exchange merchants for investment opportunities. All recipients are KYC-verified Indian entities. Technical requirements include real-time UPI/IMPS payments, balance monitoring, and webhook notifications.`;
    
    for (let i = 0; i < textareas.length; i++) {
      const textarea = textareas[i];
      const currentValue = await textarea.inputValue();
      
      if (!currentValue || currentValue.length < 20) {
        await textarea.fill(useCaseText);
        console.log(`✅ Filled textarea ${i + 1}`);
      }
    }
    
    // Fill volume fields
    console.log('\nLooking for volume/transaction fields...\n');
    
    const inputs = await targetPage.$$('input[type="text"], input[type="number"]');
    
    const fieldMappings = [
      { keywords: ['monthly', 'volume'], value: '2000000' },
      { keywords: ['daily', 'transaction'], value: '50' },
      { keywords: ['average', 'amount'], value: '10000' },
      { keywords: ['expected', 'projected'], value: '5000000' }
    ];
    
    for (const input of inputs) {
      try {
        const placeholder = await input.getAttribute('placeholder') || '';
        const name = await input.getAttribute('name') || '';
        const label = await input.evaluate(el => {
          const id = el.id;
          if (id) {
            const label = document.querySelector(`label[for="${id}"]`);
            return label?.textContent || '';
          }
          return '';
        });
        
        const fieldText = (placeholder + name + label).toLowerCase();
        
        for (const mapping of fieldMappings) {
          if (mapping.keywords.some(k => fieldText.includes(k))) {
            const currentValue = await input.inputValue();
            if (!currentValue) {
              await input.fill(mapping.value);
              console.log(`✅ Filled ${mapping.keywords.join('/')} field`);
            }
          }
        }
      } catch (e) {
        // Skip problematic inputs
      }
    }
    
    console.log('\n🎉 Form filling complete!\n');
    console.log('Please review the form and:');
    console.log('1. Check all fields are correctly filled');
    console.log('2. Select any additional APIs if needed');
    console.log('3. Upload required documents');
    console.log('4. Submit the form\n');
    
    // Keep browser open
    console.log('Browser left open for you to complete submission.');
    
  } catch (error) {
    console.error('Error:', error.message);
    console.log('\nMake sure:');
    console.log('1. Chrome is running with the ICICI form open');
    console.log('2. You are on the API selection page');
    console.log('3. The form is fully loaded');
  }
}

controlICICIForm().catch(console.error);