import { ArbitrageMonitor } from '../monitor';

async function runMonitor() {
  console.log('Starting arbitrage monitor for 30 seconds...\n');
  
  const monitor = new ArbitrageMonitor();
  await monitor.start();
  
  // Run for 30 seconds then exit
  setTimeout(() => {
    console.log('\n\nStopping monitor...');
    process.exit(0);
  }, 30000);
}

runMonitor().catch(console.error);