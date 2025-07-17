import axios from 'axios';
import { logger } from '../utils/logger';

async function checkBinanceOrders() {
  console.log('🔍 CHECKING BINANCE P2P ORDERS\n');
  console.log('━'.repeat(60));
  
  // Order IDs from your previous session
  const orderIds = [
    'binance_1752740031065_f4aao5c86',  // ₹90.5
    'binance_1752741543639_z6p0anmdr',  // ₹94.52
    'binance_1752741553798_18iblmfot',  // ₹94.52
    'binance_1752741563784_90wq6x07r',  // ₹94.52
  ];
  
  console.log('📋 Your Previous Orders:\n');
  
  // Details of your orders
  const orderDetails = [
    { id: orderIds[0], amount: 11.5, price: 90.5, created: '2:13 PM' },
    { id: orderIds[1], amount: 11.5, price: 94.52, created: '2:39 PM' },
    { id: orderIds[2], amount: 11.5, price: 94.52, created: '2:39 PM' },
    { id: orderIds[3], amount: 11.5, price: 94.52, created: '2:39 PM' },
  ];
  
  orderDetails.forEach((order, index) => {
    const total = order.amount * order.price;
    const profit = ((order.price - 89) / 89 * 100).toFixed(2);
    
    console.log(`${index + 1}. Order ID: ${order.id}`);
    console.log(`   Amount: ${order.amount} USDT @ ₹${order.price}`);
    console.log(`   Total: ₹${total.toFixed(2)}`);
    console.log(`   Profit: ${profit}% (₹${((order.price - 89) * order.amount).toFixed(2)})`);
    console.log(`   Created: ${order.created}`);
    console.log(`   Status: Checking...\n`);
  });
  
  // Check current P2P sell prices
  console.log('━'.repeat(60));
  console.log('📊 CURRENT MARKET STATUS\n');
  
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
      console.log('Current P2P Sell Prices:');
      ads.slice(0, 5).forEach((ad, index) => {
        const price = parseFloat(ad.adv.price);
        console.log(`${index + 1}. ₹${price} - ${ad.advertiser.nickName} (${ad.advertiser.monthFinishRate}% completion)`);
      });
      
      const bestPrice = parseFloat(ads[0].adv.price);
      console.log(`\n💡 Best current price: ₹${bestPrice}`);
      console.log(`   Your lowest: ₹90.5 (${((90.5 - bestPrice) / bestPrice * 100).toFixed(2)}% below market)`);
      console.log(`   Your highest: ₹94.52 (${((94.52 - bestPrice) / bestPrice * 100).toFixed(2)}% ${94.52 > bestPrice ? 'above' : 'below'} market)`);
    }
  } catch (error) {
    console.log('Could not fetch current prices');
  }
  
  console.log('\n━'.repeat(60));
  console.log('💰 TOTAL EXPOSURE\n');
  
  const totalUSDT = orderDetails.reduce((sum, order) => sum + order.amount, 0);
  const avgPrice = orderDetails.reduce((sum, order) => sum + order.price * order.amount, 0) / totalUSDT;
  const totalINR = orderDetails.reduce((sum, order) => sum + order.price * order.amount, 0);
  
  console.log(`Total USDT listed: ${totalUSDT} USDT`);
  console.log(`Average price: ₹${avgPrice.toFixed(2)}`);
  console.log(`Total INR if all sold: ₹${totalINR.toFixed(2)}`);
  console.log(`Total profit if all sold: ₹${(totalINR - (89 * totalUSDT)).toFixed(2)}`);
  
  console.log('\n⚠️  IMPORTANT NOTES:');
  console.log('- Orders may have expired if older than 15-30 minutes');
  console.log('- Check Binance app for actual order status');
  console.log('- If no buyers yet, consider lowering price to ₹89-90');
  console.log('- Market seems to be around ₹94-95 currently');
  
  console.log('\n🔄 RECOMMENDED ACTIONS:');
  console.log('1. Open Binance app > P2P > Orders to check status');
  console.log('2. Cancel high-priced orders (₹94.52) if no buyers');
  console.log('3. Relist at competitive price (₹89.5-90.5)');
  console.log('4. Enable notifications for order updates');
}

// Run the check
checkBinanceOrders().catch(console.error);