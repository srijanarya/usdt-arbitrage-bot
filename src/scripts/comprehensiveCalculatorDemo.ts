#!/usr/bin/env ts-node

import { arbitrageCalculator, P2PMerchant } from '../services/arbitrage/USDTArbitrageCalculator';
import chalk from 'chalk';
import axios from 'axios';

// Demo script showing all enhanced calculator features
async function comprehensiveDemo() {
  console.log(chalk.cyan('\n═══════════════════════════════════════════════════════════════'));
  console.log(chalk.cyan('     COMPREHENSIVE ARBITRAGE CALCULATOR DEMO                    '));
  console.log(chalk.cyan('═══════════════════════════════════════════════════════════════\n'));

  // Step 1: Show user's payment configuration
  console.log(chalk.yellow('👤 User Payment Configuration:'));
  console.log('   Enabled Methods: UPI, Bank Transfer, IMPS');
  console.log('   UPI Limits: ₹100 - ₹1,00,000');
  console.log('   Bank Transfer Limits: ₹1,000 - ₹10,00,000');
  console.log('   IMPS Limits: ₹100 - ₹2,00,000\n');

  // Step 2: Test with real P2P data (mock for demo)
  const mockP2PMerchants: P2PMerchant[] = [
    {
      id: 'real1',
      name: 'CryptoTrader365',
      price: 89.50,
      minAmount: 500,
      maxAmount: 50000,
      completedOrders: 2341,
      completionRate: 98.7,
      paymentMethods: ['UPI', 'IMPS'],
      responseTime: 3,
      platform: 'Binance P2P',
      requirements: {
        minOrders: 100,
        minCompletionRate: 95,
        kycRequired: true
      }
    },
    {
      id: 'real2',
      name: 'ExpressP2P',
      price: 86.17,
      minAmount: 100,
      maxAmount: 10000,
      completedOrders: 5678,
      completionRate: 99.2,
      paymentMethods: ['IMPS'],
      responseTime: 1,
      platform: 'Binance P2P Express',
      requirements: {
        minOrders: 1000,
        minCompletionRate: 98
      }
    },
    {
      id: 'real3',
      name: 'BankTransferPro',
      price: 90.20,
      minAmount: 5000,
      maxAmount: 200000,
      completedOrders: 890,
      completionRate: 96.5,
      paymentMethods: ['Bank Transfer', 'NEFT'],
      responseTime: 10,
      platform: 'Binance P2P'
    },
    {
      id: 'real4',
      name: 'LowRatedSeller',
      price: 91.00,
      minAmount: 100,
      maxAmount: 20000,
      completedOrders: 50,
      completionRate: 85.0,
      paymentMethods: ['UPI'],
      responseTime: 15,
      platform: 'Binance P2P'
    }
  ];

  const buyPrice = 87.50;
  const amount = 100;

  console.log(chalk.yellow(`📊 Trading Parameters:`));
  console.log(`   Buy Price (ZebPay): ₹${buyPrice}`);
  console.log(`   Trade Amount: ${amount} USDT\n`);

  // Step 3: Analyze each merchant
  console.log(chalk.yellow('🔍 Analyzing P2P Merchants:\n'));

  for (const merchant of mockP2PMerchants) {
    console.log(chalk.blue(`━━━ ${merchant.name} ━━━`));
    
    // Check payment compatibility
    const orderAmount = merchant.price * amount;
    const compatibility = arbitrageCalculator.checkPaymentCompatibility(merchant, orderAmount);
    const requirements = arbitrageCalculator.checkMerchantRequirements(merchant);
    
    console.log(`   Price: ₹${merchant.price}`);
    console.log(`   Payment Methods: ${merchant.paymentMethods.join(', ')}`);
    console.log(`   Orders: ${merchant.completedOrders} (${merchant.completionRate}% completion)`);
    console.log(`   Min Order: ₹${merchant.minAmount}`);
    
    // Payment compatibility
    if (compatibility.compatible) {
      console.log(chalk.green(`   ✓ Payment Compatible: ${compatibility.availableMethods.join(', ')}`));
    } else {
      console.log(chalk.red(`   ✗ Payment Incompatible: ${compatibility.reason}`));
    }
    
    // Merchant requirements
    if (requirements.qualified) {
      console.log(chalk.green('   ✓ Meets all requirements'));
    } else {
      console.log(chalk.red('   ✗ Requirements not met:'));
      requirements.issues.forEach(issue => {
        console.log(chalk.red(`     - ${issue}`));
      });
    }
    
    // Calculate profit if compatible
    if (compatibility.compatible && requirements.qualified) {
      const analysis = arbitrageCalculator.calculateProfit(buyPrice, merchant.price, amount, 'zebpay', merchant);
      console.log(`   Expected Profit: ${analysis.profitable ? chalk.green(`₹${analysis.netProfit.toFixed(2)}`) : chalk.red(`₹${analysis.netProfit.toFixed(2)}`)}`);
      console.log(`   ROI: ${analysis.roi.toFixed(2)}%`);
      console.log(`   Action: ${analysis.profitable ? chalk.green('PROFITABLE') : chalk.yellow('NOT PROFITABLE')}`);
    }
    
    console.log('');
  }

  // Step 4: Find best opportunity
  console.log(chalk.yellow('🎯 Best Opportunity Analysis:\n'));
  
  const { merchant: bestMerchant, analysis } = arbitrageCalculator.findBestMerchant(mockP2PMerchants, buyPrice, amount);
  
  if (bestMerchant && analysis) {
    console.log(chalk.green('✅ BEST COMPATIBLE MERCHANT FOUND!\n'));
    console.log(chalk.cyan('📋 Trade Details:'));
    console.log(`   Merchant: ${bestMerchant.name}`);
    console.log(`   Platform: ${bestMerchant.platform}`);
    console.log(`   Sell Price: ₹${bestMerchant.price}`);
    console.log(`   Payment Methods: ${bestMerchant.paymentMethods.join(', ')}`);
    console.log(`   Response Time: ${bestMerchant.responseTime} minutes\n`);
    
    console.log(chalk.cyan('💰 Profit Calculation:'));
    console.log(`   Buy ${amount} USDT at ₹${buyPrice}: ₹${(buyPrice * amount).toFixed(2)}`);
    console.log(`   Sell ${amount} USDT at ₹${bestMerchant.price}: ₹${(bestMerchant.price * amount).toFixed(2)}`);
    console.log(`   Trading Fees: ₹${(analysis.investment - buyPrice * amount).toFixed(2)}`);
    console.log(`   TDS (1%): ₹${((bestMerchant.price * amount) * 0.01).toFixed(2)}`);
    console.log(`   Net Profit: ${chalk.green(`₹${analysis.netProfit.toFixed(2)}`)}`);
    console.log(`   ROI: ${chalk.green(`${analysis.roi.toFixed(2)}%`)}\n`);
    
    console.log(chalk.cyan('📊 Risk Assessment:'));
    const signal = arbitrageCalculator.getTradingSignal(buyPrice, bestMerchant.price, amount, 100, bestMerchant);
    console.log(`   Signal: ${signal.signal === 'BUY' ? chalk.green(signal.signal) : chalk.yellow(signal.signal)}`);
    console.log(`   Risk Level: ${signal.riskLevel}`);
    console.log(`   Reason: ${signal.reason}`);
    console.log(`   Execution Time: ${signal.execution.estimatedTime}`);
  } else {
    console.log(chalk.red('❌ No compatible merchants found!\n'));
    console.log('Possible reasons:');
    console.log('- No common payment methods');
    console.log('- Order amount outside merchant limits');
    console.log('- Merchants do not meet minimum requirements');
    console.log('- No profitable opportunities');
  }

  // Step 5: Show minimum order validations
  console.log(chalk.yellow('\n📏 Minimum Order Validation Examples:\n'));
  
  const testAmounts = [10, 50, 100, 500, 1000];
  const expressP2P = mockP2PMerchants.find(m => m.name === 'ExpressP2P');
  
  if (expressP2P) {
    console.log(`Testing with ${expressP2P.name} (Min: ₹${expressP2P.minAmount}):`);
    
    testAmounts.forEach(testAmount => {
      const orderValue = buyPrice * testAmount;
      const meetsMin = orderValue >= expressP2P.minAmount;
      const analysis = arbitrageCalculator.quickProfitCheck(buyPrice, expressP2P.price, testAmount, 'zebpay', expressP2P);
      
      console.log(`   ${testAmount} USDT (₹${orderValue.toFixed(0)}): ${
        meetsMin ? chalk.green('✓') : chalk.red('✗')
      } ${meetsMin ? 'Valid' : 'Below min'} | Profit: ₹${analysis.netProfit.toFixed(2)}`);
    });
  }

  // Step 6: Show realistic price scenarios
  console.log(chalk.yellow('\n💡 Realistic Price Scenarios:\n'));
  
  arbitrageCalculator.displayRealisticComparison(buyPrice, amount);

  console.log(chalk.cyan('\n═══════════════════════════════════════════════════════════════'));
  console.log(chalk.cyan('                    DEMO COMPLETE                               '));
  console.log(chalk.cyan('═══════════════════════════════════════════════════════════════\n'));
}

// Run the demo
comprehensiveDemo().catch(console.error);