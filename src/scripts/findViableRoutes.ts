import chalk from 'chalk';
import axios from 'axios';

async function findViableRoutes() {
  console.log(chalk.bgRed.white(' 🔍 Finding Viable Arbitrage Routes \n'));
  console.log(chalk.yellow('Constraints:'));
  console.log('❌ CoinDCX - Withdrawals disabled');
  console.log('❌ WazirX - Banned');
  console.log('❌ Niyo Global - Not working on crypto platforms');
  console.log('⚠️  ZebPay - 100 USDT limit + 3 USDT fee\n');

  try {
    // Check current prices
    const zebpayResp = await axios.get('https://www.zebapi.com/pro/v1/market/USDT-INR/ticker');
    const zebpayPrice = parseFloat(zebpayResp.data.sell);
    
    const p2pResp = await axios.post('https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search', {
      page: 1, rows: 5, asset: "USDT", fiat: "INR", tradeType: "SELL"
    });
    const p2pSellPrice = parseFloat(p2pResp.data.data[0].adv.price);

    console.log(chalk.cyan('Current Prices:'));
    console.log(`ZebPay: ₹${zebpayPrice}`);
    console.log(`P2P Sell: ₹${p2pSellPrice}\n`);

    // 1. Direct P2P to P2P
    console.log(chalk.bgGreen.black(' Option 1: P2P Buy → P2P Sell (BEST) \n'));
    
    const p2pBuyResp = await axios.post('https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search', {
      page: 1, rows: 10, asset: "USDT", fiat: "INR", tradeType: "BUY"
    });
    
    console.log(chalk.yellow('Cheapest P2P Sellers:'));
    p2pBuyResp.data.data.slice(0, 5).forEach((ad: any, i: number) => {
      const buyPrice = parseFloat(ad.adv.price);
      const profit = p2pSellPrice - buyPrice;
      const profitPercent = (profit / buyPrice * 100).toFixed(2);
      const color = profit > 1 ? chalk.green : profit > 0.5 ? chalk.yellow : chalk.red;
      
      console.log(`${i+1}. ${ad.advertiser.nickName}:`);
      console.log(`   Price: ₹${buyPrice} | Methods: ${ad.adv.tradeMethods.map((m: any) => m.identifier).join(', ')}`);
      console.log(`   Profit: ${color(`₹${profit.toFixed(2)} (${profitPercent}%)`)} per USDT`);
      console.log(`   On ₹10,000: ${color(`₹${(profit * 10000 / buyPrice).toFixed(0)} profit`)}\n`);
    });

    // 2. Bank Transfer P2P
    console.log(chalk.bgYellow.black(' Option 2: Bank Transfer P2P \n'));
    
    const bankResp = await axios.post('https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search', {
      page: 1, rows: 5, asset: "USDT", fiat: "INR", tradeType: "BUY",
      payTypes: ["BankTransfer"]
    });
    
    if (bankResp.data.data.length > 0) {
      const bestBank = bankResp.data.data[0];
      console.log(`Best Bank Transfer: ₹${bestBank.adv.price}`);
      console.log(`Merchant: ${bestBank.advertiser.nickName}`);
      console.log(`Profit potential: ₹${(p2pSellPrice - parseFloat(bestBank.adv.price)).toFixed(2)} per USDT\n`);
    }

    // 3. Gift Card Arbitrage
    console.log(chalk.bgCyan.black(' Option 3: Gift Card Arbitrage \n'));
    console.log('1. Buy Amazon/Google Play gift cards with credit card');
    console.log('2. Find P2P traders accepting gift cards (5-10% premium)');
    console.log('3. Get USDT at effective rate of ₹90-92');
    console.log(`4. Sell at ₹${p2pSellPrice} for profit\n`);

    // 4. P2P Express
    console.log(chalk.bgBlue.black(' Option 4: Reverse - Buy P2P, Sell Express \n'));
    console.log('P2P Express Buy Rate: ~₹86.17');
    console.log('Need to find P2P sellers below ₹85');
    
    const cheapSellers = p2pBuyResp.data.data.filter((ad: any) => parseFloat(ad.adv.price) < 86);
    if (cheapSellers.length > 0) {
      console.log(chalk.green(`Found ${cheapSellers.length} sellers below ₹86!`));
    } else {
      console.log(chalk.red('No sellers found below Express rate'));
    }

    // 5. International Exchanges
    console.log(chalk.bgMagenta.black('\n Option 5: International Exchanges \n'));
    console.log('• Bybit - Accepts some Indian cards');
    console.log('• KuCoin - P2P with various payment methods');
    console.log('• HTX (Huobi) - Has INR P2P market');
    console.log('• MEXC - Lower fees, multiple payment options\n');

    // Summary
    console.log(chalk.bgGreen.black(' 🎯 RECOMMENDED STRATEGY \n'));
    console.log(chalk.green('1. PRIMARY: Direct P2P to P2P arbitrage'));
    console.log('   - No exchange fees or limits');
    console.log('   - Find sellers 2-3% below market');
    console.log('   - Instant profits\n');
    
    console.log(chalk.yellow('2. SECONDARY: Multiple ZebPay transactions'));
    console.log('   - Only when spread >10%');
    console.log('   - Do 3-5 transactions for decent profit\n');
    
    console.log(chalk.cyan('3. EXPLORE: Alternative payment methods'));
    console.log('   - Paytm/PhonePe merchants');
    console.log('   - Bank transfer dealers');
    console.log('   - International P2P markets');

  } catch (error) {
    console.error(chalk.red('Error:', error.message));
  }
}

findViableRoutes().catch(console.error);