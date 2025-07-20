const axios = require('axios');
const chalk = require('chalk');
const Table = require('cli-table3');

class CreditCardP2PFinder {
  constructor() {
    this.results = [];
    this.amount = 11.54;
    this.usdToInr = 83.50; // Approximate current rate
  }

  async searchP2PMarkets() {
    console.log(chalk.cyan('🔍 Searching P2P markets for Credit Card payments...\n'));
    
    // Search different fiat currencies where credit cards are common
    const markets = [
      { fiat: 'USD', symbol: '$', desc: 'US Dollar' },
      { fiat: 'EUR', symbol: '€', desc: 'Euro' },
      { fiat: 'GBP', symbol: '£', desc: 'British Pound' },
      { fiat: 'AED', symbol: 'AED', desc: 'UAE Dirham' },
      { fiat: 'SGD', symbol: 'S$', desc: 'Singapore Dollar' },
      { fiat: 'THB', symbol: '฿', desc: 'Thai Baht' },
      { fiat: 'TRY', symbol: '₺', desc: 'Turkish Lira' },
      { fiat: 'ARS', symbol: 'ARS', desc: 'Argentine Peso' },
      { fiat: 'BRL', symbol: 'R$', desc: 'Brazilian Real' }
    ];

    for (const market of markets) {
      await this.searchMarket(market);
      await new Promise(resolve => setTimeout(resolve, 1000)); // Rate limit
    }

    this.displayResults();
  }

  async searchMarket(market) {
    console.log(chalk.yellow(`📍 Searching ${market.desc} (${market.fiat})...`));
    
    try {
      // Search for credit card payment methods
      const paymentMethods = [
        'Card', 'Credit Card', 'Debit Card', 'Visa', 'Mastercard', 
        'Bank Card', 'International Card', 'Visa/Mastercard'
      ];

      const response = await axios.post(
        'https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search',
        {
          page: 1,
          rows: 20,
          payTypes: [], // Get all payment types
          asset: "USDT",
          fiat: market.fiat,
          tradeType: "BUY",
          transAmount: this.amount
        }
      );

      if (response.data?.data) {
        // Filter for credit card payments
        const creditCardAds = response.data.data.filter(ad => {
          const methods = ad.adv.tradeMethods.map(m => m.tradeMethodName || m.identifier);
          return methods.some(method => 
            paymentMethods.some(pm => 
              method.toLowerCase().includes(pm.toLowerCase()) ||
              method.toLowerCase().includes('card')
            )
          );
        });

        if (creditCardAds.length > 0) {
          console.log(chalk.green(`✓ Found ${creditCardAds.length} credit card listings`));
          
          creditCardAds.slice(0, 5).forEach(ad => {
            const price = parseFloat(ad.adv.price);
            const inrEquivalent = this.convertToINR(price, market.fiat);
            
            this.results.push({
              market: market.fiat,
              symbol: market.symbol,
              merchant: ad.advertiser.nickName,
              price: price,
              priceINR: inrEquivalent,
              methods: ad.adv.tradeMethods.map(m => m.tradeMethodName || m.identifier).join(', '),
              minOrder: parseFloat(ad.adv.minSingleTransAmount),
              maxOrder: parseFloat(ad.adv.maxSingleTransAmount),
              available: parseFloat(ad.adv.surplusAmount),
              rating: (ad.advertiser.monthFinishRate * 100).toFixed(1) + '%',
              trades: ad.advertiser.monthOrderCount,
              advertId: ad.adv.advNo
            });
          });
        } else {
          console.log(chalk.gray(`No credit card listings found`));
        }
      }
    } catch (error) {
      console.log(chalk.red(`Error searching ${market.fiat}: ${error.message}`));
    }
  }

  async fetchExchangeRates() {
    console.log(chalk.cyan('\n📊 Fetching current exchange rates...'));
    
    try {
      // Fetch USD/INR rate
      const response = await axios.get('https://api.exchangerate-api.com/v4/latest/USD');
      if (response.data?.rates?.INR) {
        this.usdToInr = response.data.rates.INR;
        console.log(chalk.green(`✓ USD/INR: ${this.usdToInr}`));
      }
    } catch (e) {
      console.log(chalk.yellow('Using approximate exchange rates'));
    }
  }

  convertToINR(price, currency) {
    // Approximate conversion rates (you may want to fetch real-time rates)
    const rates = {
      'USD': this.usdToInr,
      'EUR': this.usdToInr * 1.09,
      'GBP': this.usdToInr * 1.27,
      'AED': this.usdToInr / 3.67,
      'SGD': this.usdToInr / 1.35,
      'THB': this.usdToInr / 35.5,
      'TRY': this.usdToInr / 32.5,
      'ARS': this.usdToInr / 980,
      'BRL': this.usdToInr / 5.5
    };
    
    return price * (rates[currency] || this.usdToInr);
  }

  displayResults() {
    console.log(chalk.green('\n✅ Search complete!\n'));
    
    // Sort by INR equivalent price
    this.results.sort((a, b) => a.priceINR - b.priceINR);
    
    console.log(chalk.bgGreen.black(' 🏆 CHEAPEST CREDIT CARD P2P LISTINGS '));
    
    const table = new Table({
      head: ['Rank', 'Market', 'Price', 'INR Equiv', 'Merchant', 'Payment Methods', 'Rating'],
      colWidths: [6, 8, 12, 12, 20, 35, 10]
    });

    this.results.slice(0, 15).forEach((result, index) => {
      const priceColor = result.priceINR < 89 ? chalk.green : result.priceINR < 90 ? chalk.yellow : chalk.red;
      
      table.push([
        `#${index + 1}`,
        result.market,
        `${result.symbol}${result.price.toFixed(2)}`,
        priceColor(`₹${result.priceINR.toFixed(2)}`),
        result.merchant.substring(0, 18),
        result.methods.substring(0, 33),
        result.rating
      ]);
    });

    console.log(table.toString());

    // Show potential profit
    if (this.results.length > 0) {
      const cheapest = this.results[0];
      const p2pSellPrice = 94.79; // From your monitor
      const profit = p2pSellPrice - cheapest.priceINR;
      const profitPercent = (profit / cheapest.priceINR * 100).toFixed(2);
      
      console.log(chalk.cyan('\n💰 ARBITRAGE OPPORTUNITY:'));
      console.log(`Buy in ${cheapest.market}: ${cheapest.symbol}${cheapest.price} (₹${cheapest.priceINR.toFixed(2)})`);
      console.log(`Sell on P2P INR: ₹${p2pSellPrice}`);
      console.log(chalk.green(`Profit: ₹${profit.toFixed(2)} per USDT (${profitPercent}%)`));
      console.log(chalk.green(`Total for 11.54 USDT: ₹${(profit * 11.54).toFixed(2)}`));
      
      console.log(chalk.yellow('\n🔗 Direct Links to Best Deals:'));
      this.results.slice(0, 3).forEach((result, i) => {
        console.log(`${i + 1}. ${result.market} - ${result.merchant}: https://p2p.binance.com/en/advertiserDetail/${result.advertId}`);
      });
    }

    console.log(chalk.cyan('\n💡 TIPS FOR NIYO GLOBAL CARD:'));
    console.log('1. Ensure your card is activated for international transactions');
    console.log('2. Some merchants may require KYC verification');
    console.log('3. USD market usually has the best rates');
    console.log('4. Check merchant rating and completion rate before trading');
    console.log('5. Start with small amounts to test the process');
  }
}

// Main execution
async function main() {
  const finder = new CreditCardP2PFinder();
  
  console.log(chalk.bgBlue.white(' 💳 Credit Card P2P USDT Finder '));
  console.log(chalk.cyan('\nSearching for credit card payment options across all P2P markets...\n'));
  
  await finder.fetchExchangeRates();
  await finder.searchP2PMarkets();
  
  console.log(chalk.gray('\n\nNote: Exchange rates are approximate. Verify actual rates before trading.'));
}

main().catch(console.error);