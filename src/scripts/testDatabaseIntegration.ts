import { PostgresService } from '../services/database/postgresService';
import chalk from 'chalk';

async function testDatabaseIntegration() {
  console.log(chalk.cyan('🧪 Testing Database Integration...\n'));

  try {
    // 1. Test saving price data
    console.log(chalk.yellow('1️⃣ Testing price data insertion...'));
    const priceId = await PostgresService.savePriceData(
      'binance',
      'USDT/INR',
      94.50,
      94.79
    );
    console.log(chalk.green(`✅ Saved price data with ID: ${priceId}`));

    // 2. Test saving arbitrage opportunity
    console.log(chalk.yellow('\n2️⃣ Testing arbitrage opportunity...'));
    const oppId = await PostgresService.saveArbitrageOpportunity({
      type: 'simple',
      buyExchange: 'coindcx',
      sellExchange: 'binance_p2p',
      symbol: 'USDT/INR',
      buyPrice: 88.50,
      sellPrice: 94.79,
      grossProfit: 6.29,
      netProfit: 6.10,
      profitPercentage: 7.10
    });
    console.log(chalk.green(`✅ Saved arbitrage opportunity with ID: ${oppId}`));

    // 3. Test saving P2P order
    console.log(chalk.yellow('\n3️⃣ Testing P2P order...'));
    const p2pId = await PostgresService.saveP2POrder({
      platform: 'binance',
      orderId: 'TEST_' + Date.now(),
      type: 'sell',
      paymentMethod: 'UPI',
      price: 94.79,
      quantity: 100,
      minAmount: 1000,
      maxAmount: 50000,
      merchantName: 'TestMerchant',
      completionRate: 98.5
    });
    console.log(chalk.green(`✅ Saved P2P order with ID: ${p2pId}`));

    // 4. Test getting latest prices
    console.log(chalk.yellow('\n4️⃣ Testing price retrieval...'));
    const prices = await PostgresService.getLatestPrices();
    console.log(chalk.green(`✅ Retrieved ${prices.length} price records`));
    if (prices.length > 0) {
      console.log(chalk.gray('Latest price:'), prices[0]);
    }

    // 5. Test getting opportunities
    console.log(chalk.yellow('\n5️⃣ Testing opportunity retrieval...'));
    const opportunities = await PostgresService.getRecentOpportunities(5);
    console.log(chalk.green(`✅ Retrieved ${opportunities.length} opportunities`));
    if (opportunities.length > 0) {
      console.log(chalk.gray('Best opportunity:'));
      console.log(chalk.gray(`  Buy ${opportunities[0].buy_exchange} @ ₹${opportunities[0].buy_price}`));
      console.log(chalk.gray(`  Sell ${opportunities[0].sell_exchange} @ ₹${opportunities[0].sell_price}`));
      console.log(chalk.green(`  Profit: ${opportunities[0].profit_percentage}%`));
    }

    // 6. Test daily stats
    console.log(chalk.yellow('\n6️⃣ Testing daily stats...'));
    await PostgresService.updateDailyStats({
      volume: 10000,
      grossProfit: 629,
      netProfit: 610,
      successful: true
    });
    const stats = await PostgresService.getDailyStats();
    console.log(chalk.green('✅ Daily stats updated'));
    if (stats) {
      console.log(chalk.gray(`Today's volume: ₹${stats.total_volume}`));
      console.log(chalk.gray(`Today's profit: ₹${stats.net_profit}`));
    }

    console.log(chalk.bgGreen.black('\n 🎉 All database tests passed! \n'));
    console.log(chalk.cyan('PostgreSQL integration is working perfectly!'));
    console.log(chalk.gray('You can now start logging real-time data.'));

  } catch (error) {
    console.error(chalk.red('❌ Test failed:', error.message));
  } finally {
    // Close the connection pool
    process.exit(0);
  }
}

// Run the test
testDatabaseIntegration();