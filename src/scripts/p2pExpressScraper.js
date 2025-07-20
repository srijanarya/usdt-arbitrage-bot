const { chromium } = require('playwright');
const chalk = require('chalk');
const fs = require('fs');
require('dotenv').config();

class P2PExpressScraper {
  constructor() {
    this.browser = null;
    this.context = null;
    this.page = null;
    this.cookiesFile = 'binance-cookies.json';
    this.expressRates = {};
  }

  async init() {
    console.log(chalk.cyan('🚀 Starting P2P Express Rate Scraper...\n'));
    
    try {
      this.browser = await chromium.launch({
        headless: false, // Show browser for debugging
        channel: 'chrome'
      });

      // Check for saved cookies
      if (fs.existsSync(this.cookiesFile)) {
        console.log(chalk.green('✓ Found saved cookies'));
        const cookies = JSON.parse(fs.readFileSync(this.cookiesFile, 'utf8'));
        this.context = await this.browser.newContext({
          storageState: { cookies }
        });
      } else {
        console.log(chalk.yellow('⚠️  No saved cookies found'));
        this.context = await this.browser.newContext();
      }

      this.page = await this.context.newPage();
      
      // Set up request interception to capture API calls
      this.page.on('response', async response => {
        const url = response.url();
        if (url.includes('bapi/c2c') && url.includes('express')) {
          try {
            const data = await response.json();
            console.log(chalk.blue('📡 Captured Express API:'), url.split('/').pop());
            console.log(chalk.gray(JSON.stringify(data).substring(0, 200)));
          } catch (e) {}
        }
      });

      return true;
    } catch (error) {
      console.error(chalk.red('❌ Init failed:'), error.message);
      return false;
    }
  }

  async login() {
    console.log(chalk.yellow('\n📝 Logging into Binance...\n'));
    
    try {
      await this.page.goto('https://accounts.binance.com/en/login');
      
      // Check if already logged in
      await this.page.waitForTimeout(3000);
      if (this.page.url().includes('wallet') || this.page.url().includes('my/')) {
        console.log(chalk.green('✓ Already logged in!'));
        return true;
      }

      // Manual login required
      console.log(chalk.cyan('👤 Please log in manually in the browser'));
      console.log(chalk.gray('   Use email/phone and password'));
      console.log(chalk.gray('   Complete any 2FA if required'));
      console.log(chalk.yellow('\n⏳ Waiting for login... (timeout: 2 minutes)'));

      // Wait for successful login
      await this.page.waitForURL(/wallet|my\/|p2p/, { timeout: 120000 });
      
      console.log(chalk.green('✓ Login successful!'));
      
      // Save cookies
      const cookies = await this.context.cookies();
      fs.writeFileSync(this.cookiesFile, JSON.stringify(cookies, null, 2));
      console.log(chalk.green('✓ Cookies saved for future use'));
      
      return true;
    } catch (error) {
      console.error(chalk.red('❌ Login failed:'), error.message);
      return false;
    }
  }

  async navigateToExpress(amount = 11.54) {
    console.log(chalk.cyan(`\n📍 Navigating to P2P Express (${amount} USDT)...\n`));
    
    try {
      const url = `https://p2p.binance.com/en/express/sell/USDT/INR?amount=${amount}`;
      await this.page.goto(url, { waitUntil: 'networkidle' });
      await this.page.waitForTimeout(3000);
      
      // Check if we're on the right page
      const pageTitle = await this.page.title();
      console.log(chalk.gray(`Page title: ${pageTitle}`));
      
      return true;
    } catch (error) {
      console.error(chalk.red('❌ Navigation failed:'), error.message);
      return false;
    }
  }

  async scrapeExpressRates() {
    console.log(chalk.cyan('\n🔍 Scraping Express rates...\n'));
    
    try {
      // Method 1: Look for rate elements
      const rates = await this.page.evaluate(() => {
        const results = {};
        
        // Try to find payment method sections
        const sections = document.querySelectorAll('[class*="payment-method"], [class*="paymentMethod"]');
        sections.forEach(section => {
          const text = section.textContent;
          
          // Look for IMPS
          if (text.includes('IMPS')) {
            const rateMatch = text.match(/(\d+\.?\d*)\s*INR/);
            if (rateMatch) {
              results.IMPS = parseFloat(rateMatch[1]);
            }
          }
          
          // Look for Bank Transfer
          if (text.includes('Bank Transfer')) {
            const rateMatch = text.match(/(\d+\.?\d*)\s*INR/);
            if (rateMatch) {
              results.BankTransfer = parseFloat(rateMatch[1]);
            }
          }
          
          // Look for UPI
          if (text.includes('UPI')) {
            const rateMatch = text.match(/(\d+\.?\d*)\s*INR/);
            if (rateMatch) {
              results.UPI = parseFloat(rateMatch[1]);
            }
          }
        });
        
        // Alternative: Look for any element with INR rates
        const allElements = document.querySelectorAll('*');
        allElements.forEach(el => {
          const text = el.textContent;
          if (text.includes('1 USDT =') && text.includes('INR')) {
            const match = text.match(/1\s*USDT\s*=\s*(\d+\.?\d*)\s*INR/);
            if (match) {
              // Try to identify which payment method this is for
              const parent = el.closest('[class*="payment"], [class*="method"]');
              if (parent) {
                const parentText = parent.textContent;
                if (parentText.includes('IMPS')) results.IMPS_alt = parseFloat(match[1]);
                if (parentText.includes('Bank')) results.Bank_alt = parseFloat(match[1]);
                if (parentText.includes('UPI')) results.UPI_alt = parseFloat(match[1]);
              }
            }
          }
        });
        
        return results;
      });
      
      console.log(chalk.green('✓ Scraped rates:'));
      console.log(rates);
      
      // Take screenshot for debugging
      await this.page.screenshot({ path: 'express-rates-screenshot.png', fullPage: true });
      console.log(chalk.gray('📸 Screenshot saved: express-rates-screenshot.png'));
      
      // Method 2: Click on payment methods to see rates
      console.log(chalk.cyan('\n🖱️ Trying to interact with payment methods...\n'));
      
      const paymentMethods = ['IMPS', 'Bank Transfer', 'UPI'];
      
      for (const method of paymentMethods) {
        try {
          // Try to click on the payment method
          const element = await this.page.locator(`text="${method}"`).first();
          if (await element.isVisible()) {
            await element.click();
            await this.page.waitForTimeout(1000);
            
            // Look for rate after clicking
            const rateAfterClick = await this.page.evaluate(() => {
              const rateElements = document.querySelectorAll('[class*="rate"], [class*="price"]');
              for (const el of rateElements) {
                const text = el.textContent;
                const match = text.match(/(\d+\.?\d*)/);
                if (match && parseFloat(match[1]) > 80 && parseFloat(match[1]) < 100) {
                  return parseFloat(match[1]);
                }
              }
              return null;
            });
            
            if (rateAfterClick) {
              rates[method] = rateAfterClick;
              console.log(chalk.green(`✓ ${method}: ₹${rateAfterClick}`));
            }
          }
        } catch (e) {
          console.log(chalk.gray(`Could not click ${method}`));
        }
      }
      
      this.expressRates = rates;
      return rates;
      
    } catch (error) {
      console.error(chalk.red('❌ Scraping failed:'), error.message);
      return null;
    }
  }

  async monitorRates(amount = 11.54, interval = 30000) {
    console.log(chalk.bgCyan.black(' 🔄 Starting continuous monitoring '));
    console.log(chalk.gray(`Amount: ${amount} USDT | Refresh: ${interval/1000}s\n`));
    
    const monitor = async () => {
      await this.navigateToExpress(amount);
      const rates = await this.scrapeExpressRates();
      
      if (rates && Object.keys(rates).length > 0) {
        console.log(chalk.yellow(`\n📊 Express Rates at ${new Date().toLocaleTimeString()}:`));
        console.log(chalk.green(`IMPS: ₹${rates.IMPS || rates.IMPS_alt || 'N/A'}`));
        console.log(chalk.green(`Bank Transfer: ₹${rates.BankTransfer || rates.Bank_alt || 'N/A'}`));
        console.log(chalk.yellow(`UPI: ₹${rates.UPI || rates.UPI_alt || 'N/A'}`));
      }
    };
    
    // Initial scan
    await monitor();
    
    // Set up interval
    setInterval(monitor, interval);
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
    }
  }
}

// Main execution
async function main() {
  const scraper = new P2PExpressScraper();
  
  console.log(chalk.bgBlue.white(' P2P Express Rate Scraper '));
  console.log(chalk.cyan('\nThis tool will log into Binance and scrape real Express rates\n'));
  
  // Initialize browser
  const initialized = await scraper.init();
  if (!initialized) {
    console.error(chalk.red('Failed to initialize browser'));
    return;
  }
  
  // Login
  const loggedIn = await scraper.login();
  if (!loggedIn) {
    console.error(chalk.red('Failed to login'));
    await scraper.close();
    return;
  }
  
  // Get amount from command line or use default
  const amount = process.argv[2] ? parseFloat(process.argv[2]) : 11.54;
  
  // Start monitoring
  await scraper.monitorRates(amount);
  
  // Keep running
  console.log(chalk.gray('\nPress Ctrl+C to stop monitoring'));
}

// Run if executed directly
if (require.main === module) {
  main().catch(error => {
    console.error(chalk.red('Fatal error:'), error);
    process.exit(1);
  });
}

module.exports = P2PExpressScraper;