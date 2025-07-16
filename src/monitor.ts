import { ZebPayClient } from './api/exchanges/zebPay';
import dotenv from 'dotenv';

dotenv.config();

interface PriceData {
  exchange: string;
  bid: number;
  ask: number;
  last: number;
  timestamp: Date;
}

class ArbitrageMonitor {
  private zebpay: ZebPayClient;
  private prices: Map<string, PriceData> = new Map();
  
  constructor() {
    this.zebpay = new ZebPayClient();
  }
  
  start() {
    console.log('🚀 Starting USDT Arbitrage Monitor...\n');
    console.log('📊 Monitoring prices from:');
    console.log('   - ZebPay (Real)');
    console.log('   - CoinDCX (Mocked until API keys arrive)\n');
    console.log('═'.repeat(60));
    
    // Monitor ZebPay prices
    this.zebpay.on('priceUpdate', (data) => {
      this.prices.set('ZebPay', data);
      this.checkArbitrage();
    });
    
    this.zebpay.on('error', (error) => {
      console.error('ZebPay Error:', error.message);
    });
    
    // Start monitoring
    this.zebpay.startPriceMonitoring('USDT-INR', 3000);
    
    // Mock CoinDCX prices
    this.startMockCoinDCX();
  }
  
  private startMockCoinDCX() {
    setInterval(async () => {
      const zebpayPrice = this.prices.get('ZebPay');
      if (zebpayPrice) {
        // Add random variance to simulate different exchange
        const variance = (Math.random() - 0.5) * 0.01; // ±0.5% variance
        const mockPrice: PriceData = {
          exchange: 'CoinDCX',
          bid: zebpayPrice.bid * (1 + variance),
          ask: zebpayPrice.ask * (1 + variance),
          last: zebpayPrice.last * (1 + variance),
          timestamp: new Date()
        };
        
        this.prices.set('CoinDCX', mockPrice);
        this.checkArbitrage();
      }
    }, 3000);
  }
  
  private checkArbitrage() {
    const zebpay = this.prices.get('ZebPay');
    const coindcx = this.prices.get('CoinDCX');
    
    if (!zebpay || !coindcx) return;
    
    console.clear();
    console.log('🚀 USDT Arbitrage Monitor');
    console.log('═'.repeat(60));
    
    // Display current prices
    console.log('\n📊 Current Prices:');
    console.log(`   ZebPay:  Buy: ₹${zebpay.bid.toFixed(2)} | Sell: ₹${zebpay.ask.toFixed(2)} | Last: ₹${zebpay.last.toFixed(2)}`);
    console.log(`   CoinDCX: Buy: ₹${coindcx.bid.toFixed(2)} | Sell: ₹${coindcx.ask.toFixed(2)} | Last: ₹${coindcx.last.toFixed(2)} (mock)`);
    
    // Calculate arbitrage opportunities
    console.log('\n💰 Arbitrage Analysis:');
    
    // Opportunity 1: Buy on ZebPay, Sell on CoinDCX
    const opportunity1 = {
      buyExchange: 'ZebPay',
      sellExchange: 'CoinDCX',
      buyPrice: zebpay.ask, // We buy at ask price
      sellPrice: coindcx.bid, // We sell at bid price
      profit: coindcx.bid - zebpay.ask,
      profitPercent: ((coindcx.bid - zebpay.ask) / zebpay.ask) * 100
    };
    
    // Opportunity 2: Buy on CoinDCX, Sell on ZebPay
    const opportunity2 = {
      buyExchange: 'CoinDCX',
      sellExchange: 'ZebPay',
      buyPrice: coindcx.ask,
      sellPrice: zebpay.bid,
      profit: zebpay.bid - coindcx.ask,
      profitPercent: ((zebpay.bid - coindcx.ask) / coindcx.ask) * 100
    };
    
    // Find best opportunity
    const bestOpp = opportunity1.profit > opportunity2.profit ? opportunity1 : opportunity2;
    
    if (bestOpp.profit > 0) {
      console.log(`\n🚨 ARBITRAGE OPPORTUNITY DETECTED!`);
      console.log(`   Buy on: ${bestOpp.buyExchange} @ ₹${bestOpp.buyPrice.toFixed(2)}`);
      console.log(`   Sell on: ${bestOpp.sellExchange} @ ₹${bestOpp.sellPrice.toFixed(2)}`);
      console.log(`   Gross Profit: ₹${bestOpp.profit.toFixed(2)} (${bestOpp.profitPercent.toFixed(3)}%)`);
      
      // Calculate fees
      const buyFee = bestOpp.buyPrice * (bestOpp.buyExchange === 'ZebPay' ? 0.0015 : 0.001);
      const sellFee = bestOpp.sellPrice * (bestOpp.sellExchange === 'ZebPay' ? 0.0015 : 0.001);
      const tds = bestOpp.profit * 0.01; // 1% TDS
      const totalFees = buyFee + sellFee + tds;
      const netProfit = bestOpp.profit - totalFees;
      const netProfitPercent = (netProfit / bestOpp.buyPrice) * 100;
      
      console.log(`\n   📊 Fee Breakdown:`);
      console.log(`   Buy Fee: ₹${buyFee.toFixed(2)}`);
      console.log(`   Sell Fee: ₹${sellFee.toFixed(2)}`);
      console.log(`   TDS (1%): ₹${tds.toFixed(2)}`);
      console.log(`   Total Fees: ₹${totalFees.toFixed(2)}`);
      
      console.log(`\n   💵 NET PROFIT: ₹${netProfit.toFixed(2)} (${netProfitPercent.toFixed(3)}%)`);
      
      if (netProfit > 0) {
        console.log(`\n   ✅ PROFITABLE after fees!`);
      } else {
        console.log(`\n   ❌ Not profitable after fees`);
      }
    } else {
      console.log(`\n   No arbitrage opportunity at current prices`);
      console.log(`   Spread: ${Math.abs(opportunity1.profitPercent).toFixed(3)}%`);
    }
    
    console.log('\n' + '═'.repeat(60));
    console.log(`Last updated: ${new Date().toLocaleTimeString()}`);
    console.log('Press Ctrl+C to stop monitoring');
  }
}

// Start the monitor
const monitor = new ArbitrageMonitor();
monitor.start();