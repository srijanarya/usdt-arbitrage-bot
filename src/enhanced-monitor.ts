import express from 'express';
import chalk from 'chalk';
import { MultiExchangeManager } from './services/enhanced/MultiExchangeManager';
import { RiskManager } from './services/RiskManager';
import { TriangularArbitrageEngine } from './services/enhanced/TriangularArbitrage';
import { logger } from './utils/logger';
import TelegramBot from 'node-telegram-bot-api';
import dotenv from 'dotenv';

dotenv.config();

class EnhancedArbitrageBot {
  private app: express.Application;
  private exchangeManager: MultiExchangeManager;
  private riskManager: RiskManager;
  private triangularEngine: TriangularArbitrageEngine;
  private telegramBot: TelegramBot | null = null;
  private isRunning = false;
  private port = process.env.PORT || 3000;

  constructor() {
    this.app = express();
    this.exchangeManager = new MultiExchangeManager();
    this.riskManager = new RiskManager();
    this.triangularEngine = new TriangularArbitrageEngine();
    
    this.setupTelegram();
    this.setupExpress();
    this.setupEventHandlers();
  }

  private setupTelegram() {
    const token = process.env.TELEGRAM_BOT_TOKEN || '8070785411:AAFuGOlbn7UmB4B53mJQZey-EGaNMVKaeF0';
    if (token) {
      this.telegramBot = new TelegramBot(token, { polling: false });
      logger.info('Telegram bot initialized');
    }
  }

  private setupExpress() {
    this.app.use(express.json());
    this.app.use(express.static('public'));

    // API endpoints
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'ok',
        version: '2.0.0',
        uptime: process.uptime(),
        exchanges: Array.from(this.exchangeManager.exchanges.keys()),
      });
    });

    this.app.get('/api/opportunities', (req, res) => {
      const opportunities = this.exchangeManager.detectArbitrageOpportunities();
      res.json({
        success: true,
        count: opportunities.length,
        opportunities: opportunities.slice(0, 10),
      });
    });

    this.app.get('/api/balances', async (req, res) => {
      try {
        const balances = await this.exchangeManager.getAccountBalances();
        res.json({ success: true, balances });
      } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    this.app.get('/api/risk-status', (req, res) => {
      res.json({
        success: true,
        status: this.riskManager.getStatus(),
      });
    });

    // Enhanced dashboard
    this.app.get('/', (req, res) => {
      res.send(this.getDashboardHTML());
    });
  }

  private setupEventHandlers() {
    // Price updates
    this.exchangeManager.on('priceUpdate', (update) => {
      logger.debug(`Price update: ${update.exchange} ${update.symbol} - Bid: ${update.bid}, Ask: ${update.ask}`);
    });

    // Arbitrage opportunities
    this.exchangeManager.on('arbitrageOpportunity', async (opportunities) => {
      logger.info(`Found ${opportunities.length} arbitrage opportunities`);
      
      for (const opp of opportunities.slice(0, 3)) {
        // Validate with risk manager
        const validation = this.riskManager.validateTrade(opp, 10000);
        
        if (validation.isValid && opp.profitPercent > 0.3) {
          await this.sendTelegramAlert(opp);
        }
      }
    });

    // Risk alerts
    this.riskManager.on('riskAlert', async (alert) => {
      logger.warn(`Risk Alert: ${alert.message}`);
      if (this.telegramBot) {
        await this.telegramBot.sendMessage(
          process.env.TELEGRAM_CHAT_ID || '1271429958',
          `🚨 *Risk Alert*\n\n${alert.message}`,
          { parse_mode: 'Markdown' }
        );
      }
    });

    // Error handling
    this.exchangeManager.on('error', (error) => {
      logger.error('Exchange error:', error);
    });
  }

  private async sendTelegramAlert(opportunity: any) {
    if (!this.telegramBot) return;

    const message = `
💰 *ARBITRAGE OPPORTUNITY*

*Type:* ${opportunity.type.toUpperCase()}
*Buy:* ${opportunity.buyExchange} @ ₹${opportunity.buyPrice.toFixed(2)}
*Sell:* ${opportunity.sellExchange} @ ₹${opportunity.sellPrice.toFixed(2)}
*Profit:* ${opportunity.profitPercent.toFixed(3)}% (₹${(opportunity.profitPercent * 100).toFixed(2)} per ₹10,000)
*Volume:* ₹${opportunity.volume.toFixed(0)}

⏰ ${new Date().toLocaleTimeString('en-IN')}
    `;

    try {
      await this.telegramBot.sendMessage(
        process.env.TELEGRAM_CHAT_ID || '1271429958',
        message,
        { parse_mode: 'Markdown' }
      );
    } catch (error) {
      logger.error('Failed to send Telegram alert:', error);
    }
  }

  async start() {
    console.log(chalk.bgCyan.black('\n 🚀 ENHANCED USDT ARBITRAGE BOT V2.0 \n'));
    console.log(chalk.gray('Powered by CCXT with Multi-Exchange Support\n'));

    try {
      // Start monitoring
      await this.exchangeManager.startRealTimeMonitoring([
        'USDT/INR',
        'BTC/USDT',
        'ETH/USDT',
        'BNB/USDT'
      ]);

      // Start Express server
      this.app.listen(this.port, () => {
        console.log(chalk.green(`✅ Dashboard running at http://localhost:${this.port}`));
        console.log(chalk.green(`✅ API available at http://localhost:${this.port}/api/opportunities`));
      });

      this.isRunning = true;

      // Display status
      this.displayStatus();
      setInterval(() => this.displayStatus(), 30000);

      // Send startup notification
      if (this.telegramBot) {
        await this.telegramBot.sendMessage(
          process.env.TELEGRAM_CHAT_ID || '1271429958',
          `🚀 *Enhanced Arbitrage Bot Started*\n\nVersion: 2.0.0\nExchanges: ${Array.from(this.exchangeManager.exchanges.keys()).join(', ')}\nFeatures: CCXT, WebSockets, Triangular Arbitrage`,
          { parse_mode: 'Markdown' }
        );
      }

    } catch (error) {
      logger.error('Failed to start bot:', error);
      process.exit(1);
    }
  }

  private displayStatus() {
    const opportunities = this.exchangeManager.detectArbitrageOpportunities();
    const riskStatus = this.riskManager.getStatus();

    console.log(chalk.cyan('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
    console.log(chalk.cyan(`📊 Status Update - ${new Date().toLocaleTimeString('en-IN')}`));
    console.log(chalk.cyan('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));

    console.log(chalk.yellow('\n💹 Connected Exchanges:'));
    this.exchangeManager.exchanges.forEach((exchange, name) => {
      console.log(`  ${name}: ${chalk.green('✅ Connected')}`);
    });

    console.log(chalk.yellow('\n💰 Top Opportunities:'));
    if (opportunities.length > 0) {
      opportunities.slice(0, 3).forEach(opp => {
        console.log(`  ${opp.buyExchange} → ${opp.sellExchange}: ${chalk.green(`+${opp.profitPercent.toFixed(3)}%`)}`);
      });
    } else {
      console.log('  No profitable opportunities at the moment');
    }

    console.log(chalk.yellow('\n📊 Risk Status:'));
    console.log(`  Daily P&L: ${riskStatus.dailyPnL >= 0 ? chalk.green(`+₹${riskStatus.dailyPnL.toFixed(2)}`) : chalk.red(`-₹${Math.abs(riskStatus.dailyPnL).toFixed(2)}`)}`);
    console.log(`  Trades Today: ${riskStatus.tradestoday}`);
    console.log(`  Can Trade: ${riskStatus.canTrade ? chalk.green('YES') : chalk.red('NO')}`);

    console.log(chalk.cyan('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'));
  }

  private getDashboardHTML(): string {
    return `
<!DOCTYPE html>
<html>
<head>
    <title>Enhanced USDT Arbitrage Bot v2.0</title>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #0a0e27;
            color: #e4e4e7;
            line-height: 1.6;
        }
        .container { max-width: 1400px; margin: 0 auto; padding: 20px; }
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            padding: 30px;
            border-radius: 15px;
            margin-bottom: 30px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.3);
        }
        .header h1 { font-size: 2.5em; margin-bottom: 10px; }
        .grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }
        .card {
            background: #1e293b;
            border-radius: 15px;
            padding: 25px;
            box-shadow: 0 5px 20px rgba(0,0,0,0.2);
            border: 1px solid #334155;
        }
        .card h2 {
            font-size: 1.3em;
            margin-bottom: 20px;
            color: #a78bfa;
        }
        .opportunity {
            background: linear-gradient(135deg, #10b981 0%, #059669 100%);
            padding: 15px;
            border-radius: 10px;
            margin-bottom: 10px;
        }
        .profit { color: #10b981; font-weight: bold; }
        .loss { color: #ef4444; font-weight: bold; }
        button {
            background: #3498db;
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 5px;
            cursor: pointer;
            font-size: 1em;
        }
        button:hover { background: #2980b9; }
        .stat-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
            gap: 15px;
            margin-top: 20px;
        }
        .stat {
            background: #0f172a;
            padding: 15px;
            border-radius: 10px;
            text-align: center;
            border: 1px solid #1e293b;
        }
        .stat-value {
            font-size: 1.8em;
            font-weight: bold;
            color: #a78bfa;
        }
        .stat-label {
            font-size: 0.9em;
            color: #94a3b8;
            margin-top: 5px;
        }
        .exchange-badge {
            display: inline-block;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 0.8em;
            background: #3b82f6;
            margin-right: 5px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🚀 Enhanced USDT Arbitrage Bot v2.0</h1>
            <p>Multi-Exchange Arbitrage with CCXT Integration</p>
            <div style="margin-top: 15px;">
                <span class="exchange-badge">CoinDCX</span>
                <span class="exchange-badge">ZebPay</span>
                <span class="exchange-badge">Binance</span>
                <span class="exchange-badge">WazirX</span>
                <span class="exchange-badge">KuCoin</span>
            </div>
        </div>

        <div class="grid">
            <div class="card">
                <h2>💰 Live Arbitrage Opportunities</h2>
                <div id="opportunities">Loading...</div>
                <button onclick="refreshOpportunities()">Refresh</button>
            </div>

            <div class="card">
                <h2>📊 Performance Metrics</h2>
                <div class="stat-grid">
                    <div class="stat">
                        <div class="stat-value" id="profit">₹0</div>
                        <div class="stat-label">Daily P&L</div>
                    </div>
                    <div class="stat">
                        <div class="stat-value" id="trades">0</div>
                        <div class="stat-label">Trades Today</div>
                    </div>
                    <div class="stat">
                        <div class="stat-value" id="opportunities-count">0</div>
                        <div class="stat-label">Opportunities</div>
                    </div>
                </div>
            </div>

            <div class="card">
                <h2>⚡ System Status</h2>
                <div id="status">
                    <p>✅ WebSocket Connections Active</p>
                    <p>✅ Risk Management Active</p>
                    <p>✅ Telegram Alerts Active</p>
                </div>
            </div>
        </div>

        <div class="card">
            <h2>🎛️ Controls</h2>
            <button onclick="location.href='/api/opportunities'">View API</button>
            <button onclick="location.href='/api/balances'">Check Balances</button>
            <button onclick="location.href='/api/risk-status'">Risk Status</button>
        </div>
    </div>

    <script>
        async function refreshOpportunities() {
            try {
                const response = await fetch('/api/opportunities');
                const data = await response.json();
                
                const container = document.getElementById('opportunities');
                document.getElementById('opportunities-count').textContent = data.count;
                
                if (data.opportunities.length > 0) {
                    container.innerHTML = data.opportunities.slice(0, 5).map(opp => 
                        '<div class="opportunity">' +
                        '<strong>' + opp.buyExchange + ' → ' + opp.sellExchange + '</strong><br>' +
                        'Profit: <span class="profit">+' + opp.profitPercent.toFixed(3) + '%</span><br>' +
                        'Volume: ₹' + Math.floor(opp.volume) +
                        '</div>'
                    ).join('');
                } else {
                    container.innerHTML = '<p style="color: #94a3b8;">No opportunities found</p>';
                }

                // Update risk status
                const riskResponse = await fetch('/api/risk-status');
                const riskData = await riskResponse.json();
                if (riskData.success) {
                    document.getElementById('profit').textContent = '₹' + riskData.status.dailyPnL.toFixed(2);
                    document.getElementById('profit').className = riskData.status.dailyPnL >= 0 ? 'stat-value profit' : 'stat-value loss';
                    document.getElementById('trades').textContent = riskData.status.tradestoday;
                }
            } catch (error) {
                console.error('Error:', error);
            }
        }

        // Auto-refresh every 5 seconds
        setInterval(refreshOpportunities, 5000);
        refreshOpportunities();
    </script>
</body>
</html>
    `;
  }

  async stop() {
    this.isRunning = false;
    this.exchangeManager.disconnect();
    logger.info('Bot stopped');
  }
}

// Start the enhanced bot
const bot = new EnhancedArbitrageBot();

process.on('SIGINT', async () => {
  console.log('\nShutting down...');
  await bot.stop();
  process.exit(0);
});

bot.start().catch(console.error);

export { EnhancedArbitrageBot };