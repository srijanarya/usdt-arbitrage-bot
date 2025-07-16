import { BinanceClient } from '../api/exchanges/binance';

async function findUSDTPairs() {
  console.log('Finding USDT trading pairs on Binance...\n');
  
  const client = new BinanceClient({
    apiKey: '',
    apiSecret: ''
  });

  try {
    const prices = await client.getAllPrices();
    
    // Find USDT pairs with other stablecoins
    const stablecoins = ['BUSD', 'USDC', 'TUSD', 'USDP', 'DAI', 'FDUSD'];
    const usdtPairs = prices.filter(p => {
      const symbol = p.symbol;
      return (symbol.startsWith('USDT') || symbol.endsWith('USDT')) && 
             stablecoins.some(stable => symbol.includes(stable));
    });

    console.log('USDT Stablecoin Pairs:');
    usdtPairs.forEach(pair => {
      console.log(`  ${pair.symbol}: $${pair.price}`);
    });

    // Check specific pairs
    console.log('\nChecking specific pairs:');
    const checkPairs = ['BUSDUSDT', 'USDCUSDT', 'TUSDUSDT', 'USDPUSDT', 'FDUSDUSDT'];
    
    for (const symbol of checkPairs) {
      const pair = prices.find(p => p.symbol === symbol);
      if (pair) {
        console.log(`✓ ${symbol}: $${pair.price}`);
      }
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
}

findUSDTPairs().catch(console.error);