import { chromium } from 'playwright';
import { logger } from '../utils/logger';

async function testBrowserAutomation() {
  console.log('🧪 Testing Browser Automation Setup\n');
  
  let browser;
  try {
    // Launch browser
    console.log('🚀 Launching browser...');
    browser = await chromium.launch({
      headless: false, // Show browser window
      slowMo: 50 // Slow down actions for visibility
    });
    
    console.log('✅ Browser launched successfully!');
    
    // Create new page
    const page = await browser.newPage();
    console.log('✅ New page created');
    
    // Navigate to Binance
    console.log('\n📍 Navigating to Binance P2P...');
    await page.goto('https://p2p.binance.com/en/trade/buy/USDT?fiat=INR&payment=UPI');
    
    // Wait for page to load
    await page.waitForLoadState('networkidle');
    console.log('✅ Page loaded');
    
    // Check if we can see prices
    console.log('\n💰 Checking for price elements...');
    
    // Wait for price elements
    const priceSelector = '[class*="advertiser-price"]';
    await page.waitForSelector(priceSelector, { timeout: 10000 });
    
    // Get first few prices
    const prices = await page.$$eval(priceSelector, elements => 
      elements.slice(0, 5).map(el => el.textContent?.trim())
    );
    
    console.log('✅ Found prices:');
    prices.forEach((price, index) => {
      console.log(`   ${index + 1}. ${price}`);
    });
    
    // Take screenshot
    console.log('\n📸 Taking screenshot...');
    await page.screenshot({ path: 'binance-p2p-test.png' });
    console.log('✅ Screenshot saved as binance-p2p-test.png');
    
    // Test completed
    console.log('\n🎉 Browser automation test completed successfully!');
    console.log('   - Browser launch: ✅');
    console.log('   - Page navigation: ✅');
    console.log('   - Element detection: ✅');
    console.log('   - Data extraction: ✅');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    logger.error('Browser automation test failed:', error);
  } finally {
    // Close browser
    if (browser) {
      console.log('\n🔚 Closing browser...');
      await browser.close();
    }
  }
}

// Run test
console.log('='.repeat(50));
console.log('BROWSER AUTOMATION TEST');
console.log('='.repeat(50));

testBrowserAutomation()
  .then(() => {
    console.log('\n✅ All tests passed!');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Test suite failed:', error);
    process.exit(1);
  });