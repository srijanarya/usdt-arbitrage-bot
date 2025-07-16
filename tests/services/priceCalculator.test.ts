import { PriceCalculator } from '../../src/services/priceCalculator';

describe('Price Calculator Service', () => {
  let calculator: PriceCalculator;

  beforeEach(() => {
    calculator = new PriceCalculator();
  });

  describe('calculateNetProfit', () => {
    it('should calculate profit correctly with all fees', () => {
      const buyPrice = 87.50;
      const sellPrice = 89.20;
      const volume = 49000; // Under TDS limit
      
      const result = calculator.calculateNetProfit(buyPrice, sellPrice, volume);

      // Expected calculation:
      // Gross profit: (89.20 - 87.50) * (49000 / 87.50) = 952
      // Trading fees: 49000 * 0.003 = 147
      // GST on fees: 147 * 0.18 = 26.46
      // Net profit before tax: 952 - 147 - 26.46 = 778.54
      // Capital gains tax: 778.54 * 0.30 = 233.56
      // Final profit: 778.54 - 233.56 = 544.98

      expect(result.grossProfit).toBeCloseTo(952, 0);
      expect(result.tradingFees).toBeCloseTo(147, 0);
      expect(result.gst).toBeCloseTo(26.46, 2);
      expect(result.capitalGainsTax).toBeCloseTo(233.56, 2);
      expect(result.netProfit).toBeCloseTo(544.98, 2);
      expect(result.profitPercentage).toBeCloseTo(1.11, 2);
    });

    it('should handle TDS for transactions above ₹50,000', () => {
      const buyPrice = 87.50;
      const sellPrice = 89.20;
      const volume = 100000; // Above TDS limit
      
      const result = calculator.calculateNetProfit(buyPrice, sellPrice, volume);

      // TDS: 1% of 100000 = 1000
      expect(result.tds).toBe(1000);
      expect(result.netProfit).toBeLessThan(result.grossProfit - result.tradingFees - result.gst - result.capitalGainsTax);
    });

    it('should return negative profit for loss-making trades', () => {
      const buyPrice = 89.50;
      const sellPrice = 87.20; // Selling at loss
      const volume = 49000;
      
      const result = calculator.calculateNetProfit(buyPrice, sellPrice, volume);

      expect(result.netProfit).toBeLessThan(0);
      expect(result.profitPercentage).toBeLessThan(0);
    });
  });

  describe('calculateOptimalVolume', () => {
    it('should suggest optimal volume under TDS limit', () => {
      const availableCapital = 200000;
      const currentPrice = 87.50;
      
      const optimal = calculator.calculateOptimalVolume(availableCapital, currentPrice);

      expect(optimal.suggestedVolume).toBe(49900); // Just under 50k
      expect(optimal.numberOfTransactions).toBe(4); // 200k / 49.9k
      expect(optimal.tdsAvoidance).toBe(true);
    });

    it('should handle small capital amounts', () => {
      const availableCapital = 30000;
      const currentPrice = 87.50;
      
      const optimal = calculator.calculateOptimalVolume(availableCapital, currentPrice);

      expect(optimal.suggestedVolume).toBe(30000);
      expect(optimal.numberOfTransactions).toBe(1);
      expect(optimal.tdsAvoidance).toBe(true);
    });
  });

  describe('calculateArbitrageOpportunity', () => {
    it('should identify profitable arbitrage opportunities', () => {
      const exchanges = [
        { name: 'CoinDCX', buyPrice: 87.48, sellPrice: 87.52, fees: 0.001 },
        { name: 'WazirX', buyPrice: 86.74, sellPrice: 86.78, fees: 0.002 },
        { name: 'ZebPay', buyPrice: 89.15, sellPrice: 89.20, fees: 0.0015 }
      ];

      const opportunity = calculator.findBestArbitrageRoute(exchanges);

      expect(opportunity).toEqual({
        buyExchange: 'WazirX',
        sellExchange: 'ZebPay',
        buyPrice: 86.74,
        sellPrice: 89.20,
        profitPercentage: expect.any(Number),
        recommendedVolume: 49900
      });

      expect(opportunity!.profitPercentage).toBeGreaterThan(2);
    });

    it('should return null for no profitable opportunities', () => {
      const exchanges = [
        { name: 'CoinDCX', buyPrice: 87.48, sellPrice: 87.52, fees: 0.001 },
        { name: 'WazirX', buyPrice: 87.45, sellPrice: 87.49, fees: 0.002 },
        { name: 'ZebPay', buyPrice: 87.50, sellPrice: 87.54, fees: 0.0015 }
      ];

      const opportunity = calculator.findBestArbitrageRoute(exchanges);

      expect(opportunity).toBeNull();
    });
  });

  describe('P2P Premium Calculations', () => {
    it('should calculate P2P premium correctly', () => {
      const exchangePrice = 87.50;
      const p2pPrice = 90.20;
      
      const premium = calculator.calculateP2PPremium(exchangePrice, p2pPrice);

      expect(premium).toBeCloseTo(3.09, 2); // ((90.20 - 87.50) / 87.50) * 100
    });

    it('should calculate effective P2P profit after all costs', () => {
      const buyPrice = 87.50;
      const p2pSellPrice = 90.20;
      const p2pFee = 0.002; // 0.2% P2P platform fee
      const volume = 49000;

      const result = calculator.calculateP2PProfit(buyPrice, p2pSellPrice, p2pFee, volume);

      // Should include exchange fees, P2P fees, GST, and taxes
      expect(result.netProfit).toBeLessThan(result.grossProfit);
      expect(result.effectivePremium).toBeLessThan(3.09); // Less than raw premium
    });
  });

  describe('Break-even Analysis', () => {
    it('should calculate break-even sell price', () => {
      const buyPrice = 87.50;
      const volume = 49000;
      
      const breakEven = calculator.calculateBreakEvenPrice(buyPrice, volume);

      // Break-even should cover all fees and taxes
      expect(breakEven).toBeGreaterThan(buyPrice);
      expect(breakEven).toBeCloseTo(87.94, 2); // Approximately 0.5% higher
    });

    it('should calculate minimum profit price', () => {
      const buyPrice = 87.50;
      const volume = 49000;
      const minProfitPercentage = 2;
      
      const minPrice = calculator.calculateMinimumProfitPrice(buyPrice, volume, minProfitPercentage);

      expect(minPrice).toBeGreaterThan(buyPrice * 1.02);
    });
  });

  describe('Multi-hop Arbitrage', () => {
    it('should calculate multi-exchange arbitrage routes', () => {
      const exchanges = {
        'CoinDCX': { buy: 87.48, sell: 87.52 },
        'LocalP2P': { buy: 89.50, sell: 90.20 },
        'WazirX': { buy: 86.74, sell: 86.78 }
      };

      const route = calculator.findMultiHopRoute(exchanges);

      expect(route).toEqual({
        path: ['WazirX', 'LocalP2P'],
        totalProfit: expect.any(Number),
        steps: [
          { from: 'Market', to: 'WazirX', action: 'buy', price: 86.74 },
          { from: 'WazirX', to: 'LocalP2P', action: 'transfer', cost: 1 },
          { from: 'LocalP2P', to: 'Market', action: 'sell', price: 90.20 }
        ]
      });
    });
  });

  describe('Risk-adjusted Returns', () => {
    it('should calculate risk-adjusted profit', () => {
      const baseProfit = 1000;
      const riskFactors = {
        exchangeReliability: 0.95,
        paymentMethodRisk: 0.98,
        regulatoryRisk: 0.90,
        liquidityRisk: 0.95
      };

      const adjustedProfit = calculator.calculateRiskAdjustedProfit(baseProfit, riskFactors);

      expect(adjustedProfit).toBeLessThan(baseProfit);
      expect(adjustedProfit).toBeCloseTo(baseProfit * 0.95 * 0.98 * 0.90 * 0.95, 2);
    });
  });

  describe('Fee Optimization', () => {
    it('should suggest optimal fee structure', () => {
      const monthlyVolume = 5000000; // ₹50 lakhs
      
      const optimization = calculator.optimizeFeeStructure(monthlyVolume);

      expect(optimization).toEqual({
        recommendedExchanges: expect.arrayContaining(['CoinDCX']),
        estimatedMonthlySavings: expect.any(Number),
        breakEvenVolume: expect.any(Number),
        suggestions: expect.arrayContaining([
          expect.stringContaining('volume discount')
        ])
      });
    });
  });

  describe('Tax Optimization', () => {
    it('should calculate tax-optimized transaction splitting', () => {
      const totalVolume = 200000;
      
      const split = calculator.optimizeForTax(totalVolume);

      expect(split).toEqual({
        numberOfTransactions: 5, // 200k split into <50k chunks
        transactionAmounts: [49900, 49900, 49900, 49900, 400],
        tdsSaved: 2000, // 1% of 200k
        additionalCosts: expect.any(Number) // Multiple transaction costs
      });
    });

    it('should handle volumes already under TDS limit', () => {
      const totalVolume = 45000;
      
      const split = calculator.optimizeForTax(totalVolume);

      expect(split.numberOfTransactions).toBe(1);
      expect(split.tdsSaved).toBe(0);
    });
  });
});