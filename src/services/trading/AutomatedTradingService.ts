import chalk from 'chalk';
import { EventEmitter } from 'events';
import { arbitrageCalculator } from '../arbitrage/USDTArbitrageCalculator';
import { telegramAlert } from '../telegram/TelegramAlertService';
import { PostgresService } from '../database/postgresService';
import { riskManager } from './RiskManagementService';
import axios from 'axios';

interface TradingConfig {
  enabled: boolean;
  minProfit: number;
  minROI: number;
  maxAmountPerTrade: number;
  dailyLimit: number;
  exchanges: {
    zebpay: boolean;
    binanceP2P: boolean;
    coindcx: boolean;
  };
  safetyChecks: {
    requireConfirmation: boolean;
    checkPriceDeviation: boolean;
    maxPriceDeviation: number;
  };
}

interface TradeExecution {
  id: string;
  type: 'buy' | 'sell';
  exchange: string;
  amount: number;
  price: number;
  status: 'pending' | 'executing' | 'completed' | 'failed';
  timestamp: Date;
  error?: string;
}

interface ArbitrageExecution {
  id: string;
  buyTrade: TradeExecution;
  sellTrade: TradeExecution;
  expectedProfit: number;
  actualProfit?: number;
  status: 'pending' | 'buying' | 'transferring' | 'selling' | 'completed' | 'failed';
  startTime: Date;
  endTime?: Date;
}

export class AutomatedTradingService extends EventEmitter {
  private config: TradingConfig;
  private isRunning = false;
  private dailyVolume = 0;
  private dailyProfit = 0;
  private activeExecutions: Map<string, ArbitrageExecution> = new Map();
  private lastResetDate: Date;

  constructor(config: Partial<TradingConfig> = {}) {
    super();
    
    this.config = {
      enabled: config.enabled || false,
      minProfit: config.minProfit || 200,
      minROI: config.minROI || 2,
      maxAmountPerTrade: config.maxAmountPerTrade || 100,
      dailyLimit: config.dailyLimit || 10000,
      exchanges: {
        zebpay: config.exchanges?.zebpay !== false,
        binanceP2P: config.exchanges?.binanceP2P !== false,
        coindcx: false // Disabled due to withdrawal issues
      },
      safetyChecks: {
        requireConfirmation: config.safetyChecks?.requireConfirmation !== false,
        checkPriceDeviation: config.safetyChecks?.checkPriceDeviation !== false,
        maxPriceDeviation: config.safetyChecks?.maxPriceDeviation || 0.02 // 2%
      }
    };

    this.lastResetDate = new Date();
    this.resetDailyLimits();
  }

  /**
   * Start automated trading
   */
  async start() {
    if (this.isRunning) {
      console.log(chalk.yellow('Automated trading already running'));
      return;
    }

    console.log(chalk.bgGreen.black(' 🤖 Starting Automated Trading Service \n'));
    
    if (!this.config.enabled) {
      console.log(chalk.red('⚠️  Automated trading is DISABLED in config'));
      console.log(chalk.yellow('Set enabled: true to activate'));
      return;
    }

    this.isRunning = true;
    this.emit('started');

    // Send startup notification
    await telegramAlert.sendSystemAlert(
      'Trading Bot Started',
      `Automated trading activated\nMin Profit: ₹${this.config.minProfit}\nMin ROI: ${this.config.minROI}%`
    );

    console.log(chalk.green('✅ Automated trading activated'));
    console.log(chalk.yellow(`Min Profit: ₹${this.config.minProfit}`));
    console.log(chalk.yellow(`Min ROI: ${this.config.minROI}%`));
    console.log(chalk.yellow(`Max per trade: ${this.config.maxAmountPerTrade} USDT`));
    console.log(chalk.yellow(`Daily limit: ₹${this.config.dailyLimit}`));
  }

  /**
   * Stop automated trading
   */
  async stop() {
    if (!this.isRunning) return;

    console.log(chalk.yellow('🛑 Stopping automated trading...'));
    this.isRunning = false;
    
    // Wait for active executions to complete
    if (this.activeExecutions.size > 0) {
      console.log(chalk.yellow(`Waiting for ${this.activeExecutions.size} active trades to complete...`));
      // In real implementation, would wait for trades to finish
    }

    this.emit('stopped');
    
    await telegramAlert.sendSystemAlert(
      'Trading Bot Stopped',
      `Daily volume: ₹${this.dailyVolume.toFixed(2)}\nDaily profit: ₹${this.dailyProfit.toFixed(2)}`
    );
  }

  /**
   * Evaluate arbitrage opportunity for automated execution
   */
  async evaluateOpportunity(
    buyExchange: string,
    sellExchange: string,
    buyPrice: number,
    sellPrice: number,
    suggestedAmount: number = 100,
    merchantName?: string
  ): Promise<boolean> {
    if (!this.isRunning || !this.config.enabled) {
      return false;
    }

    // Check if exchanges are enabled
    if (!this.isExchangeEnabled(buyExchange) || !this.isExchangeEnabled(sellExchange)) {
      console.log(chalk.gray(`Skipping disabled exchange: ${buyExchange} or ${sellExchange}`));
      return false;
    }

    // Check daily limit
    if (this.dailyVolume >= this.config.dailyLimit) {
      console.log(chalk.yellow('Daily trading limit reached'));
      return false;
    }

    // Calculate profit
    const amount = Math.min(suggestedAmount, this.config.maxAmountPerTrade);
    const analysis = arbitrageCalculator.calculateProfit(buyPrice, sellPrice, amount, buyExchange);

    // Check profitability thresholds
    if (!analysis.profitable || 
        analysis.netProfit < this.config.minProfit || 
        analysis.roi < this.config.minROI) {
      return false;
    }

    // Check minimum quantity requirements
    if (!analysis.meetsMinQuantity) {
      console.log(chalk.yellow(`Below minimum quantity for ${buyExchange}`));
      return false;
    }

    // Risk assessment
    const riskAssessment = riskManager.assessTrade(
      buyExchange,
      sellExchange,
      amount,
      buyPrice,
      analysis.netProfit,
      merchantName
    );

    if (!riskAssessment.allowed) {
      console.log(chalk.red(`❌ Risk check failed: ${riskAssessment.reason}`));
      await telegramAlert.sendSystemAlert(
        'Trade Rejected by Risk Management',
        `Route: ${buyExchange} → ${sellExchange}\nReason: ${riskAssessment.reason}\nRisk Score: ${riskAssessment.riskScore}/100`,
        'warning'
      );
      return false;
    }

    // Use risk-adjusted amount if suggested
    const finalAmount = riskAssessment.suggestedAmount || amount;
    
    // Display risk warnings
    if (riskAssessment.warnings.length > 0) {
      console.log(chalk.yellow('⚠️  Risk warnings:'));
      riskAssessment.warnings.forEach(warning => {
        console.log(chalk.yellow(`   • ${warning}`));
      });
    }

    // Price deviation check
    if (this.config.safetyChecks.checkPriceDeviation) {
      const priceDeviationOk = await this.checkPriceDeviation(buyExchange, buyPrice, sellExchange, sellPrice);
      if (!priceDeviationOk) {
        console.log(chalk.red('Price deviation too high, skipping trade'));
        return false;
      }
    }

    // All checks passed - execute trade
    console.log(chalk.green(`✅ Opportunity approved for execution`));
    console.log(chalk.cyan(`Expected profit: ₹${analysis.netProfit.toFixed(2)} (${analysis.roi.toFixed(2)}%)`));
    console.log(chalk.cyan(`Risk Score: ${riskAssessment.riskScore}/100`));
    console.log(chalk.cyan(`Final Amount: ${finalAmount} USDT`));

    if (this.config.safetyChecks.requireConfirmation) {
      // In production, would wait for user confirmation via Telegram
      console.log(chalk.yellow('⚠️  Manual confirmation required (simulated approval)'));
    }

    // Execute the arbitrage
    await this.executeArbitrage(buyExchange, sellExchange, buyPrice, sellPrice, finalAmount, analysis, merchantName);
    
    return true;
  }

  /**
   * Execute arbitrage trade
   */
  private async executeArbitrage(
    buyExchange: string,
    sellExchange: string,
    buyPrice: number,
    sellPrice: number,
    amount: number,
    analysis: any,
    merchantName?: string
  ) {
    const executionId = this.generateExecutionId();
    
    const execution: ArbitrageExecution = {
      id: executionId,
      buyTrade: {
        id: `${executionId}-buy`,
        type: 'buy',
        exchange: buyExchange,
        amount,
        price: buyPrice,
        status: 'pending',
        timestamp: new Date()
      },
      sellTrade: {
        id: `${executionId}-sell`,
        type: 'sell',
        exchange: sellExchange,
        amount,
        price: sellPrice,
        status: 'pending',
        timestamp: new Date()
      },
      expectedProfit: analysis.netProfit,
      status: 'pending',
      startTime: new Date()
    };

    this.activeExecutions.set(executionId, execution);
    this.emit('executionStarted', execution);

    try {
      // Step 1: Execute buy order
      console.log(chalk.blue(`📥 Executing BUY on ${buyExchange}...`));
      execution.status = 'buying';
      execution.buyTrade.status = 'executing';
      
      await this.executeBuyOrder(execution.buyTrade);
      execution.buyTrade.status = 'completed';
      
      console.log(chalk.green(`✅ Buy completed: ${amount} USDT @ ₹${buyPrice}`));

      // Step 2: Transfer USDT (if needed)
      if (buyExchange !== sellExchange && buyExchange !== 'binance_p2p') {
        console.log(chalk.blue(`🔄 Transferring USDT to ${sellExchange}...`));
        execution.status = 'transferring';
        await this.executeTransfer(buyExchange, sellExchange, amount);
      }

      // Step 3: Execute sell order
      console.log(chalk.blue(`📤 Executing SELL on ${sellExchange}...`));
      execution.status = 'selling';
      execution.sellTrade.status = 'executing';
      
      await this.executeSellOrder(execution.sellTrade);
      execution.sellTrade.status = 'completed';
      
      console.log(chalk.green(`✅ Sell completed: ${amount} USDT @ ₹${sellPrice}`));

      // Calculate actual profit
      const actualRevenue = sellPrice * amount * 0.99; // Assuming 1% TDS
      const actualCost = buyPrice * amount * 1.0025; // Including fees
      execution.actualProfit = actualRevenue - actualCost;
      execution.status = 'completed';
      execution.endTime = new Date();

      // Update daily stats
      this.dailyVolume += actualCost;
      this.dailyProfit += execution.actualProfit;

      // Log success
      console.log(chalk.bgGreen.black(`\n 🎉 Arbitrage Completed Successfully! \n`));
      console.log(chalk.green(`Actual Profit: ₹${execution.actualProfit.toFixed(2)}`));
      console.log(chalk.green(`Execution Time: ${(execution.endTime.getTime() - execution.startTime.getTime()) / 1000}s`));

      // Send success notification
      await telegramAlert.sendArbitrageAlert(
        buyExchange,
        sellExchange,
        buyPrice,
        sellPrice,
        execution.actualProfit,
        (execution.actualProfit / actualCost) * 100,
        amount
      );

      // Save to database
      await this.saveExecutionRecord(execution);

      // Record successful trade in risk management
      riskManager.recordTrade(
        execution.actualProfit,
        amount,
        buyPrice,
        true,
        merchantName
      );

      this.emit('executionCompleted', execution);

    } catch (error) {
      console.error(chalk.red('❌ Execution failed:', error.message));
      execution.status = 'failed';
      execution.buyTrade.error = error.message;
      
      // Record failed trade in risk management
      riskManager.recordTrade(
        0,
        amount,
        buyPrice,
        false,
        merchantName
      );
      
      await telegramAlert.sendSystemAlert(
        'Trade Execution Failed',
        `Route: ${buyExchange} → ${sellExchange}\nError: ${error.message}`,
        'error'
      );

      this.emit('executionFailed', execution, error);
    } finally {
      this.activeExecutions.delete(executionId);
    }
  }

  /**
   * Execute buy order (simulated for now)
   */
  private async executeBuyOrder(trade: TradeExecution): Promise<void> {
    // In production, this would call actual exchange APIs
    
    if (trade.exchange === 'zebpay') {
      // Simulate ZebPay buy
      console.log(chalk.gray(`[SIMULATED] ZebPay API: Buy ${trade.amount} USDT at ₹${trade.price}`));
      await this.simulateDelay(2000);
      
    } else if (trade.exchange === 'binance_p2p') {
      // Simulate P2P buy
      console.log(chalk.gray(`[SIMULATED] Binance P2P: Buy ${trade.amount} USDT at ₹${trade.price}`));
      await this.simulateDelay(5000); // P2P takes longer
      
    } else {
      throw new Error(`Unsupported exchange: ${trade.exchange}`);
    }
  }

  /**
   * Execute sell order (simulated for now)
   */
  private async executeSellOrder(trade: TradeExecution): Promise<void> {
    // In production, this would call actual exchange APIs
    
    if (trade.exchange === 'binance_p2p') {
      // Simulate P2P sell
      console.log(chalk.gray(`[SIMULATED] Binance P2P: Sell ${trade.amount} USDT at ₹${trade.price}`));
      await this.simulateDelay(5000);
      
    } else {
      throw new Error(`Unsupported sell exchange: ${trade.exchange}`);
    }
  }

  /**
   * Execute USDT transfer between exchanges
   */
  private async executeTransfer(from: string, to: string, amount: number): Promise<void> {
    console.log(chalk.gray(`[SIMULATED] Transfer ${amount} USDT from ${from} to ${to}`));
    await this.simulateDelay(3000);
    
    // In production would:
    // 1. Get deposit address from destination
    // 2. Execute withdrawal from source
    // 3. Wait for confirmation
  }

  /**
   * Check if price hasn't deviated too much
   */
  private async checkPriceDeviation(
    buyExchange: string,
    buyPrice: number,
    sellExchange: string,
    sellPrice: number
  ): Promise<boolean> {
    try {
      // Fetch current prices
      const currentBuyPrice = await this.getCurrentPrice(buyExchange, 'buy');
      const currentSellPrice = await this.getCurrentPrice(sellExchange, 'sell');

      const buyDeviation = Math.abs(currentBuyPrice - buyPrice) / buyPrice;
      const sellDeviation = Math.abs(currentSellPrice - sellPrice) / sellPrice;

      if (buyDeviation > this.config.safetyChecks.maxPriceDeviation ||
          sellDeviation > this.config.safetyChecks.maxPriceDeviation) {
        console.log(chalk.red(`Price deviation too high: Buy ${(buyDeviation * 100).toFixed(2)}%, Sell ${(sellDeviation * 100).toFixed(2)}%`));
        return false;
      }

      return true;
    } catch (error) {
      console.error(chalk.red('Price check failed:', error.message));
      return false;
    }
  }

  /**
   * Get current price from exchange
   */
  private async getCurrentPrice(exchange: string, type: 'buy' | 'sell'): Promise<number> {
    // In production, would fetch real-time prices
    // For now, return simulated prices
    
    const prices = {
      zebpay_buy: 86.50,
      zebpay_sell: 86.00,
      binance_p2p_buy: 91.50,
      binance_p2p_sell: 90.50
    };

    return prices[`${exchange}_${type}`] || 90;
  }

  /**
   * Save execution record to database
   */
  private async saveExecutionRecord(execution: ArbitrageExecution) {
    try {
      await PostgresService.saveArbitrageOpportunity({
        type: 'executed',
        buyExchange: execution.buyTrade.exchange,
        sellExchange: execution.sellTrade.exchange,
        symbol: 'USDT/INR',
        buyPrice: execution.buyTrade.price,
        sellPrice: execution.sellTrade.price,
        grossProfit: execution.expectedProfit,
        netProfit: execution.actualProfit || 0,
        profitPercentage: ((execution.actualProfit || 0) / (execution.buyTrade.price * execution.buyTrade.amount)) * 100
      });
    } catch (error) {
      console.error(chalk.red('Failed to save execution record:', error.message));
    }
  }

  /**
   * Check if exchange is enabled for trading
   */
  private isExchangeEnabled(exchange: string): boolean {
    const key = exchange.toLowerCase().replace('_', '');
    return this.config.exchanges[key as keyof typeof this.config.exchanges] || false;
  }

  /**
   * Reset daily limits at midnight
   */
  private resetDailyLimits() {
    const now = new Date();
    if (now.getDate() !== this.lastResetDate.getDate()) {
      this.dailyVolume = 0;
      this.dailyProfit = 0;
      this.lastResetDate = now;
      console.log(chalk.blue('Daily limits reset'));
    }
  }

  /**
   * Generate unique execution ID
   */
  private generateExecutionId(): string {
    return `exec_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }

  /**
   * Simulate delay (for testing)
   */
  private simulateDelay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get current stats
   */
  getStats() {
    return {
      isRunning: this.isRunning,
      dailyVolume: this.dailyVolume,
      dailyProfit: this.dailyProfit,
      dailyLimit: this.config.dailyLimit,
      activeExecutions: this.activeExecutions.size,
      config: this.config
    };
  }

  /**
   * Update configuration
   */
  updateConfig(updates: Partial<TradingConfig>) {
    this.config = { ...this.config, ...updates };
    console.log(chalk.yellow('Trading configuration updated'));
  }
}

// Export singleton
export const autoTrader = new AutomatedTradingService();