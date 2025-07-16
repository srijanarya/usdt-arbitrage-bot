import EventEmitter from 'events';
import { pool } from '../../config/database';
import { CoinDCXClient } from '../../api/exchanges/coinDCX';
import { ZebPayClient } from '../../api/exchanges/zebPay';
import { BinanceClient } from '../../api/exchanges/binance';
import { KuCoinClient } from '../../api/exchanges/kucoin';
import { CoinSwitchClient } from '../../api/exchanges/coinSwitch';

interface PriceData {
  exchange: string;
  pair: string;
  bid: number;
  ask: number;
  last: number;
  timestamp: Date;
}

interface ArbitrageOpportunity {
  buyExchange: string;
  sellExchange: string;
  pair: string;
  buyPrice: number;
  sellPrice: number;
  grossProfit: number;
  netProfit: number;
  fees: number;
  timestamp: Date;
}

export class PriceScanner extends EventEmitter {
  private exchanges: Map<string, any> = new Map();
  private prices: Map<string, PriceData> = new Map();
  private isRunning: boolean = false;
  private scanInterval: NodeJS.Timeout | null = null;
  
  // Fee structures for different exchanges
  private fees = {
    'CoinDCX': 0.001, // 0.1%
    'ZebPay': 0.001, // 0.1%
    'Binance': 0.001, // 0.1%
    'KuCoin': 0.001, // 0.1%
    'CoinSwitch': 0.001, // 0.1%
  };
  
  // TDS (Tax Deducted at Source) - 1% for Indian exchanges
  private tds = {
    'CoinDCX': 0.01, // 1%
    'ZebPay': 0.01, // 1%
    'Binance': 0, // No TDS
    'KuCoin': 0, // No TDS
    'CoinSwitch': 0.01, // 1%
  };

  constructor() {
    super();
    this.initializeExchanges();
  }

  private initializeExchanges() {
    // Initialize CoinDCX client
    if (process.env.COINDCX_API_KEY && process.env.COINDCX_API_SECRET) {
      const coinDCX = new CoinDCXClient({
        apiKey: process.env.COINDCX_API_KEY,
        apiSecret: process.env.COINDCX_API_SECRET,
      });
      this.exchanges.set('CoinDCX', coinDCX);
    }

    // Initialize ZebPay client
    if (process.env.ZEBPAY_API_KEY && process.env.ZEBPAY_API_SECRET) {
      const zebPay = new ZebPayClient();
      this.exchanges.set('ZebPay', zebPay);
    }

    // Initialize Binance client
    if (process.env.BINANCE_API_KEY && process.env.BINANCE_API_SECRET) {
      const binance = new BinanceClient({
        apiKey: process.env.BINANCE_API_KEY,
        apiSecret: process.env.BINANCE_API_SECRET,
      });
      this.exchanges.set('Binance', binance);
    }

    // Initialize KuCoin client
    if (process.env.KUCOIN_API_KEY && process.env.KUCOIN_API_SECRET) {
      const kucoin = new KuCoinClient({
        apiKey: process.env.KUCOIN_API_KEY,
        apiSecret: process.env.KUCOIN_API_SECRET,
        passphrase: process.env.KUCOIN_PASSPHRASE || '',
      });
      this.exchanges.set('KuCoin', kucoin);
    }

    // Initialize CoinSwitch client
    if (process.env.COINSWITCH_API_KEY && process.env.COINSWITCH_API_SECRET) {
      const coinSwitch = new CoinSwitchClient({
        apiKey: process.env.COINSWITCH_API_KEY,
        apiSecret: process.env.COINSWITCH_API_SECRET,
      });
      this.exchanges.set('CoinSwitch', coinSwitch);
    }
  }

  async start() {
    if (this.isRunning) {
      console.log('Price scanner is already running');
      return;
    }

    this.isRunning = true;
    console.log('Starting price scanner...');

    // Start scanning for arbitrage opportunities
    this.scanInterval = setInterval(() => {
      this.scan().catch(console.error);
    }, 3000); // Scan every 3 seconds

    // Initial scan
    await this.scan();
  }

  stop() {
    if (!this.isRunning) return;

    this.isRunning = false;
    if (this.scanInterval) {
      clearInterval(this.scanInterval);
      this.scanInterval = null;
    }

    console.log('Price scanner stopped');
  }

  async scan() {
    try {
      // Fetch prices from all exchanges
      await this.fetchPrices();
      
      // Detect arbitrage opportunities
      const opportunities = this.detectArbitrageOpportunities();
      
      // Store opportunities in database
      for (const opportunity of opportunities) {
        await this.storeOpportunity(opportunity);
        this.emit('arbitrageOpportunity', opportunity);
      }

      // Emit price updates
      this.prices.forEach((priceData, key) => {
        this.emit('priceUpdate', { key, data: priceData });
      });

    } catch (error) {
      console.error('Error during price scan:', error);
      this.emit('error', error);
    }
  }

  private async fetchPrices() {
    const pricePromises: Promise<void>[] = [];

    // CoinDCX USDT/INR
    if (this.exchanges.has('CoinDCX')) {
      pricePromises.push(this.fetchCoinDCXPrice());
    }

    // ZebPay USDT/INR
    if (this.exchanges.has('ZebPay')) {
      pricePromises.push(this.fetchZebPayPrice());
    }

    // Binance USDT/USDC
    if (this.exchanges.has('Binance')) {
      pricePromises.push(this.fetchBinancePrice());
    }

    // KuCoin USDT/USDC
    if (this.exchanges.has('KuCoin')) {
      pricePromises.push(this.fetchKuCoinPrice());
    }

    // CoinSwitch USDT/INR
    if (this.exchanges.has('CoinSwitch')) {
      pricePromises.push(this.fetchCoinSwitchPrice());
    }

    await Promise.allSettled(pricePromises);
  }

  private async fetchCoinDCXPrice() {
    try {
      const exchange = this.exchanges.get('CoinDCX');
      const ticker = await exchange.getTicker('I-USDT_INR');
      
      this.prices.set('CoinDCX-USDT/INR', {
        exchange: 'CoinDCX',
        pair: 'USDT/INR',
        bid: parseFloat(ticker.bid),
        ask: parseFloat(ticker.ask),
        last: parseFloat(ticker.last || ticker.bid),
        timestamp: new Date(),
      });
    } catch (error) {
      console.error('Error fetching CoinDCX price:', error);
    }
  }

  private async fetchZebPayPrice() {
    try {
      const exchange = this.exchanges.get('ZebPay');
      const ticker = await exchange.getTicker('USDT-INR');
      
      this.prices.set('ZebPay-USDT/INR', {
        exchange: 'ZebPay',
        pair: 'USDT/INR',
        bid: parseFloat(ticker.buy),
        ask: parseFloat(ticker.sell),
        last: parseFloat(ticker.market),
        timestamp: new Date(),
      });
    } catch (error) {
      console.error('Error fetching ZebPay price:', error);
    }
  }

  private async fetchBinancePrice() {
    try {
      const exchange = this.exchanges.get('Binance');
      const ticker = await exchange.getTicker('USDCUSDT');
      
      this.prices.set('Binance-USDC/USDT', {
        exchange: 'Binance',
        pair: 'USDC/USDT',
        bid: parseFloat(ticker.bidPrice),
        ask: parseFloat(ticker.askPrice),
        last: parseFloat(ticker.lastPrice),
        timestamp: new Date(),
      });
    } catch (error) {
      console.error('Error fetching Binance price:', error);
    }
  }

  private async fetchKuCoinPrice() {
    try {
      const exchange = this.exchanges.get('KuCoin');
      const ticker = await exchange.getTicker('USDT-USDC');
      
      this.prices.set('KuCoin-USDT/USDC', {
        exchange: 'KuCoin',
        pair: 'USDT/USDC',
        bid: parseFloat(ticker.bestBid),
        ask: parseFloat(ticker.bestAsk),
        last: parseFloat(ticker.price),
        timestamp: new Date(),
      });
    } catch (error) {
      console.error('Error fetching KuCoin price:', error);
    }
  }

  private async fetchCoinSwitchPrice() {
    try {
      const exchange = this.exchanges.get('CoinSwitch');
      const ticker = await exchange.getTicker('USDT/INR');
      
      this.prices.set('CoinSwitch-USDT/INR', {
        exchange: 'CoinSwitch',
        pair: 'USDT/INR',
        bid: parseFloat(ticker.bid),
        ask: parseFloat(ticker.ask),
        last: parseFloat(ticker.last),
        timestamp: new Date(),
      });
    } catch (error) {
      console.error('Error fetching CoinSwitch price:', error);
    }
  }

  private detectArbitrageOpportunities(): ArbitrageOpportunity[] {
    const opportunities: ArbitrageOpportunity[] = [];
    const priceArray = Array.from(this.prices.values());

    // Check for arbitrage opportunities between all pairs
    for (let i = 0; i < priceArray.length; i++) {
      for (let j = i + 1; j < priceArray.length; j++) {
        const price1 = priceArray[i];
        const price2 = priceArray[j];

        // Only compare same trading pairs
        if (price1.pair === price2.pair) {
          const opportunity1 = this.calculateArbitrage(price1, price2);
          const opportunity2 = this.calculateArbitrage(price2, price1);

          if (opportunity1 && opportunity1.netProfit > 0.1) { // Minimum 0.1% profit
            opportunities.push(opportunity1);
          }
          if (opportunity2 && opportunity2.netProfit > 0.1) { // Minimum 0.1% profit
            opportunities.push(opportunity2);
          }
        }
      }
    }

    return opportunities;
  }

  private calculateArbitrage(buyPrice: PriceData, sellPrice: PriceData): ArbitrageOpportunity | null {
    // Buy at buyPrice.ask, sell at sellPrice.bid
    const buyPriceValue = buyPrice.ask;
    const sellPriceValue = sellPrice.bid;

    if (sellPriceValue <= buyPriceValue) return null;

    // Calculate gross profit percentage
    const grossProfit = ((sellPriceValue - buyPriceValue) / buyPriceValue) * 100;

    // Calculate fees
    const buyFee = this.fees[buyPrice.exchange as keyof typeof this.fees] || 0;
    const sellFee = this.fees[sellPrice.exchange as keyof typeof this.fees] || 0;
    const buyTDS = this.tds[buyPrice.exchange as keyof typeof this.tds] || 0;
    const sellTDS = this.tds[sellPrice.exchange as keyof typeof this.tds] || 0;

    const totalFees = (buyFee + sellFee + buyTDS + sellTDS) * 100;
    const netProfit = grossProfit - totalFees;

    return {
      buyExchange: buyPrice.exchange,
      sellExchange: sellPrice.exchange,
      pair: buyPrice.pair,
      buyPrice: buyPriceValue,
      sellPrice: sellPriceValue,
      grossProfit,
      netProfit,
      fees: totalFees,
      timestamp: new Date(),
    };
  }

  private async storeOpportunity(opportunity: ArbitrageOpportunity) {
    try {
      const query = `
        INSERT INTO arbitrage_opportunities 
        (buy_exchange, sell_exchange, pair, buy_price, sell_price, gross_profit, net_profit, fees, timestamp)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `;
      
      await pool.query(query, [
        opportunity.buyExchange,
        opportunity.sellExchange,
        opportunity.pair,
        opportunity.buyPrice,
        opportunity.sellPrice,
        opportunity.grossProfit,
        opportunity.netProfit,
        opportunity.fees,
        opportunity.timestamp,
      ]);
    } catch (error) {
      // Table might not exist, create it
      await this.createTables();
      // Retry storing
      const query = `
        INSERT INTO arbitrage_opportunities 
        (buy_exchange, sell_exchange, pair, buy_price, sell_price, gross_profit, net_profit, fees, timestamp)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `;
      
      await pool.query(query, [
        opportunity.buyExchange,
        opportunity.sellExchange,
        opportunity.pair,
        opportunity.buyPrice,
        opportunity.sellPrice,
        opportunity.grossProfit,
        opportunity.netProfit,
        opportunity.fees,
        opportunity.timestamp,
      ]);
    }
  }

  private async createTables() {
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS arbitrage_opportunities (
        id SERIAL PRIMARY KEY,
        buy_exchange VARCHAR(50) NOT NULL,
        sell_exchange VARCHAR(50) NOT NULL,
        pair VARCHAR(20) NOT NULL,
        buy_price DECIMAL(10, 4) NOT NULL,
        sell_price DECIMAL(10, 4) NOT NULL,
        gross_profit DECIMAL(5, 3) NOT NULL,
        net_profit DECIMAL(5, 3) NOT NULL,
        fees DECIMAL(5, 3) NOT NULL,
        timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `;
    
    await pool.query(createTableQuery);
  }

  // Get recent arbitrage opportunities
  async getRecentOpportunities(limit: number = 10): Promise<ArbitrageOpportunity[]> {
    const query = `
      SELECT * FROM arbitrage_opportunities 
      ORDER BY timestamp DESC 
      LIMIT $1
    `;
    
    const result = await pool.query(query, [limit]);
    return result.rows;
  }

  // Get current prices
  getCurrentPrices(): Map<string, PriceData> {
    return new Map(this.prices);
  }
}
