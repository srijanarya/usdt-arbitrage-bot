import { EventEmitter } from 'events';
import { CoinDCXClient } from '../api/exchanges/coinDCX';
import { ZebPayClient } from '../api/exchanges/zebPay';
import { PriceCalculator } from './priceCalculator';

export interface BotConfig {
  minProfitPercentage: number;
  maxVolume: number;
  enableTelegram: boolean;
  scanInterval: number;
}

export interface Opportunity {
  buyExchange: string;
  sellExchange: string;
  buyPrice: number;
  sellPrice: number;
  profitPercentage: number;
  recommendedVolume: number;
  riskAdjustedProfit?: number;
}

export interface P2POpportunity {
  buyExchange: string;
  sellPlatform: string;
  buyPrice: number;
  sellPrice: number;
  profitPercentage: number;
  recommendedVolume: number;
}

export class ArbitrageBot extends EventEmitter {
  private exchanges: {
    coinDCX?: CoinDCXClient;
    zebPay?: ZebPayClient;
  };
  private calculator: PriceCalculator;
  private config: BotConfig;
  private isRunning = false;
  private scanTimer?: NodeJS.Timer;
  private errors: string[] = [];
  private p2pPrices: Record<string, { price: number; premium: number }> = {};
  private riskFactors: Record<string, number> = {};
  private scanHistory: Array<{ timestamp: number; opportunities: number }> = [];
  private lastScanDuration = 0;
  private websocketConnected = false;
  private reconnectAttempts = 0;

  constructor(options: {
    exchanges: { coinDCX?: CoinDCXClient; zebPay?: ZebPayClient };
    calculator: PriceCalculator;
    config: BotConfig;
  }) {
    super();
    this.exchanges = options.exchanges;
    this.calculator = options.calculator;
    this.config = options.config;
  }

  async scanForOpportunities(): Promise<Opportunity[]> {
    const startTime = Date.now();
    const opportunities: Opportunity[] = [];
    this.errors = [];

    try {
      // Get prices from all exchanges
      const prices: Record<string, number> = {};
      
      if (this.exchanges.coinDCX) {
        try {
          prices['CoinDCX'] = await this.exchanges.coinDCX.getPrice('USDTINR');
        } catch (error: any) {
          this.errors.push(`CoinDCX: ${error.message}`);
        }
      }

      if (this.exchanges.zebPay) {
        try {
          prices['ZebPay'] = await this.exchanges.zebPay.getPrice('USDT_INR');
        } catch (error: any) {
          this.errors.push(`ZebPay: ${error.message}`);
        }
      }

      // Find arbitrage opportunities
      const exchangeNames = Object.keys(prices);
      for (const buyExchange of exchangeNames) {
        for (const sellExchange of exchangeNames) {
          if (buyExchange === sellExchange) continue;

          const buyPrice = prices[buyExchange];
          const sellPrice = prices[sellExchange];

          const profit = this.calculator.calculateNetProfit(
            buyPrice,
            sellPrice,
            this.config.maxVolume
          );

          if (profit.profitPercentage >= this.config.minProfitPercentage) {
            const opportunity: Opportunity = {
              buyExchange,
              sellExchange,
              buyPrice,
              sellPrice,
              profitPercentage: profit.profitPercentage,
              recommendedVolume: this.config.maxVolume
            };

            // Apply risk adjustment if factors are set
            if (this.riskFactors[buyExchange] && this.riskFactors[sellExchange]) {
              const riskFactor = this.riskFactors[buyExchange] * this.riskFactors[sellExchange];
              opportunity.riskAdjustedProfit = profit.profitPercentage * riskFactor;
            }

            opportunities.push(opportunity);
          }
        }
      }
    } catch (error: any) {
      this.errors.push(`Scan error: ${error.message}`);
    }

    this.lastScanDuration = Date.now() - startTime;
    this.scanHistory.push({ timestamp: Date.now(), opportunities: opportunities.length });
    if (this.scanHistory.length > 100) this.scanHistory.shift();

    return opportunities.sort((a, b) => b.profitPercentage - a.profitPercentage);
  }

  async scanForP2POpportunities(): Promise<P2POpportunity[]> {
    const opportunities: P2POpportunity[] = [];

    try {
      // Get exchange prices
      const exchangePrices: Record<string, number> = {};
      
      if (this.exchanges.coinDCX) {
        try {
          exchangePrices['CoinDCX'] = await this.exchanges.coinDCX.getPrice('USDTINR');
        } catch (error) {
          // Ignore
        }
      }

      // Compare with P2P prices
      for (const [exchange, buyPrice] of Object.entries(exchangePrices)) {
        for (const [platform, p2pData] of Object.entries(this.p2pPrices)) {
          const profit = this.calculator.calculateNetProfit(
            buyPrice,
            p2pData.price,
            this.config.maxVolume
          );

          if (profit.profitPercentage >= this.config.minProfitPercentage) {
            opportunities.push({
              buyExchange: exchange,
              sellPlatform: platform,
              buyPrice,
              sellPrice: p2pData.price,
              profitPercentage: profit.profitPercentage,
              recommendedVolume: this.config.maxVolume
            });
          }
        }
      }
    } catch (error) {
      // Handle error
    }

    return opportunities;
  }

  async calculateP2PProfit(
    exchange: string,
    buyPrice: number,
    p2pPrice: number,
    p2pFee: number,
    volume: number
  ): Promise<any> {
    return this.calculator.calculateP2PProfit(buyPrice, p2pPrice, p2pFee, volume);
  }

  start(): void {
    if (this.isRunning) return;

    this.isRunning = true;
    this.performScan();
    
    this.scanTimer = setInterval(() => {
      this.performScan();
    }, this.config.scanInterval);
  }

  stop(): void {
    this.isRunning = false;
    if (this.scanTimer) {
      clearInterval(this.scanTimer);
      this.scanTimer = undefined;
    }
  }

  private async performScan(): Promise<void> {
    const opportunities = await this.scanForOpportunities();
    
    if (opportunities.length > 0) {
      this.emit('opportunity', opportunities[0]);
    }
  }

  connectWebSocket(): void {
    // Mock WebSocket connection
    this.websocketConnected = false;
    this.reconnectAttempts++;
  }

  setP2PPrices(prices: Record<string, { price: number; premium: number }>): void {
    this.p2pPrices = prices;
  }

  setConfig(config: Partial<BotConfig>): void {
    this.config = { ...this.config, ...config };
  }

  setRiskFactors(factors: Record<string, number>): void {
    this.riskFactors = factors;
  }

  getStatus(): {
    isRunning: boolean;
    errors: string[];
    websocketConnected: boolean;
    reconnectAttempts: number;
  } {
    return {
      isRunning: this.isRunning,
      errors: this.errors,
      websocketConnected: this.websocketConnected,
      reconnectAttempts: this.reconnectAttempts
    };
  }

  getMetrics(): {
    lastScanDuration: number;
    averageScanTime: number;
  } {
    const avgTime = this.scanHistory.length > 0
      ? this.scanHistory.reduce((sum, scan, i) => {
          if (i === 0) return 0;
          return sum + (scan.timestamp - this.scanHistory[i - 1].timestamp);
        }, 0) / Math.max(1, this.scanHistory.length - 1)
      : 0;

    return {
      lastScanDuration: this.lastScanDuration,
      averageScanTime: Math.round(avgTime)
    };
  }

  getScanHistory(): Array<{ timestamp: number; opportunities: number }> {
    return this.scanHistory;
  }

  isRunning(): boolean {
    return this.isRunning;
  }
}