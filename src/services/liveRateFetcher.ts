import { EventEmitter } from 'events';
import { BinanceClient } from '../api/exchanges/binance';
import { ZebPayClient } from '../api/exchanges/zebPay';
import { KuCoinClient } from '../api/exchanges/kucoin';
import { CoinSwitchClient } from '../api/exchanges/coinSwitch';
import { CoinDCXClient } from '../api/exchanges/coinDCX';
import { PriceCalculator } from './priceCalculator';
import { logger } from '../utils/logger';
import dotenv from 'dotenv';

dotenv.config();

export interface ExchangeRate {
  exchange: string;
  pair: string;
  bid: number;
  ask: number;
  last: number;
  volume24h?: number;
  change24h?: number;
  timestamp: Date;
}

export interface ArbitrageOpportunity {
  buyExchange: string;
  sellExchange: string;
  buyPrice: number;
  sellPrice: number;
  profit: number;
  profitPercentage: number;
  volume: number;
  estimatedTime: string;
}

export interface RateFetcherConfig {
  interval: number; // milliseconds
  exchanges: string[];
  enableWebSocket: boolean;
  storeHistory: boolean;
  alertThreshold: number; // profit percentage
}

export class LiveRateFetcher extends EventEmitter {
  private exchanges: Map<string, any> = new Map();
  private rates: Map<string, ExchangeRate> = new Map();
  private rateHistory: Map<string, ExchangeRate[]> = new Map();
  private config: RateFetcherConfig;
  private calculator: PriceCalculator;
  private fetchTimer?: NodeJS.Timer;
  private isRunning = false;
  private websocketConnections: Map<string, boolean> = new Map();

  constructor(config: Partial<RateFetcherConfig> = {}) {
    super();
    
    this.config = {
      interval: 5000,
      exchanges: ['binance', 'zebpay', 'kucoin', 'coinswitch', 'coindcx'],
      enableWebSocket: true,
      storeHistory: true,
      alertThreshold: 1.0,
      ...config
    };
    
    this.calculator = new PriceCalculator();
    this.initializeExchanges();
  }

  private initializeExchanges() {
    // Binance
    if (this.config.exchanges.includes('binance') && 
        process.env.BINANCE_API_KEY && 
        process.env.BINANCE_API_KEY !== 'pending') {
      const binance = new BinanceClient({
        apiKey: process.env.BINANCE_API_KEY,
        apiSecret: process.env.BINANCE_API_SECRET!
      });
      this.exchanges.set('binance', binance);
      this.setupWebSocket('binance', binance);
    }

    // ZebPay
    if (this.config.exchanges.includes('zebpay') && 
        process.env.ZEBPAY_API_KEY && 
        process.env.ZEBPAY_API_KEY !== 'pending') {
      const zebpay = new ZebPayClient();
      this.exchanges.set('zebpay', zebpay);
      this.setupWebSocket('zebpay', zebpay);
    }

    // KuCoin
    if (this.config.exchanges.includes('kucoin') && 
        process.env.KUCOIN_API_KEY && 
        process.env.KUCOIN_API_KEY !== 'pending') {
      const kucoin = new KuCoinClient({
        apiKey: process.env.KUCOIN_API_KEY,
        apiSecret: process.env.KUCOIN_API_SECRET!,
        passphrase: process.env.KUCOIN_PASSPHRASE!
      });
      this.exchanges.set('kucoin', kucoin);
      this.setupWebSocket('kucoin', kucoin);
    }

    // CoinSwitch
    if (this.config.exchanges.includes('coinswitch') && 
        process.env.COINSWITCH_API_KEY && 
        process.env.COINSWITCH_API_KEY !== 'pending') {
      const coinswitch = new CoinSwitchClient({
        apiKey: process.env.COINSWITCH_API_KEY,
        apiSecret: process.env.COINSWITCH_API_SECRET!
      });
      this.exchanges.set('coinswitch', coinswitch);
      this.setupWebSocket('coinswitch', coinswitch);
    }

    // CoinDCX
    if (this.config.exchanges.includes('coindcx') && 
        process.env.COINDCX_API_KEY && 
        process.env.COINDCX_API_KEY !== 'pending') {
      const coindcx = new CoinDCXClient({
        apiKey: process.env.COINDCX_API_KEY,
        apiSecret: process.env.COINDCX_API_SECRET!
      });
      this.exchanges.set('coindcx', coindcx);
      this.setupWebSocket('coindcx', coindcx);
    }

    logger.info(`Initialized ${this.exchanges.size} exchanges`);
  }

  private setupWebSocket(exchangeName: string, client: any) {
    if (!this.config.enableWebSocket) return;

    try {
      client.on('priceUpdate', (data: any) => {
        this.handleWebSocketUpdate(exchangeName, data);
      });

      client.on('error', (error: Error) => {
        logger.error(`WebSocket error for ${exchangeName}:`, error);
        this.websocketConnections.set(exchangeName, false);
        this.emit('websocketError', { exchange: exchangeName, error });
      });

      client.on('connected', () => {
        logger.info(`WebSocket connected for ${exchangeName}`);
        this.websocketConnections.set(exchangeName, true);
        this.emit('websocketConnected', { exchange: exchangeName });
      });

      client.on('disconnected', () => {
        logger.warn(`WebSocket disconnected for ${exchangeName}`);
        this.websocketConnections.set(exchangeName, false);
        this.emit('websocketDisconnected', { exchange: exchangeName });
      });
    } catch (error) {
      logger.error(`Failed to setup WebSocket for ${exchangeName}:`, error);
    }
  }

  private handleWebSocketUpdate(exchangeName: string, data: any) {
    const rate: ExchangeRate = {
      exchange: exchangeName,
      pair: 'USDT/INR',
      bid: data.bid || data.buy || data.price,
      ask: data.ask || data.sell || data.price,
      last: data.last || data.price,
      volume24h: data.volume,
      change24h: data.change,
      timestamp: new Date()
    };

    this.updateRate(exchangeName, rate);
  }

  private updateRate(exchangeName: string, rate: ExchangeRate) {
    // Update current rate
    this.rates.set(exchangeName, rate);

    // Store history if enabled
    if (this.config.storeHistory) {
      if (!this.rateHistory.has(exchangeName)) {
        this.rateHistory.set(exchangeName, []);
      }
      
      const history = this.rateHistory.get(exchangeName)!;
      history.push(rate);

      // Keep only last 1 hour of data
      const oneHourAgo = Date.now() - (60 * 60 * 1000);
      const filteredHistory = history.filter(r => r.timestamp.getTime() > oneHourAgo);
      this.rateHistory.set(exchangeName, filteredHistory);
    }

    // Emit rate update
    this.emit('rateUpdate', { exchange: exchangeName, rate });

    // Check for arbitrage opportunities
    this.checkArbitrage();
  }

  async fetchRates() {
    const promises = Array.from(this.exchanges.entries()).map(async ([name, client]) => {
      try {
        let rate: ExchangeRate;

        switch (name) {
          case 'binance':
            // Binance doesn't have direct USDT/INR
            const binanceTicker = await client.getTicker('USDTBUSD');
            const inrRate = 87.5; // Approximate conversion
            rate = {
              exchange: 'binance',
              pair: 'USDT/INR',
              bid: parseFloat(binanceTicker.bidPrice) * inrRate,
              ask: parseFloat(binanceTicker.askPrice) * inrRate,
              last: parseFloat(binanceTicker.lastPrice) * inrRate,
              volume24h: parseFloat(binanceTicker.volume),
              change24h: parseFloat(binanceTicker.priceChangePercent),
              timestamp: new Date()
            };
            break;

          case 'zebpay':
            const zebpayData = await client.getTicker('USDT-INR');
            rate = {
              exchange: 'zebpay',
              pair: 'USDT/INR',
              bid: zebpayData.buy,
              ask: zebpayData.sell,
              last: zebpayData.last,
              volume24h: zebpayData.volume,
              timestamp: new Date()
            };
            break;

          case 'kucoin':
            const kucoinTicker = await client.getTicker('USDT-INR');
            rate = {
              exchange: 'kucoin',
              pair: 'USDT/INR',
              bid: parseFloat(kucoinTicker.bestBid),
              ask: parseFloat(kucoinTicker.bestAsk),
              last: parseFloat(kucoinTicker.price),
              timestamp: new Date()
            };
            break;

          case 'coinswitch':
            const coinswitchTicker = await client.getTicker('USDT_INR');
            rate = {
              exchange: 'coinswitch',
              pair: 'USDT/INR',
              bid: parseFloat(coinswitchTicker.bid),
              ask: parseFloat(coinswitchTicker.ask),
              last: parseFloat(coinswitchTicker.last),
              volume24h: parseFloat(coinswitchTicker.volume),
              timestamp: new Date()
            };
            break;

          case 'coindcx':
            const coindcxPrice = await client.getPrice('USDTINR');
            rate = {
              exchange: 'coindcx',
              pair: 'USDT/INR',
              bid: coindcxPrice * 0.999, // Approximate bid
              ask: coindcxPrice * 1.001, // Approximate ask
              last: coindcxPrice,
              timestamp: new Date()
            };
            break;

          default:
            return;
        }

        this.updateRate(name, rate);

      } catch (error: any) {
        logger.error(`Error fetching rate from ${name}:`, error.message);
        this.emit('fetchError', { exchange: name, error });
      }
    });

    await Promise.all(promises);
  }

  private checkArbitrage() {
    const opportunities: ArbitrageOpportunity[] = [];
    const rateArray = Array.from(this.rates.values());

    for (let i = 0; i < rateArray.length; i++) {
      for (let j = 0; j < rateArray.length; j++) {
        if (i === j) continue;

        const buyExchange = rateArray[i];
        const sellExchange = rateArray[j];

        const volume = 49900; // Under TDS limit
        const profit = this.calculator.calculateNetProfit(
          buyExchange.ask,
          sellExchange.bid,
          volume
        );

        if (profit.profitPercentage >= this.config.alertThreshold) {
          opportunities.push({
            buyExchange: buyExchange.exchange,
            sellExchange: sellExchange.exchange,
            buyPrice: buyExchange.ask,
            sellPrice: sellExchange.bid,
            profit: profit.netProfit,
            profitPercentage: profit.profitPercentage,
            volume,
            estimatedTime: '10-15 mins'
          });
        }
      }
    }

    if (opportunities.length > 0) {
      opportunities.sort((a, b) => b.profitPercentage - a.profitPercentage);
      this.emit('arbitrageFound', opportunities);
    }
  }

  start() {
    if (this.isRunning) {
      logger.warn('Rate fetcher is already running');
      return;
    }

    this.isRunning = true;
    logger.info('Starting live rate fetcher...');

    // Initial fetch
    this.fetchRates();

    // Start periodic fetching
    this.fetchTimer = setInterval(() => {
      this.fetchRates();
    }, this.config.interval);

    // Start WebSocket connections if enabled
    if (this.config.enableWebSocket) {
      this.exchanges.forEach((client, name) => {
        if (client.connect) {
          client.connect();
        }
      });
    }

    this.emit('started');
  }

  stop() {
    if (!this.isRunning) {
      logger.warn('Rate fetcher is not running');
      return;
    }

    this.isRunning = false;
    logger.info('Stopping live rate fetcher...');

    // Clear timer
    if (this.fetchTimer) {
      clearInterval(this.fetchTimer);
      this.fetchTimer = undefined;
    }

    // Close WebSocket connections
    this.exchanges.forEach((client, name) => {
      if (client.disconnect) {
        client.disconnect();
      }
    });

    this.emit('stopped');
  }

  getCurrentRates(): ExchangeRate[] {
    return Array.from(this.rates.values());
  }

  getRate(exchange: string): ExchangeRate | undefined {
    return this.rates.get(exchange);
  }

  getRateHistory(exchange: string): ExchangeRate[] {
    return this.rateHistory.get(exchange) || [];
  }

  getBestPrices(): { bestBuy: ExchangeRate | null, bestSell: ExchangeRate | null } {
    const rates = this.getCurrentRates();
    
    if (rates.length === 0) {
      return { bestBuy: null, bestSell: null };
    }

    const bestBuy = rates.reduce((min, curr) => 
      curr.ask < min.ask ? curr : min
    );

    const bestSell = rates.reduce((max, curr) => 
      curr.bid > max.bid ? curr : max
    );

    return { bestBuy, bestSell };
  }

  getSpread(exchange: string): number | null {
    const rate = this.rates.get(exchange);
    if (!rate) return null;

    return ((rate.ask - rate.bid) / rate.bid) * 100;
  }

  getAveragePrice(): number {
    const rates = this.getCurrentRates();
    if (rates.length === 0) return 0;

    const sum = rates.reduce((total, rate) => total + rate.last, 0);
    return sum / rates.length;
  }

  getVolatility(exchange: string, minutes: number = 60): number | null {
    const history = this.getRateHistory(exchange);
    if (history.length < 2) return null;

    const cutoffTime = Date.now() - (minutes * 60 * 1000);
    const recentHistory = history.filter(r => r.timestamp.getTime() > cutoffTime);

    if (recentHistory.length < 2) return null;

    const prices = recentHistory.map(r => r.last);
    const mean = prices.reduce((sum, p) => sum + p, 0) / prices.length;
    const variance = prices.reduce((sum, p) => sum + Math.pow(p - mean, 2), 0) / prices.length;
    
    return Math.sqrt(variance);
  }

  isWebSocketConnected(exchange: string): boolean {
    return this.websocketConnections.get(exchange) || false;
  }

  getStatus(): {
    isRunning: boolean;
    activeExchanges: number;
    totalExchanges: number;
    websocketStatus: Map<string, boolean>;
    lastUpdate: Date | null;
  } {
    const rates = this.getCurrentRates();
    const lastUpdate = rates.length > 0 
      ? rates.reduce((latest, rate) => 
          rate.timestamp > latest ? rate.timestamp : latest, 
          rates[0].timestamp
        )
      : null;

    return {
      isRunning: this.isRunning,
      activeExchanges: this.rates.size,
      totalExchanges: this.exchanges.size,
      websocketStatus: new Map(this.websocketConnections),
      lastUpdate
    };
  }
}