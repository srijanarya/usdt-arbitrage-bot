#!/usr/bin/env node
import axios from 'axios';

console.log(`
🔍 SIMPLE P2P MARKET MONITOR
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`);

async function monitorP2P() {
  console.log('Monitoring Binance P2P market for USDT/INR...\n');

  setInterval(async () => {
    try {
      // Fetch sell orders (people selling USDT)
      const sellResponse = await axios.post(
        'https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search',
        {
          page: 1,
          rows: 5,
          payTypes: ["UPI"],
          tradeType: "SELL",
          asset: "USDT",
          fiat: "INR"
        },
        { headers: { 'Content-Type': 'application/json' } }
      );

      // Fetch buy orders (people buying USDT)
      const buyResponse = await axios.post(
        'https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search',
        {
          page: 1,
          rows: 5,
          payTypes: ["UPI"],
          tradeType: "BUY",
          asset: "USDT",
          fiat: "INR"
        },
        { headers: { 'Content-Type': 'application/json' } }
      );

      const sellAds = sellResponse.data.data || [];
      const buyAds = buyResponse.data.data || [];

      console.clear();
      console.log(`🔍 P2P MARKET STATUS - ${new Date().toLocaleTimeString()}`);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

      if (sellAds.length > 0 && buyAds.length > 0) {
        const topSellPrice = parseFloat(sellAds[0].adv.price);
        const topBuyPrice = parseFloat(buyAds[0].adv.price);
        const spread = topSellPrice - topBuyPrice;
        const spreadPercent = (spread / topBuyPrice * 100).toFixed(2);

        console.log('📊 MARKET OVERVIEW:');
        console.log(`   Top Sell Price: ₹${topSellPrice} (you compete here)`);
        console.log(`   Top Buy Price:  ₹${topBuyPrice} (you could buy here)`);
        console.log(`   Spread: ₹${spread.toFixed(2)} (${spreadPercent}%)\n`);

        console.log('🔥 TOP 5 SELLERS (Your Competition):');
        sellAds.forEach((ad: any, i: number) => {
          const merchant = ad.advertiser;
          console.log(`   ${i + 1}. ₹${ad.adv.price} - ${merchant.nickName} (${merchant.monthOrderCount} orders, ${(merchant.monthFinishRate * 100).toFixed(0)}%)`);
          console.log(`      Min: ₹${ad.adv.minSingleTransAmount} | Max: ₹${ad.adv.maxSingleTransAmount}`);
        });

        console.log('\n💰 TOP 5 BUYERS (Potential Sources):');
        buyAds.forEach((ad: any, i: number) => {
          const merchant = ad.advertiser;
          console.log(`   ${i + 1}. ₹${ad.adv.price} - ${merchant.nickName} (${merchant.monthOrderCount} orders)`);
        });

        console.log('\n📈 OPPORTUNITIES:');
        
        // Strategy 1: Competitive selling
        const competitivePrice = topSellPrice - 0.05;
        console.log(`\n   1️⃣ COMPETITIVE SELLING:`);
        console.log(`      Sell at ₹${competitivePrice.toFixed(2)} (5 paise below top)`);
        console.log(`      Profit: ₹${((competitivePrice - 89) * 10).toFixed(2)} per 10 USDT`);

        // Strategy 2: Quick flip
        if (spread > 0.5) {
          console.log(`\n   2️⃣ QUICK FLIP OPPORTUNITY:`);
          console.log(`      Buy at: ₹${topBuyPrice}`);
          console.log(`      Sell at: ₹${competitivePrice.toFixed(2)}`);
          console.log(`      Profit per USDT: ₹${(competitivePrice - topBuyPrice).toFixed(2)}`);
        }

        // Best price to list
        console.log(`\n✅ RECOMMENDED ACTION:`);
        console.log(`   List your USDT at ₹${competitivePrice.toFixed(2)}`);
        console.log(`   Expected profit: ${((competitivePrice - 89) / 89 * 100).toFixed(1)}%`);

      }

      console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('Refreshing in 30 seconds... (Press Ctrl+C to stop)');

    } catch (error) {
      console.error('Error fetching market data:', error);
    }
  }, 30000); // Update every 30 seconds

  // Initial fetch
  setTimeout(() => {}, 100);
}

monitorP2P().catch(console.error);