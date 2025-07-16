import { ZebPayClient } from './api/exchanges/zebPay';
import { KuCoinClient } from './api/exchanges/kucoin';
import dotenv from 'dotenv';

dotenv.config();

interface PriceData {
  exchange: string;
  pair: string;
  bid: number;
  ask: number;
  last: number;
  timestamp: Date;
}

class CrossExchangeMonitor {
  private zebpay: ZebPayClient;
  private kucoin: KuCoinClient;
  private prices: Map<string, PriceData> = new Map();
  
  constructor() {
    this.zebpay = new ZebPayClient();
    this.kucoin = new KuCoinClient({
      apiKey: process.env.KUCOIN_API_KEY || '',
      apiSecret: process.env.KUCOIN_API_SECRET || '',
      passphrase: process.env.KUCOIN_PASSPHRASE || ''
    });
  }
  
  async start() {
    console.log('🚀 Starting Cross-Exchange Arbitrage Monitor...\n');
    console.log('📊 Monitoring prices from:');
    console.log('   - ZebPay: USDT/INR (Indian Rupee)');
    console.log('   - KuCoin: USDT/USDC (USD Coin)\n');
    console.log('═'.repeat(60));
    
    // Monitor ZebPay prices
    this.zebpay.on('priceUpdate', (data) => {
      this.prices.set('ZebPay-USDT/INR', {
        ...data,
        pair: 'USDT/INR'
      });
      this.checkArbitrage();
    });
    
    this.zebpay.on('error', (error) => {
      console.error('ZebPay Error:', error.message);
    });
    
    // Start ZebPay monitoring
    this.zebpay.startPriceMonitoring('USDT-INR', 3000);
    
    // Monitor KuCoin prices
    await this.startKuCoinMonitoring();
  }
  
  private async startKuCoinMonitoring() {
    // Poll KuCoin prices every 3 seconds
    const pollKuCoin = async () => {
      try {
        const ticker = await this.kucoin.getTicker('USDT-USDC');
        const priceData: PriceData = {
          exchange: 'KuCoin',
          pair: 'USDT/USDC',
          bid: parseFloat(ticker.bestBid),
          ask: parseFloat(ticker.bestAsk),
          last: parseFloat(ticker.price),
          timestamp: new Date()
        };
        
        this.prices.set('KuCoin-USDT/USDC', priceData);
        this.checkArbitrage();
      } catch (error: any) {
        console.error('KuCoin Error:', error.message);
      }
    };
    
    // Initial poll
    await pollKuCoin();
    
    // Poll every 3 seconds
    setInterval(pollKuCoin, 3000);
    
    // Also connect to WebSocket for real-time updates
    this.kucoin.on('connected', () => {
      console.log('✓ Connected to KuCoin WebSocket');
    });
    
    this.kucoin.on('ticker', (data) => {
      const priceData: PriceData = {
        exchange: 'KuCoin',
        pair: 'USDT/USDC',
        bid: parseFloat(data.bestBid || '0'),
        ask: parseFloat(data.bestAsk || '0'),
        last: parseFloat(data.price || '0'),
        timestamp: new Date()
      };
      
      if (priceData.bid > 0 && priceData.ask > 0) {
        this.prices.set('KuCoin-USDT/USDC', priceData);
        this.checkArbitrage();
      }
    });
    
    this.kucoin.on('error', (error) => {
      console.error('KuCoin WebSocket Error:', error.message);
    });
    
    // Connect to WebSocket
    await this.kucoin.connect();
  }
  
  private checkArbitrage() {
    const zebpayUSDTINR = this.prices.get('ZebPay-USDT/INR');
    const kucoinUSDTUSDC = this.prices.get('KuCoin-USDT/USDC');
    
    if (!zebpayUSDTINR || !kucoinUSDTUSDC) return;
    
    console.clear();
    console.log('🚀 Cross-Exchange Arbitrage Monitor');
    console.log('═'.repeat(60));
    
    // Display current prices
    console.log('\n📊 Current Prices:');
    console.log(`   ZebPay USDT/INR:  Buy: ₹${zebpayUSDTINR.bid.toFixed(2)} | Sell: ₹${zebpayUSDTINR.ask.toFixed(2)}`);
    console.log(`   KuCoin USDT/USDC: Buy: $${kucoinUSDTUSDC.bid.toFixed(4)} | Sell: $${kucoinUSDTUSDC.ask.toFixed(4)}`);
    
    // Calculate implied INR/USD rate
    const impliedINRUSDRate = zebpayUSDTINR.last / kucoinUSDTUSDC.last;
    console.log(`\n💱 Implied INR/USD Rate: ₹${impliedINRUSDRate.toFixed(2)} per USD`);
    
    // Arbitrage opportunities
    console.log('\n💰 Arbitrage Opportunities:');
    
    // Scenario 1: If you have INR and want to maximize USDT
    const inrAmount = 10000; // ₹10,000
    const usdtFromINR = inrAmount / zebpayUSDTINR.ask; // Buy USDT with INR
    console.log(`\n📈 Scenario 1: Starting with ₹${inrAmount.toLocaleString()}`);
    console.log(`   Buy ${usdtFromINR.toFixed(2)} USDT on ZebPay @ ₹${zebpayUSDTINR.ask.toFixed(2)}`);
    
    // Scenario 2: If you have USDC and want to get INR
    const usdcAmount = 100; // $100 USDC
    const usdtFromUSDC = usdcAmount / kucoinUSDTUSDC.ask; // Buy USDT with USDC
    const inrFromUSDT = usdtFromUSDC * zebpayUSDTINR.bid; // Sell USDT for INR
    console.log(`\n📈 Scenario 2: Starting with $${usdcAmount} USDC`);
    console.log(`   1. Buy ${usdtFromUSDC.toFixed(2)} USDT on KuCoin @ $${kucoinUSDTUSDC.ask.toFixed(4)}`);
    console.log(`   2. Sell USDT on ZebPay for ₹${inrFromUSDT.toFixed(2)} @ ₹${zebpayUSDTINR.bid.toFixed(2)}`);
    console.log(`   Effective rate: ₹${(inrFromUSDT / usdcAmount).toFixed(2)} per USD`);
    
    // Calculate stablecoin arbitrage
    const stablecoinArb = ((1 / kucoinUSDTUSDC.ask) - 1) * 100;
    console.log(`\n📊 Stablecoin Arbitrage (USDT/USDC):`);
    console.log(`   KuCoin USDT/USDC deviation: ${stablecoinArb.toFixed(3)}%`);
    
    if (Math.abs(stablecoinArb) > 0.1) {
      console.log(`   ⚡ Opportunity: ${stablecoinArb > 0 ? 'Buy USDC with USDT' : 'Buy USDT with USDC'}`);
    }
    
    // Show spread information
    console.log('\n📏 Spreads:');
    const zebpaySpread = ((zebpayUSDTINR.ask - zebpayUSDTINR.bid) / zebpayUSDTINR.bid) * 100;
    const kucoinSpread = ((kucoinUSDTUSDC.ask - kucoinUSDTUSDC.bid) / kucoinUSDTUSDC.bid) * 100;
    console.log(`   ZebPay spread: ${zebpaySpread.toFixed(3)}%`);
    console.log(`   KuCoin spread: ${kucoinSpread.toFixed(3)}%`);
    
    console.log('\n' + '═'.repeat(60));
    console.log(`Last updated: ${new Date().toLocaleTimeString()}`);
    console.log('Press Ctrl+C to stop monitoring');
  }
}

// Start the monitor
export { CrossExchangeMonitor };

if (require.main === module) {
  const monitor = new CrossExchangeMonitor();
  monitor.start().catch(console.error);
}