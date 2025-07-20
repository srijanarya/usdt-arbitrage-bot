import chalk from 'chalk';
import { EventEmitter } from 'events';
import { PostgresService } from '../database/postgresService';
import { wsManager } from '../websocket/WebSocketManager';

interface PriceData {
  exchange: string;
  symbol: string;
  bid: number;
  ask: number;
  timestamp: Date;
}

interface ArbitrageOpportunity {
  buyExchange: string;
  sellExchange: string;
  buyPrice: number;
  sellPrice: number;
  profitPercentage: number;
  profitAmount: number;
  volume?: number;
}

export class RealtimeArbitrageDetector extends EventEmitter {
  private prices: Map<string, PriceData> = new Map();
  private minProfitThreshold: number;
  private checkInterval: NodeJS.Timeout | null = null;

  constructor(minProfitThreshold: number = 0.5) {
    super();
    this.minProfitThreshold = minProfitThreshold;
  }

  start() {
    console.log(chalk.cyan('🎯 Starting Real-time Arbitrage Detection...\n'));

    // Listen for price updates from WebSocket
    wsManager.on('priceUpdate', (priceUpdate) => {
      this.updatePrice(priceUpdate);
      this.checkArbitrageOpportunities();
    });

    // Also check periodically for P2P prices
    this.checkInterval = setInterval(() => {
      this.checkP2PArbitrage();
    }, 10000); // Every 10 seconds

    // Start WebSocket connections
    wsManager.start();
  }

  stop() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }
    wsManager.stop();
  }

  private updatePrice(priceData: PriceData) {
    const key = `${priceData.exchange}_${priceData.symbol}`;
    this.prices.set(key, priceData);
  }

  private async checkArbitrageOpportunities() {
    const opportunities: ArbitrageOpportunity[] = [];

    // Get all USDT/INR prices
    const usdtInrPrices = Array.from(this.prices.entries())
      .filter(([key]) => key.includes('USDT/INR'))
      .map(([_, price]) => price);

    // Check all combinations
    for (let i = 0; i < usdtInrPrices.length; i++) {
      for (let j = 0; j < usdtInrPrices.length; j++) {
        if (i === j) continue;

        const buyExchange = usdtInrPrices[i];
        const sellExchange = usdtInrPrices[j];

        // Buy at ask price, sell at bid price
        const buyPrice = buyExchange.ask;
        const sellPrice = sellExchange.bid;

        if (sellPrice > buyPrice) {
          const profitAmount = sellPrice - buyPrice;
          const profitPercentage = (profitAmount / buyPrice) * 100;

          if (profitPercentage >= this.minProfitThreshold) {
            const opportunity: ArbitrageOpportunity = {
              buyExchange: buyExchange.exchange,
              sellExchange: sellExchange.exchange,
              buyPrice,
              sellPrice,
              profitPercentage,
              profitAmount
            };

            opportunities.push(opportunity);

            // Save to database
            await this.saveOpportunity(opportunity);

            // Emit event
            this.emit('arbitrageFound', opportunity);

            // Log to console
            this.logOpportunity(opportunity);
          }
        }
      }
    }

    // Check stablecoin arbitrage (USDT/USDC)
    this.checkStablecoinArbitrage();
  }

  private async checkP2PArbitrage() {
    try {
      // Fetch current P2P prices
      const response = await fetch('https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          page: 1,
          rows: 5,
          asset: "USDT",
          fiat: "INR",
          tradeType: "SELL"
        })
      });

      const data = await response.json();
      if (data?.data?.[0]) {
        const bestP2PSell = parseFloat(data.data[0].adv.price);
        
        // Check against all exchange prices
        this.prices.forEach((price) => {
          if (price.symbol === 'USDT/INR' && price.ask < bestP2PSell) {
            const profitAmount = bestP2PSell - price.ask;
            const profitPercentage = (profitAmount / price.ask) * 100;

            if (profitPercentage >= this.minProfitThreshold) {
              const opportunity: ArbitrageOpportunity = {
                buyExchange: price.exchange,
                sellExchange: 'binance_p2p',
                buyPrice: price.ask,
                sellPrice: bestP2PSell,
                profitPercentage,
                profitAmount
              };

              this.saveOpportunity(opportunity);
              this.emit('arbitrageFound', opportunity);
              this.logOpportunity(opportunity);
            }
          }
        });
      }
    } catch (error) {
      console.error(chalk.red('P2P check error:', error.message));
    }
  }

  private checkStablecoinArbitrage() {
    const usdtUsdc = this.prices.get('kucoin_USDT/USDC');
    
    if (usdtUsdc) {
      // If USDT is trading above 1.001 USDC, there's an opportunity
      if (usdtUsdc.bid > 1.001) {
        const opportunity: ArbitrageOpportunity = {
          buyExchange: 'market',
          sellExchange: 'kucoin',
          buyPrice: 1.0,
          sellPrice: usdtUsdc.bid,
          profitPercentage: (usdtUsdc.bid - 1.0) * 100,
          profitAmount: usdtUsdc.bid - 1.0
        };

        this.emit('stablecoinArbitrage', opportunity);
      }
    }
  }

  private async saveOpportunity(opportunity: ArbitrageOpportunity) {
    try {
      await PostgresService.saveArbitrageOpportunity({
        type: 'simple',
        buyExchange: opportunity.buyExchange,
        sellExchange: opportunity.sellExchange,
        symbol: 'USDT/INR',
        buyPrice: opportunity.buyPrice,
        sellPrice: opportunity.sellPrice,
        grossProfit: opportunity.profitAmount,
        netProfit: opportunity.profitAmount * 0.95, // Assume 5% for fees/slippage
        profitPercentage: opportunity.profitPercentage
      });
    } catch (error) {
      console.error(chalk.red('Error saving opportunity:', error.message));
    }
  }

  private logOpportunity(opportunity: ArbitrageOpportunity) {
    console.log(chalk.bgGreen.black('\n 💰 ARBITRAGE OPPORTUNITY DETECTED! '));
    console.log(chalk.yellow(`Buy ${opportunity.buyExchange}: ₹${opportunity.buyPrice.toFixed(2)}`));
    console.log(chalk.green(`Sell ${opportunity.sellExchange}: ₹${opportunity.sellPrice.toFixed(2)}`));
    console.log(chalk.cyan(`Profit: ${opportunity.profitPercentage.toFixed(2)}% (₹${opportunity.profitAmount.toFixed(2)})`));
    console.log(chalk.gray(`Time: ${new Date().toLocaleTimeString()}\n`));
  }

  getCurrentPrices(): Map<string, PriceData> {
    return new Map(this.prices);
  }

  getConnectionStatus() {
    return wsManager.getConnectionStatus();
  }
}

// Export singleton instance
export const arbitrageDetector = new RealtimeArbitrageDetector();