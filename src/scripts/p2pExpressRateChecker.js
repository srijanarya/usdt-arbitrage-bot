const axios = require('axios');
const chalk = require('chalk');
const { chromium } = require('playwright');

class P2PExpressRateChecker {
  constructor() {
    this.browser = null;
    this.page = null;
  }

  // Method 1: Try to fetch Express rates via API
  async fetchViaAPI(amount = 11.54) {
    console.log(chalk.cyan('\n📡 Method 1: Fetching via API...'));
    
    try {
      // Try Express-specific endpoint
      const expressResponse = await axios.post(
        'https://p2p.binance.com/bapi/c2c/v2/public/payment/express/adv/list',
        {
          amount: amount.toString(),
          asset: "USDT",
          fiat: "INR",
          tradeType: "SELL",
          payTypes: ["IMPS", "Bank Transfer", "UPI"]
        },
        {
          headers: {
            'User-Agent': 'Mozilla/5.0',
            'Content-Type': 'application/json'
          }
        }
      );
      
      if (expressResponse.data) {
        console.log(chalk.green('✓ Express API Response:'));
        console.log(JSON.stringify(expressResponse.data, null, 2));
        return expressResponse.data;
      }
    } catch (error) {
      console.log(chalk.red('✗ Express API failed:', error.message));
    }

    // Try regular P2P API
    try {
      const regularResponse = await axios.post(
        'https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search',
        {
          page: 1,
          rows: 1,
          payTypes: ["IMPS", "Bank Transfer", "UPI"],
          countries: [],
          asset: "USDT",
          fiat: "INR",
          tradeType: "SELL",
          transAmount: amount,
          merchantCheck: false
        }
      );

      if (regularResponse.data?.data?.[0]) {
        const rate = parseFloat(regularResponse.data.data[0].adv.price);
        console.log(chalk.yellow('✓ Regular P2P API Rate:', `₹${rate}`));
        return { rate, source: 'P2P API' };
      }
    } catch (error) {
      console.log(chalk.red('✗ Regular API failed:', error.message));
    }

    return null;
  }

  // Method 2: Use Playwright to get actual rates from the page
  async fetchViaBrowser(amount = 11.54) {
    console.log(chalk.cyan('\n🌐 Method 2: Fetching via Browser...'));
    
    try {
      this.browser = await chromium.launch({ headless: false });
      this.page = await this.browser.newPage();
      
      // Go to P2P Express sell page
      const url = `https://p2p.binance.com/en/express/sell/USDT/INR?amount=${amount}`;
      console.log(chalk.gray(`Opening: ${url}`));
      
      await this.page.goto(url, { waitUntil: 'networkidle' });
      await this.page.waitForTimeout(3000);
      
      // Try to extract rates from the page
      const rates = await this.page.evaluate(() => {
        const results = {};
        
        // Look for rate elements
        const rateElements = document.querySelectorAll('[class*="price"], [class*="rate"]');
        rateElements.forEach((el, index) => {
          const text = el.textContent;
          if (text.includes('₹') || text.match(/\d+\.\d+/)) {
            results[`element_${index}`] = text;
          }
        });
        
        // Look for payment method sections
        const paymentSections = document.querySelectorAll('[class*="payment-method"]');
        paymentSections.forEach((section) => {
          const methodName = section.querySelector('[class*="method-name"]')?.textContent;
          const rate = section.querySelector('[class*="rate"], [class*="price"]')?.textContent;
          if (methodName && rate) {
            results[methodName] = rate;
          }
        });
        
        return results;
      });
      
      console.log(chalk.green('✓ Browser extracted rates:'));
      console.log(JSON.stringify(rates, null, 2));
      
      // Take screenshot for debugging
      await this.page.screenshot({ path: 'p2p-express-rates.png' });
      console.log(chalk.gray('Screenshot saved: p2p-express-rates.png'));
      
      return rates;
    } catch (error) {
      console.log(chalk.red('✗ Browser method failed:', error.message));
    } finally {
      if (this.browser) {
        await this.browser.close();
      }
    }
    
    return null;
  }

  // Method 3: Check network requests
  async fetchViaNetworkMonitoring(amount = 11.54) {
    console.log(chalk.cyan('\n🔍 Method 3: Monitoring Network Requests...'));
    
    try {
      this.browser = await chromium.launch({ headless: false });
      const context = await this.browser.newContext();
      this.page = await context.newPage();
      
      const capturedRequests = [];
      
      // Monitor all API requests
      this.page.on('request', request => {
        const url = request.url();
        if (url.includes('binance.com') && url.includes('bapi')) {
          capturedRequests.push({
            url: url,
            method: request.method(),
            postData: request.postData()
          });
        }
      });
      
      // Monitor responses
      this.page.on('response', async response => {
        const url = response.url();
        if (url.includes('binance.com') && url.includes('bapi')) {
          try {
            const data = await response.json();
            console.log(chalk.blue('\n📥 API Response:'));
            console.log(chalk.gray(`URL: ${url}`));
            console.log(chalk.gray(`Data: ${JSON.stringify(data).substring(0, 200)}...`));
          } catch (e) {}
        }
      });
      
      // Navigate to Express page
      await this.page.goto(`https://p2p.binance.com/en/express/sell/USDT/INR`, { 
        waitUntil: 'networkidle' 
      });
      
      // Wait and interact
      await this.page.waitForTimeout(3000);
      
      // Try to input amount
      const amountInput = await this.page.$('input[type="number"], input[placeholder*="amount"]');
      if (amountInput) {
        await amountInput.fill(amount.toString());
        await this.page.waitForTimeout(2000);
      }
      
      console.log(chalk.yellow('\n📋 Captured API Requests:'));
      capturedRequests.forEach((req, index) => {
        console.log(`${index + 1}. ${req.method} ${req.url}`);
        if (req.postData) {
          console.log(chalk.gray(`   Data: ${req.postData.substring(0, 100)}...`));
        }
      });
      
      return capturedRequests;
    } catch (error) {
      console.log(chalk.red('✗ Network monitoring failed:', error.message));
    } finally {
      if (this.browser) {
        await this.browser.close();
      }
    }
    
    return null;
  }

  async checkAllMethods(amount = 11.54) {
    console.log(chalk.bgCyan.black(' 🔬 P2P Express Rate Deep Research '));
    console.log(chalk.yellow(`\nChecking rates for ${amount} USDT...\n`));
    
    // Method 1: API
    const apiRates = await this.fetchViaAPI(amount);
    
    // Method 2: Browser scraping
    const browserRates = await this.fetchViaBrowser(amount);
    
    // Method 3: Network monitoring
    const networkData = await this.fetchViaNetworkMonitoring(amount);
    
    console.log(chalk.bgGreen.black('\n📊 Summary:'));
    console.log('1. API Rates:', apiRates);
    console.log('2. Browser Rates:', browserRates);
    console.log('3. Network Requests Found:', networkData?.length || 0);
    
    console.log(chalk.yellow('\n💡 Recommendations:'));
    console.log('- P2P Express may use dynamic pricing based on amount');
    console.log('- Rates differ significantly between payment methods');
    console.log('- IMPS/Bank Transfer typically offers better rates than UPI');
    console.log('- Consider using browser automation for most accurate rates');
  }
}

// Test the checker
if (require.main === module) {
  const checker = new P2PExpressRateChecker();
  
  // Get amount from command line or use default
  const amount = process.argv[2] ? parseFloat(process.argv[2]) : 11.54;
  
  checker.checkAllMethods(amount).catch(console.error);
}

module.exports = P2PExpressRateChecker;