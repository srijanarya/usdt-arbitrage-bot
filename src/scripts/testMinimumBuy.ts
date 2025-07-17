import { config } from 'dotenv';
import { logger } from '../utils/logger';
import axios from 'axios';

config();

interface ExchangeInfo {
  name: string;
  minOrderAmount: number;
  currentPrice: number;
  fees: {
    maker: number;
    taker: number;
  };
}

interface MinimumBuyTest {
  exchange: string;
  amount: number;
  estimatedCost: number;
  success: boolean;
  orderId?: string;
  error?: string;
}

async function getExchangeMinimums(): Promise<ExchangeInfo[]> {
  return [
    {
      name: 'binance',
      minOrderAmount: 10, // 10 USDT minimum
      currentPrice: 86.5,
      fees: { maker: 0.001, taker: 0.001 }
    },
    {
      name: 'zebpay', 
      minOrderAmount: 5, // 5 USDT minimum
      currentPrice: 84.8,
      fees: { maker: 0.002, taker: 0.002 }
    },
    {
      name: 'kucoin',
      minOrderAmount: 1, // 1 USDT minimum
      currentPrice: 85.2,
      fees: { maker: 0.001, taker: 0.001 }
    },
    {
      name: 'coinswitch',
      minOrderAmount: 8, // 8 USDT minimum
      currentPrice: 87.1,
      fees: { maker: 0.003, taker: 0.003 }
    }
  ];
}

async function testMinimumBuy(): Promise<void> {
  try {
    logger.info('🎯 Testing minimum buy amounts on all exchanges...');
    
    const exchanges = await getExchangeMinimums();
    const results: MinimumBuyTest[] = [];
    
    // Find the cheapest exchange
    const cheapestExchange = exchanges.reduce((prev, current) => 
      prev.currentPrice < current.currentPrice ? prev : current
    );
    
    logger.info(`💰 Cheapest exchange: ${cheapestExchange.name} @ ₹${cheapestExchange.currentPrice}`);
    logger.info(`📊 Testing minimum orders on all exchanges:`);
    
    for (const exchange of exchanges) {
      try {
        logger.info(`\n🔍 Testing ${exchange.name}:`);
        logger.info(`   Min Amount: ${exchange.minOrderAmount} USDT`);
        logger.info(`   Current Price: ₹${exchange.currentPrice}`);
        logger.info(`   Estimated Cost: ₹${(exchange.minOrderAmount * exchange.currentPrice).toFixed(2)}`);
        
        // Test order creation via API
        const testOrder = {
          exchange: exchange.name,
          amount: exchange.minOrderAmount,
          price: exchange.currentPrice,
          type: 'buy',
          paymentMethod: 'UPI',
          autoRelease: false
        };
        
        try {
          const response = await axios.post('http://localhost:3001/api/p2p/execute', testOrder, {
            headers: { 'Content-Type': 'application/json' },
            timeout: 5000
          });
          
          if (response.data.success) {
            results.push({
              exchange: exchange.name,
              amount: exchange.minOrderAmount,
              estimatedCost: exchange.minOrderAmount * exchange.currentPrice,
              success: true,
              orderId: response.data.orderId
            });
            logger.info(`   ✅ Test order created: ${response.data.orderId}`);
          } else {
            results.push({
              exchange: exchange.name,
              amount: exchange.minOrderAmount,
              estimatedCost: exchange.minOrderAmount * exchange.currentPrice,
              success: false,
              error: response.data.error || 'Unknown error'
            });
            logger.error(`   ❌ Order failed: ${response.data.error}`);
          }
        } catch (apiError: any) {
          results.push({
            exchange: exchange.name,
            amount: exchange.minOrderAmount,
            estimatedCost: exchange.minOrderAmount * exchange.currentPrice,
            success: false,
            error: apiError.response?.data?.error || apiError.message || 'API call failed'
          });
          logger.error(`   ❌ API call failed: ${apiError.message}`);
        }
        
      } catch (error: any) {
        logger.error(`Failed to test ${exchange.name}:`, error.message);
      }
    }
    
    // Summary
    console.log('\n📋 Minimum Buy Test Results:');
    console.log('='.repeat(60));
    
    const successfulTests = results.filter(r => r.success);
    const failedTests = results.filter(r => !r.success);
    
    if (successfulTests.length > 0) {
      console.log('\n✅ Successful Orders:');
      successfulTests.forEach(test => {
        console.log(`   ${test.exchange}: ${test.amount} USDT @ ₹${test.estimatedCost.toFixed(2)} (Order: ${test.orderId})`);
      });
      
      // Find the cheapest successful order
      const cheapestSuccessful = successfulTests.reduce((prev, current) => 
        prev.estimatedCost < current.estimatedCost ? prev : current
      );
      
      console.log(`\n🏆 Cheapest Successful Order:`);
      console.log(`   Exchange: ${cheapestSuccessful.exchange}`);
      console.log(`   Amount: ${cheapestSuccessful.amount} USDT`);
      console.log(`   Cost: ₹${cheapestSuccessful.estimatedCost.toFixed(2)}`);
      console.log(`   Order ID: ${cheapestSuccessful.orderId}`);
    }
    
    if (failedTests.length > 0) {
      console.log('\n❌ Failed Orders:');
      failedTests.forEach(test => {
        console.log(`   ${test.exchange}: ${test.error}`);
      });
    }
    
    // Recommendations
    console.log('\n💡 Recommendations:');
    console.log('─'.repeat(30));
    
    if (cheapestExchange) {
      console.log(`• Start with ${cheapestExchange.name} for lowest prices`);
      console.log(`• Minimum investment: ₹${(cheapestExchange.minOrderAmount * cheapestExchange.currentPrice).toFixed(2)}`);
      console.log(`• Consider fees: ${(cheapestExchange.fees.taker * 100).toFixed(3)}% per trade`);
    }
    
    // Live trading suggestions
    console.log('\n🚀 Next Steps for Live Trading:');
    console.log('1. Verify exchange API credentials are properly configured');
    console.log('2. Test with the minimum amount on the cheapest exchange');
    console.log('3. Monitor order execution and payment verification');
    console.log('4. Scale up gradually after successful test trades');
    
  } catch (error) {
    logger.error('💥 Test failed:', error);
    throw error;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  testMinimumBuy().catch(error => {
    logger.error('💥 Script failed:', error);
    process.exit(1);
  });
}

export { testMinimumBuy, getExchangeMinimums };