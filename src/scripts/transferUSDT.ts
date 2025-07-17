import { walletTransferService } from '../services/wallet/walletTransferService';
import { logger } from '../utils/logger';
import readline from 'readline';
import { config } from 'dotenv';

config();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (query: string): Promise<string> => {
  return new Promise(resolve => rl.question(query, resolve));
};

async function transferWizard() {
  console.log('\n🔄 USDT WALLET TRANSFER WIZARD\n');
  console.log('Available exchanges: binance, kucoin, zebpay, coinswitch\n');

  try {
    const fromExchange = await question('From exchange (e.g., zebpay): ');
    const toExchange = await question('To exchange (e.g., binance): ');
    const amount = parseFloat(await question('Amount of USDT to transfer: '));
    
    console.log('\nAvailable networks:');
    console.log('1. TRC20 (Tron) - Cheapest, ~1 USDT fee');
    console.log('2. ERC20 (Ethereum) - Expensive, ~10 USDT fee');
    console.log('3. BSC (Binance Smart Chain) - Low fee, ~0.8 USDT');
    console.log('4. POLYGON - Very cheap, ~0.1 USDT\n');
    
    const networkChoice = await question('Choose network (1-4) [default: 1]: ') || '1';
    const networks = ['TRC20', 'ERC20', 'BSC', 'POLYGON'];
    const network = networks[parseInt(networkChoice) - 1] || 'TRC20';

    console.log('\n📋 Transfer Summary:');
    console.log(`   From: ${fromExchange.toUpperCase()}`);
    console.log(`   To: ${toExchange.toUpperCase()}`);
    console.log(`   Amount: ${amount} USDT`);
    console.log(`   Network: ${network}`);
    console.log(`   Estimated Fee: ~${getNetworkFee(network)} USDT`);
    console.log(`   You will receive: ~${amount - getNetworkFee(network)} USDT\n`);

    const confirm = await question('Proceed with transfer? (yes/no): ');
    
    if (confirm.toLowerCase() === 'yes' || confirm.toLowerCase() === 'y') {
      console.log('\n🚀 Initiating transfer...\n');
      
      const result = await walletTransferService.transferUSDT({
        fromExchange,
        toExchange,
        amount,
        currency: 'USDT',
        network
      });

      if (result.success) {
        console.log('✅ Transfer initiated successfully!');
        console.log(`📝 Transaction ID: ${result.txId}`);
        console.log(`⏱️ Estimated time: ${result.estimatedTime}`);
        console.log(`💰 Network fee: ${result.fee} USDT`);
        console.log('\n📱 You can track this transfer in both exchange apps');
      } else {
        console.log(`❌ Transfer failed: ${result.message}`);
        
        if (result.message.includes('manually')) {
          console.log('\n📱 Manual transfer instructions:');
          console.log('1. Open the source exchange app');
          console.log('2. Go to Wallet > USDT > Withdraw');
          console.log('3. Select the network: ' + network);
          console.log('4. Enter the amount: ' + amount);
          console.log('5. The deposit address will be shown after you select the destination exchange');
        }
      }
    } else {
      console.log('❌ Transfer cancelled');
    }

  } catch (error) {
    logger.error('Transfer wizard error:', error);
    console.log('❌ An error occurred:', error.message);
  } finally {
    rl.close();
  }
}

function getNetworkFee(network: string): number {
  const fees: Record<string, number> = {
    'TRC20': 1,
    'ERC20': 10,
    'BSC': 0.8,
    'POLYGON': 0.1
  };
  return fees[network] || 5;
}

// Quick transfer function for common routes
export async function quickTransfer(from: string, to: string, amount: number) {
  logger.info(`Quick transfer: ${amount} USDT from ${from} to ${to}`);
  
  return await walletTransferService.transferUSDT({
    fromExchange: from,
    toExchange: to,
    amount,
    currency: 'USDT',
    network: 'TRC20' // Default to cheapest network
  });
}

// Run wizard if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  // Check if quick transfer arguments provided
  const [,, from, to, amount] = process.argv;
  
  if (from && to && amount) {
    quickTransfer(from, to, parseFloat(amount))
      .then(result => {
        if (result.success) {
          console.log(`✅ Transfer initiated: ${result.txId}`);
        } else {
          console.log(`❌ Transfer failed: ${result.message}`);
        }
        process.exit(0);
      })
      .catch(error => {
        console.error('Error:', error.message);
        process.exit(1);
      });
  } else {
    // Run interactive wizard
    transferWizard();
  }
}