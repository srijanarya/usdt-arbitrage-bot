import { chromium } from 'playwright';
import { logger } from '../utils/logger';
import { config } from 'dotenv';

config();

interface AutoBuyConfig {
  targetPrice: number;
  buyAmount: number;
  checkInterval: number;
}

async function simpleBrowserAutoBuy() {
  console.log('🤖 SIMPLE BROWSER AUTO-BUY FOR BINANCE P2P\n');
  
  const config: AutoBuyConfig = {
    targetPrice: 88.5,  // Buy when price <= ₹88.5
    buyAmount: 10,      // Buy 10 USDT
    checkInterval: 30000 // Check every 30 seconds
  };
  
  console.log('📋 Configuration:');
  console.log(`   Target Price: ₹${config.targetPrice}`);
  console.log(`   Buy Amount: ${config.buyAmount} USDT`);
  console.log(`   Check Interval: ${config.checkInterval / 1000}s`);
  console.log('━'.repeat(50));
  
  let browser;
  try {
    // Launch browser
    console.log('\n🚀 Launching browser...');
    browser = await chromium.launch({
      headless: false, // Show browser for transparency
      args: [
        '--disable-blink-features=AutomationControlled',
        '--disable-features=IsolateOrigins,site-per-process'
      ]
    });
    
    const context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });
    
    const page = await context.newPage();
    
    // Function to check prices
    async function checkPrices() {
      try {
        console.log(`\n[${new Date().toLocaleTimeString()}] Checking prices...`);
        
        // Navigate to P2P buy page
        await page.goto('https://p2p.binance.com/en/trade/buy/USDT?fiat=INR&payment=UPI', {
          waitUntil: 'networkidle'
        });
        
        // Wait a bit for dynamic content
        await page.waitForTimeout(3000);
        
        // Try multiple selectors for price elements
        const priceSelectors = [
          'div[class*="price"] span',
          'div[class*="advertiser-price"]',
          'div[class*="css-"] span[class*="price"]',
          'span:has-text("₹")'
        ];
        
        let prices = [];
        for (const selector of priceSelectors) {
          try {
            const elements = await page.$$(selector);
            if (elements.length > 0) {
              const extractedPrices = await Promise.all(
                elements.slice(0, 10).map(async el => {
                  const text = await el.textContent();
                  const match = text?.match(/₹?([\d,]+\.?\d*)/);
                  return match ? parseFloat(match[1].replace(/,/g, '')) : null;
                })
              );
              
              prices = extractedPrices.filter(p => p && p > 80 && p < 100);
              if (prices.length > 0) break;
            }
          } catch (e) {
            // Try next selector
          }
        }
        
        if (prices.length === 0) {
          console.log('⚠️  No prices found, will retry...');
          return null;
        }
        
        const lowestPrice = Math.min(...prices);
        console.log(`💰 Found ${prices.length} prices. Lowest: ₹${lowestPrice}`);
        console.log(`   Top 5 prices: ${prices.slice(0, 5).map(p => `₹${p}`).join(', ')}`);
        
        return lowestPrice;
        
      } catch (error) {
        console.error('❌ Error checking prices:', error.message);
        return null;
      }
    }
    
    // Monitor prices
    console.log('\n📊 Starting price monitoring...');
    console.log('Press Ctrl+C to stop\n');
    
    let isRunning = true;
    process.on('SIGINT', () => {
      console.log('\n\n🛑 Stopping auto-buy...');
      isRunning = false;
    });
    
    while (isRunning) {
      const currentPrice = await checkPrices();
      
      if (currentPrice && currentPrice <= config.targetPrice) {
        console.log(`\n🎯 TARGET PRICE HIT! Current: ₹${currentPrice}, Target: ₹${config.targetPrice}`);
        console.log('🔔 ALERT: Good buying opportunity!');
        
        // Take screenshot
        await page.screenshot({ 
          path: `buy-opportunity-${Date.now()}.png`,
          fullPage: true 
        });
        console.log('📸 Screenshot saved');
        
        // Here you would implement actual buy logic
        console.log('💡 To implement: Automated buy execution');
        
        // For now, just alert and continue monitoring
        console.log('✅ Opportunity logged. Continuing to monitor...\n');
      } else if (currentPrice) {
        const diff = currentPrice - config.targetPrice;
        console.log(`   ↳ Current price ₹${currentPrice} is ₹${diff.toFixed(2)} above target`);
      }
      
      // Wait before next check
      await new Promise(resolve => setTimeout(resolve, config.checkInterval));
    }
    
  } catch (error) {
    console.error('❌ Fatal error:', error);
    logger.error('Browser automation error:', error);
  } finally {
    if (browser) {
      await browser.close();
      console.log('✅ Browser closed');
    }
  }
}

// Run the auto-buyer
simpleBrowserAutoBuy().catch(console.error);