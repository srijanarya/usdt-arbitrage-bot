const axios = require('axios');
const chalk = require('chalk');
const Table = require('cli-table3');
const { exec } = require('child_process');
const fs = require('fs');

class AdaptiveP2PMonitor {
  constructor() {
    // Trading progression stages
    this.tradingStages = [
      { stage: 1, amount: 10, minProfit: 0.5, description: "Beginner - Testing the waters" },
      { stage: 2, amount: 50, minProfit: 0.4, description: "Building confidence" },
      { stage: 3, amount: 100, minProfit: 0.3, description: "Scaling up" },
      { stage: 4, amount: 500, minProfit: 0.25, description: "Experienced trader" },
      { stage: 5, amount: 1000, minProfit: 0.2, description: "High volume" },
      { stage: 6, amount: 5000, minProfit: 0.15, description: "Professional level" }
    ];
    
    // Your current stage
    this.currentStage = 1;
    this.currentAmount = 11.54; // Your starting amount
    this.completedTrades = 0;
    this.totalProfit = 0;
    
    // Load progress if exists
    this.loadProgress();
    
    this.openedDeals = new Set();
    this.expressRates = {};
  }

  loadProgress() {
    try {
      const data = fs.readFileSync('p2p-trading-progress.json', 'utf8');
      const progress = JSON.parse(data);
      this.currentStage = progress.currentStage || 1;
      this.completedTrades = progress.completedTrades || 0;
      this.totalProfit = progress.totalProfit || 0;
      this.currentAmount = progress.currentAmount || 11.54;
    } catch (e) {
      // No progress file yet
    }
  }

  saveProgress() {
    const progress = {
      currentStage: this.currentStage,
      completedTrades: this.completedTrades,
      totalProfit: this.totalProfit,
      currentAmount: this.currentAmount,
      lastUpdate: new Date().toISOString()
    };
    fs.writeFileSync('p2p-trading-progress.json', JSON.stringify(progress, null, 2));
  }

  async fetchExpressRates(amount) {
    try {
      const response = await axios.post(
        'https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search',
        {
          page: 1,
          rows: 5,
          payTypes: ["IMPS", "Bank Transfer", "UPI"],
          countries: [],
          asset: "USDT",
          fiat: "INR",
          tradeType: "SELL",
          transAmount: amount,
          merchantCheck: false
        }
      );

      if (response.data?.data?.length > 0) {
        const rates = {};
        response.data.data.forEach(ad => {
          const price = parseFloat(ad.adv.price);
          ad.adv.tradeMethods.forEach(method => {
            const methodName = method.identifier;
            if (!rates[methodName] || price < rates[methodName]) {
              rates[methodName] = price;
            }
          });
        });
        return rates;
      }
    } catch (error) {
      console.error('Error fetching Express rates:', error.message);
    }
    return null;
  }

  async findOpportunities(amount) {
    // Get Express sell rates for this amount
    const expressRates = await this.fetchExpressRates(amount);
    if (!expressRates) return [];

    const bestExpressRate = Math.min(...Object.values(expressRates));
    const opportunities = [];

    // Fetch buy opportunities
    try {
      const buyResponse = await axios.post(
        'https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search',
        {
          page: 1,
          rows: 15,
          payTypes: [],
          asset: "USDT",
          fiat: "INR",
          tradeType: "BUY",
          transAmount: amount
        }
      );

      if (buyResponse.data?.data) {
        buyResponse.data.data.forEach(ad => {
          const buyPrice = parseFloat(ad.adv.price);
          const available = parseFloat(ad.adv.surplusAmount);
          
          // Only consider if enough available
          if (available >= amount) {
            const profit = bestExpressRate - buyPrice;
            const profitPercent = (profit / buyPrice * 100);
            
            opportunities.push({
              merchant: ad.advertiser.nickName,
              buyPrice: buyPrice,
              sellPrice: bestExpressRate,
              profit: profit,
              profitPercent: profitPercent,
              available: available,
              methods: ad.adv.tradeMethods.map(m => m.identifier).join(', '),
              completionRate: ad.advertiser.monthFinishRate * 100,
              trades: ad.advertiser.monthOrderCount,
              url: `https://p2p.binance.com/en/advertiserDetail/${ad.adv.advNo}`
            });
          }
        });
      }
    } catch (error) {
      console.error('Error finding opportunities:', error.message);
    }

    return opportunities.sort((a, b) => b.profit - a.profit);
  }

  displayDashboard(opportunities) {
    console.clear();
    console.log(chalk.bgCyan.black(' 🎯 Adaptive P2P Trading Monitor '));
    
    // Display trading progress
    const stage = this.tradingStages[this.currentStage - 1];
    console.log(chalk.yellow('\n📊 Your Trading Progress:'));
    const progressTable = new Table({
      head: ['Metric', 'Value'],
      colWidths: [25, 40]
    });
    
    progressTable.push(
      ['Current Stage', `${this.currentStage}/6 - ${stage.description}`],
      ['Trading Amount', chalk.cyan(`${this.currentAmount} USDT`)],
      ['Completed Trades', chalk.green(this.completedTrades)],
      ['Total Profit', chalk.green(`₹${this.totalProfit.toFixed(2)}`)]
    );
    console.log(progressTable.toString());

    // Stage progression
    console.log(chalk.cyan('\n📈 Stage Progression:'));
    this.tradingStages.forEach((s, index) => {
      const current = index + 1 === this.currentStage;
      const completed = index + 1 < this.currentStage;
      const icon = completed ? '✅' : current ? '🔄' : '🔒';
      const color = completed ? chalk.green : current ? chalk.yellow : chalk.gray;
      console.log(color(`${icon} Stage ${s.stage}: ${s.amount} USDT - ${s.description}`));
    });

    // Next stage requirements
    if (this.currentStage < 6) {
      const tradesNeeded = 5 * this.currentStage - this.completedTrades;
      console.log(chalk.yellow(`\n📍 Next Stage: Complete ${tradesNeeded} more trades to unlock ${this.tradingStages[this.currentStage].amount} USDT trading`));
    }

    // Display opportunities
    console.log(chalk.yellow(`\n💰 Opportunities for ${this.currentAmount} USDT:`));
    
    if (opportunities.length > 0) {
      const table = new Table({
        head: ['Merchant', 'Buy', 'Sell', 'Profit', 'Rating', 'Action'],
        colWidths: [20, 10, 10, 15, 15, 10]
      });

      const minProfit = stage.minProfit;
      let bestQualified = null;

      opportunities.slice(0, 10).forEach((opp, index) => {
        const meetsProfit = opp.profit >= minProfit;
        const goodRating = opp.completionRate >= 95;
        const qualified = meetsProfit && goodRating;
        
        if (!bestQualified && qualified) {
          bestQualified = opp;
        }

        const profitColor = opp.profit > 1 ? chalk.green : opp.profit > 0.5 ? chalk.yellow : chalk.white;
        const ratingColor = opp.completionRate >= 98 ? chalk.green : opp.completionRate >= 95 ? chalk.yellow : chalk.red;
        
        table.push([
          opp.merchant.substring(0, 18),
          chalk.red(`₹${opp.buyPrice.toFixed(2)}`),
          chalk.green(`₹${opp.sellPrice.toFixed(2)}`),
          profitColor(`₹${opp.profit.toFixed(2)}\n${opp.profitPercent.toFixed(2)}%`),
          ratingColor(`${opp.completionRate.toFixed(1)}%\n${opp.trades} trades`),
          qualified ? chalk.bgGreen.black(' GO! ') : ''
        ]);
      });

      console.log(table.toString());

      // Auto-open best qualified opportunity
      if (bestQualified && !this.openedDeals.has(bestQualified.url)) {
        console.log(chalk.bgGreen.black('\n🚀 QUALIFIED OPPORTUNITY FOUND!'));
        console.log(chalk.white(`Merchant: ${bestQualified.merchant}`));
        console.log(chalk.white(`Expected profit: ₹${(bestQualified.profit * this.currentAmount).toFixed(2)}`));
        console.log(chalk.gray(`\nOpening in browser...`));
        
        this.openBuyPage(bestQualified.url);
        this.openedDeals.add(bestQualified.url);
        
        // Clear after 5 minutes
        setTimeout(() => {
          this.openedDeals.delete(bestQualified.url);
        }, 300000);

        // Simulate trade completion (in real app, you'd confirm actual trade)
        console.log(chalk.cyan('\n📝 After completing this trade:'));
        console.log(chalk.gray('1. Press T to mark trade as complete'));
        console.log(chalk.gray('2. Press F if trade failed'));
        console.log(chalk.gray('3. Press Q to quit'));
      }
    } else {
      console.log(chalk.red('No opportunities found at current rates'));
    }

    console.log(chalk.gray(`\n⏰ Refreshing in 15 seconds...`));
    console.log(chalk.gray(`Stage minimum profit: ₹${stage.minProfit}/USDT`));
  }

  recordTrade(success, profit = 0) {
    if (success) {
      this.completedTrades++;
      this.totalProfit += profit;
      
      // Check for stage progression
      const requiredTrades = 5 * this.currentStage;
      if (this.completedTrades >= requiredTrades && this.currentStage < 6) {
        this.currentStage++;
        const newStage = this.tradingStages[this.currentStage - 1];
        
        console.log(chalk.bgGreen.black('\n🎉 CONGRATULATIONS! STAGE UPGRADED!'));
        console.log(chalk.yellow(`You've unlocked Stage ${this.currentStage}: ${newStage.description}`));
        console.log(chalk.cyan(`New trading amount: ${newStage.amount} USDT`));
        
        // Update amount
        this.currentAmount = newStage.amount;
      }
      
      this.saveProgress();
    }
  }

  openBuyPage(url) {
    exec(`open -a "Google Chrome" "${url}"`);
  }

  async start() {
    console.log(chalk.yellow('🚀 Starting Adaptive P2P Monitor...'));
    console.log(chalk.gray('This monitor adapts to your trading experience\n'));

    const monitor = async () => {
      try {
        const opportunities = await this.findOpportunities(this.currentAmount);
        this.displayDashboard(opportunities);
      } catch (error) {
        console.error(chalk.red('Error:'), error.message);
      }
    };

    // Initial run
    await monitor();

    // Set up refresh interval
    const interval = setInterval(monitor, 15000);

    // Handle keyboard input (if available)
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true);
      process.stdin.resume();
      process.stdin.on('data', (key) => {
        const keyStr = key.toString();
        
        if (keyStr === 't' || keyStr === 'T') {
          // Mark trade as complete
          const profit = this.currentAmount * 0.5; // Estimate 0.5 INR/USDT profit
          this.recordTrade(true, profit);
          console.log(chalk.green('\n✅ Trade marked as complete!'));
          setTimeout(monitor, 1000);
        } else if (keyStr === 'f' || keyStr === 'F') {
          console.log(chalk.red('\n❌ Trade marked as failed'));
        } else if (keyStr === 'q' || keyStr === 'Q') {
          console.log(chalk.yellow('\n👋 Saving progress and exiting...'));
          this.saveProgress();
          clearInterval(interval);
          process.exit(0);
        }
      });
    }
  }
}

// Run
if (require.main === module) {
  const monitor = new AdaptiveP2PMonitor();
  monitor.start();
}

module.exports = AdaptiveP2PMonitor;