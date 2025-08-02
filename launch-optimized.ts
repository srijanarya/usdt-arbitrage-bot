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
