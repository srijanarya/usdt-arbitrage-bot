import { performanceMonitor } from './src/services/monitoring/PerformanceMonitorAPI';
import { PerformanceIntegration } from './integrate-performance-monitor';
import { credentialManager } from './src/services/security/CredentialManager';
import { logger } from './src/utils/logger';

async function startBotWithMonitoring() {
  try {
    logger.info('🚀 Starting USDT Arbitrage Bot with Performance Monitoring');
    
    // Initialize performance monitoring
    await PerformanceIntegration.initialize();
    logger.info('✅ Performance dashboard available at http://localhost:3001');
    
    // Initialize credentials (if using encryption)
    if (credentialManager.isEncrypted()) {
      // This would normally prompt for password
      await credentialManager.initialize();
      await credentialManager.loadCredentials();
    }
    
    // Your existing bot initialization here
    // ...
    
    // Example monitoring integration:
    setInterval(() => {
      // Simulate API calls
      const exchanges = ['binance', 'coindcx', 'zebpay'];
      exchanges.forEach(exchange => {
        const startTime = Date.now();
        // Simulate API latency
        setTimeout(() => {
          PerformanceIntegration.trackApiCall(exchange, startTime);
        }, Math.random() * 200);
      });
      
      // Simulate trades (remove in production)
      if (Math.random() > 0.7) {
        const profit = (Math.random() - 0.3) * 500; // -150 to +350
        PerformanceIntegration.recordTrade({
          pair: 'USDT/INR',
          type: Math.random() > 0.5 ? 'buy' : 'sell',
          amount: 100,
          price: 88 + Math.random() * 2,
          profit
        });
      }
      
      // Update positions
      PerformanceIntegration.updatePositions(Math.floor(Math.random() * 5));
      
    }, 5000);
    
    logger.info('✅ Bot running with performance monitoring');
    
  } catch (error) {
    logger.error('Failed to start bot:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  logger.info('Shutting down...');
  performanceMonitor.stop();
  process.exit(0);
});

// Start the bot
startBotWithMonitoring();
