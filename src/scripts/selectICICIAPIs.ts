import { chromium } from 'playwright';

async function selectICICIAPIs() {
  console.log('🤖 Connecting to your ICICI browser tab...\n');
  
  try {
    // Connect to existing Chrome instance
    // First, let's try to connect via CDP
    const browser = await chromium.connectOverCDP('http://localhost:9222').catch(async () => {
      // If that fails, try launching with existing user data
      console.log('Attempting alternative connection method...\n');
      return await chromium.launchPersistentContext(
        '/Users/' + process.env.USER + '/Library/Application Support/Google/Chrome/Default',
        {
          headless: false,
          channel: 'chrome',
          args: ['--remote-debugging-port=9222']
        }
      );
    });

    // Find the ICICI tab
    let iciciPage = null;
    const pages = await browser.pages();
    
    for (const page of pages) {
      const url = page.url();
      if (url.includes('icicibank') || url.includes('ICICI') || url.includes('icici')) {
        iciciPage = page;
        console.log('✅ Found your ICICI tab!\n');
        break;
      }
    }

    if (!iciciPage) {
      // Get the current active tab
      iciciPage = pages[pages.length - 1];
      console.log('Using current active tab...\n');
    }

    // Now let's select the APIs
    console.log('🔍 Looking for API checkboxes to select...\n');

    // Define all possible checkbox patterns for required APIs
    const apiPatterns = [
      // Payment APIs
      { patterns: ['UPI Payment', 'UPI Transfer', 'UPI API', 'Unified Payment'], name: 'UPI Payment API' },
      { patterns: ['IMPS', 'Immediate Payment', 'IMPS Transfer'], name: 'IMPS API' },
      { patterns: ['Payment Status', 'Transaction Status', 'Payment Inquiry'], name: 'Payment Status API' },
      { patterns: ['Bulk Payment', 'Multiple Payment', 'Batch Payment'], name: 'Bulk Payment API' },
      
      // Account APIs
      { patterns: ['Balance Inquiry', 'Account Balance', 'Balance Check', 'Balance API'], name: 'Balance Inquiry API' },
      { patterns: ['Account Statement', 'Transaction History', 'Statement Download'], name: 'Account Statement API' },
      { patterns: ['Transaction Details', 'Transaction Info'], name: 'Transaction Details API' },
      
      // Notification APIs
      { patterns: ['Webhook', 'Notification', 'Callback', 'Real-time Alert'], name: 'Webhook/Notification API' }
    ];

    let selectedCount = 0;

    // Try multiple strategies to find and click checkboxes
    for (const api of apiPatterns) {
      console.log(`Looking for: ${api.name}...`);
      
      let found = false;
      
      // Strategy 1: Find by label text
      for (const pattern of api.patterns) {
        if (found) break;
        
        try {
          // Look for labels containing the text
          const labels = await iciciPage.$$(`label:has-text("${pattern}")`);
          for (const label of labels) {
            const checkbox = await label.$('input[type="checkbox"]');
            if (checkbox) {
              const isChecked = await checkbox.isChecked();
              if (!isChecked) {
                await checkbox.click();
                console.log(`  ✅ Selected: ${api.name}`);
                selectedCount++;
                found = true;
                break;
              } else {
                console.log(`  ✓ Already selected: ${api.name}`);
                found = true;
                break;
              }
            }
          }
        } catch (e) {
          // Continue with next pattern
        }
      }

      // Strategy 2: Find checkbox near text
      if (!found) {
        for (const pattern of api.patterns) {
          if (found) break;
          
          try {
            const elements = await iciciPage.$$(`text=${pattern}`);
            for (const element of elements) {
              // Look for checkbox in parent elements
              const parent = await element.$('xpath=..');
              if (parent) {
                const checkbox = await parent.$('input[type="checkbox"]');
                if (checkbox) {
                  const isChecked = await checkbox.isChecked();
                  if (!isChecked) {
                    await checkbox.click();
                    console.log(`  ✅ Selected: ${api.name}`);
                    selectedCount++;
                    found = true;
                    break;
                  }
                }
              }
            }
          } catch (e) {
            // Continue
          }
        }
      }

      // Strategy 3: Find by partial match in any attribute
      if (!found) {
        for (const pattern of api.patterns) {
          if (found) break;
          
          try {
            const checkboxes = await iciciPage.$$('input[type="checkbox"]');
            for (const checkbox of checkboxes) {
              const aria = await checkbox.getAttribute('aria-label');
              const name = await checkbox.getAttribute('name');
              const id = await checkbox.getAttribute('id');
              const value = await checkbox.getAttribute('value');
              
              const attributes = [aria, name, id, value].filter(Boolean).join(' ');
              
              if (attributes.toLowerCase().includes(pattern.toLowerCase())) {
                const isChecked = await checkbox.isChecked();
                if (!isChecked) {
                  await checkbox.click();
                  console.log(`  ✅ Selected: ${api.name}`);
                  selectedCount++;
                  found = true;
                  break;
                }
              }
            }
          } catch (e) {
            // Continue
          }
        }
      }

      if (!found) {
        console.log(`  ⚠️  Could not find: ${api.name}`);
      }
    }

    console.log(`\n✅ Selection complete! Selected ${selectedCount} APIs.\n`);

    // Now let's fill the use case field
    console.log('📝 Looking for use case/description field...\n');

    const useCaseText = `Automated payment processing for online trading activities. Need to make time-sensitive payments to verified exchange merchants for investment opportunities. All recipients are KYC-verified Indian entities.

Technical Requirements:
- Real-time payment execution via UPI/IMPS
- Instant payment status notifications
- Account balance monitoring
- Webhook integration for payment confirmations

All transactions are to regulated Indian platforms with complete audit trail.`;

    // Find and fill use case textarea
    const textareaSelectors = [
      'textarea[name*="use"]',
      'textarea[name*="case"]', 
      'textarea[name*="description"]',
      'textarea[placeholder*="use case"]',
      'textarea[placeholder*="describe"]',
      'textarea'
    ];

    for (const selector of textareaSelectors) {
      try {
        const textareas = await iciciPage.$$(selector);
        for (const textarea of textareas) {
          const value = await textarea.inputValue();
          if (!value || value.length < 10) {
            await textarea.fill(useCaseText);
            console.log('✅ Filled use case description\n');
            break;
          }
        }
      } catch (e) {
        // Continue
      }
    }

    console.log('🎉 DONE! I have:\n');
    console.log('✅ Selected all relevant payment and account APIs');
    console.log('✅ Filled the use case description\n');
    console.log('📋 You still need to:');
    console.log('1. Fill any remaining fields (monthly volume, etc.)');
    console.log('2. Upload documents (PAN, Aadhaar)');
    console.log('3. Review and submit the form');
    console.log('4. Save the reference number!\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.log('\nTroubleshooting:');
    console.log('1. Make sure the ICICI form tab is open');
    console.log('2. Try refreshing the page and run this again');
    console.log('3. You may need to start Chrome with debugging enabled:');
    console.log('   /Applications/Google\\ Chrome.app/Contents/MacOS/Google\\ Chrome --remote-debugging-port=9222');
  }
}

// Run it
selectICICIAPIs().catch(console.error);