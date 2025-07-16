import { ZebPayClient } from '../api/exchanges/zebPay';

async function testOrderBook() {
  const client = new ZebPayClient();
  
  try {
    console.log('Testing ZebPay Order Book structure...\n');
    
    const orderBook = await client.getOrderBook('USDT-INR');
    console.log('Raw order book response:');
    console.log(JSON.stringify(orderBook, null, 2));
    
  } catch (error) {
    console.error('Error:', error);
  }
}

testOrderBook().catch(console.error);