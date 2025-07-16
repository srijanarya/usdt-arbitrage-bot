import { ZebPayClient } from './api/exchanges/zebPay';
import { KuCoinClient } from './api/exchanges/kucoin';
import { BinanceClient } from './api/exchanges/binance';
import dotenv from 'dotenv';
import { EventEmitter } from 'events';

dotenv.config();

interface PriceData {
  exchange: string;
  pair: string;
  bid: number;
  ask: number;
  last: number;
  timestamp: Date;
}

class MultiExchangeMonitor extends EventEmitter {
  private zebpay: ZebPayClient;
  private kucoin: KuCoinClient;
  private binance: BinanceClient;
  private prices: Map<string, PriceData> = new Map();
  
  constructor() {
    super();
    this.zebpay = new ZebPayClient();
    this.kucoin = new KuCoinClient({
      apiKey: process.env.KUCOIN_API_KEY || '',
      apiSecret: process.env.KUCOIN_API_SECRET || '',
      passphrase: process.env.KUCOIN_PASSPHRASE || ''
    });
    this.binance = new BinanceClient({
      apiKey: process.env.BINANCE_API_KEY || '',
      apiSecret: process.env.BINANCE_API_SECRET || ''
    });
  }
  
  async start() {
    console.log('🚀 Starting Multi-Exchange Arbitrage Monitor...\n');
    console.log('📊 Monitoring stablecoin prices from:');
    console.log('   - ZebPay: USDT/INR (Indian Rupees)');
    console.log('   - KuCoin: USDT/USDC');
    console.log('   - Binance: USDC/USDT\n');
    console.log('═'.repeat(70));
    
    // Monitor ZebPay prices
    this.zebpay.on('priceUpdate', (data) => {
      const priceData = {
        ...data,
        exchange: 'ZebPay',
        pair: 'USDT/INR'
      };
      this.prices.set('ZebPay-USDT/INR', priceData);
      this.emit('priceUpdate', { exchange: 'ZebPay', data: priceData });
      this.checkArbitrage();
    });
    
    this.zebpay.on('error', (error) => {
      console.error('ZebPay Error:', error.message);
    });
    
    // Start ZebPay monitoring
    this.zebpay.startPriceMonitoring('USDT-INR', 3000);
    
    // Monitor KuCoin prices
    await this.startKuCoinMonitoring();
    
    // Monitor Binance prices
    await this.startBinanceMonitoring();
    
    // Emit initial status
    console.log('All exchanges connected and monitoring started');
  }
  
  private async startKuCoinMonitoring() {
    // Poll KuCoin prices
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
        this.emit('priceUpdate', { exchange: 'KuCoin', data: priceData });
        this.checkArbitrage();
      } catch (error: any) {
        console.error('KuCoin Error:', error.message);
      }
    };
    
    await pollKuCoin();
    setInterval(pollKuCoin, 3000);
  }
  
  private async startBinanceMonitoring() {
    // Poll Binance prices
    const pollBinance = async () => {
      try {
        const ticker = await this.binance.getTicker('USDCUSDT');
        const priceData: PriceData = {
          exchange: 'Binance',
          pair: 'USDC/USDT',
          bid: parseFloat(ticker.bidPrice),
          ask: parseFloat(ticker.askPrice),
          last: parseFloat(ticker.lastPrice),
          timestamp: new Date()
        };
        
        this.prices.set('Binance-USDC/USDT', priceData);
        this.emit('priceUpdate', { exchange: 'Binance', data: priceData });
        this.checkArbitrage();
      } catch (error: any) {
        console.error('Binance Error:', error.message);
      }
    };
    
    await pollBinance();
    setInterval(pollBinance, 3000);
    
    // Also connect to WebSocket for real-time updates
    this.binance.on('connected', () => {
      console.log('✓ Connected to Binance WebSocket');
    });
    
    this.binance.on('ticker', (data) => {
      if (data.symbol === 'USDCUSDT') {
        const priceData: PriceData = {
          exchange: 'Binance',
          pair: 'USDC/USDT',
          bid: parseFloat(data.bidPrice || '0'),
          ask: parseFloat(data.askPrice || '0'),
          last: parseFloat(data.lastPrice || '0'),
          timestamp: new Date()
        };
        
        if (priceData.bid > 0 && priceData.ask > 0) {
          this.prices.set('Binance-USDC/USDT', priceData);
          this.emit('priceUpdate', { exchange: 'Binance', data: priceData });
          this.checkArbitrage();
        }
      }
    });
    
    await this.binance.connect();
  }
  
  private checkArbitrage() {
    const zebpayUSDTINR = this.prices.get('ZebPay-USDT/INR');
    const kucoinUSDTUSDC = this.prices.get('KuCoin-USDT/USDC');
    const binanceUSDCUSDT = this.prices.get('Binance-USDC/USDT');
    
    if (!zebpayUSDTINR || !kucoinUSDTUSDC || !binanceUSDCUSDT) return;
    
    console.clear();
    console.log('🚀 Multi-Exchange Arbitrage Monitor');
    console.log('═'.repeat(70));
    
    // Display current prices
    console.log('\n📊 Current Prices:');
    console.log(`   ZebPay USDT/INR:   Buy: ₹${zebpayUSDTINR.bid.toFixed(2)} | Sell: ₹${zebpayUSDTINR.ask.toFixed(2)}`);
    console.log(`   KuCoin USDT/USDC:  Buy: $${kucoinUSDTUSDC.bid.toFixed(4)} | Sell: $${kucoinUSDTUSDC.ask.toFixed(4)}`);
    console.log(`   Binance USDC/USDT: Buy: $${binanceUSDCUSDT.bid.toFixed(4)} | Sell: $${binanceUSDCUSDT.ask.toFixed(4)}`);
    
    // Calculate stablecoin arbitrage opportunities
    console.log('\n💰 Stablecoin Arbitrage Opportunities:');
    
    // Direct USDT/USDC arbitrage between KuCoin and Binance
    const kucoinSellUSDT = kucoinUSDTUSDC.bid; // Sell USDT for USDC on KuCoin
    const binanceBuyUSDT = 1 / binanceUSDCUSDT.ask; // Buy USDT with USDC on Binance
    const directArb = ((binanceBuyUSDT / kucoinSellUSDT) - 1) * 100;
    
    console.log('\n📈 Strategy 1: USDT → USDC → USDT');
    console.log(`   1. Sell 1 USDT on KuCoin for ${kucoinSellUSDT.toFixed(4)} USDC`);
    console.log(`   2. Use ${kucoinSellUSDT.toFixed(4)} USDC on Binance to buy ${(kucoinSellUSDT * binanceBuyUSDT).toFixed(4)} USDT`);
    console.log(`   Net result: ${directArb > 0 ? '+' : ''}${directArb.toFixed(3)}% ${directArb > 0 ? '✅ PROFIT' : '❌ LOSS'}`);
    
    // Reverse: USDC → USDT → USDC
    const binanceSellUSDC = binanceUSDCUSDT.bid; // Sell USDC for USDT on Binance
    const kucoinBuyUSDC = 1 / kucoinUSDTUSDC.ask; // Buy USDC with USDT on KuCoin
    const reverseArb = ((kucoinBuyUSDC / binanceSellUSDC) - 1) * 100;
    
    console.log('\n📈 Strategy 2: USDC → USDT → USDC');
    console.log(`   1. Sell 1 USDC on Binance for ${binanceSellUSDC.toFixed(4)} USDT`);
    console.log(`   2. Use ${binanceSellUSDC.toFixed(4)} USDT on KuCoin to buy ${(binanceSellUSDC * kucoinBuyUSDC).toFixed(4)} USDC`);
    console.log(`   Net result: ${reverseArb > 0 ? '+' : ''}${reverseArb.toFixed(3)}% ${reverseArb > 0 ? '✅ PROFIT' : '❌ LOSS'}`);
    
    // Calculate fees impact
    const kucoinFee = 0.001; // 0.1%
    const binanceFee = 0.001; // 0.1%
    const totalFees = (kucoinFee + binanceFee) * 100;
    
    console.log('\n📊 Fee Analysis:');
    console.log(`   KuCoin Fee: ${kucoinFee * 100}%`);
    console.log(`   Binance Fee: ${binanceFee * 100}%`);
    console.log(`   Total Fees: ${totalFees}%`);
    console.log(`   Min profit needed: >${totalFees}%`);
    
    // Show best opportunity
    const bestArb = Math.max(directArb, reverseArb);
    const bestStrategy = directArb > reverseArb ? 'USDT → USDC → USDT' : 'USDC → USDT → USDC';
    
    if (bestArb > totalFees) {
      console.log(`\n🚨 ARBITRAGE OPPORTUNITY DETECTED!`);
      console.log(`   Best strategy: ${bestStrategy}`);
      console.log(`   Gross profit: ${bestArb.toFixed(3)}%`);
      console.log(`   Net profit after fees: ${(bestArb - totalFees).toFixed(3)}%`);
      
      this.emit('arbitrageOpportunity', {
        strategy: bestStrategy,
        route: bestStrategy,
        grossProfit: bestArb,
        netProfit: bestArb - totalFees,
        timestamp: new Date()
      });
    }
    
    // Show spreads
    console.log('\n📏 Spreads:');
    const zebpaySpread = ((zebpayUSDTINR.ask - zebpayUSDTINR.bid) / zebpayUSDTINR.bid) * 100;
    const kucoinSpread = ((kucoinUSDTUSDC.ask - kucoinUSDTUSDC.bid) / kucoinUSDTUSDC.bid) * 100;
    const binanceSpread = ((binanceUSDCUSDT.ask - binanceUSDCUSDT.bid) / binanceUSDCUSDT.bid) * 100;
    console.log(`   ZebPay spread: ${zebpaySpread.toFixed(3)}%`);
    console.log(`   KuCoin spread: ${kucoinSpread.toFixed(3)}%`);
    console.log(`   Binance spread: ${binanceSpread.toFixed(3)}%`);
    
    console.log('\n' + '═'.repeat(70));
    console.log(`Last updated: ${new Date().toLocaleTimeString()}`);
    console.log('Press Ctrl+C to stop monitoring');
  }
}

// Start the monitor
export { MultiExchangeMonitor };

// Start the monitor if running directly
if (process.argv[1] && process.argv[1].endsWith('monitorMultiExchange.ts')) {
  const monitor = new MultiExchangeMonitor();
  monitor.start().catch(console.error);
}