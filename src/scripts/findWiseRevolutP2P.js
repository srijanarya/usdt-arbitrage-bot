const axios = require('axios');
const chalk = require('chalk');
const Table = require('cli-table3');

class WiseRevolutP2PFinder {
  constructor() {
    this.results = [];
    this.paymentMethods = ['Wise', 'Revolut', 'Payoneer', 'Skrill', 'Paypal'];
    this.currencies = ['USD', 'EUR', 'GBP', 'SGD', 'AED'];
  }

  async searchAllMarkets() {
    console.log(chalk.cyan('🔍 Searching for Wise/Revolut P2P traders...\n'));
    
    for (const currency of this.currencies) {
      await this.searchCurrency(currency);
      await new Promise(resolve => setTimeout(resolve, 2000)); // Rate limit
    }
    
    this.displayResults();
  }

  async searchCurrency(currency) {
    console.log(chalk.yellow(`📍 Searching ${currency} market...`));
    
    try {
      const response = await axios.post(
        'https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search',
        {
          page: 1,
          rows: 20,
          payTypes: [], // Get all payment types
          asset: "USDT",
          fiat: currency,
          tradeType: "BUY",
          transAmount: ""
        }
      );

      if (response.data?.data) {
        let foundCount = 0;
        
        response.data.data.forEach(ad => {
          const methods = ad.adv.tradeMethods.map(m => m.tradeMethodName || m.identifier || '');
          const methodString = methods.join(' ').toLowerCase();
          
          // Check if any of our target payment methods are available
          const hasTargetMethod = this.paymentMethods.some(method => 
            methodString.includes(method.toLowerCase())
          );
          
          if (hasTargetMethod) {
            foundCount++;
            const price = parseFloat(ad.adv.price);
            const matchedMethods = this.paymentMethods.filter(method => 
              methodString.includes(method.toLowerCase())
            );
            
            this.results.push({
              currency: currency,
              merchant: ad.advertiser.nickName,
              price: price,
              priceINR: this.convertToINR(price, currency),
              methods: methods.join(', '),
              targetMethods: matchedMethods.join(', '),
              minOrder: parseFloat(ad.adv.minSingleTransAmount),
              maxOrder: parseFloat(ad.adv.maxSingleTransAmount),
              available: parseFloat(ad.adv.surplusAmount),
              rating: (ad.advertiser.monthFinishRate * 100).toFixed(1) + '%',
              trades: ad.advertiser.monthOrderCount,
              advertId: ad.adv.advNo
            });
          }
        });
        
        if (foundCount > 0) {
          console.log(chalk.green(`✓ Found ${foundCount} traders accepting Wise/Revolut`));
        } else {
          console.log(chalk.gray(`No Wise/Revolut traders found`));
        }
      }
    } catch (error) {
      console.log(chalk.red(`Error searching ${currency}: ${error.message}`));
    }
  }

  convertToINR(price, currency) {
    const rates = {
      'USD': 83.50,
      'EUR': 90.95,
      'GBP': 106.02,
      'SGD': 61.85,
      'AED': 22.75
    };
    return price * (rates[currency] || 83.50);
  }

  displayResults() {
    console.log(chalk.green('\n✅ Search complete!\n'));
    
    if (this.results.length === 0) {
      console.log(chalk.red('❌ No Wise/Revolut traders found in any market'));
      return;
    }
    
    // Sort by INR price
    this.results.sort((a, b) => a.priceINR - b.priceINR);
    
    console.log(chalk.bgGreen.black(' 🏆 WISE/REVOLUT P2P TRADERS '));
    
    const table = new Table({
      head: ['Rank', 'Market', 'Price', 'INR Equiv', 'Merchant', 'Payment', 'Rating', 'Min-Max'],
      colWidths: [6, 8, 12, 12, 18, 25, 10, 20]
    });

    this.results.slice(0, 20).forEach((result, index) => {
      const priceColor = result.priceINR < 86 ? chalk.green : 
                        result.priceINR < 87 ? chalk.yellow : chalk.white;
      
      table.push([
        `#${index + 1}`,
        result.currency,
        `${result.price.toFixed(2)}`,
        priceColor(`₹${result.priceINR.toFixed(2)}`),
        result.merchant.substring(0, 16),
        chalk.cyan(result.targetMethods),
        result.rating,
        `${result.minOrder}-${result.maxOrder}`
      ]);
    });

    console.log(table.toString());

    // Group by payment method
    console.log(chalk.cyan('\n📊 BY PAYMENT METHOD:'));
    
    this.paymentMethods.forEach(method => {
      const methodResults = this.results.filter(r => 
        r.targetMethods.toLowerCase().includes(method.toLowerCase())
      );
      
      if (methodResults.length > 0) {
        console.log(chalk.yellow(`\n${method}: ${methodResults.length} traders`));
        methodResults.slice(0, 3).forEach(r => {
          console.log(`  • ${r.currency} @ ${r.price} (₹${r.priceINR.toFixed(2)}) - ${r.merchant}`);
        });
      }
    });

    // Best opportunities
    if (this.results.length > 0) {
      console.log(chalk.bgBlue.white('\n 💰 ARBITRAGE OPPORTUNITIES '));
      
      const top3 = this.results.slice(0, 3);
      top3.forEach((result, i) => {
        const p2pSellPrice = 94.79;
        const profit = p2pSellPrice - result.priceINR;
        const profitPercent = (profit / result.priceINR * 100).toFixed(1);
        
        console.log(chalk.yellow(`\n${i + 1}. ${result.targetMethods} - ${result.currency}`));
        console.log(`   Merchant: ${result.merchant} (${result.rating}, ${result.trades} trades)`);
        console.log(`   Buy at: ${result.currency} ${result.price} (₹${result.priceINR.toFixed(2)})`);
        console.log(`   Sell at: ₹${p2pSellPrice}`);
        console.log(chalk.green(`   Profit: ₹${profit.toFixed(2)} per USDT (${profitPercent}%)`));
        console.log(`   Link: https://p2p.binance.com/en/advertiserDetail/${result.advertId}`);
      });
    }

    // Instructions
    console.log(chalk.cyan('\n📝 HOW TO USE WISE/REVOLUT:'));
    console.log('1. Create Wise/Revolut account (if you don\'t have one)');
    console.log('2. Fund it with your Niyo Global card');
    console.log('3. Buy USDT from these P2P traders');
    console.log('4. Transfer USDT to spot wallet');
    console.log('5. Sell on INR P2P market');
    
    console.log(chalk.yellow('\n⚠️  IMPORTANT:'));
    console.log('• Verify merchant rating and trade count');
    console.log('• Start with small test transaction');
    console.log('• Keep payment proof screenshots');
    console.log('• Complete trades within time limit');
  }
}

// Run the search
async function main() {
  const finder = new WiseRevolutP2PFinder();
  await finder.searchAllMarkets();
}

main().catch(console.error);