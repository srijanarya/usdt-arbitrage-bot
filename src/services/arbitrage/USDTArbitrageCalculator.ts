import chalk from 'chalk';

interface ProfitAnalysis {
  buyPrice: number;
  sellPrice: number;
  amount: number;
  investment: number;
  revenue: number;
  grossProfit: number;
  netProfit: number;
  roi: number;
  profitable: boolean;
  recommendedAction: string;
  meetsMinQuantity: boolean;
  minQuantityRequired?: number;
}

interface MinimumQuantityCriteria {
  zebpay: number;      // Minimum USDT for ZebPay
  binanceP2P: number;  // Minimum INR for Binance P2P
  coindcx: number;     // Minimum USDT for CoinDCX
  wazirx: number;      // Minimum INR for WazirX
}

interface TradingSignal {
  signal: 'BUY' | 'HOLD' | 'WAIT';
  reason: string;
  expectedProfit: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  execution: {
    shouldExecute: boolean;
    suggestedAmount: number;
    estimatedTime: string;
  };
}

export class USDTArbitrageCalculator {
  // Fee structure based on your document
  private readonly fees = {
    zebpay: {
      tradingFee: 0.0025,  // 0.25%
      withdrawalFee: 1,     // 1 USDT
      depositFee: 0         // Free INR deposits
    },
    binance: {
      p2pFee: 0,           // No P2P fees
      expressMode: true     // Instant release available
    },
    taxes: {
      tds: 0.01,           // 1% TDS on sale
      gst: 0               // No GST on P2P
    }
  };

  // Risk parameters
  private readonly riskParams = {
    minProfitINR: 100,     // Minimum profit to consider
    riskBuffer: 50,        // Safety margin in INR
    maxSlippage: 0.005     // 0.5% max price slippage
  };

  // Minimum quantity requirements for different platforms
  private readonly minQuantity: MinimumQuantityCriteria = {
    zebpay: 10,         // 10 USDT minimum
    binanceP2P: 100,    // ₹100 minimum for P2P
    coindcx: 5,         // 5 USDT minimum
    wazirx: 100         // ₹100 minimum
  };

  // Realistic sell prices (accounting for actual market conditions)
  private readonly realisticSellPrices = {
    p2pExpress: 86.17,     // IMPS rate from user feedback
    p2pExpressUPI: 84.80,  // UPI rate from user feedback
    p2pRegular: 90.00,     // Regular P2P (non-Express) realistic rate
    p2pPremium: 94.75      // Premium rate (rarely achievable)
  };

  /**
   * Calculate detailed profit analysis for arbitrage
   */
  calculateProfit(buyPrice: number, sellPrice: number, amount: number, exchange: string = 'zebpay'): ProfitAnalysis {
    // Check minimum quantity requirements
    const meetsMinQuantity = this.checkMinimumQuantity(amount, buyPrice, exchange);
    const minQuantityRequired = this.getMinQuantityRequired(exchange, buyPrice);

    // Step 1: Calculate investment
    const investment = buyPrice * amount;
    const tradingFee = investment * this.fees.zebpay.tradingFee;
    const totalInvestment = investment + tradingFee;

    // Step 2: Calculate revenue
    const grossRevenue = sellPrice * amount;
    const tds = grossRevenue * this.fees.taxes.tds;
    const withdrawalCost = this.fees.zebpay.withdrawalFee * buyPrice; // Convert USDT fee to INR
    
    // Step 3: Calculate profits
    const totalCosts = totalInvestment + tds + withdrawalCost;
    const netRevenue = grossRevenue - tds;
    const netProfit = netRevenue - totalInvestment - withdrawalCost;
    const roi = (netProfit / totalInvestment) * 100;

    // Step 4: Determine profitability
    const profitable = netProfit >= this.riskParams.minProfitINR && meetsMinQuantity;
    const recommendedAction = this.getRecommendation(netProfit, roi, meetsMinQuantity);

    return {
      buyPrice,
      sellPrice,
      amount,
      investment: totalInvestment,
      revenue: netRevenue,
      grossProfit: grossRevenue - investment,
      netProfit,
      roi,
      profitable,
      recommendedAction,
      meetsMinQuantity,
      minQuantityRequired
    };
  }

  /**
   * Quick profitability check
   */
  quickProfitCheck(buyPrice: number, sellPrice: number, amount: number, exchange: string = 'zebpay') {
    const analysis = this.calculateProfit(buyPrice, sellPrice, amount, exchange);
    
    return {
      profitable: analysis.profitable,
      netProfit: analysis.netProfit,
      roi: analysis.roi,
      meetsMinQuantity: analysis.meetsMinQuantity,
      action: analysis.profitable ? 'EXECUTE' : 'SKIP'
    };
  }

  /**
   * Generate trading signal with risk assessment
   */
  getTradingSignal(buyPrice: number, sellPrice: number, amount: number, minProfit: number = 100): TradingSignal {
    const analysis = this.calculateProfit(buyPrice, sellPrice, amount);
    
    // Determine signal
    let signal: 'BUY' | 'HOLD' | 'WAIT' = 'WAIT';
    let reason = '';
    let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' = 'HIGH';
    
    if (analysis.netProfit >= minProfit * 2) {
      signal = 'BUY';
      reason = `High profit opportunity: ₹${analysis.netProfit.toFixed(2)} (${analysis.roi.toFixed(1)}% ROI)`;
      riskLevel = 'LOW';
    } else if (analysis.netProfit >= minProfit) {
      signal = 'BUY';
      reason = `Profitable opportunity: ₹${analysis.netProfit.toFixed(2)}`;
      riskLevel = 'MEDIUM';
    } else if (analysis.netProfit > 0) {
      signal = 'HOLD';
      reason = `Low profit: ₹${analysis.netProfit.toFixed(2)} (below ₹${minProfit} threshold)`;
      riskLevel = 'HIGH';
    } else {
      signal = 'WAIT';
      reason = `Unprofitable: Loss of ₹${Math.abs(analysis.netProfit).toFixed(2)}`;
      riskLevel = 'HIGH';
    }
    
    return {
      signal,
      reason,
      expectedProfit: analysis.netProfit,
      riskLevel,
      execution: {
        shouldExecute: signal === 'BUY',
        suggestedAmount: this.getSuggestedAmount(analysis.roi, amount),
        estimatedTime: signal === 'BUY' ? '5-10 minutes' : 'N/A'
      }
    };
  }

  /**
   * Calculate required sell price for target profit
   */
  getRequiredSellPrice(buyPrice: number, amount: number, targetProfit: number): number {
    // Reverse calculate from target profit
    const investment = buyPrice * amount * (1 + this.fees.zebpay.tradingFee);
    const withdrawalCost = this.fees.zebpay.withdrawalFee * buyPrice;
    const totalCosts = investment + withdrawalCost;
    
    // Required revenue after TDS
    const requiredNetRevenue = totalCosts + targetProfit;
    // Gross revenue needed (before TDS)
    const requiredGrossRevenue = requiredNetRevenue / (1 - this.fees.taxes.tds);
    // Required sell price per USDT
    const requiredSellPrice = requiredGrossRevenue / amount;
    
    return requiredSellPrice;
  }

  /**
   * Calculate break-even price
   */
  getBreakEvenPrice(buyPrice: number, amount: number): number {
    return this.getRequiredSellPrice(buyPrice, amount, 0);
  }

  /**
   * Batch analysis for multiple price points
   */
  batchAnalysis(buyPrices: number[], sellPrice: number, amount: number) {
    return buyPrices.map(buyPrice => ({
      buyPrice,
      analysis: this.calculateProfit(buyPrice, sellPrice, amount),
      signal: this.getTradingSignal(buyPrice, sellPrice, amount)
    }));
  }

  /**
   * Risk-adjusted position sizing
   */
  private getSuggestedAmount(roi: number, requestedAmount: number): number {
    if (roi > 5) return requestedAmount;           // Full amount for high ROI
    if (roi > 3) return requestedAmount * 0.75;    // 75% for medium ROI
    if (roi > 2) return requestedAmount * 0.5;     // 50% for low ROI
    return requestedAmount * 0.25;                  // 25% for minimal ROI
  }

  /**
   * Check if amount meets minimum quantity requirements
   */
  private checkMinimumQuantity(amount: number, buyPrice: number, exchange: string): boolean {
    const minQuantity = this.minQuantity[exchange as keyof MinimumQuantityCriteria] || 0;
    
    if (exchange === 'binanceP2P' || exchange === 'wazirx') {
      // These platforms have INR minimums
      return (amount * buyPrice) >= minQuantity;
    }
    
    // Other platforms have USDT minimums
    return amount >= minQuantity;
  }

  /**
   * Get minimum quantity required for an exchange
   */
  private getMinQuantityRequired(exchange: string, buyPrice: number): number {
    const minQuantity = this.minQuantity[exchange as keyof MinimumQuantityCriteria] || 0;
    
    if (exchange === 'binanceP2P' || exchange === 'wazirx') {
      // Convert INR minimum to USDT
      return minQuantity / buyPrice;
    }
    
    return minQuantity;
  }

  /**
   * Calculate with realistic sell prices
   */
  calculateWithRealisticPrices(buyPrice: number, amount: number, exchange: string = 'zebpay'): {
    express: ProfitAnalysis;
    regular: ProfitAnalysis;
    premium: ProfitAnalysis;
  } {
    return {
      express: this.calculateProfit(buyPrice, this.realisticSellPrices.p2pExpress, amount, exchange),
      regular: this.calculateProfit(buyPrice, this.realisticSellPrices.p2pRegular, amount, exchange),
      premium: this.calculateProfit(buyPrice, this.realisticSellPrices.p2pPremium, amount, exchange)
    };
  }

  /**
   * Get recommendation based on profit analysis
   */
  private getRecommendation(netProfit: number, roi: number, meetsMinQuantity: boolean): string {
    if (!meetsMinQuantity) {
      return "❌ SKIP - Below minimum quantity requirement";
    }
    
    if (netProfit >= 500 && roi >= 5) {
      return "🚀 STRONG BUY - Excellent opportunity!";
    } else if (netProfit >= 200 && roi >= 3) {
      return "✅ BUY - Good profit opportunity";
    } else if (netProfit >= 100 && roi >= 2) {
      return "📊 MODERATE BUY - Acceptable profit";
    } else if (netProfit > 0) {
      return "⚠️ HOLD - Profit too low";
    } else {
      return "❌ SKIP - Unprofitable trade";
    }
  }

  /**
   * Display formatted analysis
   */
  displayAnalysis(analysis: ProfitAnalysis) {
    console.log(chalk.cyan('\n═══════════════════════════════════════'));
    console.log(chalk.cyan('       ARBITRAGE ANALYSIS REPORT        '));
    console.log(chalk.cyan('═══════════════════════════════════════\n'));

    console.log(chalk.yellow('📊 Price Information:'));
    console.log(`   Buy Price:           ₹${analysis.buyPrice.toFixed(2)}`);
    console.log(`   Sell Price:          ₹${analysis.sellPrice.toFixed(2)}`);
    console.log(`   Spread:              ₹${(analysis.sellPrice - analysis.buyPrice).toFixed(2)}`);
    console.log(`   Amount:              ${analysis.amount} USDT`);
    
    if (!analysis.meetsMinQuantity) {
      console.log(chalk.red(`   ⚠️  Below min qty:    ${analysis.minQuantityRequired?.toFixed(2)} USDT required`));
    } else {
      console.log(chalk.green(`   ✅ Meets min qty:    ${analysis.minQuantityRequired?.toFixed(2)} USDT`));
    }
    console.log('');

    console.log(chalk.yellow('💰 Financial Breakdown:'));
    console.log(`   Investment:          ₹${analysis.investment.toFixed(2)}`);
    console.log(`   Revenue:             ₹${analysis.revenue.toFixed(2)}`);
    console.log(`   Gross Profit:        ₹${analysis.grossProfit.toFixed(2)}`);
    console.log(`   Net Profit:          ${analysis.profitable ? chalk.green(`₹${analysis.netProfit.toFixed(2)}`) : chalk.red(`₹${analysis.netProfit.toFixed(2)}`)}`);
    console.log(`   ROI:                 ${analysis.roi >= 0 ? chalk.green(`${analysis.roi.toFixed(2)}%`) : chalk.red(`${analysis.roi.toFixed(2)}%`)}\n`);

    console.log(chalk.yellow('🎯 Recommendation:'));
    console.log(`   ${analysis.recommendedAction}\n`);

    console.log(chalk.cyan('═══════════════════════════════════════\n'));
  }

  /**
   * Display comparison with realistic prices
   */
  displayRealisticComparison(buyPrice: number, amount: number, exchange: string = 'zebpay') {
    const results = this.calculateWithRealisticPrices(buyPrice, amount, exchange);
    
    console.log(chalk.cyan('\n═══════════════════════════════════════'));
    console.log(chalk.cyan('    REALISTIC PRICE COMPARISON          '));
    console.log(chalk.cyan('═══════════════════════════════════════\n'));
    
    console.log(chalk.yellow(`💰 Buy Price: ₹${buyPrice.toFixed(2)} | Amount: ${amount} USDT\n`));
    
    // Express rates
    console.log(chalk.blue('1. P2P Express (IMPS):'));
    console.log(`   Sell Price: ₹${this.realisticSellPrices.p2pExpress}`);
    console.log(`   Net Profit: ${results.express.profitable ? chalk.green(`₹${results.express.netProfit.toFixed(2)}`) : chalk.red(`₹${results.express.netProfit.toFixed(2)}`)}`);
    console.log(`   ROI: ${results.express.roi.toFixed(2)}%`);
    console.log(`   ${results.express.recommendedAction}\n`);
    
    // Regular P2P
    console.log(chalk.yellow('2. Regular P2P (₹90):'));
    console.log(`   Sell Price: ₹${this.realisticSellPrices.p2pRegular}`);
    console.log(`   Net Profit: ${results.regular.profitable ? chalk.green(`₹${results.regular.netProfit.toFixed(2)}`) : chalk.red(`₹${results.regular.netProfit.toFixed(2)}`)}`);
    console.log(`   ROI: ${results.regular.roi.toFixed(2)}%`);
    console.log(`   ${results.regular.recommendedAction}\n`);
    
    // Premium rates
    console.log(chalk.gray('3. Premium P2P (₹94.75):'));
    console.log(`   Sell Price: ₹${this.realisticSellPrices.p2pPremium}`);
    console.log(`   Net Profit: ${results.premium.profitable ? chalk.green(`₹${results.premium.netProfit.toFixed(2)}`) : chalk.red(`₹${results.premium.netProfit.toFixed(2)}`)}`);
    console.log(`   ROI: ${results.premium.roi.toFixed(2)}%`);
    console.log(`   ${results.premium.recommendedAction}\n`);
    
    console.log(chalk.cyan('═══════════════════════════════════════\n'));
  }
}

// Export singleton instance
export const arbitrageCalculator = new USDTArbitrageCalculator();