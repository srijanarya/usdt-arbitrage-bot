import { LiveRateFetcher } from '../services/liveRateFetcher';
import chalk from 'chalk';
import Table from 'cli-table3';

async function testLiveRateFetcher() {
  console.log(chalk.cyan.bold('Testing Live Rate Fetcher\n'));

  const fetcher = new LiveRateFetcher({
    interval: 3000, // 3 seconds
    enableWebSocket: false, // Start with REST API only
    storeHistory: true,
    alertThreshold: 0.5 // Alert on 0.5% profit
  });

  // Event listeners
  fetcher.on('started', () => {
    console.log(chalk.green('✓ Rate fetcher started'));
  });

  fetcher.on('rateUpdate', ({ exchange, rate }) => {
    console.log(chalk.blue(`Rate update from ${exchange}: ₹${rate.last.toFixed(2)}`));
  });

  fetcher.on('arbitrageFound', (opportunities) => {
    console.log(chalk.yellow.bold('\n🚨 Arbitrage Opportunities Found!'));
    
    const table = new Table({
      head: ['Route', 'Buy Price', 'Sell Price', 'Profit %', 'Net Profit'],
      colWidths: [25, 12, 12, 10, 12]
    });

    opportunities.slice(0, 3).forEach(opp => {
      table.push([
        `${opp.buyExchange} → ${opp.sellExchange}`,
        `₹${opp.buyPrice.toFixed(2)}`,
        `₹${opp.sellPrice.toFixed(2)}`,
        `${opp.profitPercentage.toFixed(2)}%`,
        `₹${opp.profit.toFixed(2)}`
      ]);
    });

    console.log(table.toString());
  });

  fetcher.on('fetchError', ({ exchange, error }) => {
    console.log(chalk.red(`✗ Error fetching from ${exchange}: ${error.message}`));
  });

  // Start the fetcher
  fetcher.start();

  // Display status every 10 seconds
  setInterval(() => {
    const status = fetcher.getStatus();
    const { bestBuy, bestSell } = fetcher.getBestPrices();

    console.log(chalk.cyan('\n━'.repeat(60)));
    console.log(chalk.cyan.bold('Status Update'));
    console.log(chalk.gray(`Active Exchanges: ${status.activeExchanges}/${status.totalExchanges}`));
    console.log(chalk.gray(`Last Update: ${status.lastUpdate?.toLocaleTimeString() || 'N/A'}`));

    if (bestBuy && bestSell) {
      console.log(chalk.green(`Best Buy: ${bestBuy.exchange} @ ₹${bestBuy.ask.toFixed(2)}`));
      console.log(chalk.red(`Best Sell: ${bestSell.exchange} @ ₹${bestSell.bid.toFixed(2)}`));
      
      const spread = ((bestSell.bid - bestBuy.ask) / bestBuy.ask * 100).toFixed(2);
      console.log(chalk.yellow(`Max Spread: ${spread}%`));
    }

    // Show average price
    const avgPrice = fetcher.getAveragePrice();
    if (avgPrice > 0) {
      console.log(chalk.magenta(`Average Price: ₹${avgPrice.toFixed(2)}`));
    }

    // Show volatility for each exchange
    console.log(chalk.cyan('\nVolatility (last 30 min):'));
    status.activeExchanges > 0 && fetcher.getCurrentRates().forEach(rate => {
      const volatility = fetcher.getVolatility(rate.exchange, 30);
      if (volatility !== null) {
        console.log(`  ${rate.exchange}: ±₹${volatility.toFixed(2)}`);
      }
    });
  }, 10000);

  // Test specific methods after 5 seconds
  setTimeout(() => {
    console.log(chalk.cyan.bold('\nTesting specific methods:'));

    // Get current rates
    const rates = fetcher.getCurrentRates();
    console.log(`\nCurrent rates count: ${rates.length}`);

    // Get specific exchange rate
    const binanceRate = fetcher.getRate('binance');
    if (binanceRate) {
      console.log(`\nBinance rate: ₹${binanceRate.last.toFixed(2)}`);
      console.log(`Spread: ${fetcher.getSpread('binance')?.toFixed(3)}%`);
    }

    // Get rate history
    const history = fetcher.getRateHistory('zebpay');
    console.log(`\nZebPay history entries: ${history.length}`);
  }, 5000);

  // Stop after 1 minute
  setTimeout(() => {
    console.log(chalk.red('\nStopping rate fetcher...'));
    fetcher.stop();
    process.exit(0);
  }, 60000);
}

// Handle errors
process.on('unhandledRejection', (error) => {
  console.error(chalk.red('Unhandled rejection:'), error);
  process.exit(1);
});

// Run the test
testLiveRateFetcher().catch(console.error);