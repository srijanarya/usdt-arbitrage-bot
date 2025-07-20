import chalk from 'chalk';
import { arbitrageCalculator } from '../services/arbitrage/USDTArbitrageCalculator';
import axios from 'axios';
import Table from 'cli-table3';

async function displayArbitrageSummary() {
  console.log(chalk.bgCyan.black(' 📊 USDT Arbitrage Summary - Indian Market \n'));
  console.log(chalk.gray(`Generated at: ${new Date().toLocaleString()}\n`));

  // Fetch current prices
  const prices = await fetchCurrentPrices();
  
  // Display price overview
  displayPriceOverview(prices);
  
  // Display arbitrage opportunities
  displayArbitrageOpportunities(prices);
  
  // Display constraints and limitations
  displayConstraints();
  
  // Display recommendations
  displayRecommendations(prices);
}

async function fetchCurrentPrices() {
  const prices: any = {};
  
  try {
    // ZebPay
    const zebpayResp = await axios.get('https://www.zebapi.com/pro/v1/market/USDT-INR/ticker');
    prices.zebpay = parseFloat(zebpayResp.data.sell);
    
    // CoinDCX
    const coindcxResp = await axios.get('https://public.coindcx.com/exchange/ticker');
    const usdtInr = coindcxResp.data.find((t: any) => t.market === 'USDTINR');
    prices.coindcx = usdtInr ? parseFloat(usdtInr.ask) : 0;
    
    // P2P prices
    const p2pResp = await axios.post('https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search', {
      page: 1, rows: 5, asset: "USDT", fiat: "INR", tradeType: "SELL"
    });
    prices.p2pSell = parseFloat(p2pResp.data.data[0].adv.price);
    
    const p2pBuyResp = await axios.post('https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search', {
      page: 1, rows: 5, asset: "USDT", fiat: "INR", tradeType: "BUY"
    });
    prices.p2pBuy = parseFloat(p2pBuyResp.data.data[0].adv.price);
    
  } catch (error) {
    console.error(chalk.red('Error fetching prices'));
  }
  
  return prices;
}

function displayPriceOverview(prices: any) {
  console.log(chalk.yellow('💰 Current USDT Prices:\n'));
  
  const priceTable = new Table({
    head: ['Platform', 'Buy Price', 'Sell Price', 'Status', 'Notes'],
    colWidths: [15, 12, 12, 15, 30]
  });
  
  priceTable.push(
    ['ZebPay', `₹${prices.zebpay?.toFixed(2) || 'N/A'}`, '-', chalk.green('✅ Working'), '100 USDT limit + 3 USDT fee'],
    ['CoinDCX', `₹${prices.coindcx?.toFixed(2) || 'N/A'}`, '-', chalk.red('❌ Disabled'), 'Withdrawals disabled (hack)'],
    ['WazirX', 'N/A', 'N/A', chalk.red('❌ Banned'), 'Banned in India'],
    ['P2P Buy', `₹${prices.p2pBuy?.toFixed(2) || 'N/A'}', '-`, chalk.green('✅ Working'), 'Direct P2P purchase'],
    ['P2P Sell', '-', `₹${prices.p2pSell?.toFixed(2) || 'N/A'}`, chalk.green('✅ Working'), 'Direct P2P sale']
  );
  
  console.log(priceTable.toString());
  console.log('');
}

function displayArbitrageOpportunities(prices: any) {
  console.log(chalk.yellow('🎯 Arbitrage Opportunities:\n'));
  
  const oppTable = new Table({
    head: ['Route', 'Buy', 'Sell', 'Profit/100 USDT', 'ROI', 'Viability'],
    colWidths: [30, 10, 10, 15, 8, 20]
  });
  
  // Calculate opportunities
  const opportunities = [
    {
      route: 'ZebPay → P2P Regular (₹90)',
      buy: prices.zebpay,
      sell: 90,
      exchange: 'zebpay'
    },
    {
      route: 'P2P Buy → P2P Sell',
      buy: prices.p2pBuy,
      sell: prices.p2pSell,
      exchange: 'binance_p2p'
    },
    {
      route: 'ZebPay → P2P Express (₹86.17)',
      buy: prices.zebpay,
      sell: 86.17,
      exchange: 'zebpay'
    },
    {
      route: 'International (₹83) → P2P (₹90)',
      buy: 83,
      sell: 90,
      exchange: 'international'
    }
  ];
  
  opportunities.forEach(opp => {
    if (opp.buy && opp.sell) {
      const analysis = arbitrageCalculator.calculateProfit(opp.buy, opp.sell, 100, opp.exchange);
      
      let viability = '';
      let viabilityColor = chalk.red;
      
      if (analysis.profitable && analysis.netProfit > 200) {
        viability = '🚀 Excellent';
        viabilityColor = chalk.green;
      } else if (analysis.profitable && analysis.netProfit > 100) {
        viability = '✅ Good';
        viabilityColor = chalk.green;
      } else if (analysis.profitable) {
        viability = '⚠️  Low profit';
        viabilityColor = chalk.yellow;
      } else {
        viability = '❌ Not viable';
        viabilityColor = chalk.red;
      }
      
      oppTable.push([
        opp.route,
        `₹${opp.buy.toFixed(2)}`,
        `₹${opp.sell.toFixed(2)}`,
        analysis.profitable ? chalk.green(`₹${analysis.netProfit.toFixed(2)}`) : chalk.red(`₹${analysis.netProfit.toFixed(2)}`),
        `${analysis.roi.toFixed(1)}%`,
        viabilityColor(viability)
      ]);
    }
  });
  
  console.log(oppTable.toString());
  console.log('');
}

function displayConstraints() {
  console.log(chalk.yellow('⚠️  Key Constraints:\n'));
  
  const constraints = [
    { platform: 'ZebPay', constraint: 'Max 100 USDT withdrawal + 3 USDT fee', impact: 'Limits profit to ~₹300-400 per transaction' },
    { platform: 'CoinDCX', constraint: 'Withdrawals disabled', impact: 'Cannot use for arbitrage' },
    { platform: 'P2P Express', constraint: 'Buy rate: ₹86.17 (IMPS)', impact: 'Need to buy below ₹84 for profit' },
    { platform: 'Regular P2P', constraint: 'Realistic sell: ₹90 (not ₹94.75)', impact: 'Lower profit margins than expected' },
    { platform: 'All Exchanges', constraint: 'Minimum quantities apply', impact: 'ZebPay: 10 USDT, P2P: ₹100 minimum' }
  ];
  
  const constraintTable = new Table({
    head: ['Platform', 'Constraint', 'Impact'],
    colWidths: [15, 30, 35]
  });
  
  constraints.forEach(c => {
    constraintTable.push([c.platform, c.constraint, c.impact]);
  });
  
  console.log(constraintTable.toString());
  console.log('');
}

function displayRecommendations(prices: any) {
  console.log(chalk.bgGreen.black(' 💡 Recommendations \n'));
  
  const recommendations = [];
  
  // Check ZebPay viability
  if (prices.zebpay && prices.zebpay < 85) {
    recommendations.push({
      priority: 'HIGH',
      action: `Buy on ZebPay at ₹${prices.zebpay.toFixed(2)}`,
      reason: 'Price below ₹85 threshold',
      profit: `~₹${((90 - prices.zebpay) * 97 - 100).toFixed(0)} per 100 USDT`
    });
  }
  
  // Check P2P spread
  if (prices.p2pBuy && prices.p2pSell) {
    const spread = ((prices.p2pSell - prices.p2pBuy) / prices.p2pBuy * 100).toFixed(2);
    if (parseFloat(spread) > 1) {
      recommendations.push({
        priority: 'MEDIUM',
        action: 'Direct P2P arbitrage',
        reason: `${spread}% spread between buy/sell`,
        profit: `₹${((prices.p2pSell - prices.p2pBuy) * 100).toFixed(0)} per 100 USDT`
      });
    }
  }
  
  // International route
  recommendations.push({
    priority: 'EXPLORE',
    action: 'Use Niyo Global on international P2P',
    reason: 'Buy at ~₹83 on USD P2P markets',
    profit: '₹500+ per 100 USDT (if viable)'
  });
  
  if (recommendations.length === 0) {
    console.log(chalk.red('❌ No profitable opportunities at current prices\n'));
    console.log('Wait for:');
    console.log('• ZebPay price to drop below ₹84');
    console.log('• P2P sellers offering below ₹88');
    console.log('• International payment methods\n');
  } else {
    recommendations.forEach(rec => {
      const color = rec.priority === 'HIGH' ? chalk.green : 
                    rec.priority === 'MEDIUM' ? chalk.yellow : chalk.cyan;
      
      console.log(color(`[${rec.priority}] ${rec.action}`));
      console.log(`   Reason: ${rec.reason}`);
      console.log(`   Expected profit: ${rec.profit}\n`);
    });
  }
  
  // Final summary
  console.log(chalk.bgBlue.white(' 📈 Summary \n'));
  console.log('1. Most Indian exchanges sell USDT at ₹86-90');
  console.log('2. Realistic P2P sell price is ₹90 (not ₹94.75)');
  console.log('3. For profitable arbitrage, need to buy below ₹84-85');
  console.log('4. ZebPay limited by 100 USDT cap + 3 USDT fee');
  console.log('5. Best opportunity: International P2P with Niyo Global');
}

// Run the summary
displayArbitrageSummary().catch(console.error);