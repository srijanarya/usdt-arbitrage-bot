#!/usr/bin/env node
import axios from 'axios';
import { telegramNotifier } from '../services/telegram';
import { config } from 'dotenv';

config();

console.log(`
📱 MANUAL P2P TRADING ASSISTANT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

This will monitor prices and alert you when to create orders.
You'll need to manually create ads on Binance P2P.

Starting monitor...
`);

let lastAlertPrice = 0;

async function monitorAndAlert() {
  try {
    // Get current market prices
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
    if (ads.length === 0) return;

    const topPrice = parseFloat(ads[0].adv.price);
    const competitivePrice = topPrice - 0.05;
    
    // Alert conditions
    const shouldAlert = 
      Math.abs(topPrice - lastAlertPrice) > 0.10 || // Price moved 10 paise
      topPrice > 95.00 || // High price opportunity
      (Date.now() % 3600000 < 60000 && lastAlertPrice === 0); // Hourly reminder

    if (shouldAlert) {
      const message = `🔔 P2P Price Alert!\n\nTop Price: ₹${topPrice}\nSuggested: ₹${competitivePrice}\nProfit: ${((competitivePrice - 89) / 89 * 100).toFixed(1)}%\n\nCreate order now on Binance P2P!`;
      
      console.log(`\n${message}`);
      
      if (process.env.TELEGRAM_ENABLED === 'true') {
        await telegramNotifier.sendMessage(message);
      }
      
      lastAlertPrice = topPrice;
    }

    // Display current status
    console.log(`\r📊 ${new Date().toLocaleTimeString()} - Top: ₹${topPrice} | Suggested: ₹${competitivePrice} | Profit: ${((competitivePrice - 89) / 89 * 100).toFixed(1)}%`, );

  } catch (error) {
    console.error('Monitor error:', error);
  }
}

// Check every 30 seconds
setInterval(monitorAndAlert, 30000);
monitorAndAlert(); // Initial check

console.log('\nPress Ctrl+C to stop monitoring.\n');