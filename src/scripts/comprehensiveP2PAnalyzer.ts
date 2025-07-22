#!/usr/bin/env node

import axios from 'axios';
import chalk from 'chalk';
import Table from 'cli-table3';
import { P2POrderValidator } from '../services/p2p/orderValidator';
import dotenv from 'dotenv';

dotenv.config();

interface P2PAd {
  merchant: string;
  price: number;
  minAmount: number;
  maxAmount: number;
  available: number;
  completionRate: number;
  monthlyOrders: number;
  paymentMethods: string[];
  responseTime?: number;
}

interface AnalysisResult {
  validFor100USDT: P2PAd[];
  requiresMoreThan100: P2PAd[];
  profitableOpportunities: Array<{
    ad: P2PAd;
    profit: number;
    profitPercent: number;
    validation: any;
  }>;
  marketAnalysis: {
    avgPrice: number;
    minPrice: number;
    maxPrice: number;
    priceRange: number;
    avgMinOrder: number;
    merchantsAccepting100USDT: number;
    totalMerchants: number;
  };
}

class ComprehensiveP2PAnalyzer {
  private readonly buyPrice: number = 90.58; // Your buy price
  private readonly usdtAmount: number = 100; // Your USDT amount
  private readonly minProfitTarget: number = 0.5; // 0.5% minimum profit

  async fetchP2PAds(): Promise<P2PAd[]> {
    try {
      const response = await axios.post(
        'https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search',
        {
          page: 1,
          rows: 50, // Fetch more ads for comprehensive analysis
          asset: 'USDT',
          fiat: 'INR',
          tradeType: 'SELL',
          publisherType: null,
          payTypes: ['UPI', 'IMPS', 'BANK_TRANSFER']
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          }
        }
      );

      const ads = response.data.data || [];
      return ads.map((ad: any) => ({
        merchant: ad.advertiser.nickName,
        price: parseFloat(ad.adv.price),
        minAmount: parseFloat(ad.adv.minSingleTransAmount),
        maxAmount: parseFloat(ad.adv.maxSingleTransAmount),
        available: parseFloat(ad.adv.surplusAmount),
        completionRate: ad.advertiser.monthFinishRate * 100,
        monthlyOrders: ad.advertiser.monthOrderCount,
        paymentMethods: ad.adv.tradeMethods.map((m: any) => m.identifier),
        responseTime: ad.advertiser.avgReleaseTime
      }));
    } catch (error) {
      console.error(chalk.red('Error fetching P2P data:'), error);
      return [];
    }
  }

  analyzeAds(ads: P2PAd[]): AnalysisResult {
    const validFor100USDT: P2PAd[] = [];
    const requiresMoreThan100: P2PAd[] = [];
    const profitableOpportunities: any[] = [];

    // Filter quality merchants
    const qualityAds = ads.filter(ad => 
      ad.completionRate >= 95 && 
      ad.monthlyOrders >= 100
    );

    // Analyze each ad
    qualityAds.forEach(ad => {
      const validation = P2POrderValidator.validateOrder(
        this.usdtAmount,
        ad.price,
        ad.minAmount,
        ad.maxAmount
      );

      const profit = this.usdtAmount * (ad.price - this.buyPrice);
      const profitPercent = ((ad.price - this.buyPrice) / this.buyPrice) * 100;

      if (validation.isValid) {
        validFor100USDT.push(ad);
        
        if (profitPercent >= this.minProfitTarget) {
          profitableOpportunities.push({
            ad,
            profit,
            profitPercent,
            validation
          });
        }
      } else {
        requiresMoreThan100.push(ad);
      }
    });

    // Sort profitable opportunities by profit
    profitableOpportunities.sort((a, b) => b.profitPercent - a.profitPercent);

    // Calculate market analysis
    const prices = qualityAds.map(ad => ad.price);
    const minOrders = qualityAds.map(ad => ad.minAmount);
    
    const marketAnalysis = {
      avgPrice: prices.reduce((a, b) => a + b, 0) / prices.length,
      minPrice: Math.min(...prices),
      maxPrice: Math.max(...prices),
      priceRange: Math.max(...prices) - Math.min(...prices),
      avgMinOrder: minOrders.reduce((a, b) => a + b, 0) / minOrders.length,
      merchantsAccepting100USDT: validFor100USDT.length,
      totalMerchants: qualityAds.length
    };

    return {
      validFor100USDT,
      requiresMoreThan100,
      profitableOpportunities,
      marketAnalysis
    };
  }

  displayResults(analysis: AnalysisResult) {
    console.clear();
    console.log(chalk.bgCyan.black(' 📊 COMPREHENSIVE P2P MARKET ANALYSIS '));
    console.log(chalk.gray(`Buy Price: ₹${this.buyPrice} | Amount: ${this.usdtAmount} USDT\n`));

    // Market Overview
    console.log(chalk.yellow('📈 Market Overview:'));
    const overviewTable = new Table({
      head: ['Metric', 'Value'],
      colWidths: [30, 40]
    });

    overviewTable.push(
      ['Average P2P Price', `₹${analysis.marketAnalysis.avgPrice.toFixed(2)}`],
      ['Price Range', `₹${analysis.marketAnalysis.minPrice.toFixed(2)} - ₹${analysis.marketAnalysis.maxPrice.toFixed(2)}`],
      ['Average Min Order', `₹${analysis.marketAnalysis.avgMinOrder.toFixed(0)}`],
      ['Merchants Accepting 100 USDT', `${analysis.marketAnalysis.merchantsAccepting100USDT} / ${analysis.marketAnalysis.totalMerchants}`],
      ['Acceptance Rate', `${((analysis.marketAnalysis.merchantsAccepting100USDT / analysis.marketAnalysis.totalMerchants) * 100).toFixed(1)}%`]
    );

    console.log(overviewTable.toString());

    // Profitable Opportunities for 100 USDT
    console.log(chalk.green('\n✅ PROFITABLE OPPORTUNITIES (100 USDT Compatible):'));
    
    if (analysis.profitableOpportunities.length > 0) {
      const profitTable = new Table({
        head: ['Merchant', 'Price', 'Profit', 'Min-Max', 'Payment', 'Rating'],
        colWidths: [20, 10, 15, 20, 15, 10]
      });

      analysis.profitableOpportunities.slice(0, 10).forEach(opp => {
        const profitColor = opp.profitPercent >= 1.0 ? chalk.green : chalk.yellow;
        profitTable.push([
          opp.ad.merchant.substring(0, 18),
          `₹${opp.ad.price.toFixed(2)}`,
          profitColor(`₹${opp.profit.toFixed(1)} (${opp.profitPercent.toFixed(2)}%)`),
          `₹${opp.ad.minAmount}-${opp.ad.maxAmount}`,
          opp.ad.paymentMethods.slice(0, 2).join(', '),
          `${opp.ad.completionRate.toFixed(1)}%`
        ]);
      });

      console.log(profitTable.toString());

      // Best opportunity details
      const best = analysis.profitableOpportunities[0];
      console.log(chalk.bgGreen.black('\n 🏆 BEST OPPORTUNITY:'));
      console.log(`Merchant: ${best.ad.merchant}`);
      console.log(`Price: ₹${best.ad.price} (You bought at: ₹${this.buyPrice})`);
      console.log(`Profit: ₹${best.profit.toFixed(2)} (${best.profitPercent.toFixed(2)}%)`);
      console.log(`INR Amount: ₹${(this.usdtAmount * best.ad.price).toFixed(2)}`);
      console.log(`Min Order: ₹${best.ad.minAmount} | Max Order: ₹${best.ad.maxAmount}`);
      console.log(`Payment Methods: ${best.ad.paymentMethods.join(', ')}`);
    } else {
      console.log(chalk.red('No profitable opportunities found for 100 USDT'));
    }

    // High-profit merchants requiring more than 100 USDT
    console.log(chalk.yellow('\n⚠️  HIGH-PROFIT MERCHANTS (Require > 100 USDT):'));
    
    const highProfitLargeOrders = analysis.requiresMoreThan100
      .map(ad => {
        const profitPercent = ((ad.price - this.buyPrice) / this.buyPrice) * 100;
        const requiredUSDT = Math.ceil(ad.minAmount / ad.price * 100) / 100;
        return { ad, profitPercent, requiredUSDT };
      })
      .filter(item => item.profitPercent >= 1.0)
      .sort((a, b) => b.profitPercent - a.profitPercent);

    if (highProfitLargeOrders.length > 0) {
      const largeOrderTable = new Table({
        head: ['Merchant', 'Price', 'Profit %', 'Min USDT Required', 'Min INR'],
        colWidths: [20, 10, 10, 20, 15]
      });

      highProfitLargeOrders.slice(0, 5).forEach(item => {
        largeOrderTable.push([
          item.ad.merchant.substring(0, 18),
          `₹${item.ad.price.toFixed(2)}`,
          chalk.green(`${item.profitPercent.toFixed(2)}%`),
          chalk.red(`${item.requiredUSDT} USDT`),
          `₹${item.ad.minAmount}`
        ]);
      });

      console.log(largeOrderTable.toString());
    }

    // Recommendations
    console.log(chalk.cyan('\n💡 RECOMMENDATIONS:'));
    
    if (analysis.profitableOpportunities.length > 0) {
      console.log(chalk.green(`✓ Found ${analysis.profitableOpportunities.length} profitable opportunities for your 100 USDT`));
      const avgProfit = analysis.profitableOpportunities.reduce((sum, opp) => sum + opp.profitPercent, 0) / analysis.profitableOpportunities.length;
      console.log(chalk.green(`✓ Average profit potential: ${avgProfit.toFixed(2)}%`));
    }

    if (highProfitLargeOrders.length > 0) {
      const bestLarge = highProfitLargeOrders[0];
      console.log(chalk.yellow(`! Consider accumulating ${bestLarge.requiredUSDT} USDT for ${bestLarge.profitPercent.toFixed(2)}% profit`));
    }

    const acceptanceRate = (analysis.marketAnalysis.merchantsAccepting100USDT / analysis.marketAnalysis.totalMerchants) * 100;
    if (acceptanceRate < 50) {
      console.log(chalk.yellow(`! Only ${acceptanceRate.toFixed(1)}% of quality merchants accept 100 USDT orders`));
      console.log(chalk.yellow(`! Consider increasing your USDT balance for more opportunities`));
    }
  }

  async run() {
    console.log(chalk.yellow('Fetching P2P market data...'));
    
    const ads = await this.fetchP2PAds();
    if (ads.length === 0) {
      console.error(chalk.red('Failed to fetch P2P data'));
      return;
    }

    const analysis = this.analyzeAds(ads);
    this.displayResults(analysis);

    // Auto-refresh
    console.log(chalk.gray('\n\nPress Ctrl+C to exit. Auto-refreshing every 30 seconds...'));
    setInterval(async () => {
      const newAds = await this.fetchP2PAds();
      if (newAds.length > 0) {
        const newAnalysis = this.analyzeAds(newAds);
        this.displayResults(newAnalysis);
      }
    }, 30000);
  }
}

// Run the analyzer
const analyzer = new ComprehensiveP2PAnalyzer();
analyzer.run().catch(console.error);