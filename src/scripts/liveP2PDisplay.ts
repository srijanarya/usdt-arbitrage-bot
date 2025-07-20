#!/usr/bin/env node
import axios from 'axios';
import { exec } from 'child_process';

async function updateDisplay() {
  try {
    const response = await axios.post(
      'https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search',
      {
        page: 1,
        rows: 5,
        payTypes: ["UPI"],
        tradeType: "SELL",
        asset: "USDT",
        fiat: "INR"
      }
    );

    const ads = response.data.data || [];
    const topPrice = parseFloat(ads[0]?.adv?.price || 0);
    const ourPrice = (topPrice - 0.05).toFixed(2);
    const profit = ((parseFloat(ourPrice) - 89) * 11.54).toFixed(2);
    const profitPercent = ((parseFloat(ourPrice) - 89) / 89 * 100).toFixed(1);

    console.clear();
    console.log(`
💹 LIVE P2P MARKET - ${new Date().toLocaleTimeString()}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔥 TOP SELLERS:
${ads.slice(0, 3).map((ad: any, i: number) => 
  `${i + 1}. ₹${ad.adv.price} - ${ad.advertiser.nickName} (${ad.advertiser.monthOrderCount} orders)`
).join('\n')}

📊 YOUR STRATEGY:
   Market Top: ₹${topPrice}
   Your Price: ₹${ourPrice} (5 paise below)
   Your USDT: 11.54
   Total INR: ₹${(parseFloat(ourPrice) * 11.54).toFixed(2)}
   Profit: ₹${profit} (${profitPercent}%)

✅ ACTION: Create order at ₹${ourPrice}
`);

    // Update browser if price is good
    if (parseFloat(ourPrice) >= 94.5) {
      exec(`osascript -e 'display notification "Good P2P price: ₹${ourPrice}" with title "Trade Alert"'`);
    }

  } catch (error) {
    console.error('Error fetching data');
  }
}

// Update every 10 seconds
setInterval(updateDisplay, 10000);
updateDisplay();

console.log('Monitoring P2P prices... Press Ctrl+C to stop.');