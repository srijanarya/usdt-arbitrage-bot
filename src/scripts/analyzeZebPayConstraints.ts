import chalk from 'chalk';
import { zebpayCalculator } from '../services/arbitrage/ZebPayConstrainedCalculator';
import axios from 'axios';

async function analyzeZebPayConstraints() {
  console.log(chalk.bgRed.white(' 🚨 ZebPay Constraints Analysis \n'));
  
  try {
    // Fetch current prices
    console.log(chalk.yellow('Fetching current prices...\n'));
    
    // Get ZebPay price
    const zebpayResponse = await axios.get('https://www.zebapi.com/pro/v1/market/USDT-INR/ticker');
    const zebpayBuyPrice = parseFloat(zebpayResponse.data.sell); // We buy at their sell price
    
    // Get P2P sell price
    const p2pResponse = await axios.post(
      'https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search',
      {
        page: 1,
        rows: 3,
        asset: "USDT",
        fiat: "INR",
        tradeType: "SELL"
      }
    );
    const p2pSellPrice = parseFloat(p2pResponse.data.data[0].adv.price);
    
    console.log(chalk.cyan('Current Market Prices:'));
    console.log(`ZebPay Buy Price: ₹${zebpayBuyPrice.toFixed(2)}`);
    console.log(`P2P Sell Price: ₹${p2pSellPrice.toFixed(2)}`);
    console.log(`Spread: ₹${(p2pSellPrice - zebpayBuyPrice).toFixed(2)}\n`);
    
    // Analyze with constraints
    zebpayCalculator.displayConstrainedAnalysis(zebpayBuyPrice, p2pSellPrice);
    
    // Show alternatives
    zebpayCalculator.analyzeAlternatives(zebpayBuyPrice, p2pSellPrice);
    
    // Check different scenarios
    console.log(chalk.yellow('\n📊 Scenario Analysis:\n'));
    
    const scenarios = [
      { buyPrice: 85, label: 'If ZebPay drops to ₹85' },
      { buyPrice: 84, label: 'If ZebPay drops to ₹84' },
      { buyPrice: 83, label: 'If ZebPay drops to ₹83' },
      { buyPrice: 82, label: 'If ZebPay drops to ₹82' }
    ];
    
    scenarios.forEach(scenario => {
      const result = zebpayCalculator.calculateRealProfit(scenario.buyPrice, p2pSellPrice);
      const color = result.netProfit >= 100 ? chalk.green : 
                   result.netProfit > 0 ? chalk.yellow : chalk.red;
      
      console.log(`${scenario.label}:`);
      console.log(`   Net Profit: ${color(`₹${result.netProfit.toFixed(2)}`)}`);
      console.log(`   ROI: ${color(`${result.roi.toFixed(2)}%`)}`);
      console.log('');
    });
    
    // Best alternatives
    console.log(chalk.bgYellow.black(' 💡 RECOMMENDATIONS \n'));
    
    console.log(chalk.green('1. Best Option: International P2P with Niyo Global'));
    console.log('   - No withdrawal limits');
    console.log('   - Buy at ~₹83 (USD P2P)');
    console.log('   - Much higher profit potential\n');
    
    console.log(chalk.yellow('2. ZebPay Strategy:'));
    console.log('   - Only viable if price drops below ₹84');
    console.log('   - Do multiple 100 USDT transactions');
    console.log('   - Wait for higher P2P sell prices (₹95+)\n');
    
    console.log(chalk.cyan('3. Alternative Indian Exchanges:'));
    console.log('   - Check if any other exchange has withdrawals enabled');
    console.log('   - Look for P2P traders accepting bank transfer at <₹85\n');
    
  } catch (error) {
    console.error(chalk.red('Error:', error.message));
  }
}

// Run analysis
analyzeZebPayConstraints().catch(console.error);