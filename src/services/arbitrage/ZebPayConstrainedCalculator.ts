import chalk from 'chalk';

interface ZebPayArbitrage {
  amount: number;
  buyPrice: number;
  sellPrice: number;
  investment: number;
  transferFee: number;
  actualAmountReceived: number;
  revenue: number;
  netProfit: number;
  roi: number;
  profitable: boolean;
}

export class ZebPayConstrainedCalculator {
  private readonly constraints = {
    maxWithdrawal: 100,        // ZebPay limit: 100 USDT
    tronTransferFee: 3,        // 3 USDT transfer fee
    zebpayTradingFee: 0.0025,  // 0.25% trading fee
    tds: 0.01                  // 1% TDS on P2P sale
  };

  calculateRealProfit(buyPrice: number, sellPrice: number, amount: number = 100): ZebPayArbitrage {
    // Can't exceed 100 USDT on ZebPay
    const actualAmount = Math.min(amount, this.constraints.maxWithdrawal);
    
    // Step 1: Calculate investment
    const investment = buyPrice * actualAmount;
    const tradingFee = investment * this.constraints.zebpayTradingFee;
    const totalInvestment = investment + tradingFee;
    
    // Step 2: Calculate what reaches Binance
    const amountAfterTransfer = actualAmount - this.constraints.tronTransferFee;
    
    // Step 3: Calculate P2P sale revenue
    const grossRevenue = sellPrice * amountAfterTransfer;
    const tds = grossRevenue * this.constraints.tds;
    const netRevenue = grossRevenue - tds;
    
    // Step 4: Calculate actual profit
    const netProfit = netRevenue - totalInvestment;
    const roi = (netProfit / totalInvestment) * 100;
    
    return {
      amount: actualAmount,
      buyPrice,
      sellPrice,
      investment: totalInvestment,
      transferFee: this.constraints.tronTransferFee * buyPrice, // Fee in INR
      actualAmountReceived: amountAfterTransfer,
      revenue: netRevenue,
      netProfit,
      roi,
      profitable: netProfit > 0
    };
  }

  findMinimumViablePrice(sellPrice: number, targetProfit: number = 100): number {
    // Binary search for minimum buy price
    let low = 80;
    let high = sellPrice;
    let result = high;
    
    while (high - low > 0.01) {
      const mid = (low + high) / 2;
      const analysis = this.calculateRealProfit(mid, sellPrice);
      
      if (analysis.netProfit >= targetProfit) {
        result = mid;
        low = mid;
      } else {
        high = mid;
      }
    }
    
    return result;
  }

  displayConstrainedAnalysis(buyPrice: number, sellPrice: number) {
    const analysis = this.calculateRealProfit(buyPrice, sellPrice);
    
    console.log(chalk.cyan('\n═══════════════════════════════════════'));
    console.log(chalk.cyan('    ZEBPAY CONSTRAINED ANALYSIS        '));
    console.log(chalk.cyan('═══════════════════════════════════════\n'));
    
    console.log(chalk.yellow('⚠️  Constraints:'));
    console.log(`   Max withdrawal: ${this.constraints.maxWithdrawal} USDT`);
    console.log(`   Transfer fee: ${this.constraints.tronTransferFee} USDT`);
    console.log(`   Actual USDT to sell: ${analysis.actualAmountReceived} USDT\n`);
    
    console.log(chalk.yellow('💰 Financial Breakdown:'));
    console.log(`   Buy ${analysis.amount} USDT at ₹${buyPrice}: ₹${analysis.investment.toFixed(2)}`);
    console.log(`   Transfer fee (3 USDT): ₹${analysis.transferFee.toFixed(2)}`);
    console.log(`   Sell ${analysis.actualAmountReceived} USDT at ₹${sellPrice}: ₹${analysis.revenue.toFixed(2)}`);
    console.log(`   Net Profit: ${analysis.profitable ? chalk.green(`₹${analysis.netProfit.toFixed(2)}`) : chalk.red(`₹${analysis.netProfit.toFixed(2)}`)}`);
    console.log(`   ROI: ${analysis.roi >= 0 ? chalk.green(`${analysis.roi.toFixed(2)}%`) : chalk.red(`${analysis.roi.toFixed(2)}%`)}\n`);
    
    if (!analysis.profitable) {
      console.log(chalk.red('❌ NOT PROFITABLE due to transfer fees!\n'));
    } else if (analysis.netProfit < 100) {
      console.log(chalk.yellow('⚠️  Profit below ₹100 threshold\n'));
    } else {
      console.log(chalk.green('✅ Profitable even with constraints!\n'));
    }
    
    console.log(chalk.cyan('═══════════════════════════════════════\n'));
  }

  // Alternative routes analysis
  analyzeAlternatives(currentBuyPrice: number, sellPrice: number) {
    console.log(chalk.yellow('🔍 Alternative Routes:\n'));
    
    // 1. Multiple small transactions
    const singleTx = this.calculateRealProfit(currentBuyPrice, sellPrice, 100);
    const doubleTx = {
      profit: singleTx.netProfit * 2,
      investment: singleTx.investment * 2,
      fees: singleTx.transferFee * 2,
      roi: singleTx.roi // ROI remains same
    };
    
    console.log(chalk.cyan('1. Multiple 100 USDT transactions:'));
    console.log(`   Single (100 USDT): ₹${singleTx.netProfit.toFixed(2)} profit`);
    console.log(`   Double (200 USDT): ₹${doubleTx.profit.toFixed(2)} profit`);
    console.log(`   Triple (300 USDT): ₹${(singleTx.netProfit * 3).toFixed(2)} profit\n`);
    
    // 2. Niyo Global route
    console.log(chalk.cyan('2. Niyo Global Card Route:'));
    console.log(`   Buy on international P2P at ~₹83`);
    console.log(`   No withdrawal limits`);
    console.log(`   Potential profit: ₹${((sellPrice - 83) * 100 * 0.98).toFixed(2)} per 100 USDT\n`);
    
    // 3. P2P Express route
    console.log(chalk.cyan('3. P2P Express Route:'));
    console.log(`   Buy from P2P sellers`);
    console.log(`   Sell on P2P Express at ₹86.17`);
    console.log(`   Need to find sellers below ₹85\n`);
    
    // 4. Required price for profitability
    const minPrice = this.findMinimumViablePrice(sellPrice, 100);
    console.log(chalk.yellow('📊 Break-even Analysis:'));
    console.log(`   Current ZebPay price: ₹${currentBuyPrice}`);
    console.log(`   Max viable buy price: ₹${minPrice.toFixed(2)}`);
    console.log(`   Need price to drop: ₹${(currentBuyPrice - minPrice).toFixed(2)}`);
  }
}

// Export singleton
export const zebpayCalculator = new ZebPayConstrainedCalculator();