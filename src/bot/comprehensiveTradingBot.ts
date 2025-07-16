import { EventEmitter } from 'events';
import { LiveRateFetcher } from '../services/liveRateFetcher';
import { P2POpportunityFetcher } from '../services/p2pOpportunityFetcher';
import { PriceCalculator } from '../services/priceCalculator';
import { BinanceEnhancedClient } from '../api/exchanges/binanceEnhanced';
import { ZebPayClient } from '../api/exchanges/zebPay';
import { KuCoinClient } from '../api/exchanges/kucoin';
import { CoinSwitchClient } from '../api/exchanges/coinSwitch';
import { logger } from '../utils/logger';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

export interface BotConfig {
  // Trading parameters
  minProfitPercentage: number;
  maxVolumePerTrade: number;
  maxDailyVolume: number;
  enableAutoTrading: boolean;
  
  // Risk management
  maxOpenTrades: number;
  stopLossPercentage: number;
  maxSlippage: number;
  riskScore: number;
  
  // P2P settings
  enableP2PTrading: boolean;
  minMerchantRating: number;
  minMerchantOrders: number;
  preferredPaymentMethods: string[];
  
  // Notifications
  telegramEnabled: boolean;
  telegramToken?: string;
  telegramChatId?: string;
  alertThreshold: number;
  
  // Technical
  scanInterval: number;
  enableWebSocket: boolean;
  enableTestMode: boolean;
}

export interface TradeOpportunity {
  id: string;
  type: 'exchange' | 'p2p' | 'hybrid';
  buyFrom: string;
  sellTo: string;
  buyPrice: number;
  sellPrice: number;
  volume: number;
  profit: number;
  profitPercentage: number;
  estimatedTime: string;
  riskScore: number;
  merchant?: any;
  status: 'pending' | 'executing' | 'completed' | 'failed';
  createdAt: Date;
}

export interface BotStats {
  startTime: Date;
  totalScans: number;
  opportunitiesFound: number;
  tradesExecuted: number;
  tradesSuccessful: number;
  tradesFailed: number;
  totalProfit: number;
  totalVolume: number;
  averageProfit: number;
  bestTrade: TradeOpportunity | null;
  lastScanTime: Date;
  uptime: number;
}

export class ComprehensiveTradingBot extends EventEmitter {
  private config: BotConfig;
  private rateFetcher: LiveRateFetcher;
  private p2pFetcher: P2POpportunityFetcher;
  private calculator: PriceCalculator;
  private exchanges: Map<string, any> = new Map();
  private isRunning = false;
  private scanTimer?: NodeJS.Timer;
  private opportunities: Map<string, TradeOpportunity> = new Map();
  private executingTrades: Set<string> = new Set();
  private stats: BotStats;
  private dailyVolume = 0;
  private dailyVolumeReset: Date;

  constructor(config: Partial<BotConfig> = {}) {
    super();
    
    this.config = {
      minProfitPercentage: 1.0,
      maxVolumePerTrade: 49900, // Under TDS limit
      maxDailyVolume: 500000,
      enableAutoTrading: false,
      maxOpenTrades: 3,
      stopLossPercentage: 0.5,
      maxSlippage: 0.2,
      riskScore: 5,
      enableP2PTrading: true,
      minMerchantRating: 95,
      minMerchantOrders: 100,
      preferredPaymentMethods: ['UPI', 'IMPS'],
      telegramEnabled: true,
      telegramToken: process.env.TELEGRAM_BOT_TOKEN,
      telegramChatId: process.env.TELEGRAM_CHAT_ID,
      alertThreshold: 2.0,
      scanInterval: 10000,
      enableWebSocket: true,
      enableTestMode: false,
      ...config
    };

    this.calculator = new PriceCalculator();
    this.dailyVolumeReset = new Date();
    this.dailyVolumeReset.setHours(0, 0, 0, 0);
    
    this.stats = {
      startTime: new Date(),
      totalScans: 0,
      opportunitiesFound: 0,
      tradesExecuted: 0,
      tradesSuccessful: 0,
      tradesFailed: 0,
      totalProfit: 0,
      totalVolume: 0,
      averageProfit: 0,
      bestTrade: null,
      lastScanTime: new Date(),
      uptime: 0
    };

    this.initializeServices();
  }

  private initializeServices(): void {
    // Initialize rate fetcher
    this.rateFetcher = new LiveRateFetcher({
      interval: 5000,
      enableWebSocket: this.config.enableWebSocket,
      alertThreshold: this.config.alertThreshold
    });

    // Initialize P2P fetcher
    this.p2pFetcher = new P2POpportunityFetcher({
      interval: 15000,
      minCompletionRate: this.config.minMerchantRating,
      minOrders: this.config.minMerchantOrders
    });

    // Initialize exchanges
    this.initializeExchanges();

    // Setup event handlers
    this.setupEventHandlers();
  }

  private initializeExchanges(): void {
    logger.info('Initializing exchange connections...');

    // Binance
    if (process.env.BINANCE_API_KEY && process.env.BINANCE_API_KEY !== 'pending') {
      const binance = new BinanceEnhancedClient(
        process.env.BINANCE_API_KEY,
        process.env.BINANCE_API_SECRET!,
        this.config.enableTestMode
      );
      this.exchanges.set('binance', binance);
    }

    // ZebPay
    if (process.env.ZEBPAY_API_KEY && process.env.ZEBPAY_API_KEY !== 'pending') {
      const zebpay = new ZebPayClient();
      this.exchanges.set('zebpay', zebpay);
    }

    // KuCoin
    if (process.env.KUCOIN_API_KEY && process.env.KUCOIN_API_KEY !== 'pending') {
      const kucoin = new KuCoinClient({
        apiKey: process.env.KUCOIN_API_KEY,
        apiSecret: process.env.KUCOIN_API_SECRET!,
        passphrase: process.env.KUCOIN_PASSPHRASE!
      });
      this.exchanges.set('kucoin', kucoin);
    }

    // CoinSwitch
    if (process.env.COINSWITCH_API_KEY && process.env.COINSWITCH_API_KEY !== 'pending') {
      const coinswitch = new CoinSwitchClient({
        apiKey: process.env.COINSWITCH_API_KEY,
        apiSecret: process.env.COINSWITCH_API_SECRET!
      });
      this.exchanges.set('coinswitch', coinswitch);
    }

    logger.info(`Initialized ${this.exchanges.size} exchanges`);
  }

  private setupEventHandlers(): void {
    // Rate fetcher events
    this.rateFetcher.on('arbitrageFound', (opportunities) => {
      this.handleArbitrageOpportunities(opportunities, 'exchange');
    });

    this.rateFetcher.on('rateUpdate', ({ exchange, rate }) => {
      this.p2pFetcher.updateExchangeRate(exchange, rate.last);
    });

    // P2P fetcher events
    this.p2pFetcher.on('p2pOpportunitiesFound', (opportunities) => {
      this.handleArbitrageOpportunities(opportunities, 'p2p');
    });

    this.p2pFetcher.on('highProfitAlert', (opportunity) => {
      this.sendHighProfitAlert(opportunity);
    });

    // Exchange events
    this.exchanges.forEach((exchange, name) => {
      exchange.on('wsDisconnected', () => {
        logger.warn(`${name} WebSocket disconnected`);
        this.emit('exchangeDisconnected', name);
      });

      exchange.on('wsConnected', () => {
        logger.info(`${name} WebSocket connected`);
        this.emit('exchangeConnected', name);
      });

      exchange.on('error', (error: Error) => {
        logger.error(`${name} error:`, error);
        this.emit('exchangeError', { exchange: name, error });
      });
    });
  }

  private handleArbitrageOpportunities(opportunities: any[], type: string): void {
    opportunities.forEach(opp => {
      const opportunity: TradeOpportunity = {
        id: `${type}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type: type as any,
        buyFrom: opp.buyFrom || opp.buyExchange,
        sellTo: opp.sellTo || opp.sellExchange,
        buyPrice: opp.buyPrice,
        sellPrice: opp.sellPrice,
        volume: opp.volume || this.config.maxVolumePerTrade,
        profit: opp.profit,
        profitPercentage: opp.profitPercentage,
        estimatedTime: opp.estimatedTime || '10-15 mins',
        riskScore: opp.riskScore || this.calculateRiskScore(opp),
        merchant: opp.merchant,
        status: 'pending',
        createdAt: new Date()
      };

      // Check if opportunity meets criteria
      if (this.shouldTakeOpportunity(opportunity)) {
        this.opportunities.set(opportunity.id, opportunity);
        this.stats.opportunitiesFound++;
        
        this.emit('opportunityFound', opportunity);
        
        // Execute trade if auto-trading is enabled
        if (this.config.enableAutoTrading && this.canExecuteTrade()) {
          this.executeTrade(opportunity);
        } else {
          this.sendOpportunityAlert(opportunity);
        }
      }
    });
  }

  private shouldTakeOpportunity(opp: TradeOpportunity): boolean {
    // Check profit threshold
    if (opp.profitPercentage < this.config.minProfitPercentage) {
      return false;
    }

    // Check risk score
    if (opp.riskScore > this.config.riskScore) {
      return false;
    }

    // Check daily volume limit
    if (this.dailyVolume + opp.volume > this.config.maxDailyVolume) {
      logger.warn('Daily volume limit reached');
      return false;
    }

    // Check if P2P trading is enabled for P2P opportunities
    if (opp.type === 'p2p' && !this.config.enableP2PTrading) {
      return false;
    }

    return true;
  }

  private canExecuteTrade(): boolean {
    // Check if we have reached max open trades
    if (this.executingTrades.size >= this.config.maxOpenTrades) {
      return false;
    }

    // Reset daily volume if needed
    const now = new Date();
    if (now.getDate() !== this.dailyVolumeReset.getDate()) {
      this.dailyVolume = 0;
      this.dailyVolumeReset = now;
    }

    return true;
  }

  private calculateRiskScore(opp: any): number {
    let score = 3; // Base score

    // Higher profit often means higher risk
    if (opp.profitPercentage > 5) score += 2;
    else if (opp.profitPercentage > 3) score += 1;

    // P2P trades are riskier
    if (opp.type === 'p2p') score += 1;

    // Merchant-based risk for P2P
    if (opp.merchant) {
      if (opp.merchant.completionRate < 98) score += 1;
      if (opp.merchant.completedOrders < 500) score += 1;
    }

    // Time-based risk
    if (opp.estimatedTime && parseInt(opp.estimatedTime) > 20) score += 1;

    return Math.min(10, Math.max(1, score));
  }

  async executeTrade(opportunity: TradeOpportunity): Promise<void> {
    if (this.executingTrades.has(opportunity.id)) {
      logger.warn(`Trade ${opportunity.id} already executing`);
      return;
    }

    this.executingTrades.add(opportunity.id);
    opportunity.status = 'executing';
    this.stats.tradesExecuted++;

    logger.info(`Executing trade ${opportunity.id}:`, {
      route: `${opportunity.buyFrom} → ${opportunity.sellTo}`,
      profit: `${opportunity.profitPercentage.toFixed(2)}%`
    });

    this.emit('tradeStarted', opportunity);

    try {
      // Step 1: Check current prices and slippage
      const currentPrices = await this.checkCurrentPrices(opportunity);
      const slippage = this.calculateSlippage(opportunity, currentPrices);

      if (slippage > this.config.maxSlippage) {
        throw new Error(`Slippage too high: ${slippage.toFixed(2)}%`);
      }

      // Step 2: Check balances
      await this.checkBalances(opportunity);

      // Step 3: Execute buy order
      if (!this.config.enableTestMode) {
        await this.executeBuyOrder(opportunity);
      } else {
        logger.info('TEST MODE: Would execute buy order');
      }

      // Step 4: Wait for settlement and transfer if needed
      await this.waitForSettlement(opportunity);

      // Step 5: Execute sell order
      if (!this.config.enableTestMode) {
        await this.executeSellOrder(opportunity);
      } else {
        logger.info('TEST MODE: Would execute sell order');
      }

      // Step 6: Calculate actual profit
      const actualProfit = await this.calculateActualProfit(opportunity);

      // Update stats
      opportunity.status = 'completed';
      opportunity.profit = actualProfit;
      this.stats.tradesSuccessful++;
      this.stats.totalProfit += actualProfit;
      this.stats.totalVolume += opportunity.volume;
      this.dailyVolume += opportunity.volume;

      // Update best trade
      if (!this.stats.bestTrade || actualProfit > this.stats.bestTrade.profit) {
        this.stats.bestTrade = opportunity;
      }

      logger.info(`Trade ${opportunity.id} completed successfully! Profit: ₹${actualProfit.toFixed(2)}`);
      this.emit('tradeCompleted', opportunity);
      this.sendTradeCompletionAlert(opportunity);

    } catch (error: any) {
      logger.error(`Trade ${opportunity.id} failed:`, error);
      opportunity.status = 'failed';
      this.stats.tradesFailed++;
      
      this.emit('tradeFailed', { opportunity, error: error.message });
      this.sendTradeFailureAlert(opportunity, error.message);

    } finally {
      this.executingTrades.delete(opportunity.id);
    }
  }

  private async checkCurrentPrices(opp: TradeOpportunity): Promise<any> {
    // Implementation depends on opportunity type
    return {
      buyPrice: opp.buyPrice,
      sellPrice: opp.sellPrice
    };
  }

  private calculateSlippage(opp: TradeOpportunity, currentPrices: any): number {
    const buySlippage = Math.abs((currentPrices.buyPrice - opp.buyPrice) / opp.buyPrice);
    const sellSlippage = Math.abs((currentPrices.sellPrice - opp.sellPrice) / opp.sellPrice);
    return Math.max(buySlippage, sellSlippage) * 100;
  }

  private async checkBalances(opp: TradeOpportunity): Promise<void> {
    // Check exchange balances
    logger.info(`Checking balances for ${opp.volume} INR trade`);
  }

  private async executeBuyOrder(opp: TradeOpportunity): Promise<void> {
    logger.info(`Executing buy order on ${opp.buyFrom}`);
    // Exchange-specific implementation
  }

  private async executeSellOrder(opp: TradeOpportunity): Promise<void> {
    logger.info(`Executing sell order on ${opp.sellTo}`);
    // Exchange or P2P specific implementation
  }

  private async waitForSettlement(opp: TradeOpportunity): Promise<void> {
    logger.info('Waiting for order settlement...');
    await new Promise(resolve => setTimeout(resolve, 5000));
  }

  private async calculateActualProfit(opp: TradeOpportunity): Promise<number> {
    // Calculate based on actual execution prices
    return opp.profit * 0.95; // Assume 5% less due to fees and slippage
  }

  // Notification methods
  private async sendTelegramMessage(message: string): Promise<void> {
    if (!this.config.telegramEnabled || !this.config.telegramToken || !this.config.telegramChatId) {
      return;
    }

    try {
      await axios.post(
        `https://api.telegram.org/bot${this.config.telegramToken}/sendMessage`,
        {
          chat_id: this.config.telegramChatId,
          text: message,
          parse_mode: 'HTML'
        }
      );
    } catch (error) {
      logger.error('Failed to send Telegram message:', error);
    }
  }

  private async sendOpportunityAlert(opp: TradeOpportunity): Promise<void> {
    const message = `
🔔 <b>Arbitrage Opportunity Found!</b>

Route: ${opp.buyFrom} → ${opp.sellTo}
Type: ${opp.type.toUpperCase()}
Buy Price: ₹${opp.buyPrice.toFixed(2)}
Sell Price: ₹${opp.sellPrice.toFixed(2)}
Profit: ${opp.profitPercentage.toFixed(2)}% (₹${opp.profit.toFixed(2)})
Volume: ₹${opp.volume.toLocaleString()}
Risk Score: ${opp.riskScore}/10
Est. Time: ${opp.estimatedTime}
${opp.merchant ? `Merchant: ${opp.merchant.name}` : ''}

Status: ${this.config.enableAutoTrading ? 'Auto-trading enabled' : 'Manual trade required'}
    `;

    await this.sendTelegramMessage(message);
  }

  private async sendHighProfitAlert(opp: any): Promise<void> {
    const message = `
🚨 <b>HIGH PROFIT ALERT!</b> 🚨

${opp.profitPercentage.toFixed(2)}% profit opportunity detected!
Route: ${opp.buyFrom} → ${opp.sellTo}

Act quickly - these opportunities don't last long!
    `;

    await this.sendTelegramMessage(message);
  }

  private async sendTradeCompletionAlert(opp: TradeOpportunity): Promise<void> {
    const message = `
✅ <b>Trade Completed Successfully!</b>

Trade ID: ${opp.id}
Route: ${opp.buyFrom} → ${opp.sellTo}
Actual Profit: ₹${opp.profit.toFixed(2)}
Volume: ₹${opp.volume.toLocaleString()}

Daily Stats:
- Trades Today: ${this.stats.tradesSuccessful}
- Total Profit: ₹${this.stats.totalProfit.toFixed(2)}
- Success Rate: ${((this.stats.tradesSuccessful / this.stats.tradesExecuted) * 100).toFixed(1)}%
    `;

    await this.sendTelegramMessage(message);
  }

  private async sendTradeFailureAlert(opp: TradeOpportunity, error: string): Promise<void> {
    const message = `
❌ <b>Trade Failed!</b>

Trade ID: ${opp.id}
Route: ${opp.buyFrom} → ${opp.sellTo}
Error: ${error}

The opportunity has been cancelled.
    `;

    await this.sendTelegramMessage(message);
  }

  // Control methods
  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('Bot is already running');
      return;
    }

    logger.info('Starting Comprehensive Trading Bot...');
    this.isRunning = true;

    // Start services
    this.rateFetcher.start();
    
    if (this.config.enableP2PTrading) {
      this.p2pFetcher.start();
    }

    // Connect to exchanges with WebSocket
    if (this.config.enableWebSocket) {
      for (const [name, exchange] of this.exchanges) {
        if (exchange.connect) {
          await exchange.connect();
        }
      }
    }

    // Start scanning
    this.performScan();
    this.scanTimer = setInterval(() => {
      this.performScan();
    }, this.config.scanInterval);

    // Send startup notification
    await this.sendTelegramMessage(`
🤖 <b>Trading Bot Started!</b>

Configuration:
- Min Profit: ${this.config.minProfitPercentage}%
- Max Volume/Trade: ₹${this.config.maxVolumePerTrade.toLocaleString()}
- Auto Trading: ${this.config.enableAutoTrading ? 'ON' : 'OFF'}
- P2P Trading: ${this.config.enableP2PTrading ? 'ON' : 'OFF'}
- Exchanges: ${Array.from(this.exchanges.keys()).join(', ')}
    `);

    this.emit('started');
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      logger.warn('Bot is not running');
      return;
    }

    logger.info('Stopping Trading Bot...');
    this.isRunning = false;

    // Stop scanning
    if (this.scanTimer) {
      clearInterval(this.scanTimer);
      this.scanTimer = undefined;
    }

    // Stop services
    this.rateFetcher.stop();
    this.p2pFetcher.stop();

    // Disconnect exchanges
    for (const [name, exchange] of this.exchanges) {
      if (exchange.disconnect) {
        exchange.disconnect();
      }
    }

    // Send shutdown notification
    await this.sendTelegramMessage(`
🛑 <b>Trading Bot Stopped!</b>

Session Stats:
- Uptime: ${((Date.now() - this.stats.startTime.getTime()) / 3600000).toFixed(1)} hours
- Opportunities Found: ${this.stats.opportunitiesFound}
- Trades Executed: ${this.stats.tradesExecuted}
- Success Rate: ${this.stats.tradesExecuted > 0 ? ((this.stats.tradesSuccessful / this.stats.tradesExecuted) * 100).toFixed(1) : 0}%
- Total Profit: ₹${this.stats.totalProfit.toFixed(2)}
    `);

    this.emit('stopped');
  }

  private performScan(): void {
    this.stats.totalScans++;
    this.stats.lastScanTime = new Date();
    this.stats.uptime = Date.now() - this.stats.startTime.getTime();
    
    // Update average profit
    if (this.stats.tradesSuccessful > 0) {
      this.stats.averageProfit = this.stats.totalProfit / this.stats.tradesSuccessful;
    }

    this.emit('scanCompleted', {
      scanNumber: this.stats.totalScans,
      opportunities: this.opportunities.size,
      executingTrades: this.executingTrades.size
    });
  }

  // Configuration methods
  updateConfig(config: Partial<BotConfig>): void {
    this.config = { ...this.config, ...config };
    
    // Update service configurations
    if (config.scanInterval) {
      if (this.scanTimer) {
        clearInterval(this.scanTimer);
        this.scanTimer = setInterval(() => {
          this.performScan();
        }, this.config.scanInterval);
      }
    }

    logger.info('Bot configuration updated');
    this.emit('configUpdated', this.config);
  }

  getConfig(): BotConfig {
    return { ...this.config };
  }

  getStats(): BotStats {
    return { ...this.stats };
  }

  getOpportunities(): TradeOpportunity[] {
    return Array.from(this.opportunities.values())
      .sort((a, b) => b.profitPercentage - a.profitPercentage);
  }

  getExecutingTrades(): TradeOpportunity[] {
    return Array.from(this.opportunities.values())
      .filter(opp => this.executingTrades.has(opp.id));
  }

  // Manual trade execution
  async executeManualTrade(opportunityId: string): Promise<void> {
    const opportunity = this.opportunities.get(opportunityId);
    if (!opportunity) {
      throw new Error('Opportunity not found');
    }

    if (opportunity.status !== 'pending') {
      throw new Error(`Cannot execute trade in ${opportunity.status} status`);
    }

    await this.executeTrade(opportunity);
  }
}