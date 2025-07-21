import chalk from 'chalk';
import { profitTracker } from '../services/reporting/ProfitTrackingService';
import { riskManager } from '../services/trading/RiskManagementService';
import { telegramAlert } from '../services/telegram/TelegramAlertService';
import dotenv from 'dotenv';

dotenv.config();

async function generateTradingReports() {
  console.log(chalk.bgCyan.black(' 📊 Generating Trading Reports \n'));
  
  try {
    // Generate daily report
    console.log(chalk.yellow('Generating daily report...'));
    const dailyReport = await profitTracker.generateDailyReport();
    
    console.log(chalk.cyan('\n📈 Daily Trading Report:'));
    console.log(chalk.gray('═'.repeat(50)));
    console.log(`Date: ${new Date().toLocaleDateString()}`);
    console.log(`Total Trades: ${dailyReport.totalTrades}`);
    console.log(`Successful: ${dailyReport.successfulTrades}`);
    console.log(`Failed: ${dailyReport.failedTrades}`);
    console.log(`Total Volume: ₹${dailyReport.totalVolume.toFixed(2)}`);
    console.log(`Gross Profit: ₹${dailyReport.grossProfit.toFixed(2)}`);
    console.log(`Total Fees: ₹${dailyReport.totalFees.toFixed(2)}`);
    console.log(`Net Profit: ₹${dailyReport.netProfit.toFixed(2)}`);
    console.log(`Average Profit/Trade: ₹${dailyReport.averageProfit.toFixed(2)}`);
    
    if (dailyReport.bestTrade) {
      console.log(chalk.green(`\nBest Trade: ${dailyReport.bestTrade.buyExchange} → ${dailyReport.bestTrade.sellExchange}`));
      console.log(chalk.green(`  Profit: ₹${dailyReport.bestTrade.actualProfit.toFixed(2)}`));
    }
    
    if (dailyReport.worstTrade) {
      console.log(chalk.red(`\nWorst Trade: ${dailyReport.worstTrade.buyExchange} → ${dailyReport.worstTrade.sellExchange}`));
      console.log(chalk.red(`  Profit: ₹${dailyReport.worstTrade.actualProfit.toFixed(2)}`));
    }
    
    // Generate weekly summary
    console.log(chalk.yellow('\n\nGenerating weekly summary...'));
    const weeklySummary = await profitTracker.generateWeeklySummary();
    console.log(weeklySummary);
    
    // Generate risk report
    console.log(chalk.yellow('\nGenerating risk report...'));
    const riskReport = riskManager.generateRiskReport();
    console.log(riskReport);
    
    // Send summary to Telegram if configured
    if (process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID) {
      console.log(chalk.yellow('\nSending report summary to Telegram...'));
      
      const metrics = riskManager.getMetrics();
      const winRate = metrics.totalTrades > 0 
        ? (metrics.winningTrades / metrics.totalTrades * 100).toFixed(2)
        : '0';
      
      await telegramAlert.sendSystemAlert(
        '📊 Trading Report Generated',
        `Daily Net Profit: ₹${dailyReport.netProfit.toFixed(2)}\n` +
        `Total Trades: ${dailyReport.totalTrades}\n` +
        `Win Rate: ${winRate}%\n` +
        `Current Exposure: ₹${metrics.currentExposure.toFixed(2)}`
      );
      
      console.log(chalk.green('✅ Report sent to Telegram'));
    }
    
    console.log(chalk.green('\n✅ All reports generated successfully'));
    
  } catch (error) {
    console.error(chalk.red('❌ Error generating reports:', error.message));
  }
}

// Run report generation
generateTradingReports()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });