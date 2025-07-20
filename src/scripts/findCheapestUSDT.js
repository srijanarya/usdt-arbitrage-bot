const axios = require('axios');
const chalk = require('chalk');
const Table = require('cli-table3');

class CheapestUSDTFinder {
  constructor() {
    this.results = [];
    this.amount = 11.54; // Your amount
  }

  async searchAllSources() {
    console.log(chalk.cyan('🔍 Searching for cheapest USDT across Indian market...\n'));
    
    // 1. Binance P2P - All payment methods
    await this.searchBinanceP2P();
    
    // 2. Indian Exchanges
    await this.searchIndianExchanges();
    
    // 3. International Exchanges with INR
    await this.searchInternationalExchanges();
    
    // 4. P2P Platforms
    await this.searchOtherP2P();
    
    // Display results
    this.displayResults();
  }

  async searchBinanceP2P() {
    console.log(chalk.yellow('📍 Binance P2P...'));
    
    const paymentMethods = [
      { types: ["UPI"], name: "UPI" },
      { types: ["IMPS"], name: "IMPS" },
      { types: ["Bank Transfer"], name: "Bank Transfer" },
      { types: ["PhonePe"], name: "PhonePe" },
      { types: ["Paytm"], name: "Paytm" },
      { types: ["GooglePay"], name: "GooglePay" }
    ];

    for (const method of paymentMethods) {
      try {
        const response = await axios.post(
          'https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search',
          {
            page: 1,
            rows: 5,
            payTypes: method.types,
            asset: "USDT",
            fiat: "INR",
            tradeType: "BUY",
            transAmount: this.amount
          }
        );

        if (response.data?.data?.length > 0) {
          const cheapest = response.data.data[0];
          this.results.push({
            source: `Binance P2P (${method.name})`,
            price: parseFloat(cheapest.adv.price),
            merchant: cheapest.advertiser.nickName,
            minOrder: parseFloat(cheapest.adv.minSingleTransAmount),
            maxOrder: parseFloat(cheapest.adv.maxSingleTransAmount),
            available: parseFloat(cheapest.adv.surplusAmount),
            rating: (cheapest.advertiser.monthFinishRate * 100).toFixed(1) + '%',
            trades: cheapest.advertiser.monthOrderCount
          });
        }
      } catch (e) {}
      
      await new Promise(resolve => setTimeout(resolve, 500)); // Rate limit
    }
  }

  async searchIndianExchanges() {
    console.log(chalk.yellow('📍 Indian Exchanges...'));
    
    // CoinDCX
    try {
      const response = await axios.get('https://api.coindcx.com/exchange/ticker');
      const usdtinr = response.data.find(t => t.market === 'USDTINR');
      if (usdtinr) {
        this.results.push({
          source: 'CoinDCX',
          price: parseFloat(usdtinr.bid),
          minOrder: 10, // Typical minimum
          maxOrder: 1000000,
          type: 'Exchange',
          spread: ((parseFloat(usdtinr.ask) - parseFloat(usdtinr.bid)) / parseFloat(usdtinr.bid) * 100).toFixed(2) + '%'
        });
      }
    } catch (e) {}

    // ZebPay
    try {
      const response = await axios.get('https://www.zebapi.com/pro/v1/market/USDT-INR/ticker');
      this.results.push({
        source: 'ZebPay',
        price: parseFloat(response.data.buy),
        minOrder: 10,
        maxOrder: 1000000,
        type: 'Exchange',
        spread: ((parseFloat(response.data.sell) - parseFloat(response.data.buy)) / parseFloat(response.data.buy) * 100).toFixed(2) + '%'
      });
    } catch (e) {}

    // WazirX
    try {
      const response = await axios.get('https://api.wazirx.com/api/v2/tickers/usdtinr');
      const buyPrice = parseFloat(response.data.ticker.buy) || parseFloat(response.data.ticker.last);
      if (buyPrice > 80 && buyPrice < 100) { // Sanity check
        this.results.push({
          source: 'WazirX',
          price: buyPrice,
          minOrder: 10,
          maxOrder: 1000000,
          type: 'Exchange',
          status: 'Check availability'
        });
      }
    } catch (e) {}

    // Giottus
    try {
      const response = await axios.get('https://www.giottus.com/api/v2/ticker');
      const usdtinr = response.data.find(t => t.market === 'USDTINR');
      if (usdtinr) {
        this.results.push({
          source: 'Giottus',
          price: parseFloat(usdtinr.bid),
          minOrder: 100,
          maxOrder: 100000,
          type: 'Exchange'
        });
      }
    } catch (e) {}

    // CoinSwitch
    try {
      const response = await axios.get('https://api.coinswitch.co/v2/rate/inr/usdt');
      if (response.data?.data?.rate) {
        this.results.push({
          source: 'CoinSwitch',
          price: parseFloat(response.data.data.rate),
          minOrder: 100,
          maxOrder: 100000,
          type: 'Exchange'
        });
      }
    } catch (e) {}
  }

  async searchInternationalExchanges() {
    console.log(chalk.yellow('📍 International Exchanges...'));
    
    // Huobi Global
    try {
      const response = await axios.get('https://api.huobi.pro/market/detail/merged?symbol=usdtinr');
      if (response.data?.tick) {
        this.results.push({
          source: 'Huobi Global',
          price: response.data.tick.bid[0],
          type: 'International',
          note: 'Requires KYC'
        });
      }
    } catch (e) {}

    // Gate.io
    try {
      const response = await axios.get('https://api.gateio.ws/api/v4/spot/currency_pairs/USDT_INR');
      if (response.data) {
        this.results.push({
          source: 'Gate.io',
          price: parseFloat(response.data.last_price),
          type: 'International',
          note: 'Check INR support'
        });
      }
    } catch (e) {}
  }

  async searchOtherP2P() {
    console.log(chalk.yellow('📍 Other P2P Platforms...'));
    
    // LocalBitcoins alternative - Paxful
    this.results.push({
      source: 'Paxful',
      price: 'Check manually',
      type: 'P2P Platform',
      note: 'Often 1-2% cheaper',
      url: 'https://paxful.com'
    });

    // LocalCryptos
    this.results.push({
      source: 'LocalCryptos',
      price: 'Check manually',
      type: 'P2P Platform',
      note: 'Escrow based',
      url: 'https://localcryptos.com'
    });

    // Remitano
    this.results.push({
      source: 'Remitano',
      price: 'Check manually',
      type: 'P2P Platform',
      note: 'Popular in Asia',
      url: 'https://remitano.com'
    });
  }

  displayResults() {
    console.log(chalk.green('\n✅ Search complete!\n'));
    
    // Sort by price (numeric results first)
    const numericResults = this.results.filter(r => typeof r.price === 'number').sort((a, b) => a.price - b.price);
    const manualResults = this.results.filter(r => typeof r.price !== 'number');
    
    // Display cheapest options
    console.log(chalk.bgGreen.black(' 🏆 TOP 10 CHEAPEST USDT SOURCES '));
    const table = new Table({
      head: ['Rank', 'Source', 'Price (INR)', 'Min-Max', 'Details'],
      colWidths: [6, 25, 12, 20, 35]
    });

    numericResults.slice(0, 10).forEach((result, index) => {
      const priceColor = result.price < 87 ? chalk.green : result.price < 88 ? chalk.yellow : chalk.red;
      
      table.push([
        `#${index + 1}`,
        result.source,
        priceColor(`₹${result.price.toFixed(2)}`),
        result.minOrder ? `₹${result.minOrder}-${result.maxOrder}` : '-',
        result.merchant ? `${result.merchant} (${result.rating})` : result.type || ''
      ]);
    });

    console.log(table.toString());

    // P2P Express comparison
    const expressRate = 86.17;
    const cheapest = numericResults[0];
    
    if (cheapest) {
      console.log(chalk.cyan('\n📊 VS P2P EXPRESS (₹86.17):'));
      const difference = cheapest.price - expressRate;
      const profitLoss = difference > 0 ? chalk.red(`Loss: ₹${difference.toFixed(2)}`) : chalk.green(`Profit: ₹${Math.abs(difference).toFixed(2)}`);
      console.log(`Cheapest: ${cheapest.source} @ ₹${cheapest.price}`);
      console.log(profitLoss + ` per USDT`);
      console.log(`For ${this.amount} USDT: ${difference > 0 ? chalk.red(`Loss ₹${(difference * this.amount).toFixed(2)}`) : chalk.green(`Profit ₹${Math.abs(difference * this.amount).toFixed(2)}`)}`);
    }

    // Manual check platforms
    if (manualResults.length > 0) {
      console.log(chalk.yellow('\n🔍 MANUAL CHECK REQUIRED:'));
      manualResults.forEach(result => {
        console.log(`• ${result.source}: ${result.note} - ${result.url || ''}`);
      });
    }

    // Tips
    console.log(chalk.cyan('\n💡 TIPS FOR CHEAPER USDT:'));
    console.log('1. Check P2P platforms during Indian market hours (9 AM - 6 PM)');
    console.log('2. Look for new sellers with promotional rates');
    console.log('3. Consider bulk deals (>1000 USDT) for better rates');
    console.log('4. Check Telegram/WhatsApp crypto groups (verify carefully!)');
    console.log('5. International remittance services sometimes offer better rates');
    
    // Summary
    console.log(chalk.bgBlue.white(`\n📈 MARKET SUMMARY`));
    console.log(`Cheapest found: ₹${cheapest ? cheapest.price.toFixed(2) : 'N/A'}`);
    console.log(`P2P Express rate: ₹${expressRate}`);
    console.log(`Market average: ₹${(numericResults.reduce((sum, r) => sum + r.price, 0) / numericResults.length).toFixed(2)}`);
  }
}

// Run the search
async function main() {
  const finder = new CheapestUSDTFinder();
  await finder.searchAllSources();
  
  console.log(chalk.gray('\n\nNote: Rates change rapidly. Run again for latest prices.'));
}

main().catch(console.error);