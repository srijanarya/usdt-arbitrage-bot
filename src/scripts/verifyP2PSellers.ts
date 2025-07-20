import chalk from 'chalk';
import axios from 'axios';
import Table from 'cli-table3';

async function verifyP2PSellers() {
  console.log(chalk.bgRed.white(' 🔍 Verifying P2P Sellers - Real-time Check \n'));
  
  try {
    // Fetch current P2P buy ads
    const response = await axios.post(
      'https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search',
      {
        page: 1,
        rows: 20,
        asset: "USDT",
        fiat: "INR",
        tradeType: "BUY",
        transAmount: 1000 // Check for ₹1000 worth
      }
    );

    if (!response.data?.data) {
      console.log(chalk.red('No data received from Binance'));
      return;
    }

    const ads = response.data.data;
    
    // Also fetch sell prices for comparison
    const sellResponse = await axios.post(
      'https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search',
      {
        page: 1,
        rows: 5,
        asset: "USDT",
        fiat: "INR",
        tradeType: "SELL"
      }
    );
    
    const bestSellPrice = parseFloat(sellResponse.data.data[0].adv.price);
    
    console.log(chalk.yellow(`Current P2P Sell Price: ₹${bestSellPrice}\n`));
    
    // Create table for display
    const table = new Table({
      head: ['#', 'Price', 'Merchant', 'Payment', 'Min-Max', 'Rating', 'Trades', 'Profit/USDT'],
      colWidths: [3, 8, 20, 25, 15, 10, 10, 15]
    });

    // Analyze each ad
    ads.forEach((ad: any, index: number) => {
      const price = parseFloat(ad.adv.price);
      const merchant = ad.advertiser.nickName;
      const methods = ad.adv.tradeMethods.map((m: any) => m.identifier || m.tradeMethodName).join(', ');
      const minOrder = parseFloat(ad.adv.minSingleTransAmount);
      const maxOrder = parseFloat(ad.adv.maxSingleTransAmount);
      const completionRate = (ad.advertiser.monthFinishRate * 100).toFixed(1);
      const monthlyTrades = ad.advertiser.monthOrderCount;
      const profit = bestSellPrice - price;
      const profitPercent = (profit / price * 100).toFixed(2);
      
      // Color code based on profit
      let profitColor = chalk.red;
      if (profit > 10) profitColor = chalk.green;
      else if (profit > 5) profitColor = chalk.yellow;
      else if (profit > 2) profitColor = chalk.white;
      
      // Flag suspicious prices
      const isSuspicious = price < 85;
      const merchantDisplay = isSuspicious ? chalk.red(merchant + ' ⚠️') : merchant;
      
      table.push([
        (index + 1).toString(),
        `₹${price}`,
        merchantDisplay,
        methods.substring(0, 23),
        `${minOrder}-${maxOrder}`,
        `${completionRate}%`,
        monthlyTrades.toString(),
        profitColor(`₹${profit.toFixed(2)} (${profitPercent}%)`)
      ]);
    });

    console.log(table.toString());
    
    // Analyze suspicious sellers
    const suspiciousSellers = ads.filter((ad: any) => parseFloat(ad.adv.price) < 85);
    
    if (suspiciousSellers.length > 0) {
      console.log(chalk.bgRed.white('\n ⚠️  WARNING: Suspicious Low Prices Found \n'));
      
      suspiciousSellers.forEach((ad: any) => {
        const price = parseFloat(ad.adv.price);
        const merchant = ad.advertiser.nickName;
        const methods = ad.adv.tradeMethods.map((m: any) => m.identifier).join(', ');
        
        console.log(chalk.red(`\n${merchant} - ₹${price}`));
        console.log(chalk.yellow('Payment Methods:'), methods);
        console.log(chalk.yellow('Completion Rate:'), ad.advertiser.monthFinishRate * 100 + '%');
        console.log(chalk.yellow('Monthly Trades:'), ad.advertiser.monthOrderCount);
        
        // Check for red flags
        const redFlags = [];
        if (methods.includes('CDM') || methods.includes('WesternUnion')) {
          redFlags.push('Uses cash deposit methods');
        }
        if (ad.advertiser.monthOrderCount < 100) {
          redFlags.push('Low trade volume');
        }
        if (price < 83) {
          redFlags.push('Price significantly below market (>8% discount)');
        }
        
        if (redFlags.length > 0) {
          console.log(chalk.red('🚩 Red Flags:'));
          redFlags.forEach(flag => console.log(chalk.red(`   - ${flag}`)));
        }
      });
    }
    
    // Find legitimate opportunities
    const legitimateOpportunities = ads.filter((ad: any) => {
      const price = parseFloat(ad.adv.price);
      const methods = ad.adv.tradeMethods.map((m: any) => m.identifier).join(', ');
      const isLegit = price >= 85 && price <= 92 && 
                      ad.advertiser.monthOrderCount > 50 &&
                      ad.advertiser.monthFinishRate > 0.95;
      return isLegit;
    });
    
    if (legitimateOpportunities.length > 0) {
      console.log(chalk.bgGreen.black('\n ✅ Legitimate Opportunities \n'));
      
      legitimateOpportunities.slice(0, 5).forEach((ad: any) => {
        const price = parseFloat(ad.adv.price);
        const profit = bestSellPrice - price;
        const profitPercent = (profit / price * 100).toFixed(2);
        
        console.log(chalk.green(`${ad.advertiser.nickName}:`));
        console.log(`   Price: ₹${price} | Profit: ₹${profit.toFixed(2)} (${profitPercent}%)`);
        console.log(`   Methods: ${ad.adv.tradeMethods.map((m: any) => m.identifier).join(', ')}`);
        console.log(`   Link: https://p2p.binance.com/en/advertiserDetail/${ad.advertiser.userNo}\n`);
      });
    }
    
    // Summary
    console.log(chalk.bgBlue.white('\n 📊 SUMMARY \n'));
    console.log(`Total ads analyzed: ${ads.length}`);
    console.log(`Suspicious sellers (<₹85): ${suspiciousSellers.length}`);
    console.log(`Legitimate opportunities: ${legitimateOpportunities.length}`);
    console.log(`Best legitimate price: ₹${legitimateOpportunities[0] ? parseFloat(legitimateOpportunities[0].adv.price) : 'N/A'}`);
    
    // Recommendations
    console.log(chalk.bgYellow.black('\n 💡 RECOMMENDATIONS \n'));
    console.log(chalk.yellow('1. AVOID sellers below ₹85 - Too risky'));
    console.log(chalk.yellow('2. PREFER sellers with:'));
    console.log('   - 95%+ completion rate');
    console.log('   - 100+ monthly trades');
    console.log('   - Standard payment methods (UPI, IMPS, Bank)');
    console.log(chalk.yellow('3. REALISTIC profit: 2-5% (₹2-5 per USDT)'));
    console.log(chalk.yellow('4. TEST with small amounts first'));
    
  } catch (error) {
    console.error(chalk.red('Error:', error.message));
  }
}

verifyP2PSellers().catch(console.error);