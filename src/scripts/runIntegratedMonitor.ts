import chalk from 'chalk';
import { priceMonitor } from '../services/websocket/SimpleWebSocketMonitor';
import { arbitrageCalculator } from '../services/arbitrage/USDTArbitrageCalculator';
import { PostgresService } from '../services/database/postgresService';

async function runIntegratedMonitor() {
  console.log(chalk.bgCyan.black(' 🚀 Integrated USDT Arbitrage Monitor with Calculator \n'));
  
  const config = {
    defaultAmount: 100,      // Default USDT amount
    minProfit: 100,         // Minimum profit threshold
    checkInterval: 5000,    // Update every 5 seconds
    autoExecute: false      // Set to true for automated trading
  };

  let bestOpportunity: any = null;
  let totalOpportunities = 0;
  const startTime = Date.now();

  // Listen for price updates
  priceMonitor.on('priceUpdate', (priceUpdate) => {
    // Check if this creates an arbitrage opportunity
    checkArbitrageWithCalculator(priceUpdate);
  });

  // Listen for arbitrage opportunities
  priceMonitor.on('arbitrageFound', (opportunity) => {
    totalOpportunities++;
    bestOpportunity = opportunity;
  });

  // Start monitoring
  priceMonitor.start();

  // Check arbitrage with calculator
  async function checkArbitrageWithCalculator(priceUpdate: any) {
    const prices = priceMonitor.getCurrentPrices();
    const p2pPrice = prices.get('binance_p2p_USDT/INR');
    
    if (!p2pPrice || priceUpdate.exchange === 'binance_p2p') return;

    // Use the calculator to analyze
    const analysis = arbitrageCalculator.calculateProfit(
      priceUpdate.ask,  // Buy price
      p2pPrice.bid,     // Sell price
      config.defaultAmount
    );

    // Get trading signal
    const signal = arbitrageCalculator.getTradingSignal(
      priceUpdate.ask,
      p2pPrice.bid,
      config.defaultAmount,
      config.minProfit
    );

    // If profitable, log and potentially execute
    if (signal.signal === 'BUY' && signal.execution.shouldExecute) {
      console.log(chalk.bgGreen.black('\n 🎯 CALCULATOR: Profitable Opportunity! '));
      console.log(chalk.yellow(`Exchange: ${priceUpdate.exchange}`));
      console.log(chalk.cyan(signal.reason));
      console.log(chalk.green(`Risk Level: ${signal.riskLevel}`));
      console.log(chalk.white(`Suggested Amount: ${signal.execution.suggestedAmount} USDT`));
      
      if (config.autoExecute) {
        console.log(chalk.bgYellow.black(' 🤖 AUTO-EXECUTION WOULD TRIGGER HERE '));
        // Add your execution logic here
      }
    }
  }

  // Display dashboard
  const displayInterval = setInterval(async () => {
    console.clear();
    console.log(chalk.bgCyan.black(' 💹 Integrated Arbitrage Monitor with Profitability Calculator \n'));

    const prices = priceMonitor.getCurrentPrices();
    const sortedPrices = Array.from(prices.values()).sort((a, b) => a.ask - b.ask);
    
    // Find best opportunity
    const p2pPrice = prices.get('binance_p2p_USDT/INR');
    const cheapestExchange = sortedPrices.find(p => p.exchange !== 'binance_p2p');
    
    if (cheapestExchange && p2pPrice) {
      // Calculate using the integrated calculator
      const analysis = arbitrageCalculator.calculateProfit(
        cheapestExchange.ask,
        p2pPrice.bid,
        config.defaultAmount
      );
      
      // Display the analysis
      console.log(chalk.yellow('📊 Best Opportunity Analysis:'));
      console.log(chalk.gray('═'.repeat(60)));
      
      arbitrageCalculator.displayAnalysis(analysis);
      
      // Show quick metrics
      const signal = arbitrageCalculator.getTradingSignal(
        cheapestExchange.ask,
        p2pPrice.bid,
        config.defaultAmount
      );
      
      console.log(chalk.yellow('🎯 Trading Signal:'));
      console.log(`   Signal: ${signal.signal === 'BUY' ? chalk.green(signal.signal) : chalk.yellow(signal.signal)}`);
      console.log(`   Reason: ${signal.reason}`);
      console.log(`   Risk: ${signal.riskLevel}`);
      
      // Calculate different amounts
      console.log(chalk.yellow('\n💰 Profit at Different Amounts:'));
      const amounts = [50, 100, 200, 500];
      amounts.forEach(amount => {
        const result = arbitrageCalculator.quickProfitCheck(
          cheapestExchange.ask,
          p2pPrice.bid,
          amount
        );
        const color = result.profitable ? chalk.green : chalk.red;
        console.log(`   ${amount} USDT: ${color(`₹${result.netProfit.toFixed(2)} (${result.roi.toFixed(2)}% ROI)`)}`);
      });
      
      // Break-even analysis
      const breakEven = arbitrageCalculator.getBreakEvenPrice(cheapestExchange.ask, config.defaultAmount);
      console.log(chalk.yellow('\n📈 Break-even Analysis:'));
      console.log(`   Break-even sell price: ₹${breakEven.toFixed(2)}`);
      console.log(`   Current P2P price: ₹${p2pPrice.bid.toFixed(2)}`);
      console.log(`   Margin above break-even: ₹${(p2pPrice.bid - breakEven).toFixed(2)}`);
      
      // Target profit analysis
      const targetProfits = [100, 200, 500];
      console.log(chalk.yellow('\n🎯 Required Prices for Target Profits:'));
      targetProfits.forEach(target => {
        const required = arbitrageCalculator.getRequiredSellPrice(
          cheapestExchange.ask,
          config.defaultAmount,
          target
        );
        const achievable = p2pPrice.bid >= required;
        console.log(`   ₹${target} profit needs: ₹${required.toFixed(2)} ${achievable ? chalk.green('✓ Achievable') : chalk.red('✗ Not achievable')}`);
      });
    }

    // Show all current prices
    console.log(chalk.yellow('\n📊 Live Market Prices:'));
    console.log(chalk.gray('─'.repeat(60)));
    sortedPrices.forEach(price => {
      const isCheapest = price === cheapestExchange;
      const isP2P = price.exchange === 'binance_p2p';
      const marker = isCheapest ? chalk.green(' ← Buy here') : isP2P ? chalk.yellow(' ← Sell here') : '';
      
      console.log(
        `${price.exchange.padEnd(15)} | ` +
        `Bid: ₹${price.bid.toFixed(2)} | ` +
        `Ask: ₹${price.ask.toFixed(2)}${marker}`
      );
    });

    // Statistics
    const runtime = Math.floor((Date.now() - startTime) / 1000);
    console.log(chalk.gray(`\n⏱️  Runtime: ${runtime}s | Opportunities analyzed: ${totalOpportunities}`));
    console.log(chalk.gray('Press Ctrl+C to stop\n'));

  }, config.checkInterval);

  // Handle shutdown
  process.on('SIGINT', async () => {
    console.log(chalk.yellow('\n\n👋 Shutting down integrated monitor...'));
    
    clearInterval(displayInterval);
    priceMonitor.stop();
    
    // Show session summary
    console.log(chalk.green('\n📊 Session Summary:'));
    console.log(`Total opportunities analyzed: ${totalOpportunities}`);
    
    if (bestOpportunity) {
      const finalAnalysis = arbitrageCalculator.calculateProfit(
        bestOpportunity.buyPrice,
        bestOpportunity.sellPrice,
        config.defaultAmount
      );
      console.log(`Best opportunity: ${bestOpportunity.buyExchange} → ${bestOpportunity.sellExchange}`);
      console.log(`Maximum profit found: ₹${finalAnalysis.netProfit.toFixed(2)} (${finalAnalysis.roi.toFixed(2)}% ROI)`);
    }
    
    process.exit(0);
  });

  console.log(chalk.yellow('📡 Starting integrated monitoring with profitability calculator...'));
  console.log(chalk.gray(`Monitoring amount: ${config.defaultAmount} USDT`));
  console.log(chalk.gray(`Minimum profit threshold: ₹${config.minProfit}`));
  console.log(chalk.gray(`Auto-execution: ${config.autoExecute ? 'ENABLED' : 'DISABLED'}\n`));
}

// Run the integrated monitor
runIntegratedMonitor().catch(console.error);