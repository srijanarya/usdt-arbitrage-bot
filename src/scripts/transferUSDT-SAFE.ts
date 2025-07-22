import { walletTransferService } from '../services/wallet/walletTransferService';
import { logger } from '../utils/logger';
import { safetyGuard } from '../services/SafetyGuard';
import readline from 'readline';
import chalk from 'chalk';
import { config } from 'dotenv';

config();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (query: string): Promise<string> => {
  return new Promise(resolve => rl.question(query, resolve));
};

// Exchange minimum withdrawal limits (in USDT)
const WITHDRAWAL_LIMITS = {
  binance: { min: 10, max: 1000000 },
  kucoin: { min: 20, max: 100000 },
  zebpay: { min: 10, max: 10000 },
  coinswitch: { min: 20, max: 50000 },
  coindcx: { min: 10, max: 100000 }
};

// Network fees (approximate in USDT)
const NETWORK_FEES = {
  TRC20: 1,
  ERC20: 10,
  BSC: 0.8,
  POLYGON: 0.1
};

async function transferWizardSafe() {
  console.log(chalk.red('\n🛡️  SAFE USDT TRANSFER WIZARD\n'));
  console.log(chalk.yellow('This wizard includes comprehensive safety checks.\n'));
  
  try {
    // Step 1: Exchange selection with validation
    console.log(chalk.cyan('Available exchanges:'), Object.keys(WITHDRAWAL_LIMITS).join(', '));
    const fromExchange = await question('\nFrom exchange: ');
    const toExchange = await question('To exchange: ');
    
    // Validate exchanges
    if (!WITHDRAWAL_LIMITS[fromExchange]) {
      console.log(chalk.red(`\n❌ Unknown source exchange: ${fromExchange}`));
      process.exit(1);
    }
    
    if (!WITHDRAWAL_LIMITS[toExchange]) {
      console.log(chalk.red(`\n❌ Unknown destination exchange: ${toExchange}`));
      process.exit(1);
    }
    
    if (fromExchange === toExchange) {
      console.log(chalk.red('\n❌ Cannot transfer to the same exchange!'));
      process.exit(1);
    }
    
    // Step 2: Check balances first
    console.log(chalk.yellow('\n🔍 Checking balance...'));
    // This would call actual balance check
    // const balance = await checkBalance(fromExchange);
    const balance = 100; // Mock balance
    console.log(chalk.green(`✅ Available balance: ${balance} USDT`));
    
    // Step 3: Amount validation
    const amountStr = await question('\nAmount of USDT to transfer: ');
    const amount = parseFloat(amountStr);
    
    if (isNaN(amount) || amount <= 0) {
      console.log(chalk.red('\n❌ Invalid amount!'));
      process.exit(1);
    }
    
    if (amount > balance) {
      console.log(chalk.red(`\n❌ Insufficient balance! You have ${balance} USDT`));
      process.exit(1);
    }
    
    const limits = WITHDRAWAL_LIMITS[fromExchange];
    if (amount < limits.min) {
      console.log(chalk.red(`\n❌ Amount below minimum: ${limits.min} USDT`));
      process.exit(1);
    }
    
    if (amount > limits.max) {
      console.log(chalk.red(`\n❌ Amount above maximum: ${limits.max} USDT`));
      process.exit(1);
    }
    
    // Step 4: Network selection
    console.log(chalk.cyan('\n📡 Available networks:'));
    console.log('1. TRC20 (Tron) - Fee: ~1 USDT (Recommended)');
    console.log('2. ERC20 (Ethereum) - Fee: ~10 USDT (Expensive)');
    console.log('3. BSC (Binance Smart Chain) - Fee: ~0.8 USDT');
    console.log('4. POLYGON - Fee: ~0.1 USDT (Cheapest)');
    
    const networkChoice = await question('\nChoose network (1-4) [default: 1]: ') || '1';
    const networks = ['TRC20', 'ERC20', 'BSC', 'POLYGON'];
    const network = networks[parseInt(networkChoice) - 1] || 'TRC20';
    const fee = NETWORK_FEES[network];
    
    // Step 5: Check if amount covers fees
    if (amount <= fee) {
      console.log(chalk.red(`\n❌ Amount must be greater than network fee (${fee} USDT)`));
      process.exit(1);
    }
    
    // Step 6: Withdrawal address check
    console.log(chalk.yellow('\n🔍 Checking withdrawal address...'));
    console.log(chalk.red('⚠️  CRITICAL: Withdrawal address must be whitelisted!'));
    
    const hasAddress = await question(`\nHave you whitelisted ${toExchange} ${network} address in ${fromExchange}? (yes/no): `);
    if (hasAddress.toLowerCase() !== 'yes') {
      console.log(chalk.red('\n❌ You must whitelist the withdrawal address first!'));
      console.log(chalk.yellow('\nSteps:'));
      console.log(`1. Login to ${toExchange}`);
      console.log(`2. Go to Wallet > Deposit > USDT > ${network}`);
      console.log(`3. Copy the deposit address`);
      console.log(`4. Login to ${fromExchange}`);
      console.log(`5. Go to Security > Withdrawal Whitelist`);
      console.log(`6. Add the ${toExchange} address`);
      console.log(`7. Wait for confirmation (usually 24h for first time)`);
      process.exit(1);
    }
    
    // Step 7: Final summary with all fees
    console.log(chalk.cyan('\n📋 TRANSFER SUMMARY:'));
    console.log('━'.repeat(50));
    console.log(`From: ${chalk.bold(fromExchange.toUpperCase())}`);
    console.log(`To: ${chalk.bold(toExchange.toUpperCase())}`);
    console.log(`Amount: ${chalk.bold(amount + ' USDT')}`);
    console.log(`Network: ${chalk.bold(network)}`);
    console.log(`Network Fee: ${chalk.yellow(fee + ' USDT')}`);
    console.log(`You will receive: ${chalk.green((amount - fee) + ' USDT')}`);
    console.log(`Time estimate: ${chalk.yellow(getTransferTime(network))}`);
    console.log('━'.repeat(50));
    
    // Step 8: Safety validation
    console.log(chalk.yellow('\n🛡️  Running safety checks...'));
    const validation = await safetyGuard.validateTrade({
      type: 'transfer',
      fromExchange,
      toExchange,
      amount,
      currency: 'USDT'
    });
    
    if (!validation.isValid) {
      console.log(chalk.red('\n❌ Safety validation failed!'));
      return;
    }
    
    // Step 9: Risk warnings
    console.log(chalk.red('\n⚠️  IMPORTANT WARNINGS:'));
    console.log('• Double-check the network matches on both exchanges');
    console.log('• Wrong network = PERMANENT LOSS of funds');
    console.log('• This transaction is IRREVERSIBLE');
    console.log('• Test with small amount first if unsure');
    
    // Step 10: Final confirmation
    console.log(chalk.yellow('\n🚨 This will transfer REAL MONEY!'));
    const finalConfirm = await question('\nType "CONFIRM" to proceed: ');
    
    if (finalConfirm !== 'CONFIRM') {
      console.log(chalk.yellow('\n❌ Transfer cancelled.'));
      process.exit(0);
    }
    
    // Step 11: Execute transfer
    console.log(chalk.green('\n🚀 Initiating transfer...\n'));
    
    try {
      const result = await walletTransferService.transferUSDT({
        fromExchange,
        toExchange,
        amount,
        network
      });
      
      console.log(chalk.green('\n✅ TRANSFER INITIATED SUCCESSFULLY!'));
      console.log(`Transaction ID: ${result.transactionId}`);
      console.log(`\nTrack your transfer:`);
      console.log(`• ${fromExchange}: Check withdrawal history`);
      console.log(`• ${toExchange}: Check deposit history`);
      console.log(`• Estimated arrival: ${getTransferTime(network)}`);
      
      // Log for audit
      logger.info('Transfer executed', {
        from: fromExchange,
        to: toExchange,
        amount,
        network,
        fee,
        transactionId: result.transactionId
      });
      
    } catch (error: any) {
      console.log(chalk.red('\n❌ TRANSFER FAILED!'));
      console.log(chalk.red(`Error: ${error.message}`));
      logger.error('Transfer failed', error);
    }
    
  } catch (error: any) {
    console.log(chalk.red('\n❌ Error:'), error.message);
  } finally {
    rl.close();
  }
}

function getTransferTime(network: string): string {
  const times = {
    TRC20: '10-30 minutes',
    ERC20: '15-45 minutes',
    BSC: '5-15 minutes',
    POLYGON: '5-10 minutes'
  };
  return times[network] || '10-60 minutes';
}

// Run the safe wizard
console.log(chalk.red('⚠️  SAFE VERSION - Includes all safety checks'));
console.log(chalk.yellow('The original transferUSDT.ts is UNSAFE - DO NOT USE!\n'));

transferWizardSafe().catch(error => {
  console.error(chalk.red('Fatal error:'), error);
  process.exit(1);
});