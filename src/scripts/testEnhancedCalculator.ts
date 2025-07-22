#!/usr/bin/env ts-node

import { arbitrageCalculator, P2PMerchant } from '../services/arbitrage/USDTArbitrageCalculator';
import { zebpayCalculator } from '../services/arbitrage/ZebPayConstrainedCalculator';
import chalk from 'chalk';

// Sample P2P merchants with different payment methods
const sampleMerchants: P2PMerchant[] = [
  {
    id: 'merchant1',
    name: 'FastTrader',
    price: 90.50,
    minAmount: 1000,
    maxAmount: 50000,
    completedOrders: 5432,
    completionRate: 98.5,
    paymentMethods: ['UPI', 'IMPS'],
    responseTime: 2,
    platform: 'Binance P2P',
    requirements: {
      minOrders: 100,
      minCompletionRate: 95,
      kycRequired: true
    }
  },
  {
    id: 'merchant2',
    name: 'CryptoKing',
    price: 91.20,
    minAmount: 500,
    maxAmount: 100000,
    completedOrders: 234,
    completionRate: 96.2,
    paymentMethods: ['Bank Transfer', 'NEFT'],
    responseTime: 5,
    platform: 'Binance P2P',
    requirements: {
      minOrders: 50,
      minCompletionRate: 90
    }
  },
  {
    id: 'merchant3',
    name: 'P2PExpress',
    price: 86.17,
    minAmount: 100,
    maxAmount: 10000,
    completedOrders: 8765,
    completionRate: 99.1,
    paymentMethods: ['IMPS'],
    responseTime: 1,
    platform: 'Binance P2P Express',
    requirements: {
      minOrders: 1000,
      minCompletionRate: 98
    }
  },
  {
    id: 'merchant4',
    name: 'NoMatch',
    price: 92.00,
    minAmount: 1000,
    maxAmount: 50000,
    completedOrders: 543,
    completionRate: 97.0,
    paymentMethods: ['PayPal', 'Paytm'],
    responseTime: 3,
    platform: 'Binance P2P'
  },
  {
    id: 'merchant5',
    name: 'LowRated',
    price: 93.50,
    minAmount: 100,
    maxAmount: 25000,
    completedOrders: 45,
    completionRate: 88.5,
    paymentMethods: ['UPI'],
    responseTime: 10,
    platform: 'Binance P2P',
    requirements: {
      minOrders: 100,
      minCompletionRate: 95
    }
  }
];

async function testEnhancedCalculator() {
  console.log(chalk.cyan('\n═══════════════════════════════════════════════════════════════'));
  console.log(chalk.cyan('         ENHANCED ARBITRAGE CALCULATOR TEST                     '));
  console.log(chalk.cyan('═══════════════════════════════════════════════════════════════\n'));

  const buyPrice = 87.00;
  const amount = 100;

  console.log(chalk.yellow('📊 Test Parameters:'));
  console.log(`   Buy Price: ₹${buyPrice}`);
  console.log(`   Amount: ${amount} USDT`);
  console.log(`   User Payment Methods: UPI, Bank Transfer, IMPS\n`);

  console.log(chalk.yellow('👥 Testing with Different Merchants:\n'));

  // Test each merchant
  for (const merchant of sampleMerchants) {
    console.log(chalk.blue(`\n━━━ Testing with ${merchant.name} ━━━`));
    console.log(`   Price: ₹${merchant.price}`);
    console.log(`   Payment Methods: ${merchant.paymentMethods.join(', ')}`);
    console.log(`   Orders: ${merchant.completedOrders} (${merchant.completionRate}% completion)`);
    
    // Quick profitability check
    const quickCheck = arbitrageCalculator.quickProfitCheck(buyPrice, merchant.price, amount, 'zebpay', merchant);
    
    console.log(`   Profitable: ${quickCheck.profitable ? chalk.green('YES') : chalk.red('NO')}`);
    console.log(`   Net Profit: ${quickCheck.netProfit >= 0 ? chalk.green(`₹${quickCheck.netProfit.toFixed(2)}`) : chalk.red(`₹${quickCheck.netProfit.toFixed(2)}`)}`);
    console.log(`   ROI: ${quickCheck.roi.toFixed(2)}%`);
    console.log(`   Payment Compatible: ${quickCheck.paymentCompatible ? chalk.green('YES') : chalk.red('NO')}`);
    
    if (quickCheck.incompatibilityReason) {
      console.log(chalk.red(`   Issue: ${quickCheck.incompatibilityReason}`));
    }
    
    console.log(`   Action: ${quickCheck.action === 'EXECUTE' ? chalk.green(quickCheck.action) : chalk.yellow(quickCheck.action)}`);
  }

  console.log(chalk.yellow('\n\n🎯 Finding Best Compatible Merchant:'));
  const { merchant: bestMerchant, analysis } = arbitrageCalculator.findBestMerchant(sampleMerchants, buyPrice, amount);
  
  if (bestMerchant && analysis) {
    console.log(chalk.green(`\n✅ Best Compatible Merchant: ${bestMerchant.name}`));
    console.log(`   Price: ₹${bestMerchant.price}`);
    console.log(`   Expected Profit: ₹${analysis.netProfit.toFixed(2)}`);
    console.log(`   ROI: ${analysis.roi.toFixed(2)}%`);
    console.log(`   Payment Methods: ${bestMerchant.paymentMethods.join(', ')}`);
  } else {
    console.log(chalk.red('\n❌ No compatible merchants found!'));
  }

  console.log(chalk.yellow('\n\n📋 Minimum Order Validation:'));
  
  // Test minimum order amounts
  const testAmounts = [5, 10, 50, 100, 500];
  const testMerchant = sampleMerchants[0]; // FastTrader
  
  console.log(`\nTesting with ${testMerchant.name} (Min: ₹${testMerchant.minAmount})`);
  
  for (const testAmount of testAmounts) {
    const orderValue = buyPrice * testAmount;
    const meetsMin = orderValue >= testMerchant.minAmount;
    
    console.log(`   ${testAmount} USDT (₹${orderValue.toFixed(0)}): ${meetsMin ? chalk.green('✓ Valid') : chalk.red('✗ Below minimum')}`);
  }

  console.log(chalk.yellow('\n\n🔄 ZebPay Constrained Analysis:'));
  
  // Test with ZebPay constraints
  const p2pExpressMerchant = sampleMerchants.find(m => m.name === 'P2PExpress');
  if (p2pExpressMerchant) {
    zebpayCalculator.displayConstrainedAnalysis(buyPrice, p2pExpressMerchant.price, p2pExpressMerchant);
  }

  console.log(chalk.cyan('\n═══════════════════════════════════════════════════════════════'));
  console.log(chalk.cyan('                    TEST COMPLETE                               '));
  console.log(chalk.cyan('═══════════════════════════════════════════════════════════════\n'));
}

// Run the test
testEnhancedCalculator().catch(console.error);