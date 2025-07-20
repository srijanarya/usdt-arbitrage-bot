import chalk from 'chalk';
import { EventEmitter } from 'events';
import { PostgresService } from '../database/postgresService';
import { arbitrageCalculator } from '../arbitrage/USDTArbitrageCalculator';
import axios from 'axios';

interface PriceUpdate {
  exchange: string;
  symbol: string;
  bid: number;
  ask: number;
  timestamp: Date;
}

export class SimpleWebSocketMonitor extends EventEmitter {
  private isRunning: boolean = false;
  private pollIntervals: Map<string, NodeJS.Timeout> = new Map();
  private prices: Map<string, PriceUpdate> = new Map();
  private defaultAmount: number = 100; // Default 100 USDT for calculations

  constructor() {
    super();
  }

  async start() {
    console.log(chalk.cyan('🚀 Starting Price Monitoring (REST API fallback)...\n'));
    this.isRunning = true;

    // Start polling for each exchange
    this.startBinancePolling();
    this.startZebPayPolling();
    this.startCoinDCXPolling();
    this.startP2PPolling();
  }

  stop() {
    console.log(chalk.yellow('🛑 Stopping price monitoring...'));
    this.isRunning = false;
    
    this.pollIntervals.forEach(interval => clearInterval(interval));
    this.pollIntervals.clear();
  }

  private startBinancePolling() {
    const fetchBinancePrice = async () => {
      try {
        const response = await axios.get('https://api.binance.com/api/v3/ticker/price?symbol=USDTINR');
        const price = parseFloat(response.data.price);
        
        // For spot price, we'll use a small spread
        const priceUpdate: PriceUpdate = {
          exchange: 'binance',
          symbol: 'USDT/INR',
          bid: price - 0.05,
          ask: price + 0.05,
          timestamp: new Date()
        };

        this.updatePrice(priceUpdate);
        await PostgresService.savePriceData(
          priceUpdate.exchange,
          priceUpdate.symbol,
          priceUpdate.bid,
          priceUpdate.ask
        );

      } catch (error) {
        // Binance might not have USDT/INR, fallback to calculation
        try {
          const usdtBusd = await axios.get('https://api.binance.com/api/v3/ticker/price?symbol=USDTBUSD');
          const busdInr = await axios.get('https://api.binance.com/api/v3/ticker/price?symbol=BUSDINR');
          
          if (usdtBusd.data && busdInr.data) {
            const price = parseFloat(usdtBusd.data.price) * parseFloat(busdInr.data.price);
            
            const priceUpdate: PriceUpdate = {
              exchange: 'binance',
              symbol: 'USDT/INR',
              bid: price - 0.10,
              ask: price + 0.10,
              timestamp: new Date()
            };

            this.updatePrice(priceUpdate);
            await PostgresService.savePriceData(
              priceUpdate.exchange,
              priceUpdate.symbol,
              priceUpdate.bid,
              priceUpdate.ask
            );
          }
        } catch (e) {
          console.error(chalk.red('Binance price error:', e.message));
        }
      }
    };

    // Initial fetch
    fetchBinancePrice();
    
    // Poll every 5 seconds
    const interval = setInterval(fetchBinancePrice, 5000);
    this.pollIntervals.set('binance', interval);
  }

  private startZebPayPolling() {
    const fetchZebPayPrice = async () => {
      try {
        const response = await axios.get('https://www.zebapi.com/pro/v1/market/USDT-INR/ticker');
        
        const priceUpdate: PriceUpdate = {
          exchange: 'zebpay',
          symbol: 'USDT/INR',
          bid: parseFloat(response.data.buy),
          ask: parseFloat(response.data.sell),
          timestamp: new Date()
        };

        this.updatePrice(priceUpdate);
        await PostgresService.savePriceData(
          priceUpdate.exchange,
          priceUpdate.symbol,
          priceUpdate.bid,
          priceUpdate.ask
        );

        console.log(chalk.green(`✅ ZebPay: ₹${priceUpdate.bid.toFixed(2)} / ₹${priceUpdate.ask.toFixed(2)}`));

      } catch (error) {
        console.error(chalk.red('ZebPay error:', error.message));
      }
    };

    fetchZebPayPrice();
    const interval = setInterval(fetchZebPayPrice, 10000);
    this.pollIntervals.set('zebpay', interval);
  }

  private startCoinDCXPolling() {
    const fetchCoinDCXPrice = async () => {
      try {
        const response = await axios.get('https://api.coindcx.com/exchange/ticker');
        const usdtInr = response.data.find((t: any) => t.market === 'USDTINR');
        
        if (usdtInr) {
          const priceUpdate: PriceUpdate = {
            exchange: 'coindcx',
            symbol: 'USDT/INR',
            bid: parseFloat(usdtInr.bid),
            ask: parseFloat(usdtInr.ask),
            timestamp: new Date()
          };

          this.updatePrice(priceUpdate);
          await PostgresService.savePriceData(
            priceUpdate.exchange,
            priceUpdate.symbol,
            priceUpdate.bid,
            priceUpdate.ask
          );

          console.log(chalk.green(`✅ CoinDCX: ₹${priceUpdate.bid.toFixed(2)} / ₹${priceUpdate.ask.toFixed(2)}`));
        }

      } catch (error) {
        console.error(chalk.red('CoinDCX error:', error.message));
      }
    };

    fetchCoinDCXPrice();
    const interval = setInterval(fetchCoinDCXPrice, 10000);
    this.pollIntervals.set('coindcx', interval);
  }

  private startP2PPolling() {
    const fetchP2PPrice = async () => {
      try {
        // Fetch P2P sell prices
        const response = await axios.post(
          'https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search',
          {
            page: 1,
            rows: 3,
            asset: "USDT",
            fiat: "INR",
            tradeType: "SELL"
          }
        );

        if (response.data?.data?.[0]) {
          const bestPrice = parseFloat(response.data.data[0].adv.price);
          
          const priceUpdate: PriceUpdate = {
            exchange: 'binance_p2p',
            symbol: 'USDT/INR',
            bid: bestPrice,
            ask: bestPrice,
            timestamp: new Date()
          };

          this.updatePrice(priceUpdate);
          await PostgresService.savePriceData(
            priceUpdate.exchange,
            priceUpdate.symbol,
            priceUpdate.bid,
            priceUpdate.ask
          );

          console.log(chalk.green(`✅ Binance P2P: ₹${bestPrice.toFixed(2)}`));

          // Check for arbitrage
          this.checkArbitrage();
        }

      } catch (error) {
        console.error(chalk.red('P2P error:', error.message));
      }
    };

    fetchP2PPrice();
    const interval = setInterval(fetchP2PPrice, 15000);
    this.pollIntervals.set('p2p', interval);
  }

  private updatePrice(priceUpdate: PriceUpdate) {
    const key = `${priceUpdate.exchange}_${priceUpdate.symbol}`;
    this.prices.set(key, priceUpdate);
    this.emit('priceUpdate', priceUpdate);
  }

  private async checkArbitrage() {
    const p2pPrice = this.prices.get('binance_p2p_USDT/INR');
    
    if (!p2pPrice) return;

    // Use realistic sell price (₹90) instead of current P2P price if it's too high
    const realisticSellPrice = Math.min(p2pPrice.bid, 90);

    // Check against all exchanges
    for (const [key, priceUpdate] of this.prices) {
      if (key === 'binance_p2p_USDT/INR') continue;
      
      // Calculate profit with realistic arbitrage calculator
      const analysis = arbitrageCalculator.calculateProfit(
        priceUpdate.ask,  // Buy price
        realisticSellPrice,  // Sell price (capped at ₹90)
        this.defaultAmount,
        priceUpdate.exchange
      );

      // Also check with actual P2P price for comparison
      const actualAnalysis = arbitrageCalculator.calculateProfit(
        priceUpdate.ask,
        p2pPrice.bid,
        this.defaultAmount,
        priceUpdate.exchange
      );

      // Display opportunities if profitable
      if (analysis.profitable && analysis.meetsMinQuantity) {
        console.log(chalk.bgGreen.black('\n 💰 REALISTIC ARBITRAGE OPPORTUNITY! '));
        console.log(chalk.yellow(`Buy ${priceUpdate.exchange}: ₹${priceUpdate.ask.toFixed(2)}`));
        console.log(chalk.green(`Sell P2P (Realistic): ₹${realisticSellPrice.toFixed(2)}`));
        console.log(chalk.cyan(`Net Profit: ₹${analysis.netProfit.toFixed(2)} (${analysis.roi.toFixed(2)}% ROI)`));
        console.log(chalk.gray(`Meets minimum quantity: ${analysis.minQuantityRequired?.toFixed(2)} USDT\n`));

        // Save to database
        await PostgresService.saveArbitrageOpportunity({
          type: 'realistic',
          buyExchange: priceUpdate.exchange,
          sellExchange: 'binance_p2p',
          symbol: 'USDT/INR',
          buyPrice: priceUpdate.ask,
          sellPrice: realisticSellPrice,
          grossProfit: analysis.grossProfit,
          netProfit: analysis.netProfit,
          profitPercentage: analysis.roi
        });

        this.emit('arbitrageFound', {
          buyExchange: priceUpdate.exchange,
          sellExchange: 'binance_p2p',
          buyPrice: priceUpdate.ask,
          sellPrice: realisticSellPrice,
          netProfit: analysis.netProfit,
          roi: analysis.roi,
          profitable: true,
          meetsMinQuantity: true
        });
      } else if (!analysis.meetsMinQuantity) {
        console.log(chalk.yellow(`\n⚠️ ${priceUpdate.exchange}: Below minimum quantity (${analysis.minQuantityRequired?.toFixed(2)} USDT required)`));
      }

      // Show actual P2P comparison if different
      if (p2pPrice.bid > 90 && actualAnalysis.profitable) {
        console.log(chalk.gray(`   (With actual P2P ₹${p2pPrice.bid.toFixed(2)}: ₹${actualAnalysis.netProfit.toFixed(2)} profit)`));
      }
    }
  }

  getCurrentPrices(): Map<string, PriceUpdate> {
    return new Map(this.prices);
  }
}

export const priceMonitor = new SimpleWebSocketMonitor();