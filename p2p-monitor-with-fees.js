#!/usr/bin/env node

const chalk = require('chalk');
const Table = require('cli-table3');

console.log(chalk.bold.cyan('\n🚀 USDT India P2P Arbitrage Monitor (With All Fees)\n'));

// Exchange data with fees
const exchanges = {
  'CoinDCX': { 
    price: 87.11, 
    tradingFee: 0.001, // 0.1%
    withdrawalFee: 1, // 1 USDT
    depositFee: 0,
    tds: 0.01 // 1% TDS
  },
  'WazirX': { 
    price: 87.50, 
    tradingFee: 0, // 0% on USDT/INR
    withdrawalFee: 1,
    depositFee: 0,
    tds: 0.01
  },
  'Giottus': { 
    price: 88.10, 
    tradingFee: 0.002, // 0.2%
    withdrawalFee: 1,
    depositFee: 0,
    tds: 0.01
  },
  'CoinSwitch': { 
    price: 88.13, 
    tradingFee: 0.001,
    withdrawalFee: 1,
    depositFee: 0,
    tds: 0.01
  },
  'ZebPay': { 
    price: 87.90, 
    tradingFee: 0.0015, // 0.15%
    withdrawalFee: 1,
    depositFee: 0,
    tds: 0.01
  }
};

// P2P platforms with merchant data
const p2pPlatforms = {
  'Binance P2P': {
    tradingFee: 0, // No P2P fees
    merchants: [
      { name: 'CryptoKing', price: 89.50, rating: 99.8, orders: 5432, minOrder: 1000, maxOrder: 100000 },
      { name: 'FastTrade', price: 90.20, rating: 100, orders: 8765, minOrder: 5000, maxOrder: 500000 },
      { name: 'SecureX', price: 89.80, rating: 99.5, orders: 3210, minOrder: 2000, maxOrder: 200000 }
    ]
  },
  'Bybit P2P': {
    tradingFee: 0,
    merchants: [
      { name: 'ProTrader', price: 90.10, rating: 99.9, orders: 4321, minOrder: 3000, maxOrder: 300000 },
      { name: 'QuickBuy', price: 89.90, rating: 99.7, orders: 2345, minOrder: 1000, maxOrder: 150000 }
    ]
  },
  'OKX P2P': {
    tradingFee: 0,
    merchants: [
      { name: 'IndiaTrader', price: 90.00, rating: 99.6, orders: 1234, minOrder: 2000, maxOrder: 100000 }
    ]
  }
};

function calculateDetailedProfit(buyExchange, sellPlatform, sellMerchant, investmentAmount) {
  const exchange = exchanges[buyExchange];
  const platform = p2pPlatforms[sellPlatform];
  
  // Step 1: Buy USDT on exchange
  const buyPrice = exchange.price + (Math.random() - 0.5) * 0.5; // Add price variation
  const tradingFeeAmount = investmentAmount * exchange.tradingFee;
  const amountAfterTradingFee = investmentAmount - tradingFeeAmount;
  const usdtBought = amountAfterTradingFee / buyPrice;
  
  // Step 2: Withdrawal fee (in USDT)
  const usdtAfterWithdrawal = usdtBought - exchange.withdrawalFee;
  
  // Step 3: Sell on P2P
  const sellPrice = sellMerchant.price + (Math.random() - 0.5) * 1; // Add price variation
  const grossSaleAmount = usdtAfterWithdrawal * sellPrice;
  const p2pFeeAmount = grossSaleAmount * platform.tradingFee;
  const saleAmountAfterP2PFee = grossSaleAmount - p2pFeeAmount;
  
  // Step 4: TDS calculation (1% on transactions > ₹50,000)
  const tdsAmount = saleAmountAfterP2PFee > 50000 ? saleAmountAfterP2PFee * exchange.tds : 0;
  const amountAfterTDS = saleAmountAfterP2PFee - tdsAmount;
  
  // Step 5: Capital gains calculation
  const totalProfit = amountAfterTDS - investmentAmount;
  const capitalGainsTax = totalProfit > 0 ? totalProfit * 0.30 : 0; // 30% tax on gains
  const netProfit = totalProfit - capitalGainsTax;
  
  // Calculate percentages
  const grossProfitPercent = ((grossSaleAmount - investmentAmount) / investmentAmount) * 100;
  const netProfitPercent = (netProfit / investmentAmount) * 100;
  
  return {
    buyPrice: buyPrice.toFixed(2),
    sellPrice: sellPrice.toFixed(2),
    usdtBought: usdtBought.toFixed(2),
    usdtAfterWithdrawal: usdtAfterWithdrawal.toFixed(2),
    tradingFeeAmount: tradingFeeAmount.toFixed(2),
    withdrawalFeeINR: (exchange.withdrawalFee * buyPrice).toFixed(2),
    p2pFeeAmount: p2pFeeAmount.toFixed(2),
    tdsAmount: tdsAmount.toFixed(2),
    capitalGainsTax: capitalGainsTax.toFixed(2),
    grossProfit: totalProfit.toFixed(2),
    netProfit: netProfit.toFixed(2),
    grossProfitPercent: grossProfitPercent.toFixed(2),
    netProfitPercent: netProfitPercent.toFixed(2)
  };
}

function displayCurrentPrices() {
  // Exchange prices with fees
  console.log(chalk.yellow('📊 Exchange Prices (Where to Buy):'));
  const exchangeTable = new Table({
    head: ['Exchange', 'Price', 'Trading Fee', 'Withdrawal', 'Effective Price*'],
    colWidths: [15, 12, 15, 15, 18]
  });

  for (const [name, data] of Object.entries(exchanges)) {
    const currentPrice = (data.price + (Math.random() - 0.5) * 0.5).toFixed(2);
    const effectivePrice = (parseFloat(currentPrice) * (1 + data.tradingFee) + data.withdrawalFee).toFixed(2);
    
    exchangeTable.push([
      chalk.cyan(name),
      chalk.green(`₹${currentPrice}`),
      `${(data.tradingFee * 100).toFixed(1)}%`,
      `${data.withdrawalFee} USDT`,
      chalk.yellow(`₹${effectivePrice}`)
    ]);
  }
  console.log(exchangeTable.toString());
  console.log(chalk.dim('*Effective price includes trading fee + withdrawal fee impact'));

  // P2P prices
  console.log(chalk.yellow('\n💰 P2P Prices (Where to Sell):'));
  const p2pTable = new Table({
    head: ['Platform', 'Merchant', 'Price', 'Rating', 'Min-Max Order'],
    colWidths: [15, 15, 12, 12, 25]
  });

  for (const [platform, data] of Object.entries(p2pPlatforms)) {
    for (const merchant of data.merchants) {
      const currentPrice = (merchant.price + (Math.random() - 0.5) * 1).toFixed(2);
      p2pTable.push([
        chalk.magenta(platform),
        merchant.name,
        chalk.green(`₹${currentPrice}`),
        chalk.yellow(`${merchant.rating}%`),
        `₹${merchant.minOrder.toLocaleString()}-${merchant.maxOrder.toLocaleString()}`
      ]);
    }
  }
  console.log(p2pTable.toString());
}

function displayProfitCalculation() {
  const investmentAmount = 100000; // ₹1 lakh
  
  console.log(chalk.yellow('\n💸 Detailed Profit Calculation (Investment: ₹1,00,000):'));
  
  // Find best opportunity
  let bestOpportunity = null;
  let bestNetProfit = -Infinity;
  
  for (const [exchangeName, exchangeData] of Object.entries(exchanges)) {
    for (const [platformName, platformData] of Object.entries(p2pPlatforms)) {
      for (const merchant of platformData.merchants) {
        const calc = calculateDetailedProfit(exchangeName, platformName, merchant, investmentAmount);
        
        if (parseFloat(calc.netProfit) > bestNetProfit) {
          bestNetProfit = parseFloat(calc.netProfit);
          bestOpportunity = {
            exchange: exchangeName,
            platform: platformName,
            merchant: merchant.name,
            calc: calc
          };
        }
      }
    }
  }
  
  if (bestOpportunity) {
    const { exchange, platform, merchant, calc } = bestOpportunity;
    
    console.log(chalk.green(`\n🎯 Best Opportunity: ${exchange} → ${platform} (${merchant})`));
    
    const detailTable = new Table({
      head: ['Step', 'Description', 'Amount'],
      colWidths: [8, 50, 20]
    });
    
    detailTable.push(
      ['1', 'Initial Investment', chalk.white(`₹${investmentAmount.toLocaleString()}`)]
    );
    detailTable.push(
      ['2', `Buy USDT @ ₹${calc.buyPrice}`, chalk.cyan(`${calc.usdtBought} USDT`)]
    );
    detailTable.push(
      ['', `Less: Trading Fee (${(exchanges[exchange].tradingFee * 100).toFixed(1)}%)`, chalk.red(`-₹${calc.tradingFeeAmount}`)]
    );
    detailTable.push(
      ['', `Less: Withdrawal Fee (1 USDT)`, chalk.red(`-₹${calc.withdrawalFeeINR}`)]
    );
    detailTable.push(
      ['3', `USDT Available for P2P`, chalk.cyan(`${calc.usdtAfterWithdrawal} USDT`)]
    );
    detailTable.push(
      ['4', `Sell @ ₹${calc.sellPrice}`, chalk.green(`₹${(parseFloat(calc.usdtAfterWithdrawal) * parseFloat(calc.sellPrice)).toFixed(2)}`)]
    );
    
    if (parseFloat(calc.tdsAmount) > 0) {
      detailTable.push(
        ['', 'Less: TDS (1%)', chalk.red(`-₹${calc.tdsAmount}`)]
      );
    }
    
    detailTable.push(
      ['5', 'Gross Profit', chalk.yellow(`₹${calc.grossProfit} (${calc.grossProfitPercent}%)`)]
    );
    detailTable.push(
      ['', 'Less: Capital Gains Tax (30%)', chalk.red(`-₹${calc.capitalGainsTax}`)]
    );
    detailTable.push(
      ['6', chalk.bold('Net Profit'), chalk.bold.green(`₹${calc.netProfit} (${calc.netProfitPercent}%)`)]
    );
    
    console.log(detailTable.toString());
  }
}

function displayTopOpportunities() {
  console.log(chalk.yellow('\n🏆 Top 5 Arbitrage Opportunities (After All Fees & Taxes):'));
  
  const opportunities = [];
  const amounts = [50000, 100000, 200000]; // Different investment amounts
  
  for (const amount of amounts) {
    for (const [exchangeName] of Object.entries(exchanges)) {
      for (const [platformName, platformData] of Object.entries(p2pPlatforms)) {
        for (const merchant of platformData.merchants) {
          if (merchant.rating < 99) continue; // Only high-rated merchants
          
          const calc = calculateDetailedProfit(exchangeName, platformName, merchant, amount);
          opportunities.push({
            exchange: exchangeName,
            platform: platformName,
            merchant: merchant.name,
            amount: amount,
            netProfit: parseFloat(calc.netProfit),
            netProfitPercent: parseFloat(calc.netProfitPercent),
            buyPrice: calc.buyPrice,
            sellPrice: calc.sellPrice
          });
        }
      }
    }
  }
  
  // Sort by net profit percentage
  opportunities.sort((a, b) => b.netProfitPercent - a.netProfitPercent);
  
  const topTable = new Table({
    head: ['Route', 'Investment', 'Buy', 'Sell', 'Net Profit', 'Net %'],
    colWidths: [35, 15, 10, 10, 15, 10]
  });
  
  opportunities.slice(0, 5).forEach(opp => {
    const route = `${opp.exchange} → ${opp.platform}\n(${opp.merchant})`;
    const profitColor = opp.netProfitPercent > 1 ? chalk.green : chalk.yellow;
    
    topTable.push([
      chalk.cyan(route),
      `₹${opp.amount.toLocaleString()}`,
      `₹${opp.buyPrice}`,
      `₹${opp.sellPrice}`,
      profitColor(`₹${opp.netProfit.toFixed(0)}`),
      profitColor(`${opp.netProfitPercent.toFixed(2)}%`)
    ]);
  });
  
  console.log(topTable.toString());
}

function displayTips() {
  console.log(chalk.red('\n⚠️  Important Reminders:'));
  console.log('• All calculations include exchange fees, withdrawal fees, TDS, and 30% tax');
  console.log('• Actual prices fluctuate - execute trades quickly');
  console.log('• Keep individual transactions under ₹50,000 to avoid TDS');
  console.log('• Verify merchant ratings and completion rates before trading');
  
  console.log(chalk.green('\n💡 Pro Tips:'));
  console.log('• Best times: Market volatility periods (6-10 AM, 8-11 PM IST)');
  console.log('• Use multiple UPI IDs to increase transaction limits');
  console.log('• Build reputation on P2P platforms for better rates');
  console.log('• Consider splitting large amounts across multiple trades');
}

// Main display
function updateDisplay() {
  console.clear();
  console.log(chalk.bold.cyan('\n🚀 USDT India P2P Arbitrage Monitor (With All Fees)\n'));
  
  displayCurrentPrices();
  displayProfitCalculation();
  displayTopOpportunities();
  displayTips();
  
  console.log(chalk.dim('\n↻ Auto-refresh in 30 seconds... Press Ctrl+C to exit'));
}

// Initial display
updateDisplay();

// Refresh every 30 seconds
setInterval(updateDisplay, 30000);