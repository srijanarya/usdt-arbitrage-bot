import chalk from 'chalk';
import { PostgresService } from '../database/postgresService';
import { telegramAlert } from '../telegram/TelegramAlertService';
import fs from 'fs/promises';
import path from 'path';

interface TradeRecord {
  id: string;
  timestamp: Date;
  buyExchange: string;
  sellExchange: string;
  buyPrice: number;
  sellPrice: number;
  amount: number;
  expectedProfit: number;
  actualProfit: number;
  fees: number;
  executionTime: number;
  status: 'completed' | 'failed';
}

interface DailyReport {
  date: Date;
  totalTrades: number;
  successfulTrades: number;
  failedTrades: number;
  totalVolume: number;
  grossProfit: number;
  totalFees: number;
  netProfit: number;
  averageProfit: number;
  bestTrade: TradeRecord | null;
  worstTrade: TradeRecord | null;
}

interface PerformanceMetrics {
  winRate: number;
  averageROI: number;
  sharpeRatio: number;
  maxDrawdown: number;
  profitFactor: number;
  averageExecutionTime: number;
}

export class ProfitTrackingService {
  private trades: TradeRecord[] = [];
  private dailyReports: Map<string, DailyReport> = new Map();
  private readonly reportsDir = path.join(process.cwd(), 'reports');

  constructor() {
    this.ensureReportsDirectory();
    this.loadHistoricalData();
  }

  /**
   * Record a completed trade
   */
  async recordTrade(trade: Partial<TradeRecord> & { id: string }) {
    const tradeRecord: TradeRecord = {
      id: trade.id,
      timestamp: trade.timestamp || new Date(),
      buyExchange: trade.buyExchange || '',
      sellExchange: trade.sellExchange || '',
      buyPrice: trade.buyPrice || 0,
      sellPrice: trade.sellPrice || 0,
      amount: trade.amount || 0,
      expectedProfit: trade.expectedProfit || 0,
      actualProfit: trade.actualProfit || 0,
      fees: trade.fees || 0,
      executionTime: trade.executionTime || 0,
      status: trade.status || 'completed'
    };

    this.trades.push(tradeRecord);
    
    // Update daily report
    await this.updateDailyReport(tradeRecord);
    
    // Save to database
    await this.saveTradeToDatabase(tradeRecord);
    
    // Check for milestones
    await this.checkMilestones();
  }

  /**
   * Generate daily report
   */
  async generateDailyReport(date: Date = new Date()): Promise<DailyReport> {
    const dateKey = this.getDateKey(date);
    const dayTrades = this.trades.filter(t => 
      this.getDateKey(t.timestamp) === dateKey
    );

    const successfulTrades = dayTrades.filter(t => t.status === 'completed');
    const failedTrades = dayTrades.filter(t => t.status === 'failed');

    const totalVolume = successfulTrades.reduce((sum, t) => sum + (t.amount * t.buyPrice), 0);
    const grossProfit = successfulTrades.reduce((sum, t) => sum + t.actualProfit, 0);
    const totalFees = successfulTrades.reduce((sum, t) => sum + t.fees, 0);
    const netProfit = grossProfit - totalFees;

    const bestTrade = successfulTrades.length > 0 
      ? successfulTrades.reduce((best, t) => t.actualProfit > best.actualProfit ? t : best)
      : null;

    const worstTrade = successfulTrades.length > 0
      ? successfulTrades.reduce((worst, t) => t.actualProfit < worst.actualProfit ? t : worst)
      : null;

    const report: DailyReport = {
      date,
      totalTrades: dayTrades.length,
      successfulTrades: successfulTrades.length,
      failedTrades: failedTrades.length,
      totalVolume,
      grossProfit,
      totalFees,
      netProfit,
      averageProfit: successfulTrades.length > 0 ? netProfit / successfulTrades.length : 0,
      bestTrade,
      worstTrade
    };

    this.dailyReports.set(dateKey, report);
    return report;
  }

  /**
   * Generate weekly summary
   */
  async generateWeeklySummary(): Promise<string> {
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000);
    
    const weeklyTrades = this.trades.filter(t => 
      t.timestamp >= startDate && t.timestamp <= endDate
    );

    const metrics = this.calculatePerformanceMetrics(weeklyTrades);
    
    const summary = `
📊 Weekly Trading Summary
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📅 Period: ${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}

📈 Performance Metrics:
  • Total Trades: ${weeklyTrades.length}
  • Win Rate: ${(metrics.winRate * 100).toFixed(2)}%
  • Average ROI: ${(metrics.averageROI * 100).toFixed(2)}%
  • Sharpe Ratio: ${metrics.sharpeRatio.toFixed(2)}
  • Max Drawdown: ${(metrics.maxDrawdown * 100).toFixed(2)}%
  • Profit Factor: ${metrics.profitFactor.toFixed(2)}

💰 Financial Summary:
  • Total Volume: ₹${this.calculateTotalVolume(weeklyTrades).toFixed(2)}
  • Gross Profit: ₹${this.calculateGrossProfit(weeklyTrades).toFixed(2)}
  • Net Profit: ₹${this.calculateNetProfit(weeklyTrades).toFixed(2)}
  • Average Profit/Trade: ₹${this.calculateAverageProfit(weeklyTrades).toFixed(2)}

⚡ Execution Stats:
  • Average Time: ${metrics.averageExecutionTime.toFixed(1)}s
  • Fastest Trade: ${this.getFastestTrade(weeklyTrades)?.executionTime.toFixed(1)}s
  • Success Rate: ${((weeklyTrades.filter(t => t.status === 'completed').length / weeklyTrades.length) * 100).toFixed(1)}%

🏆 Top Performing Routes:
${this.getTopRoutes(weeklyTrades)}

📊 Daily Breakdown:
${this.getDailyBreakdown(startDate, endDate)}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    `;

    // Save report to file
    await this.saveReportToFile('weekly', summary);
    
    return summary;
  }

  /**
   * Calculate performance metrics
   */
  private calculatePerformanceMetrics(trades: TradeRecord[]): PerformanceMetrics {
    const completedTrades = trades.filter(t => t.status === 'completed');
    const winningTrades = completedTrades.filter(t => t.actualProfit > 0);
    const losingTrades = completedTrades.filter(t => t.actualProfit <= 0);

    const winRate = completedTrades.length > 0 
      ? winningTrades.length / completedTrades.length 
      : 0;

    const returns = completedTrades.map(t => t.actualProfit / (t.amount * t.buyPrice));
    const averageROI = returns.length > 0 
      ? returns.reduce((sum, r) => sum + r, 0) / returns.length 
      : 0;

    // Sharpe Ratio calculation (simplified)
    const avgReturn = averageROI;
    const stdDev = this.calculateStandardDeviation(returns);
    const sharpeRatio = stdDev > 0 ? (avgReturn / stdDev) * Math.sqrt(252) : 0; // Annualized

    // Max Drawdown
    const maxDrawdown = this.calculateMaxDrawdown(trades);

    // Profit Factor
    const totalWins = winningTrades.reduce((sum, t) => sum + t.actualProfit, 0);
    const totalLosses = Math.abs(losingTrades.reduce((sum, t) => sum + t.actualProfit, 0));
    const profitFactor = totalLosses > 0 ? totalWins / totalLosses : totalWins > 0 ? Infinity : 0;

    // Average execution time
    const executionTimes = completedTrades.map(t => t.executionTime);
    const averageExecutionTime = executionTimes.length > 0
      ? executionTimes.reduce((sum, t) => sum + t, 0) / executionTimes.length
      : 0;

    return {
      winRate,
      averageROI,
      sharpeRatio,
      maxDrawdown,
      profitFactor,
      averageExecutionTime
    };
  }

  /**
   * Generate monthly report
   */
  async generateMonthlyReport(): Promise<void> {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const monthlyTrades = this.trades.filter(t => 
      t.timestamp >= startOfMonth && t.timestamp <= endOfMonth
    );

    const report = await this.generateDetailedReport(monthlyTrades, 'monthly');
    
    // Send to Telegram
    await telegramAlert.sendSystemAlert(
      `Monthly Report - ${now.toLocaleString('default', { month: 'long', year: 'numeric' })}`,
      `Total Trades: ${monthlyTrades.length}\nNet Profit: ₹${this.calculateNetProfit(monthlyTrades).toFixed(2)}\nWin Rate: ${(this.calculatePerformanceMetrics(monthlyTrades).winRate * 100).toFixed(2)}%`
    );
  }

  /**
   * Get profit/loss for a specific period
   */
  getPnL(startDate: Date, endDate: Date): number {
    const periodTrades = this.trades.filter(t => 
      t.timestamp >= startDate && t.timestamp <= endDate && t.status === 'completed'
    );
    
    return this.calculateNetProfit(periodTrades);
  }

  /**
   * Get top performing trading routes
   */
  getTopRoutes(trades: TradeRecord[]): string {
    const routeMap = new Map<string, { count: number; profit: number }>();
    
    trades.filter(t => t.status === 'completed').forEach(trade => {
      const route = `${trade.buyExchange} → ${trade.sellExchange}`;
      const existing = routeMap.get(route) || { count: 0, profit: 0 };
      routeMap.set(route, {
        count: existing.count + 1,
        profit: existing.profit + trade.actualProfit
      });
    });

    const sortedRoutes = Array.from(routeMap.entries())
      .sort((a, b) => b[1].profit - a[1].profit)
      .slice(0, 5);

    return sortedRoutes.map(([ route, data ], index) => 
      `  ${index + 1}. ${route}: ₹${data.profit.toFixed(2)} (${data.count} trades)`
    ).join('\n');
  }

  /**
   * Calculate standard deviation
   */
  private calculateStandardDeviation(values: number[]): number {
    if (values.length === 0) return 0;
    
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
    const variance = squaredDiffs.reduce((sum, val) => sum + val, 0) / values.length;
    
    return Math.sqrt(variance);
  }

  /**
   * Calculate maximum drawdown
   */
  private calculateMaxDrawdown(trades: TradeRecord[]): number {
    if (trades.length === 0) return 0;

    let peak = 0;
    let maxDrawdown = 0;
    let runningTotal = 0;

    trades.forEach(trade => {
      runningTotal += trade.actualProfit;
      if (runningTotal > peak) {
        peak = runningTotal;
      }
      const drawdown = (peak - runningTotal) / peak;
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
      }
    });

    return maxDrawdown;
  }

  /**
   * Helper methods
   */
  private calculateTotalVolume(trades: TradeRecord[]): number {
    return trades
      .filter(t => t.status === 'completed')
      .reduce((sum, t) => sum + (t.amount * t.buyPrice), 0);
  }

  private calculateGrossProfit(trades: TradeRecord[]): number {
    return trades
      .filter(t => t.status === 'completed')
      .reduce((sum, t) => sum + t.actualProfit, 0);
  }

  private calculateNetProfit(trades: TradeRecord[]): number {
    return trades
      .filter(t => t.status === 'completed')
      .reduce((sum, t) => sum + t.actualProfit - t.fees, 0);
  }

  private calculateAverageProfit(trades: TradeRecord[]): number {
    const completed = trades.filter(t => t.status === 'completed');
    return completed.length > 0 
      ? this.calculateNetProfit(completed) / completed.length 
      : 0;
  }

  private getFastestTrade(trades: TradeRecord[]): TradeRecord | null {
    const completed = trades.filter(t => t.status === 'completed');
    return completed.length > 0
      ? completed.reduce((fastest, t) => t.executionTime < fastest.executionTime ? t : fastest)
      : null;
  }

  private getDailyBreakdown(startDate: Date, endDate: Date): string {
    const breakdown: string[] = [];
    const current = new Date(startDate);
    
    while (current <= endDate) {
      const dateKey = this.getDateKey(current);
      const report = this.dailyReports.get(dateKey);
      
      if (report && report.totalTrades > 0) {
        breakdown.push(
          `  ${current.toLocaleDateString()}: ` +
          `${report.successfulTrades}/${report.totalTrades} trades, ` +
          `₹${report.netProfit.toFixed(2)} profit`
        );
      }
      
      current.setDate(current.getDate() + 1);
    }
    
    return breakdown.join('\n');
  }

  private getDateKey(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  private async updateDailyReport(trade: TradeRecord) {
    const dateKey = this.getDateKey(trade.timestamp);
    await this.generateDailyReport(trade.timestamp);
  }

  private async saveTradeToDatabase(trade: TradeRecord) {
    try {
      // Save to PostgreSQL (implementation depends on your schema)
      console.log(chalk.gray(`Saving trade ${trade.id} to database`));
    } catch (error) {
      console.error(chalk.red('Failed to save trade to database:', error));
    }
  }

  private async checkMilestones() {
    const totalProfit = this.calculateNetProfit(this.trades);
    
    // Check profit milestones
    const milestones = [1000, 5000, 10000, 50000, 100000];
    for (const milestone of milestones) {
      if (totalProfit >= milestone && !this.hasReachedMilestone(milestone)) {
        await telegramAlert.sendSystemAlert(
          '🎉 Milestone Achieved!',
          `Total profit has reached ₹${milestone.toLocaleString()}!\nKeep up the great work!`
        );
        this.recordMilestone(milestone);
      }
    }
  }

  private hasReachedMilestone(amount: number): boolean {
    // In production, would check database
    return false;
  }

  private recordMilestone(amount: number) {
    // In production, would save to database
    console.log(chalk.green(`🎉 Milestone reached: ₹${amount}`));
  }

  private async ensureReportsDirectory() {
    try {
      await fs.mkdir(this.reportsDir, { recursive: true });
    } catch (error) {
      console.error(chalk.red('Failed to create reports directory:', error));
    }
  }

  private async saveReportToFile(type: string, content: string) {
    try {
      const filename = `${type}-report-${new Date().toISOString().split('T')[0]}.txt`;
      const filepath = path.join(this.reportsDir, filename);
      await fs.writeFile(filepath, content, 'utf-8');
      console.log(chalk.green(`Report saved to ${filepath}`));
    } catch (error) {
      console.error(chalk.red('Failed to save report:', error));
    }
  }

  private async loadHistoricalData() {
    try {
      // In production, would load from database
      console.log(chalk.gray('Loading historical trade data...'));
    } catch (error) {
      console.error(chalk.red('Failed to load historical data:', error));
    }
  }

  private async generateDetailedReport(trades: TradeRecord[], type: string): Promise<string> {
    const metrics = this.calculatePerformanceMetrics(trades);
    const totalVolume = this.calculateTotalVolume(trades);
    const netProfit = this.calculateNetProfit(trades);
    
    // Generate detailed report content
    return `${type.toUpperCase()} REPORT\nTrades: ${trades.length}\nVolume: ₹${totalVolume.toFixed(2)}\nProfit: ₹${netProfit.toFixed(2)}`;
  }
}

// Export singleton
export const profitTracker = new ProfitTrackingService();