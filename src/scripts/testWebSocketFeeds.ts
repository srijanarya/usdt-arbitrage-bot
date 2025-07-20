import chalk from 'chalk';
import { arbitrageDetector } from '../services/arbitrage/RealtimeArbitrageDetector';
import { PostgresService } from '../services/database/postgresService';

async function testWebSocketFeeds() {
  console.log(chalk.bgCyan.black(' 🚀 Real-time WebSocket Price Feed Test \n'));

  // Track statistics
  let priceUpdateCount = 0;
  let opportunityCount = 0;
  const startTime = Date.now();

  // Listen for arbitrage opportunities
  arbitrageDetector.on('arbitrageFound', (opportunity) => {
    opportunityCount++;
    console.log(chalk.bgYellow.black(`\n🎯 Opportunity #${opportunityCount} found!`));
  });

  // Start the detector
  arbitrageDetector.start();

  // Display live prices every 5 seconds
  const displayInterval = setInterval(async () => {
    console.clear();
    console.log(chalk.bgCyan.black(' 📊 Real-time USDT Arbitrage Monitor \n'));

    // Get current prices
    const prices = arbitrageDetector.getCurrentPrices();
    const connections = arbitrageDetector.getConnectionStatus();

    // Display connection status
    console.log(chalk.yellow('🔌 Connection Status:'));
    connections.forEach((isConnected, exchange) => {
      const status = isConnected ? chalk.green('✅ Connected') : chalk.red('❌ Disconnected');
      console.log(`  ${exchange}: ${status}`);
    });

    // Display current prices
    console.log(chalk.yellow('\n💹 Current Prices:'));
    const priceTable: any[] = [];
    
    prices.forEach((price) => {
      priceTable.push({
        Exchange: price.exchange,
        Symbol: price.symbol,
        Bid: `₹${price.bid.toFixed(2)}`,
        Ask: `₹${price.ask.toFixed(2)}`,
        Spread: `${((price.ask - price.bid) / price.bid * 100).toFixed(3)}%`,
        Time: price.timestamp.toLocaleTimeString()
      });
    });

    if (priceTable.length > 0) {
      console.table(priceTable);
    } else {
      console.log(chalk.gray('  Waiting for price data...'));
    }

    // Get recent opportunities from database
    try {
      const opportunities = await PostgresService.getRecentOpportunities(5);
      
      if (opportunities.length > 0) {
        console.log(chalk.yellow('\n🎯 Recent Arbitrage Opportunities:'));
        opportunities.forEach((opp, i) => {
          console.log(chalk.cyan(`\n${i + 1}. ${opp.buy_exchange} → ${opp.sell_exchange}`));
          console.log(chalk.gray(`   Buy: ₹${parseFloat(opp.buy_price).toFixed(2)} | Sell: ₹${parseFloat(opp.sell_price).toFixed(2)}`));
          console.log(chalk.green(`   Profit: ${parseFloat(opp.profit_percentage).toFixed(2)}% (₹${parseFloat(opp.net_profit).toFixed(2)})`));
          console.log(chalk.gray(`   Detected: ${new Date(opp.detected_at).toLocaleTimeString()}`));
        });
      }

      // Display stats
      const stats = await PostgresService.getDailyStats();
      if (stats) {
        console.log(chalk.yellow('\n📈 Today\'s Performance:'));
        console.log(chalk.gray(`  Total Volume: ₹${parseFloat(stats.total_volume).toLocaleString()}`));
        console.log(chalk.gray(`  Total Trades: ${stats.total_trades}`));
        console.log(chalk.green(`  Net Profit: ₹${parseFloat(stats.net_profit).toLocaleString()}`));
      }

    } catch (error) {
      console.error(chalk.red('Database error:', error.message));
    }

    // Runtime stats
    const runtime = Math.floor((Date.now() - startTime) / 1000);
    console.log(chalk.gray(`\n⏱️  Runtime: ${runtime}s | Opportunities found: ${opportunityCount}`));
    console.log(chalk.gray('Press Ctrl+C to stop monitoring'));

  }, 5000);

  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    console.log(chalk.yellow('\n\n👋 Shutting down...'));
    
    clearInterval(displayInterval);
    arbitrageDetector.stop();
    
    // Show final stats
    const finalStats = await PostgresService.getDailyStats();
    if (finalStats) {
      console.log(chalk.green('\n📊 Session Summary:'));
      console.log(chalk.gray(`Opportunities detected: ${opportunityCount}`));
      console.log(chalk.gray(`Today's profit: ₹${parseFloat(finalStats.net_profit).toLocaleString()}`));
    }
    
    process.exit(0);
  });

  // Test P2P integration
  console.log(chalk.cyan('\n🔍 Checking P2P prices...'));
  setTimeout(() => {
    console.log(chalk.gray('WebSocket feeds starting...'));
  }, 2000);
}

// Run the test
testWebSocketFeeds().catch(console.error);