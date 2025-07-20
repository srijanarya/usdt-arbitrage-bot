import chalk from 'chalk';
import axios from 'axios';
import Table from 'cli-table3';

interface P2PAd {
  price: number;
  merchant: string;
  minOrder: number;
  maxOrder: number;
  paymentMethods: string[];
  completionRate: number;
  monthlyTrades: number;
  userId: string;
}

class P2PArbitrageScanner {
  private readonly minProfitThreshold = 0.5; // 0.5% minimum profit
  private readonly minTradeVolume = 50; // Minimum monthly trades
  private readonly minCompletionRate = 0.95; // 95% completion rate

  async scanForOpportunities() {
    console.log(chalk.bgCyan.black(' 🔍 P2P Direct Arbitrage Scanner \n'));
    
    try {
      // Fetch buy and sell ads simultaneously
      const [buyAds, sellAds] = await Promise.all([
        this.fetchP2PAds('BUY'),
        this.fetchP2PAds('SELL')
      ]);
      
      // Filter legitimate traders
      const legitimateBuyers = this.filterLegitimateTraders(buyAds);
      const legitimateSellers = this.filterLegitimateTraders(sellAds);
      
      console.log(chalk.yellow(`Found ${legitimateBuyers.length} legitimate buyers`));
      console.log(chalk.yellow(`Found ${legitimateSellers.length} legitimate sellers\n`));
      
      // Find arbitrage opportunities
      const opportunities = this.findArbitrageOpportunities(legitimateBuyers, legitimateSellers);
      
      // Display results
      this.displayOpportunities(opportunities);
      
      // Show best P2P rates
      this.displayBestRates(legitimateBuyers, legitimateSellers);
      
      // Show payment method analysis
      this.analyzePaymentMethods(legitimateBuyers, legitimateSellers);
      
    } catch (error) {
      console.error(chalk.red('Error scanning P2P market:', error));
    }
  }

  async fetchP2PAds(tradeType: 'BUY' | 'SELL'): Promise<P2PAd[]> {
    const response = await axios.post(
      'https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search',
      {
        page: 1,
        rows: 20,
        asset: "USDT",
        fiat: "INR",
        tradeType: tradeType,
        transAmount: tradeType === 'BUY' ? 10000 : undefined // ₹10,000 for buy
      }
    );
    
    return response.data.data.map((ad: any) => ({
      price: parseFloat(ad.adv.price),
      merchant: ad.advertiser.nickName,
      minOrder: parseFloat(ad.adv.minSingleTransAmount),
      maxOrder: parseFloat(ad.adv.maxSingleTransAmount),
      paymentMethods: ad.adv.tradeMethods.map((m: any) => m.identifier || m.tradeMethodName),
      completionRate: ad.advertiser.monthFinishRate,
      monthlyTrades: ad.advertiser.monthOrderCount,
      userId: ad.advertiser.userNo
    }));
  }

  filterLegitimateTraders(ads: P2PAd[]): P2PAd[] {
    return ads.filter(ad => 
      ad.completionRate >= this.minCompletionRate &&
      ad.monthlyTrades >= this.minTradeVolume &&
      ad.price >= 80 && // Not suspiciously low
      ad.price <= 100   // Not suspiciously high
    );
  }

  findArbitrageOpportunities(buyers: P2PAd[], sellers: P2PAd[]): Array<{
    buyer: P2PAd;
    seller: P2PAd;
    spread: number;
    spreadPercent: number;
    profitOn10k: number;
  }> {
    const opportunities = [];
    
    for (const buyer of buyers) {
      for (const seller of sellers) {
        const spread = buyer.price - seller.price;
        const spreadPercent = (spread / seller.price) * 100;
        
        if (spreadPercent >= this.minProfitThreshold) {
          // Check if they have common payment methods
          const commonMethods = buyer.paymentMethods.filter(method => 
            seller.paymentMethods.includes(method)
          );
          
          if (commonMethods.length > 0) {
            opportunities.push({
              buyer,
              seller,
              spread,
              spreadPercent,
              profitOn10k: (10000 / seller.price) * spread
            });
          }
        }
      }
    }
    
    // Sort by profit percentage
    return opportunities.sort((a, b) => b.spreadPercent - a.spreadPercent);
  }

  displayOpportunities(opportunities: any[]) {
    console.log(chalk.bgGreen.black(' 💰 P2P Arbitrage Opportunities \n'));
    
    if (opportunities.length === 0) {
      console.log(chalk.red('No profitable P2P arbitrage opportunities found\n'));
      return;
    }
    
    const table = new Table({
      head: ['#', 'Buy From', 'Sell To', 'Spread', 'Profit %', 'Profit on ₹10k', 'Payment'],
      colWidths: [3, 20, 20, 10, 10, 15, 25]
    });
    
    opportunities.slice(0, 10).forEach((opp, index) => {
      const commonMethods = opp.buyer.paymentMethods.filter((method: string) => 
        opp.seller.paymentMethods.includes(method)
      ).join(', ');
      
      table.push([
        (index + 1).toString(),
        `${opp.seller.merchant}\n₹${opp.seller.price.toFixed(2)}`,
        `${opp.buyer.merchant}\n₹${opp.buyer.price.toFixed(2)}`,
        chalk.green(`₹${opp.spread.toFixed(2)}`),
        chalk.green(`${opp.spreadPercent.toFixed(2)}%`),
        chalk.green(`₹${opp.profitOn10k.toFixed(0)}`),
        commonMethods.substring(0, 23)
      ]);
    });
    
    console.log(table.toString());
    
    if (opportunities.length > 0) {
      const best = opportunities[0];
      console.log(chalk.yellow('\n🏆 Best Opportunity:'));
      console.log(`Buy from: ${best.seller.merchant} at ₹${best.seller.price.toFixed(2)}`);
      console.log(`Sell to: ${best.buyer.merchant} at ₹${best.buyer.price.toFixed(2)}`);
      console.log(`Profit: ₹${best.spread.toFixed(2)} per USDT (${best.spreadPercent.toFixed(2)}%)`);
      console.log(`On ₹1,00,000: Profit of ₹${(best.profitOn10k * 10).toFixed(0)}`);
    }
  }

  displayBestRates(buyers: P2PAd[], sellers: P2PAd[]) {
    console.log(chalk.bgBlue.white('\n 📊 Best P2P Rates \n'));
    
    const bestBuyRate = Math.max(...buyers.map(b => b.price));
    const bestSellRate = Math.min(...sellers.map(s => s.price));
    const averageBuyRate = buyers.reduce((sum, b) => sum + b.price, 0) / buyers.length;
    const averageSellRate = sellers.reduce((sum, s) => sum + s.price, 0) / sellers.length;
    
    console.log(chalk.cyan('Buying USDT (You sell INR):'));
    console.log(`Best rate: ₹${bestSellRate.toFixed(2)} (cheapest USDT)`);
    console.log(`Average rate: ₹${averageSellRate.toFixed(2)}`);
    console.log(`Worst rate: ₹${Math.max(...sellers.map(s => s.price)).toFixed(2)}`);
    
    console.log(chalk.yellow('\nSelling USDT (You get INR):'));
    console.log(`Best rate: ₹${bestBuyRate.toFixed(2)} (highest price)`);
    console.log(`Average rate: ₹${averageBuyRate.toFixed(2)}`);
    console.log(`Worst rate: ₹${Math.min(...buyers.map(b => b.price)).toFixed(2)}`);
    
    console.log(chalk.green(`\nMax Spread: ₹${(bestBuyRate - bestSellRate).toFixed(2)} (${((bestBuyRate - bestSellRate) / bestSellRate * 100).toFixed(2)}%)`));
  }

  analyzePaymentMethods(buyers: P2PAd[], sellers: P2PAd[]) {
    console.log(chalk.bgMagenta.white('\n 💳 Payment Method Analysis \n'));
    
    // Count payment methods
    const buyerMethods = new Map<string, number>();
    const sellerMethods = new Map<string, number>();
    
    buyers.forEach(buyer => {
      buyer.paymentMethods.forEach(method => {
        buyerMethods.set(method, (buyerMethods.get(method) || 0) + 1);
      });
    });
    
    sellers.forEach(seller => {
      seller.paymentMethods.forEach(method => {
        sellerMethods.set(method, (sellerMethods.get(method) || 0) + 1);
      });
    });
    
    const table = new Table({
      head: ['Payment Method', 'Buyers Accept', 'Sellers Accept', 'Overlap'],
      colWidths: [20, 15, 15, 10]
    });
    
    const allMethods = new Set([...buyerMethods.keys(), ...sellerMethods.keys()]);
    
    allMethods.forEach(method => {
      const buyerCount = buyerMethods.get(method) || 0;
      const sellerCount = sellerMethods.get(method) || 0;
      const overlap = Math.min(buyerCount, sellerCount);
      
      table.push([
        method,
        buyerCount.toString(),
        sellerCount.toString(),
        overlap > 0 ? chalk.green(overlap.toString()) : chalk.red('0')
      ]);
    });
    
    console.log(table.toString());
    
    // Find most versatile payment methods
    const versatileMethods = Array.from(allMethods)
      .filter(method => 
        (buyerMethods.get(method) || 0) >= 5 && 
        (sellerMethods.get(method) || 0) >= 5
      );
    
    if (versatileMethods.length > 0) {
      console.log(chalk.green('\n✅ Best payment methods for arbitrage:'));
      versatileMethods.forEach(method => {
        console.log(`  • ${method}`);
      });
    }
  }
}

// Create a continuous monitor
async function continuousMonitor() {
  const scanner = new P2PArbitrageScanner();
  
  console.log(chalk.bgCyan.black(' 🔄 Starting continuous P2P monitoring... \n'));
  
  // Initial scan
  await scanner.scanForOpportunities();
  
  // Scan every 2 minutes
  setInterval(async () => {
    console.clear();
    await scanner.scanForOpportunities();
    console.log(chalk.gray('\n⏳ Next scan in 2 minutes... Press Ctrl+C to stop'));
  }, 120000);
}

// Run based on command line argument
const args = process.argv.slice(2);
if (args.includes('--continuous') || args.includes('-c')) {
  continuousMonitor().catch(console.error);
} else {
  // Single scan
  const scanner = new P2PArbitrageScanner();
  scanner.scanForOpportunities().catch(console.error);
}