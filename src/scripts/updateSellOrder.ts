import axios from 'axios';
import { logger } from '../utils/logger';
import { config } from 'dotenv';

config();

interface UpdateOrderRequest {
  orderId: string;
  newPrice: number;
  aggressiveMode?: boolean;
}

async function updateSellOrder(orderId: string, newPrice: number) {
  try {
    logger.info(`🔄 Updating sell order ${orderId} to ₹${newPrice}`);
    
    // Cancel existing order
    const cancelResponse = await axios.post('http://localhost:3001/api/p2p/cancel', {
      orderId,
      exchange: 'binance'
    });
    
    if (!cancelResponse.data.success) {
      throw new Error('Failed to cancel existing order');
    }
    
    logger.info('✅ Existing order cancelled');
    
    // Create new order with competitive price
    const createResponse = await axios.post('http://localhost:3001/api/p2p/execute', {
      exchange: 'binance',
      amount: 11.5,
      price: newPrice,
      type: 'sell',
      paymentMethod: 'UPI',
      competitiveMode: true // Flag for competitive pricing
    });
    
    if (createResponse.data.success) {
      logger.info(`✅ New order created: ${createResponse.data.orderId}`);
      logger.info(`💰 New price: ₹${newPrice} (Profit: ${((newPrice - 89) / 89 * 100).toFixed(2)}%)`);
      return createResponse.data;
    } else {
      throw new Error(createResponse.data.error || 'Failed to create new order');
    }
    
  } catch (error) {
    logger.error('Failed to update order:', error);
    throw error;
  }
}

async function getMarketPrice(): Promise<number> {
  try {
    const response = await axios.post(
      'https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search',
      {
        page: 1,
        rows: 5,
        payTypes: ["UPI"],
        publisherType: null,
        tradeType: "SELL",
        asset: "USDT",
        fiat: "INR",
        merchantCheck: false
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      }
    );
    
    const ads = response.data.data || [];
    if (ads.length > 0) {
      // Get average of top 3 prices
      const topPrices = ads.slice(0, 3).map(ad => parseFloat(ad.adv.price));
      const avgPrice = topPrices.reduce((a, b) => a + b, 0) / topPrices.length;
      return avgPrice;
    }
    
    return 90; // Default fallback
  } catch (error) {
    logger.error('Failed to get market price:', error);
    return 90;
  }
}

async function main() {
  const orderId = 'binance_1752740031065_f4aao5c86'; // Current order ID
  const buyPrice = 89;
  const minProfit = 0.5; // 0.5% minimum profit for aggressive mode
  
  try {
    // Get current market price
    const marketPrice = await getMarketPrice();
    logger.info(`📊 Current market average: ₹${marketPrice.toFixed(2)}`);
    
    // Calculate competitive price (slightly below market average)
    let competitivePrice = marketPrice - 0.1; // ₹0.10 below market
    
    // Ensure minimum profit
    const minPrice = buyPrice * (1 + minProfit / 100);
    if (competitivePrice < minPrice) {
      competitivePrice = minPrice;
      logger.warn(`⚠️ Adjusted to minimum profit price: ₹${competitivePrice.toFixed(2)}`);
    }
    
    // Calculate profit
    const profit = ((competitivePrice - buyPrice) / buyPrice) * 100;
    
    console.log('\n💰 PRICE UPDATE PROPOSAL');
    console.log('━'.repeat(40));
    console.log(`Current order: ₹90.5`);
    console.log(`Market average: ₹${marketPrice.toFixed(2)}`);
    console.log(`Competitive price: ₹${competitivePrice.toFixed(2)}`);
    console.log(`Expected profit: ${profit.toFixed(2)}%`);
    console.log('━'.repeat(40));
    
    // Update the order
    await updateSellOrder(orderId, competitivePrice);
    
    console.log('\n✅ Order successfully updated!');
    console.log('🚀 Your order is now competitively priced for quick sale');
    
  } catch (error) {
    logger.error('Update failed:', error);
    process.exit(1);
  }
}

// Run the update
main().catch(console.error);