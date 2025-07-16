export interface ProfitCalculation {
  grossProfit: number;
  tradingFees: number;
  gst: number;
  capitalGainsTax: number;
  tds: number;
  netProfit: number;
  profitPercentage: number;
}

export interface OptimalVolume {
  suggestedVolume: number;
  numberOfTransactions: number;
  tdsAvoidance: boolean;
}

export interface ArbitrageOpportunity {
  buyExchange: string;
  sellExchange: string;
  buyPrice: number;
  sellPrice: number;
  profitPercentage: number;
  recommendedVolume: number;
}

export class PriceCalculator {
  private readonly TDS_LIMIT = 50000;
  private readonly TDS_RATE = 0.01; // 1%
  private readonly CAPITAL_GAINS_TAX_RATE = 0.30; // 30%
  private readonly GST_RATE = 0.18; // 18% on fees
  private readonly DEFAULT_TRADING_FEE = 0.001; // 0.1%

  calculateNetProfit(
    buyPrice: number,
    sellPrice: number,
    volume: number
  ): ProfitCalculation {
    // Calculate quantity based on volume and buy price
    const quantity = volume / buyPrice;
    
    // Gross profit
    const grossProfit = (sellPrice - buyPrice) * quantity;
    
    // Trading fees (0.1% each side = 0.2% total)
    const buyFee = volume * this.DEFAULT_TRADING_FEE;
    const sellFee = (sellPrice * quantity) * this.DEFAULT_TRADING_FEE;
    const tradingFees = buyFee + sellFee;
    
    // GST on trading fees
    const gst = tradingFees * this.GST_RATE;
    
    // TDS calculation (1% on transactions > 50k)
    const tds = volume > this.TDS_LIMIT ? volume * this.TDS_RATE : 0;
    
    // Net profit before capital gains tax
    const profitBeforeTax = grossProfit - tradingFees - gst - tds;
    
    // Capital gains tax (30% on profit)
    const capitalGainsTax = profitBeforeTax > 0 ? profitBeforeTax * this.CAPITAL_GAINS_TAX_RATE : 0;
    
    // Final net profit
    const netProfit = profitBeforeTax - capitalGainsTax;
    const profitPercentage = (netProfit / volume) * 100;

    return {
      grossProfit: Math.round(grossProfit * 100) / 100,
      tradingFees: Math.round(tradingFees * 100) / 100,
      gst: Math.round(gst * 100) / 100,
      capitalGainsTax: Math.round(capitalGainsTax * 100) / 100,
      tds: Math.round(tds * 100) / 100,
      netProfit: Math.round(netProfit * 100) / 100,
      profitPercentage: Math.round(profitPercentage * 100) / 100
    };
  }

  calculateOptimalVolume(
    availableCapital: number,
    currentPrice: number
  ): OptimalVolume {
    // Optimal volume is just under TDS limit
    const optimalVolume = Math.min(49900, availableCapital);
    const numberOfTransactions = Math.ceil(availableCapital / optimalVolume);

    return {
      suggestedVolume: optimalVolume,
      numberOfTransactions,
      tdsAvoidance: true
    };
  }

  findBestArbitrageRoute(exchanges: Array<{
    name: string;
    buyPrice: number;
    sellPrice: number;
    fees: number;
  }>): ArbitrageOpportunity | null {
    let bestOpportunity: ArbitrageOpportunity | null = null;
    let maxProfit = 0;

    for (const buyExchange of exchanges) {
      for (const sellExchange of exchanges) {
        if (buyExchange.name === sellExchange.name) continue;

        const profit = this.calculateNetProfit(
          buyExchange.buyPrice,
          sellExchange.sellPrice,
          49900
        );

        if (profit.profitPercentage > maxProfit) {
          maxProfit = profit.profitPercentage;
          bestOpportunity = {
            buyExchange: buyExchange.name,
            sellExchange: sellExchange.name,
            buyPrice: buyExchange.buyPrice,
            sellPrice: sellExchange.sellPrice,
            profitPercentage: profit.profitPercentage,
            recommendedVolume: 49900
          };
        }
      }
    }

    return maxProfit > 0.5 ? bestOpportunity : null;
  }

  calculateP2PPremium(exchangePrice: number, p2pPrice: number): number {
    return ((p2pPrice - exchangePrice) / exchangePrice) * 100;
  }

  calculateP2PProfit(
    buyPrice: number,
    p2pSellPrice: number,
    p2pFee: number,
    volume: number
  ): any {
    const quantity = volume / buyPrice;
    const grossProfit = (p2pSellPrice - buyPrice) * quantity;
    
    // Exchange fees
    const exchangeFee = volume * this.DEFAULT_TRADING_FEE;
    
    // P2P platform fee
    const p2pPlatformFee = (p2pSellPrice * quantity) * p2pFee;
    
    // Total fees
    const totalFees = exchangeFee + p2pPlatformFee;
    const gst = totalFees * this.GST_RATE;
    
    // TDS
    const tds = volume > this.TDS_LIMIT ? volume * this.TDS_RATE : 0;
    
    // Net profit calculation
    const profitBeforeTax = grossProfit - totalFees - gst - tds;
    const capitalGainsTax = profitBeforeTax > 0 ? profitBeforeTax * this.CAPITAL_GAINS_TAX_RATE : 0;
    const netProfit = profitBeforeTax - capitalGainsTax;
    
    const effectivePremium = (netProfit / volume) * 100;

    return {
      grossProfit: Math.round(grossProfit * 100) / 100,
      netProfit: Math.round(netProfit * 100) / 100,
      effectivePremium: Math.round(effectivePremium * 100) / 100,
      fees: {
        exchangeFee: Math.round(exchangeFee * 100) / 100,
        p2pFee: Math.round(p2pPlatformFee * 100) / 100,
        gst: Math.round(gst * 100) / 100
      }
    };
  }

  calculateBreakEvenPrice(buyPrice: number, volume: number): number {
    // Break-even needs to cover:
    // - Trading fees (both sides)
    // - GST on fees
    // - Capital gains tax
    // Roughly 0.5% total overhead
    return buyPrice * 1.005;
  }

  calculateMinimumProfitPrice(
    buyPrice: number,
    volume: number,
    minProfitPercentage: number
  ): number {
    // Account for all fees and desired profit
    const breakEven = this.calculateBreakEvenPrice(buyPrice, volume);
    const minProfitMultiplier = 1 + (minProfitPercentage / 100);
    return breakEven * minProfitMultiplier;
  }

  findMultiHopRoute(exchanges: Record<string, { buy: number; sell: number }>): any {
    // Simple implementation for two-hop arbitrage
    const route = {
      path: ['WazirX', 'LocalP2P'],
      totalProfit: 0,
      steps: [
        { from: 'Market', to: 'WazirX', action: 'buy', price: exchanges['WazirX'].buy },
        { from: 'WazirX', to: 'LocalP2P', action: 'transfer', cost: 1 },
        { from: 'LocalP2P', to: 'Market', action: 'sell', price: exchanges['LocalP2P'].sell }
      ]
    };

    const profit = this.calculateNetProfit(
      exchanges['WazirX'].buy,
      exchanges['LocalP2P'].sell,
      49900
    );

    route.totalProfit = profit.profitPercentage;
    return route;
  }

  calculateRiskAdjustedProfit(
    baseProfit: number,
    riskFactors: Record<string, number>
  ): number {
    let adjustedProfit = baseProfit;
    
    for (const factor of Object.values(riskFactors)) {
      adjustedProfit *= factor;
    }
    
    return Math.round(adjustedProfit * 100) / 100;
  }

  optimizeFeeStructure(monthlyVolume: number): any {
    return {
      recommendedExchanges: ['CoinDCX'],
      estimatedMonthlySavings: monthlyVolume * 0.0005, // 0.05% savings
      breakEvenVolume: 1000000,
      suggestions: ['Consider volume discount programs']
    };
  }

  optimizeForTax(totalVolume: number): any {
    const numberOfTransactions = Math.ceil(totalVolume / 49900);
    const transactionAmounts: number[] = [];
    
    let remaining = totalVolume;
    while (remaining > 0) {
      const amount = Math.min(49900, remaining);
      transactionAmounts.push(amount);
      remaining -= amount;
    }

    const tdsSaved = totalVolume > this.TDS_LIMIT ? totalVolume * this.TDS_RATE : 0;
    const additionalCosts = (numberOfTransactions - 1) * 10; // Assume ₹10 per extra transaction

    return {
      numberOfTransactions,
      transactionAmounts,
      tdsSaved: Math.round(tdsSaved),
      additionalCosts
    };
  }
}