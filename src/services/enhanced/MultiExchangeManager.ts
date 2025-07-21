import ccxt from 'ccxt';
import { EventEmitter } from 'events';
import chalk from 'chalk';
import { logger } from '../../utils/logger';

interface ExchangeConfig {
  apiKey?: string;
  secret?: string;
  password?: string;
  sandbox?: boolean;
  rateLimit?: number;
}

interface ArbitrageOpportunity {
  type: 'simple' | 'triangular';
  buyExchange: string;
  sellExchange: string;
  buyPrice: number;
  sellPrice: number;
  profitPercent: number;
  volume: number;
  path?: string[];
  fees: {
    buy: number;
    sell: number;
    total: number;
  };
  timestamp: Date;
}

export class MultiExchangeManager extends EventEmitter {
  public exchanges: Map<string, ccxt.Exchange>;
  private priceCache: Map<string, any>;
  private orderBooks: Map<string, any>;
  public isConnected: boolean = false;

  constructor() {
    super();
    this.exchanges = new Map();
    this.priceCache = new Map();
    this.orderBooks = new Map();
    this.initializeExchanges();
  }

  private initializeExchanges() {
    // Available exchanges in CCXT
    const availableExchanges = ccxt.exchanges;
    
    // Binance - Always available and most popular
    if (process.env.BINANCE_API_KEY) {
      try {
        this.exchanges.set('binance', new ccxt.binance({
          apiKey: process.env.BINANCE_API_KEY,
          secret: process.env.BINANCE_API_SECRET,
          options: {
            defaultType: 'spot',
          },
        }));
        console.log(chalk.green('✅ Binance initialized'));
      } catch (error) {
        console.log(chalk.red('❌ Failed to initialize Binance'));
      }
    }

    // KuCoin
    if (process.env.KUCOIN_API_KEY) {
      try {
        this.exchanges.set('kucoin', new ccxt.kucoin({
          apiKey: process.env.KUCOIN_API_KEY,
          secret: process.env.KUCOIN_API_SECRET,
          password: process.env.KUCOIN_PASSPHRASE,
        }));
        console.log(chalk.green('✅ KuCoin initialized'));
      } catch (error) {
        console.log(chalk.red('❌ Failed to initialize KuCoin'));
      }
    }

    // WazirX - Check if available
    if (availableExchanges.includes('wazirx') && process.env.WAZIRX_API_KEY) {
      try {
        this.exchanges.set('wazirx', new (ccxt as any).wazirx({
          apiKey: process.env.WAZIRX_API_KEY,
          secret: process.env.WAZIRX_API_SECRET,
        }));
        console.log(chalk.green('✅ WazirX initialized'));
      } catch (error) {
        console.log(chalk.red('❌ Failed to initialize WazirX'));
      }
    }

    // For Indian exchanges not in CCXT, we'll use custom implementations
    // or skip them for now
    console.log(chalk.yellow(`ℹ️  CoinDCX and ZebPay require custom implementation`));

    // Add demo exchange for testing
    this.addDemoExchange();

    console.log(chalk.green(`✅ Initialized ${this.exchanges.size} exchanges`));
  }

  private addDemoExchange() {
    // Create a mock exchange for demonstration
    const demoExchange: any = {
      id: 'demo',
      has: { ws: false },
      fetchTicker: async (symbol: string) => ({
        symbol,
        bid: 86.50 + Math.random() * 0.5,
        ask: 86.60 + Math.random() * 0.5,
        last: 86.55,
        baseVolume: 100000,
      }),
      fetchBalance: async () => ({
        USDT: { free: 10000, used: 0, total: 10000 },
        INR: { free: 500000, used: 0, total: 500000 },
      }),
    };
    
    this.exchanges.set('demo', demoExchange);
  }

  async startRealTimeMonitoring(symbols: string[]) {
    console.log(chalk.yellow('🚀 Starting real-time monitoring...'));
    this.isConnected = true;

    // Start WebSocket connections for exchanges that support it
    for (const [name, exchange] of this.exchanges) {
      if (exchange.has.ws) {
        this.connectWebSocket(name, exchange, symbols);
      } else {
        // Fallback to polling for exchanges without WebSocket
        this.startPolling(name, exchange, symbols);
      }
    }

    // Start arbitrage detection loop
    setInterval(() => {
      this.detectArbitrageOpportunities();
    }, 1000); // Check every second
  }

  private async connectWebSocket(name: string, exchange: any, symbols: string[]) {
    try {
      console.log(chalk.blue(`Connecting WebSocket for ${name}...`));
      
      // CCXT Pro WebSocket implementation
      if (exchange.watchTicker) {
        for (const symbol of symbols) {
          this.watchTicker(name, exchange, symbol);
        }
      }
    } catch (error) {
      console.error(chalk.red(`WebSocket error for ${name}:`), error);
      this.emit('error', { exchange: name, error });
    }
  }

  private async watchTicker(name: string, exchange: any, symbol: string) {
    try {
      while (this.isConnected) {
        const ticker = await exchange.watchTicker(symbol);
        
        const priceData = {
          exchange: name,
          symbol: symbol,
          bid: ticker.bid,
          ask: ticker.ask,
          last: ticker.last,
          volume: ticker.baseVolume,
          timestamp: Date.now(),
        };

        this.priceCache.set(`${name}:${symbol}`, priceData);
        this.emit('priceUpdate', priceData);
      }
    } catch (error) {
      console.error(chalk.red(`Watch ticker error for ${name}:${symbol}:`), error);
      // Retry after delay
      setTimeout(() => this.watchTicker(name, exchange, symbol), 5000);
    }
  }

  private startPolling(name: string, exchange: any, symbols: string[]) {
    setInterval(async () => {
      try {
        for (const symbol of symbols) {
          const ticker = await exchange.fetchTicker(symbol);
          
          const priceData = {
            exchange: name,
            symbol: symbol,
            bid: ticker.bid,
            ask: ticker.ask,
            last: ticker.last,
            volume: ticker.baseVolume,
            timestamp: Date.now(),
          };

          this.priceCache.set(`${name}:${symbol}`, priceData);
          this.emit('priceUpdate', priceData);
        }
      } catch (error) {
        console.error(chalk.red(`Polling error for ${name}:`), error);
      }
    }, 3000); // Poll every 3 seconds
  }

  detectArbitrageOpportunities(): ArbitrageOpportunity[] {
    const opportunities: ArbitrageOpportunity[] = [];
    
    // Simple arbitrage detection
    const symbol = 'USDT/INR';
    const prices: any[] = [];

    // Collect prices from all exchanges
    for (const [exchange, data] of this.priceCache.entries()) {
      if (data.symbol === symbol) {
        prices.push({
          exchange: exchange.split(':')[0],
          bid: data.bid,
          ask: data.ask,
          volume: data.volume,
        });
      }
    }

    // Find profitable pairs
    for (let i = 0; i < prices.length; i++) {
      for (let j = 0; j < prices.length; j++) {
        if (i !== j && prices[i].bid > prices[j].ask) {
          const buyPrice = prices[j].ask;
          const sellPrice = prices[i].bid;
          const fees = this.calculateFees(prices[j].exchange, prices[i].exchange);
          
          const profit = sellPrice - buyPrice - (buyPrice * fees.total / 100);
          const profitPercent = (profit / buyPrice) * 100;

          if (profitPercent > 0.1) { // Minimum 0.1% profit
            opportunities.push({
              type: 'simple',
              buyExchange: prices[j].exchange,
              sellExchange: prices[i].exchange,
              buyPrice: buyPrice,
              sellPrice: sellPrice,
              profitPercent: profitPercent,
              volume: Math.min(prices[i].volume, prices[j].volume) * 0.1, // 10% of min volume
              fees: fees,
              timestamp: new Date(),
            });
          }
        }
      }
    }

    if (opportunities.length > 0) {
      this.emit('arbitrageOpportunity', opportunities);
    }

    return opportunities;
  }

  private calculateFees(buyExchange: string, sellExchange: string): any {
    const fees: any = {
      coindcx: 0.1,
      zebpay: 0.25,
      binance: 0.1,
      wazirx: 0.2,
      kucoin: 0.1,
    };

    return {
      buy: fees[buyExchange] || 0.1,
      sell: fees[sellExchange] || 0.1,
      total: (fees[buyExchange] || 0.1) + (fees[sellExchange] || 0.1),
    };
  }

  async getAccountBalances() {
    const balances: any = {};

    for (const [name, exchange] of this.exchanges) {
      try {
        const balance = await exchange.fetchBalance();
        balances[name] = balance;
      } catch (error) {
        balances[name] = { error: error.message };
      }
    }

    return balances;
  }

  async executeArbitrage(opportunity: ArbitrageOpportunity, amount: number) {
    try {
      console.log(chalk.yellow('🚀 Executing arbitrage...'));
      
      // Step 1: Buy on the cheaper exchange
      const buyExchange = this.exchanges.get(opportunity.buyExchange);
      const buyOrder = await buyExchange!.createMarketBuyOrder(
        'USDT/INR',
        amount / opportunity.buyPrice
      );
      
      console.log(chalk.green(`✅ Buy order placed on ${opportunity.buyExchange}`));
      
      // Step 2: Transfer if needed (simplified - in reality this is complex)
      // For now, assume we have balance on both exchanges
      
      // Step 3: Sell on the expensive exchange
      const sellExchange = this.exchanges.get(opportunity.sellExchange);
      const sellOrder = await sellExchange!.createMarketSellOrder(
        'USDT/INR',
        amount / opportunity.buyPrice
      );
      
      console.log(chalk.green(`✅ Sell order placed on ${opportunity.sellExchange}`));
      
      return {
        success: true,
        buyOrder: buyOrder.id,
        sellOrder: sellOrder.id,
        profit: (opportunity.profitPercent / 100) * amount,
        message: `Arbitrage executed successfully! Profit: ₹${((opportunity.profitPercent / 100) * amount).toFixed(2)}`,
      };
      
    } catch (error) {
      console.error(chalk.red('Arbitrage execution failed:'), error);
      throw error;
    }
  }

  disconnect() {
    this.isConnected = false;
    // CCXT Pro handles WebSocket cleanup automatically
    console.log(chalk.yellow('Disconnected from all exchanges'));
  }
}