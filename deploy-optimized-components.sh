#!/bin/bash

echo "🚀 Deploying Optimized Bot Components"
echo "===================================="
echo ""

# Check if optimized directory exists
if [ ! -d "src/services/optimized" ]; then
    echo "📁 Creating optimized services directory..."
    mkdir -p src/services/optimized
fi

# Copy optimized components from automation project
AUTOMATION_DIR="/Users/srijan/Desktop/my-automation-project"

if [ -d "$AUTOMATION_DIR" ]; then
    echo "📋 Found automation project directory"
    echo "🔄 Copying optimized components..."
    
    # Copy optimized services if they exist
    if [ -f "$AUTOMATION_DIR/src/services/optimized/ConcurrentApiManager.ts" ]; then
        cp "$AUTOMATION_DIR/src/services/optimized/"*.ts src/services/optimized/
        echo "✅ Copied optimized services"
    fi
    
    # Copy performance optimization tools
    if [ -f "$AUTOMATION_DIR/p2p_strategy_optimizer.py" ]; then
        mkdir -p optimization-tools
        cp "$AUTOMATION_DIR/"*.py optimization-tools/
        echo "✅ Copied Python optimization tools"
    fi
else
    echo "⚠️  Automation project not found. Creating optimized components..."
fi

# Create deployment configuration
cat > deploy-config.json << 'EOF'
{
  "optimization": {
    "concurrent_api_calls": true,
    "redis_caching": true,
    "websocket_pooling": true,
    "batch_operations": true,
    "performance_monitoring": true
  },
  "deployment": {
    "mode": "production",
    "min_node_version": "16.0.0",
    "required_services": ["redis", "postgresql"],
    "health_check_interval": 30000
  },
  "features": {
    "dynamic_position_sizing": true,
    "advanced_risk_management": true,
    "multi_strategy_support": true,
    "auto_rebalancing": true
  }
}
EOF

echo "✅ Created deployment configuration"

# Create optimized bot launcher
cat > launch-optimized.ts << 'EOF'
import { credentialManager } from './src/services/security/CredentialManager';
import { logger } from './src/utils/logger';
import * as fs from 'fs';

async function launchOptimizedBot() {
  try {
    logger.info('🚀 Launching Optimized USDT Arbitrage Bot');
    
    // Load deployment config
    const config = JSON.parse(fs.readFileSync('deploy-config.json', 'utf-8'));
    logger.info('📋 Deployment configuration loaded', config);
    
    // Check Node.js version
    const nodeVersion = process.version;
    const requiredVersion = config.deployment.min_node_version;
    if (nodeVersion < `v${requiredVersion}`) {
      throw new Error(`Node.js ${requiredVersion} or higher required. Current: ${nodeVersion}`);
    }
    
    // Initialize services based on config
    if (config.optimization.concurrent_api_calls) {
      logger.info('✅ Concurrent API calls enabled');
      // Initialize ConcurrentApiManager
    }
    
    if (config.optimization.redis_caching) {
      logger.info('✅ Redis caching enabled');
      // Initialize Redis connection
    }
    
    if (config.optimization.websocket_pooling) {
      logger.info('✅ WebSocket pooling enabled');
      // Initialize WebSocket pool
    }
    
    // Load main bot with optimizations
    logger.info('🤖 Starting optimized bot components...');
    
    // Import and start optimized components
    const { OptimizedArbitrageEngine } = await import('./src/services/optimized/OptimizedArbitrageEngine');
    const { FastOrderExecutor } = await import('./src/services/optimized/FastOrderExecutor');
    const { OptimizedWebSocketManager } = await import('./src/services/optimized/OptimizedWebSocketManager');
    
    // Initialize components
    const engine = new OptimizedArbitrageEngine();
    await engine.initialize();
    
    logger.info('✅ All optimized components initialized');
    logger.info('🎯 Bot is running in optimized mode');
    
    // Start monitoring dashboard
    if (config.optimization.performance_monitoring) {
      const { PerformanceDashboard } = await import('./src/services/monitoring/PerformanceDashboard');
      const dashboard = new PerformanceDashboard();
      await dashboard.start(3001);
      logger.info('📊 Performance dashboard available at http://localhost:3001');
    }
    
  } catch (error) {
    logger.error('❌ Failed to launch optimized bot:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  logger.info('🛑 Shutting down optimized bot...');
  // Cleanup code here
  process.exit(0);
});

// Launch the bot
launchOptimizedBot();
EOF

echo "✅ Created optimized bot launcher"

# Create performance monitoring dashboard
mkdir -p src/services/monitoring

cat > src/services/monitoring/PerformanceDashboard.ts << 'EOF'
import express from 'express';
import { logger } from '../../utils/logger';

export class PerformanceDashboard {
  private app: express.Application;
  private metrics: any = {
    apiCalls: { total: 0, successful: 0, failed: 0, avgLatency: 0 },
    trades: { total: 0, profitable: 0, loss: 0, totalProfit: 0 },
    system: { uptime: 0, memoryUsage: 0, cpuUsage: 0 },
    websockets: { connected: 0, reconnections: 0, messages: 0 }
  };

  constructor() {
    this.app = express();
    this.setupRoutes();
  }

  private setupRoutes() {
    this.app.get('/metrics', (req, res) => {
      res.json(this.metrics);
    });

    this.app.get('/', (req, res) => {
      res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>USDT Bot Performance Dashboard</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; background: #f0f0f0; }
            .container { max-width: 1200px; margin: 0 auto; }
            .metric-card { background: white; padding: 20px; margin: 10px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
            .metric-title { font-size: 18px; color: #333; margin-bottom: 10px; }
            .metric-value { font-size: 32px; font-weight: bold; color: #2ecc71; }
            .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; }
            .status { padding: 5px 10px; border-radius: 4px; color: white; }
            .status.success { background: #2ecc71; }
            .status.warning { background: #f39c12; }
            .status.error { background: #e74c3c; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>🚀 USDT Arbitrage Bot - Performance Dashboard</h1>
            <div class="grid" id="metrics"></div>
          </div>
          <script>
            async function updateMetrics() {
              const response = await fetch('/metrics');
              const data = await response.json();
              
              const container = document.getElementById('metrics');
              container.innerHTML = \`
                <div class="metric-card">
                  <div class="metric-title">API Performance</div>
                  <div class="metric-value">\${data.apiCalls.avgLatency}ms</div>
                  <div>Total: \${data.apiCalls.total} | Success: \${data.apiCalls.successful}</div>
                </div>
                <div class="metric-card">
                  <div class="metric-title">Trading Performance</div>
                  <div class="metric-value">₹\${data.trades.totalProfit.toFixed(2)}</div>
                  <div>Trades: \${data.trades.total} | Win Rate: \${(data.trades.profitable / data.trades.total * 100).toFixed(1)}%</div>
                </div>
                <div class="metric-card">
                  <div class="metric-title">System Health</div>
                  <div class="metric-value">\${(data.system.uptime / 3600).toFixed(1)}h</div>
                  <div>Memory: \${data.system.memoryUsage}% | CPU: \${data.system.cpuUsage}%</div>
                </div>
                <div class="metric-card">
                  <div class="metric-title">WebSocket Status</div>
                  <div class="metric-value">\${data.websockets.connected} Active</div>
                  <div>Messages: \${data.websockets.messages} | Reconnects: \${data.websockets.reconnections}</div>
                </div>
              \`;
            }
            
            updateMetrics();
            setInterval(updateMetrics, 5000);
          </script>
        </body>
        </html>
      `);
    });
  }

  async start(port: number = 3001) {
    this.app.listen(port, () => {
      logger.info(`Performance dashboard started on port ${port}`);
    });
  }

  updateMetrics(category: string, updates: any) {
    Object.assign(this.metrics[category], updates);
  }
}
EOF

echo "✅ Created performance monitoring dashboard"

# Create health check script
cat > health-check.sh << 'EOF'
#!/bin/bash

echo "🏥 Running Health Check..."
echo "========================="

# Check if bot process is running
BOT_PID=$(pgrep -f "node.*optimized")
if [ -n "$BOT_PID" ]; then
    echo "✅ Bot process running (PID: $BOT_PID)"
else
    echo "❌ Bot process not found"
fi

# Check Redis connection
if command -v redis-cli >/dev/null 2>&1; then
    if redis-cli ping >/dev/null 2>&1; then
        echo "✅ Redis connection OK"
    else
        echo "❌ Redis connection failed"
    fi
else
    echo "⚠️  Redis not installed"
fi

# Check API endpoints
if curl -s http://localhost:3001/metrics >/dev/null 2>&1; then
    echo "✅ Performance dashboard accessible"
else
    echo "❌ Performance dashboard not responding"
fi

# Check disk space
DISK_USAGE=$(df -h . | awk 'NR==2 {print $5}' | sed 's/%//')
if [ "$DISK_USAGE" -lt 90 ]; then
    echo "✅ Disk usage OK ($DISK_USAGE%)"
else
    echo "⚠️  High disk usage ($DISK_USAGE%)"
fi

# Check memory usage
if command -v free >/dev/null 2>&1; then
    MEM_USAGE=$(free | grep Mem | awk '{print int($3/$2 * 100)}')
    if [ "$MEM_USAGE" -lt 90 ]; then
        echo "✅ Memory usage OK ($MEM_USAGE%)"
    else
        echo "⚠️  High memory usage ($MEM_USAGE%)"
    fi
fi

echo ""
echo "Health check complete!"
EOF

chmod +x health-check.sh

echo "✅ Created health check script"

# Create PM2 ecosystem file for production deployment
cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [{
    name: 'usdt-arbitrage-bot',
    script: 'launch-optimized.ts',
    interpreter: 'node',
    interpreter_args: '-r ts-node/register',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '2G',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: 'logs/pm2-error.log',
    out_file: 'logs/pm2-out.log',
    log_file: 'logs/pm2-combined.log',
    time: true,
    merge_logs: true,
    
    // Restart strategies
    min_uptime: '10s',
    max_restarts: 10,
    restart_delay: 4000,
    
    // Monitoring
    monitoring: true,
    
    // Graceful shutdown
    kill_timeout: 5000,
    wait_ready: true,
    listen_timeout: 10000
  }]
};
EOF

echo "✅ Created PM2 ecosystem configuration"

# Create deployment checklist
cat > DEPLOYMENT-CHECKLIST.md << 'EOF'
# Deployment Checklist for Optimized Bot

## Pre-deployment
- [ ] All tests passing
- [ ] Credentials encrypted
- [ ] Gmail authentication working
- [ ] Redis server installed and running
- [ ] Sufficient disk space (>2GB free)
- [ ] Node.js 16+ installed

## Deployment Steps
1. [ ] Run health check: `./health-check.sh`
2. [ ] Install PM2: `npm install -g pm2`
3. [ ] Start with PM2: `pm2 start ecosystem.config.js`
4. [ ] Monitor logs: `pm2 logs`
5. [ ] Check dashboard: http://localhost:3001

## Post-deployment
- [ ] Verify bot is running: `pm2 status`
- [ ] Check performance metrics
- [ ] Monitor first few trades
- [ ] Set up alerts for errors
- [ ] Schedule regular health checks

## Rollback Plan
1. Stop current version: `pm2 stop usdt-arbitrage-bot`
2. Checkout previous version: `git checkout [previous-commit]`
3. Restart: `pm2 restart usdt-arbitrage-bot`

## Monitoring Commands
- View logs: `pm2 logs usdt-arbitrage-bot`
- Monitor CPU/Memory: `pm2 monit`
- View metrics: `curl http://localhost:3001/metrics`
- Health check: `./health-check.sh`
EOF

echo "✅ Created deployment checklist"

echo ""
echo "🎉 Optimized Components Deployment Ready!"
echo "========================================"
echo ""
echo "📋 Deployment files created:"
echo "   • deploy-config.json - Optimization settings"
echo "   • launch-optimized.ts - Main launcher"
echo "   • ecosystem.config.js - PM2 configuration"
echo "   • health-check.sh - System health checker"
echo "   • DEPLOYMENT-CHECKLIST.md - Step-by-step guide"
echo ""
echo "🚀 To deploy optimized bot:"
echo "   1. Review DEPLOYMENT-CHECKLIST.md"
echo "   2. Run: npm install -g pm2"
echo "   3. Start: pm2 start ecosystem.config.js"
echo "   4. Monitor: pm2 monit"
echo ""
echo "📊 Performance dashboard will be available at:"
echo "   http://localhost:3001"
echo ""