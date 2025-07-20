import chalk from 'chalk';
import { arbitrageCalculator } from '../services/arbitrage/USDTArbitrageCalculator';

async function testRealisticCalculator() {
  console.log(chalk.bgCyan.black(' 🧮 Testing Realistic Arbitrage Calculator \n'));
  
  // Test scenarios
  const scenarios = [
    { buyPrice: 89.50, amount: 100, exchange: 'zebpay', label: 'ZebPay at ₹89.50' },
    { buyPrice: 87.00, amount: 100, exchange: 'zebpay', label: 'ZebPay at ₹87.00' },
    { buyPrice: 85.00, amount: 100, exchange: 'zebpay', label: 'ZebPay at ₹85.00' },
    { buyPrice: 83.00, amount: 100, exchange: 'zebpay', label: 'ZebPay at ₹83.00' },
    { buyPrice: 91.00, amount: 5, exchange: 'zebpay', label: 'Below min quantity (5 USDT)' },
    { buyPrice: 89.00, amount: 10, exchange: 'zebpay', label: 'At min quantity (10 USDT)' }
  ];
  
  console.log(chalk.yellow('📊 Testing with realistic P2P sell prices:\n'));
  console.log(chalk.gray('• P2P Express IMPS: ₹86.17'));
  console.log(chalk.gray('• P2P Express UPI: ₹84.80'));
  console.log(chalk.gray('• Regular P2P: ₹90.00'));
  console.log(chalk.gray('• Premium P2P: ₹94.75\n'));
  
  // Test each scenario
  for (const scenario of scenarios) {
    console.log(chalk.bgYellow.black(` ${scenario.label} `));
    
    // Show realistic price comparison
    arbitrageCalculator.displayRealisticComparison(
      scenario.buyPrice,
      scenario.amount,
      scenario.exchange
    );
    
    // Quick profit checks
    console.log(chalk.yellow('Quick Profit Checks:'));
    
    const expressCheck = arbitrageCalculator.quickProfitCheck(
      scenario.buyPrice,
      86.17, // Express IMPS rate
      scenario.amount,
      scenario.exchange
    );
    
    const regularCheck = arbitrageCalculator.quickProfitCheck(
      scenario.buyPrice,
      90.00, // Regular P2P rate
      scenario.amount,
      scenario.exchange
    );
    
    console.log(`Express (₹86.17): ${expressCheck.action} - Profit: ₹${expressCheck.netProfit.toFixed(2)} | Min Qty: ${expressCheck.meetsMinQuantity ? '✅' : '❌'}`);
    console.log(`Regular (₹90.00): ${regularCheck.action} - Profit: ₹${regularCheck.netProfit.toFixed(2)} | Min Qty: ${regularCheck.meetsMinQuantity ? '✅' : '❌'}`);
    
    console.log('\n' + chalk.gray('─'.repeat(50)) + '\n');
  }
  
  // Test minimum quantity requirements for different exchanges
  console.log(chalk.bgBlue.white(' 📏 Minimum Quantity Requirements \n'));
  
  const exchanges = ['zebpay', 'binanceP2P', 'coindcx', 'wazirx'];
  const testAmounts = [5, 10, 20, 50, 100];
  const testPrice = 90;
  
  console.log(chalk.yellow('Testing at ₹90 per USDT:\n'));
  
  for (const exchange of exchanges) {
    console.log(chalk.cyan(`${exchange}:`));
    for (const amount of testAmounts) {
      const check = arbitrageCalculator.quickProfitCheck(
        testPrice,
        94.75, // Premium sell price
        amount,
        exchange
      );
      
      const status = check.meetsMinQuantity ? chalk.green('✅ Valid') : chalk.red('❌ Below min');
      console.log(`  ${amount} USDT: ${status}`);
    }
    console.log('');
  }
  
  // Find break-even points
  console.log(chalk.bgMagenta.white(' 💔 Break-Even Analysis \n'));
  
  const sellPrices = [86.17, 90.00, 94.75];
  const amount = 100;
  
  for (const sellPrice of sellPrices) {
    const breakEven = arbitrageCalculator.getRequiredSellPrice(sellPrice - 5, amount, 0);
    const profit100 = arbitrageCalculator.getRequiredSellPrice(sellPrice - 5, amount, 100);
    const profit500 = arbitrageCalculator.getRequiredSellPrice(sellPrice - 5, amount, 500);
    
    console.log(chalk.yellow(`Selling at ₹${sellPrice}:`));
    console.log(`  Break-even buy price: ₹${(sellPrice - (breakEven - (sellPrice - 5))).toFixed(2)}`);
    console.log(`  For ₹100 profit, max buy: ₹${(sellPrice - (profit100 - (sellPrice - 5))).toFixed(2)}`);
    console.log(`  For ₹500 profit, max buy: ₹${(sellPrice - (profit500 - (sellPrice - 5))).toFixed(2)}`);
    console.log('');
  }
  
  // Recommendations
  console.log(chalk.bgGreen.black(' 💡 Key Insights \n'));
  console.log(chalk.green('1. Realistic P2P sell price is ₹90 (not ₹94.75)'));
  console.log(chalk.green('2. For profitable arbitrage with ₹90 sell:'));
  console.log('   - Need buy price below ₹84-85');
  console.log('   - Most exchanges sell at ₹89+');
  console.log(chalk.yellow('3. P2P Express (₹86.17) requires even lower buy prices'));
  console.log(chalk.red('4. Always check minimum quantity requirements'));
  console.log(chalk.cyan('5. Consider multiple small transactions if profitable'));
}

testRealisticCalculator().catch(console.error);