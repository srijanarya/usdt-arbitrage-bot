import { logger } from '../../utils/logger';

export interface P2POrderValidation {
  isValid: boolean;
  reason?: string;
  adjustedAmount?: number;
  inrAmount?: number;
}

export class P2POrderValidator {
  /**
   * Validates if a USDT amount meets P2P merchant requirements
   * @param usdtAmount Amount in USDT
   * @param price Price per USDT in INR
   * @param minOrderINR Minimum order amount in INR
   * @param maxOrderINR Maximum order amount in INR
   */
  static validateOrder(
    usdtAmount: number,
    price: number,
    minOrderINR: number,
    maxOrderINR: number
  ): P2POrderValidation {
    const inrAmount = usdtAmount * price;
    
    // Check minimum order requirement
    if (inrAmount < minOrderINR) {
      const requiredUSDT = Math.ceil(minOrderINR / price * 100) / 100; // Round up to 2 decimals
      return {
        isValid: false,
        reason: `Order too small. Minimum: ₹${minOrderINR} (${requiredUSDT} USDT at ₹${price})`,
        adjustedAmount: requiredUSDT,
        inrAmount: minOrderINR
      };
    }
    
    // Check maximum order requirement
    if (inrAmount > maxOrderINR) {
      const maxUSDT = Math.floor(maxOrderINR / price * 100) / 100; // Round down to 2 decimals
      return {
        isValid: false,
        reason: `Order too large. Maximum: ₹${maxOrderINR} (${maxUSDT} USDT at ₹${price})`,
        adjustedAmount: maxUSDT,
        inrAmount: maxOrderINR
      };
    }
    
    return {
      isValid: true,
      inrAmount: inrAmount
    };
  }
  
  /**
   * Finds the optimal order amount considering profit and limits
   * @param availableUSDT Your available USDT balance
   * @param buyPrice Price you bought at
   * @param sellPrice P2P sell price
   * @param minOrderINR Minimum order in INR
   * @param maxOrderINR Maximum order in INR
   * @param targetProfitPercent Target profit percentage
   */
  static findOptimalAmount(
    availableUSDT: number,
    buyPrice: number,
    sellPrice: number,
    minOrderINR: number,
    maxOrderINR: number,
    targetProfitPercent: number = 1.0
  ): {
    optimalUSDT: number;
    expectedProfit: number;
    profitPercent: number;
    meetsTarget: boolean;
  } | null {
    // Calculate profit percentage
    const profitPercent = ((sellPrice - buyPrice) / buyPrice) * 100;
    
    if (profitPercent < 0) {
      logger.warn(`Negative profit: Buy ₹${buyPrice}, Sell ₹${sellPrice}`);
      return null;
    }
    
    // Calculate USDT range based on INR limits
    const minUSDT = Math.ceil(minOrderINR / sellPrice * 100) / 100;
    const maxUSDT = Math.min(
      availableUSDT,
      Math.floor(maxOrderINR / sellPrice * 100) / 100
    );
    
    // Check if we have enough USDT for minimum order
    if (availableUSDT < minUSDT) {
      logger.warn(`Insufficient USDT: Have ${availableUSDT}, need ${minUSDT} minimum`);
      return null;
    }
    
    // Determine optimal amount
    let optimalUSDT = maxUSDT; // Default to maximum possible
    
    // If profit is below target, consider if it's still worth it
    const meetsTarget = profitPercent >= targetProfitPercent;
    
    // For 100 USDT specifically
    if (availableUSDT >= 100 && minUSDT <= 100 && maxUSDT >= 100) {
      const inrFor100 = 100 * sellPrice;
      if (inrFor100 >= minOrderINR && inrFor100 <= maxOrderINR) {
        optimalUSDT = 100; // Prefer round number if possible
      }
    }
    
    const expectedProfit = optimalUSDT * (sellPrice - buyPrice);
    
    return {
      optimalUSDT,
      expectedProfit,
      profitPercent,
      meetsTarget
    };
  }
  
  /**
   * Batch validate multiple P2P opportunities
   */
  static validateOpportunities(
    opportunities: Array<{
      merchant: string;
      price: number;
      minAmount: number;
      maxAmount: number;
    }>,
    usdtAmount: number,
    buyPrice: number
  ): Array<{
    merchant: string;
    validation: P2POrderValidation;
    profit: number;
    profitPercent: number;
  }> {
    return opportunities.map(opp => {
      const validation = this.validateOrder(
        usdtAmount,
        opp.price,
        opp.minAmount,
        opp.maxAmount
      );
      
      const profit = usdtAmount * (opp.price - buyPrice);
      const profitPercent = ((opp.price - buyPrice) / buyPrice) * 100;
      
      return {
        merchant: opp.merchant,
        validation,
        profit,
        profitPercent
      };
    });
  }
}