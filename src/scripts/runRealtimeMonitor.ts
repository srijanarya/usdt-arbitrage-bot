import chalk from 'chalk';
import { priceMonitor } from '../services/websocket/SimpleWebSocketMonitor';
import { PostgresService } from '../services/database/postgresService';

async function runRealtimeMonitor() {
  console.log(chalk.bgCyan.black(' 🚀 USDT Real-time Arbitrage Monitor \n'));
  console.log(chalk.gray('Using REST API polling for reliable data feeds\n'));

  let opportunityCount = 0;
  const startTime = Date.now();

  // Listen for arbitrage opportunities
  priceMonitor.on('arbitrageFound', (opportunity) => {
    opportunityCount++;
  });

  // Start monitoring
  priceMonitor.start();

  // Display dashboard every 5 seconds
  const displayInterval = setInterval(async () => {
    console.clear();
    console.log(chalk.bgCyan.black(' 💹 USDT Arbitrage Monitor - Live Prices \n'));

    // Get current prices
    const prices = priceMonitor.getCurrentPrices();

    // Display prices in a table format
    console.log(chalk.yellow('📊 Current Market Prices:'));
    console.log(chalk.gray('━'.repeat(60)));
    
    const sortedPrices = Array.from(prices.values()).sort((a, b) => a.ask - b.ask);
    
    sortedPrices.forEach((price, index) => {
      const spread = ((price.ask - price.bid) / price.bid * 100).toFixed(3);
      const isCheapest = index === 0;
      const isBestSell = price.exchange === 'binance_p2p';
      
      const marker = isCheapest ? chalk.green(' ⬇️ CHEAPEST') : 
                    isBestSell ? chalk.yellow(' ⬆️ BEST SELL') : '';
      
      console.log(
        `${chalk.cyan(price.exchange.padEnd(15))} | ` +
        `Bid: ${chalk.red(`₹${price.bid.toFixed(2)}`)} | ` +
        `Ask: ${chalk.green(`₹${price.ask.toFixed(2)}`)} | ` +
        `Spread: ${spread}%${marker}`
      );
    });
    
    console.log(chalk.gray('━'.repeat(60)));

    // Calculate potential arbitrage
    if (sortedPrices.length >= 2) {
      const cheapestBuy = sortedPrices.find(p => p.exchange !== 'binance_p2p');
      const p2pSell = sortedPrices.find(p => p.exchange === 'binance_p2p');
      
      if (cheapestBuy && p2pSell) {
        const profit = p2pSell.bid - cheapestBuy.ask;
        const profitPercent = (profit / cheapestBuy.ask * 100).toFixed(2);
        
        console.log(chalk.yellow('\n💰 Best Arbitrage Opportunity:'));
        console.log(chalk.gray(`Buy from ${cheapestBuy.exchange}: ₹${cheapestBuy.ask.toFixed(2)}`));
        console.log(chalk.gray(`Sell on P2P: ₹${p2pSell.bid.toFixed(2)}`));
        
        if (profit > 0) {
          console.log(chalk.green(`Profit: ₹${profit.toFixed(2)} (${profitPercent}%) ✅`));
          console.log(chalk.gray(`On ₹10,000: Profit ₹${(profit * 10000 / cheapestBuy.ask).toFixed(0)}`));
        } else {
          console.log(chalk.red(`Loss: ₹${Math.abs(profit).toFixed(2)} (${profitPercent}%) ❌`));
        }
      }
    }

    // Get recent opportunities from database
    try {
      const opportunities = await PostgresService.getRecentOpportunities(3);
      
      if (opportunities.length > 0) {
        console.log(chalk.yellow('\n🎯 Recent Profitable Opportunities:'));
        opportunities.forEach((opp, i) => {
          const time = new Date(opp.detected_at).toLocaleTimeString();
          console.log(
            chalk.gray(`${i + 1}. ${time} - `) +
            chalk.cyan(`${opp.buy_exchange} → ${opp.sell_exchange}: `) +
            chalk.green(`${parseFloat(opp.profit_percentage).toFixed(2)}%`)
          );
        });
      }

      // Today's stats
      const stats = await PostgresService.getDailyStats();
      if (stats && parseFloat(stats.total_volume) > 0) {
        console.log(chalk.yellow('\n📈 Today\'s Performance:'));
        console.log(chalk.gray(`Volume: ₹${parseFloat(stats.total_volume).toLocaleString()} | ` +
                             `Trades: ${stats.total_trades} | ` +
                             `Profit: ₹${parseFloat(stats.net_profit).toLocaleString()}`));
      }

    } catch (error) {
      // Ignore database errors in display
    }

    // Runtime info
    const runtime = Math.floor((Date.now() - startTime) / 1000);
    const mins = Math.floor(runtime / 60);
    const secs = runtime % 60;
    
    console.log(chalk.gray(`\n⏱️  Runtime: ${mins}m ${secs}s | Opportunities: ${opportunityCount}`));
    console.log(chalk.gray('Press Ctrl+C to stop\n'));

  }, 5000);

  // Initial message
  console.log(chalk.yellow('📡 Fetching live prices from exchanges...'));
  console.log(chalk.gray('Updates every 5-15 seconds\n'));

  // Graceful shutdown
  process.on('SIGINT', async () => {
    console.log(chalk.yellow('\n\n👋 Shutting down...'));
    
    clearInterval(displayInterval);
    priceMonitor.stop();
    
    const finalStats = await PostgresService.getDailyStats();
    if (finalStats && opportunityCount > 0) {
      console.log(chalk.green('\n✅ Session Complete'));
      console.log(chalk.gray(`Opportunities found: ${opportunityCount}`));
      console.log(chalk.gray(`Today's total profit: ₹${parseFloat(finalStats.net_profit).toLocaleString()}`));
    }
    
    process.exit(0);
  });
}

// Run the monitor
runRealtimeMonitor().catch(console.error);