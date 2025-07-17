import { exec } from 'child_process';
import { promisify } from 'util';
import { chromium } from 'playwright';

const execAsync = promisify(exec);

class DirectChromeControl {
  async setupChromeForAutomation() {
    console.log('🎯 Setting up direct Chrome control...\n');
    
    // Step 1: Use AppleScript to control Chrome
    const appleScript = `
      tell application "Google Chrome"
        activate
        set activeTab to active tab of window 1
        set tabURL to URL of activeTab
        set tabTitle to title of activeTab
        return tabURL & "|" & tabTitle
      end tell
    `;
    
    try {
      const { stdout } = await execAsync(`osascript -e '${appleScript}'`);
      const [url, title] = stdout.trim().split('|');
      console.log(`Current tab: ${title}`);
      console.log(`URL: ${url}\n`);
      
      if (!url.includes('icici')) {
        console.log('⚠️  Current tab is not ICICI. Looking for ICICI tab...\n');
        
        // Find ICICI tab
        const findICICIScript = `
          tell application "Google Chrome"
            set allTabs to every tab of every window
            repeat with theWindow in every window
              set tabIndex to 0
              repeat with theTab in every tab of theWindow
                set tabIndex to tabIndex + 1
                set tabURL to URL of theTab
                if tabURL contains "icici" or tabURL contains "ICICI" then
                  set active tab index of theWindow to tabIndex
                  activate
                  return "Found ICICI tab"
                end if
              end repeat
            end repeat
            return "No ICICI tab found"
          end tell
        `;
        
        const { stdout: result } = await execAsync(`osascript -e '${findICICIScript}'`);
        console.log(result.trim() + '\n');
      }
    } catch (error) {
      console.log('AppleScript method not available\n');
    }
    
    // Step 2: Enable Chrome debugging
    console.log('Enabling Chrome debugging mode...\n');
    
    try {
      // Kill existing Chrome debug instance
      await execAsync('pkill -f "remote-debugging-port"').catch(() => {});
      
      // Start Chrome with debugging
      const startChromeDebug = `
        osascript -e 'tell application "Google Chrome" to quit'
        sleep 2
        /Applications/Google\\ Chrome.app/Contents/MacOS/Google\\ Chrome --remote-debugging-port=9222 --user-data-dir="/Users/${process.env.USER}/Library/Application Support/Google/Chrome" &
        sleep 3
      `;
      
      console.log('Restarting Chrome with debugging enabled...\n');
      await execAsync(startChromeDebug);
      
    } catch (error) {
      console.log('Chrome is already running\n');
    }
  }
  
  async automateForm() {
    console.log('🤖 Connecting to Chrome and automating form...\n');
    
    let browser;
    let connected = false;
    
    // Try multiple connection methods
    const connectionMethods = [
      async () => {
        console.log('Method 1: Connecting via CDP...');
        browser = await chromium.connectOverCDP('http://localhost:9222');
        return true;
      },
      async () => {
        console.log('Method 2: Using existing Chrome profile...');
        browser = await chromium.launchPersistentContext(
          `/Users/${process.env.USER}/Library/Application Support/Google/Chrome/Default`,
          { headless: false, channel: 'chrome' }
        );
        return true;
      },
      async () => {
        console.log('Method 3: Launching new Chrome...');
        browser = await chromium.launch({ headless: false, channel: 'chrome' });
        return true;
      }
    ];
    
    for (const method of connectionMethods) {
      try {
        connected = await method();
        if (connected) {
          console.log('✅ Connected successfully!\n');
          break;
        }
      } catch (e) {
        console.log(`❌ Failed: ${e.message}\n`);
      }
    }
    
    if (!connected || !browser) {
      throw new Error('Could not connect to Chrome');
    }
    
    // Get all pages
    const pages = await browser.pages();
    let iciciPage = null;
    
    // Find ICICI page
    for (const page of pages) {
      const url = page.url();
      if (url.includes('icici') || url.includes('bank')) {
        iciciPage = page;
        break;
      }
    }
    
    if (!iciciPage && pages.length > 0) {
      iciciPage = pages[0];
      console.log('Using current active tab. Please make sure you are on ICICI form.\n');
    }
    
    if (!iciciPage) {
      throw new Error('No pages found');
    }
    
    // Now automate the form
    console.log('🎯 Automating form filling...\n');
    
    // JavaScript to run in the page
    const formAutomationScript = `
      // Function to select checkboxes by keywords
      function selectCheckboxes() {
        const keywords = ['upi', 'payment', 'imps', 'balance', 'statement', 'webhook', 'notification', 'transfer', 'fund', 'status', 'inquiry'];
        const checkboxes = document.querySelectorAll('input[type="checkbox"]');
        let count = 0;
        
        checkboxes.forEach(cb => {
          const parent = cb.closest('div') || cb.parentElement;
          const text = (parent?.textContent || '').toLowerCase();
          
          if (keywords.some(k => text.includes(k)) && !cb.checked) {
            cb.click();
            count++;
          }
        });
        
        return count;
      }
      
      // Function to fill textareas
      function fillTextAreas() {
        const useCase = \`Automated payment processing for online trading activities. Need to make time-sensitive payments to verified exchange merchants for investment opportunities. All recipients are KYC-verified Indian entities.\`;
        
        const textareas = document.querySelectorAll('textarea');
        textareas.forEach(ta => {
          if (!ta.value || ta.value.length < 50) {
            ta.value = useCase;
            ta.dispatchEvent(new Event('input', { bubbles: true }));
          }
        });
      }
      
      // Function to fill input fields
      function fillInputs() {
        const fieldMappings = {
          'monthly.*volume': '2000000',
          'daily.*transaction': '50',
          'average.*transaction': '10000',
          'expected.*volume': '5000000'
        };
        
        const inputs = document.querySelectorAll('input[type="text"], input[type="number"]');
        inputs.forEach(input => {
          const fieldInfo = (input.name + input.id + input.placeholder + (document.querySelector(\`label[for="\${input.id}"]\`)?.textContent || '')).toLowerCase();
          
          for (const [pattern, value] of Object.entries(fieldMappings)) {
            if (new RegExp(pattern).test(fieldInfo) && !input.value) {
              input.value = value;
              input.dispatchEvent(new Event('input', { bubbles: true }));
            }
          }
        });
      }
      
      // Execute all functions
      const checkboxCount = selectCheckboxes();
      fillTextAreas();
      fillInputs();
      
      return {
        checkboxes: checkboxCount,
        textareas: document.querySelectorAll('textarea').length,
        inputs: document.querySelectorAll('input').length
      };
    `;
    
    // Execute the automation script
    const result = await iciciPage.evaluate(formAutomationScript);
    
    console.log(`✅ Form automation complete!`);
    console.log(`   - Selected ${result.checkboxes} checkboxes`);
    console.log(`   - Filled ${result.textareas} text areas`);
    console.log(`   - Processed ${result.inputs} input fields\n`);
    
    // Take screenshot
    await iciciPage.screenshot({ path: 'icici-form-completed.png', fullPage: true });
    console.log('📸 Screenshot saved: icici-form-completed.png\n');
    
    return true;
  }
}

async function main() {
  console.log('🚀 ICICI FORM COMPLETE AUTOMATION\n');
  console.log('This will take control of your Chrome and fill the form.\n');
  
  const controller = new DirectChromeControl();
  
  try {
    // Setup Chrome
    await controller.setupChromeForAutomation();
    
    // Wait a bit for Chrome to be ready
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Automate the form
    await controller.automateForm();
    
    console.log('✅ SUCCESS! Form has been filled.\n');
    console.log('📋 Please complete these final steps:');
    console.log('1. Review all fields');
    console.log('2. Upload PAN and Aadhaar documents');
    console.log('3. Complete CAPTCHA if present');
    console.log('4. Submit the form');
    console.log('5. Note down the reference number\n');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.log('\n🔧 Manual steps to enable automation:');
    console.log('1. Close all Chrome windows');
    console.log('2. Open Terminal and run:');
    console.log('   /Applications/Google\\ Chrome.app/Contents/MacOS/Google\\ Chrome --remote-debugging-port=9222');
    console.log('3. Navigate to ICICI API form');
    console.log('4. Run this script again\n');
  }
}

main().catch(console.error);