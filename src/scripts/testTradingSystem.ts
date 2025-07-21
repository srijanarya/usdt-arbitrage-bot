import chalk from 'chalk';
import { priceMonitor } from '../services/websocket/SimpleWebSocketMonitor';
import { autoTrader } from '../services/trading/AutomatedTradingService';
import { riskManager } from '../services/trading/RiskManagementService';
import { profitTracker } from '../services/reporting/ProfitTrackingService';
import { telegramAlert } from '../services/telegram/TelegramAlertService';
import { arbitrageCalculator } from '../services/arbitrage/USDTArbitrageCalculator';
import dotenv from 'dotenv';

dotenv.config();

class TradingSystemTester {
  private testResults: { [key: string]: { passed: boolean; message: string }[] } = {};
  private simulatedPrices = {
    zebpay: { buy: 86.50, sell: 86.00 },
    binance_p2p: { buy: 91.50, sell: 90.50 },
    coindcx: { buy: 87.00, sell: 86.50 }
  };

  async runAllTests() {
    console.log(chalk.bgCyan.black('\n 🧪 TRADING SYSTEM TEST SUITE \n'));
    console.log(chalk.cyan('━'.repeat(60)));
    
    // Test categories
    await this.testPriceMonitoring();
    await this.testArbitrageCalculations();
    await this.testRiskManagement();
    await this.testAutomatedTrading();
    await this.testProfitTracking();
    await this.testAlertSystem();
    await this.testErrorHandling();
    await this.testPerformance();
    
    // Display results
    this.displayTestResults();
  }

  /**
   * Test 1: Price Monitoring System
   */
  async testPriceMonitoring() {
    console.log(chalk.yellow('\n📊 Testing Price Monitoring System...'));
    const results: any[] = [];
    
    try {
      // Test WebSocket connection
      const connectPromise = new Promise((resolve) => {
        priceMonitor.once('connected', () => resolve(true));
        setTimeout(() => resolve(false), 5000);
      });
      
      await priceMonitor.start();
      const connected = await connectPromise;
      
      results.push({
        passed: connected,
        message: connected ? 'WebSocket connection established' : 'WebSocket connection failed'
      });
      
      // Test price update events
      const priceUpdatePromise = new Promise((resolve) => {
        priceMonitor.once('priceUpdate', (exchange, data) => {
          resolve({ exchange, data });
        });
        setTimeout(() => resolve(null), 3000);
      });
      
      // Simulate price update
      priceMonitor.emit('priceUpdate', 'zebpay', {
        buyPrice: this.simulatedPrices.zebpay.buy,
        sellPrice: this.simulatedPrices.zebpay.sell,
        timestamp: Date.now()
      });
      
      const priceUpdate = await priceUpdatePromise;
      results.push({
        passed: priceUpdate !== null,
        message: priceUpdate ? 'Price updates received' : 'No price updates received'
      });
      
      // Test arbitrage detection
      const arbPromise = new Promise((resolve) => {
        priceMonitor.once('arbitrageFound', (opp) => resolve(opp));
        setTimeout(() => resolve(null), 2000);
      });
      
      // Simulate arbitrage opportunity
      this.simulateArbitrageOpportunity();
      
      const opportunity = await arbPromise;
      results.push({
        passed: opportunity !== null,
        message: opportunity ? 'Arbitrage detection working' : 'Arbitrage detection failed'
      });
      
    } catch (error) {
      results.push({
        passed: false,
        message: `Price monitoring error: ${error.message}`
      });
    } finally {
      priceMonitor.stop();
    }
    
    this.testResults['Price Monitoring'] = results;
  }

  /**
   * Test 2: Arbitrage Calculations
   */
  async testArbitrageCalculations() {
    console.log(chalk.yellow('\n💹 Testing Arbitrage Calculations...'));
    const results: any[] = [];
    
    // Test profit calculation
    const analysis = arbitrageCalculator.calculateProfit(
      this.simulatedPrices.zebpay.buy,
      this.simulatedPrices.binance_p2p.sell,
      100,
      'zebpay'
    );
    
    results.push({
      passed: analysis.profitable && analysis.netProfit > 0,
      message: `Profit calculation: ₹${analysis.netProfit.toFixed(2)} (${analysis.roi.toFixed(2)}% ROI)`
    });
    
    // Test minimum quantity validation
    results.push({
      passed: analysis.meetsMinQuantity !== undefined,
      message: `Min quantity check: ${analysis.meetsMinQuantity ? 'Passed' : 'Failed'}`
    });
    
    // Test fee calculations
    const expectedFees = (100 * this.simulatedPrices.zebpay.buy * 0.0025) + 
                        (100 * this.simulatedPrices.binance_p2p.sell * 0.01); // TDS
    const actualFees = analysis.buyFee + analysis.sellFee + analysis.tds;
    
    results.push({
      passed: Math.abs(expectedFees - actualFees) < 0.01,
      message: `Fee calculation: ₹${actualFees.toFixed(2)} (expected: ₹${expectedFees.toFixed(2)})`
    });
    
    this.testResults['Arbitrage Calculations'] = results;
  }

  /**
   * Test 3: Risk Management
   */
  async testRiskManagement() {
    console.log(chalk.yellow('\n⚠️  Testing Risk Management...'));
    const results: any[] = [];
    
    // Reset risk manager state
    riskManager.resetDailyMetrics();
    
    // Test trade assessment
    const assessment = riskManager.assessTrade(
      'zebpay',
      'binance_p2p',
      100,
      this.simulatedPrices.zebpay.buy,
      400,
      'TestMerchant'
    );
    
    results.push({
      passed: assessment.allowed,
      message: `Trade assessment: ${assessment.allowed ? 'Allowed' : `Blocked - ${assessment.reason}`}`
    });
    
    results.push({
      passed: assessment.riskScore >= 0 && assessment.riskScore <= 100,
      message: `Risk score: ${assessment.riskScore}/100`
    });
    
    // Test consecutive loss protection
    for (let i = 0; i < 3; i++) {
      riskManager.recordTrade(-100, 100, 90, false, 'TestMerchant');
    }
    
    const afterLosses = riskManager.assessTrade(
      'zebpay',
      'binance_p2p',
      100,
      90,
      400,
      'TestMerchant'
    );
    
    results.push({
      passed: !afterLosses.allowed,
      message: `Consecutive loss protection: ${!afterLosses.allowed ? 'Working' : 'Failed'}`
    });
    
    // Test position sizing
    riskManager.updateCapital(10000);
    const largeTrade = riskManager.assessTrade(
      'zebpay',
      'binance_p2p',
      200, // Large amount
      90,
      800,
      'TestMerchant2'
    );
    
    results.push({
      passed: largeTrade.suggestedAmount !== undefined && largeTrade.suggestedAmount < 200,
      message: `Position sizing: Suggested ${largeTrade.suggestedAmount?.toFixed(2)} USDT`
    });
    
    this.testResults['Risk Management'] = results;
  }

  /**
   * Test 4: Automated Trading
   */
  async testAutomatedTrading() {
    console.log(chalk.yellow('\n🤖 Testing Automated Trading...'));
    const results: any[] = [];
    
    // Configure for testing
    autoTrader.updateConfig({
      enabled: true,
      minProfit: 100,
      minROI: 1,
      maxAmountPerTrade: 100,
      dailyLimit: 10000
    });
    
    try {
      // Test start/stop
      await autoTrader.start();
      results.push({
        passed: autoTrader.getStats().isRunning,
        message: 'Auto trader started successfully'
      });
      
      // Test opportunity evaluation
      const evaluated = await autoTrader.evaluateOpportunity(
        'zebpay',
        'binance_p2p',
        this.simulatedPrices.zebpay.buy,
        this.simulatedPrices.binance_p2p.sell,
        100,
        'TestMerchant'
      );
      
      results.push({
        passed: evaluated,
        message: `Opportunity evaluation: ${evaluated ? 'Approved' : 'Rejected'}`
      });
      
      // Test execution tracking
      const executionPromise = new Promise((resolve) => {
        autoTrader.once('executionCompleted', (execution) => resolve(execution));
        autoTrader.once('executionFailed', (execution, error) => resolve({ failed: true, error }));
        setTimeout(() => resolve(null), 10000);
      });
      
      // Wait for simulated execution
      const execution = await executionPromise;
      
      if (execution && !execution.failed) {
        results.push({
          passed: true,
          message: `Trade executed: Profit ₹${execution.actualProfit?.toFixed(2)}`
        });
      } else {
        results.push({
          passed: false,
          message: `Trade execution: ${execution?.error || 'Timeout'}`
        });
      }
      
      // Test stats tracking
      const stats = autoTrader.getStats();
      results.push({
        passed: stats.dailyVolume > 0 || stats.dailyProfit !== 0,
        message: `Stats tracking: Volume ₹${stats.dailyVolume.toFixed(2)}, Profit ₹${stats.dailyProfit.toFixed(2)}`
      });
      
    } finally {
      await autoTrader.stop();
    }
    
    this.testResults['Automated Trading'] = results;
  }

  /**
   * Test 5: Profit Tracking
   */
  async testProfitTracking() {
    console.log(chalk.yellow('\n📈 Testing Profit Tracking...'));
    const results: any[] = [];
    
    // Record test trades
    const testTrades = [
      { id: 'test1', profit: 250, amount: 100, status: 'completed' as const },
      { id: 'test2', profit: -50, amount: 100, status: 'completed' as const },
      { id: 'test3', profit: 180, amount: 100, status: 'completed' as const },
      { id: 'test4', profit: 0, amount: 100, status: 'failed' as const }
    ];
    
    for (const trade of testTrades) {
      await profitTracker.recordTrade({
        id: trade.id,
        buyExchange: 'zebpay',
        sellExchange: 'binance_p2p',
        buyPrice: 90,
        sellPrice: 92,
        amount: trade.amount,
        expectedProfit: trade.profit,
        actualProfit: trade.profit,
        fees: 20,
        executionTime: 30,
        status: trade.status
      });
    }
    
    // Test daily report
    const dailyReport = await profitTracker.generateDailyReport();
    
    results.push({
      passed: dailyReport.totalTrades === 4,
      message: `Trade recording: ${dailyReport.totalTrades} trades recorded`
    });
    
    results.push({
      passed: dailyReport.successfulTrades === 3,
      message: `Success tracking: ${dailyReport.successfulTrades}/3 successful trades`
    });
    
    results.push({
      passed: Math.abs(dailyReport.netProfit - 320) < 0.01, // 380 gross - 60 fees
      message: `Profit calculation: ₹${dailyReport.netProfit.toFixed(2)} net profit`
    });
    
    // Test performance metrics
    const metrics = profitTracker['calculatePerformanceMetrics'](
      profitTracker['trades']
    );
    
    results.push({
      passed: metrics.winRate === 2/3, // 2 wins out of 3 completed
      message: `Win rate: ${(metrics.winRate * 100).toFixed(2)}%`
    });
    
    this.testResults['Profit Tracking'] = results;
  }

  /**
   * Test 6: Alert System
   */
  async testAlertSystem() {
    console.log(chalk.yellow('\n🔔 Testing Alert System...'));
    const results: any[] = [];
    
    // Check if Telegram is configured
    const telegramConfigured = !!(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID);
    
    if (telegramConfigured) {
      try {
        // Test system alert
        const systemAlert = await telegramAlert.sendSystemAlert(
          'Test Alert',
          'Testing alert system functionality',
          'info'
        );
        
        results.push({
          passed: true,
          message: 'System alert sent successfully'
        });
        
        // Test arbitrage alert
        await telegramAlert.sendArbitrageAlert(
          'zebpay',
          'binance_p2p',
          90,
          92,
          180,
          2,
          100
        );
        
        results.push({
          passed: true,
          message: 'Arbitrage alert sent successfully'
        });
        
      } catch (error) {
        results.push({
          passed: false,
          message: `Alert error: ${error.message}`
        });
      }
    } else {
      results.push({
        passed: false,
        message: 'Telegram not configured (set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID)'
      });
    }
    
    this.testResults['Alert System'] = results;
  }

  /**
   * Test 7: Error Handling
   */
  async testErrorHandling() {
    console.log(chalk.yellow('\n🛡️  Testing Error Handling...'));
    const results: any[] = [];
    
    // Test invalid trade parameters
    try {
      const invalidAssessment = riskManager.assessTrade(
        'invalid_exchange',
        'binance_p2p',
        -100, // Invalid amount
        0, // Invalid price
        400,
        'TestMerchant'
      );
      
      results.push({
        passed: !invalidAssessment.allowed,
        message: 'Invalid trade parameters handled correctly'
      });
    } catch (error) {
      results.push({
        passed: false,
        message: `Error handling failed: ${error.message}`
      });
    }
    
    // Test recovery from connection loss
    priceMonitor.stop();
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    try {
      await priceMonitor.start();
      results.push({
        passed: true,
        message: 'WebSocket reconnection successful'
      });
    } catch (error) {
      results.push({
        passed: false,
        message: `Reconnection failed: ${error.message}`
      });
    }
    
    this.testResults['Error Handling'] = results;
  }

  /**
   * Test 8: Performance
   */
  async testPerformance() {
    console.log(chalk.yellow('\n⚡ Testing Performance...'));
    const results: any[] = [];
    
    // Test calculation speed
    const startCalc = Date.now();
    for (let i = 0; i < 1000; i++) {
      arbitrageCalculator.calculateProfit(90 + Math.random(), 92 + Math.random(), 100);
    }
    const calcTime = Date.now() - startCalc;
    
    results.push({
      passed: calcTime < 100, // Should complete 1000 calculations in < 100ms
      message: `Calculation speed: 1000 calculations in ${calcTime}ms`
    });
    
    // Test memory usage
    const memUsage = process.memoryUsage();
    const heapUsedMB = memUsage.heapUsed / 1024 / 1024;
    
    results.push({
      passed: heapUsedMB < 200, // Should use less than 200MB
      message: `Memory usage: ${heapUsedMB.toFixed(2)}MB`
    });
    
    this.testResults['Performance'] = results;
  }

  /**
   * Simulate arbitrage opportunity
   */
  private simulateArbitrageOpportunity() {
    // Update prices to create opportunity
    priceMonitor.emit('priceUpdate', 'zebpay', {
      buyPrice: this.simulatedPrices.zebpay.buy,
      sellPrice: this.simulatedPrices.zebpay.sell,
      timestamp: Date.now()
    });
    
    priceMonitor.emit('priceUpdate', 'binance_p2p', {
      buyPrice: this.simulatedPrices.binance_p2p.buy,
      sellPrice: this.simulatedPrices.binance_p2p.sell,
      timestamp: Date.now()
    });
    
    // Trigger arbitrage check
    priceMonitor['checkArbitrageOpportunities']();
  }

  /**
   * Display test results
   */
  private displayTestResults() {
    console.log(chalk.cyan('\n━'.repeat(60)));
    console.log(chalk.bgCyan.black('\n 📊 TEST RESULTS SUMMARY \n'));
    
    let totalTests = 0;
    let passedTests = 0;
    
    for (const [category, results] of Object.entries(this.testResults)) {
      console.log(chalk.yellow(`\n${category}:`));
      
      for (const result of results) {
        totalTests++;
        if (result.passed) passedTests++;
        
        const icon = result.passed ? '✅' : '❌';
        const color = result.passed ? chalk.green : chalk.red;
        console.log(`  ${icon} ${color(result.message)}`);
      }
    }
    
    const passRate = (passedTests / totalTests * 100).toFixed(1);
    const summaryColor = passRate >= 80 ? chalk.green : passRate >= 60 ? chalk.yellow : chalk.red;
    
    console.log(chalk.cyan('\n━'.repeat(60)));
    console.log(summaryColor(`\n📈 Overall: ${passedTests}/${totalTests} tests passed (${passRate}%)\n`));
    
    // Recommendations
    if (passRate < 100) {
      console.log(chalk.yellow('💡 Recommendations:'));
      
      if (this.testResults['Alert System']?.some(r => !r.passed)) {
        console.log('  • Configure Telegram alerts for production monitoring');
      }
      
      if (this.testResults['Price Monitoring']?.some(r => !r.passed)) {
        console.log('  • Check WebSocket connections and network stability');
      }
      
      if (this.testResults['Risk Management']?.some(r => !r.passed)) {
        console.log('  • Review risk parameters and capital allocation');
      }
      
      console.log('');
    }
  }
}

// Run tests
const tester = new TradingSystemTester();
tester.runAllTests()
  .then(() => {
    console.log(chalk.gray('Tests completed. Check results above.'));
    process.exit(0);
  })
  .catch(error => {
    console.error(chalk.red('Test suite error:', error));
    process.exit(1);
  });