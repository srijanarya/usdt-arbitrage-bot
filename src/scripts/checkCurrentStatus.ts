import { binanceService } from '../services/exchanges/binanceService';
import axios from 'axios';
import { config } from 'dotenv';

config();

async function checkCurrentStatus() {
  console.log(`
🔍 CHECKING YOUR CURRENT STATUS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

`);

  // 1. Check USDT balance
  try {
    console.log('💰 Checking USDT Balance...');
    const balance = await binanceService.getBalance('USDT');
    console.log(`   Total: ${balance.total} USDT`);
    console.log(`   Available: ${balance.free} USDT`);
    console.log(`   Locked: ${balance.locked} USDT\n`);
  } catch (error) {
    console.log('   ❌ Could not fetch balance\n');
  }

  // 2. Check current P2P market prices
  try {
    console.log('📊 Current P2P Market (Sell Orders):');
    const response = await axios.post(
      'https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search',
      {
        page: 1,
        rows: 5,
        payTypes: ["UPI"],
        tradeType: "SELL",
        asset: "USDT",
        fiat: "INR"
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0'
        }
      }
    );

    const ads = response.data.data || [];
    ads.slice(0, 5).forEach((ad, i) => {
      const price = parseFloat(ad.adv.price);
      const minAmount = ad.adv.minSingleTransAmount;
      const maxAmount = ad.adv.maxSingleTransAmount;
      console.log(`   ${i+1}. ₹${price} (${minAmount}-${maxAmount} INR) - ${ad.advertiser.nickName}`);
    });

    if (ads.length > 0) {
      const avgPrice = ads.slice(0, 3).reduce((sum, ad) => sum + parseFloat(ad.adv.price), 0) / 3;
      console.log(`\n   📈 Average Top 3 Price: ₹${avgPrice.toFixed(2)}`);
      console.log(`   💡 Your Buy Price: ₹89.00`);
      console.log(`   🎯 Potential Profit: ${((avgPrice - 89) / 89 * 100).toFixed(2)}%\n`);
    }
  } catch (error) {
    console.log('   ❌ Could not fetch market prices\n');
  }

  // 3. Your previous orders summary
  console.log('📋 Your Previous Orders (from session):');
  console.log('   1. 11.5 USDT @ ₹90.50 (Created at 2:13 PM)');
  console.log('   2. 11.5 USDT @ ₹94.52 (Created at 2:39 PM) x3\n');

  // 4. Recommendations
  console.log('💡 RECOMMENDATIONS:');
  console.log('   1. Check Binance app for actual order status');
  console.log('   2. Cancel high-priced orders if no buyers');
  console.log('   3. Use auto-listing for competitive pricing');
  console.log('   4. Target ₹89.50-90.50 for quick sales\n');

  // 5. Auto-listing benefits
  console.log('🤖 AUTO-LISTING BENEFITS:');
  console.log('   ✅ Automatic order expiry detection');
  console.log('   ✅ Competitive price adjustment');
  console.log('   ✅ Balance protection');
  console.log('   ✅ 24/7 monitoring');
  console.log('   ✅ Instant relisting\n');

  console.log('📌 To start auto-listing, run:');
  console.log('   npm run auto-list\n');
}

// Run check
checkCurrentStatus().catch(console.error);