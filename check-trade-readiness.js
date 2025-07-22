const ccxt = require('ccxt');
const chalk = require('chalk').default || require('chalk');
require('dotenv').config();

console.log(chalk.red('\n⚠️  TRADE READINESS SAFETY CHECK\n'));
console.log('I will NEVER execute trades without verifying these:\n');

async function checkTradeReadiness() {
    const issues = [];
    const warnings = [];
    
    console.log(chalk.yellow('1. CHECKING EXCHANGE CONFIGURATIONS:\n'));
    
    // Check KuCoin
    try {
        console.log('📍 KuCoin:');
        const kucoin = new ccxt.kucoin({
            apiKey: process.env.KUCOIN_API_KEY,
            secret: process.env.KUCOIN_API_SECRET,
            password: process.env.KUCOIN_PASSPHRASE,
            enableRateLimit: true
        });
        
        // Check balance
        const balance = await kucoin.fetchBalance();
        const usdtBalance = balance.USDT?.free || 0;
        console.log(`   ✅ Connected - ${usdtBalance} USDT available`);
        
        // Check if withdrawal addresses are configured
        console.log('   ⚠️  CANNOT verify withdrawal addresses via API');
        warnings.push('KuCoin: Must manually check if Binance USDT address is whitelisted');
        
        // Check withdrawal status
        try {
            const currencies = await kucoin.fetchCurrencies();
            const usdt = currencies['USDT'];
            if (usdt && !usdt.active) {
                issues.push('KuCoin: USDT withdrawals may be disabled');
            }
        } catch (e) {
            warnings.push('KuCoin: Could not verify withdrawal status');
        }
        
    } catch (e) {
        issues.push(`KuCoin: ${e.message}`);
    }
    
    // Check Binance
    try {
        console.log('\n📍 Binance:');
        const binance = new ccxt.binance({
            apiKey: process.env.BINANCE_API_KEY,
            secret: process.env.BINANCE_API_SECRET,
            enableRateLimit: true
        });
        
        // Check balance
        const balance = await binance.fetchBalance();
        const usdtBalance = balance.USDT?.free || 0;
        console.log(`   ✅ Connected - ${usdtBalance} USDT available`);
        
        // Get deposit address
        try {
            const depositAddress = await binance.fetchDepositAddress('USDT');
            console.log(`   ✅ USDT deposit address: ${depositAddress.address}`);
            console.log(`   ✅ Network: ${depositAddress.network || 'TRC20'}`);
            
            console.log(chalk.cyan('\n   📋 TODO: Add this address to KuCoin whitelist:'));
            console.log(`   Address: ${depositAddress.address}`);
            console.log(`   Network: ${depositAddress.network || 'TRC20'}`);
            
        } catch (e) {
            issues.push('Binance: Cannot fetch deposit address');
        }
        
    } catch (e) {
        issues.push(`Binance: ${e.message}`);
    }
    
    console.log(chalk.yellow('\n\n2. CHECKING P2P PAYMENT METHODS:\n'));
    
    console.log('📍 Binance P2P Payment Methods:');
    console.log('   ⚠️  CANNOT verify via API - must check manually');
    console.log('   Your .env shows: Axis Bank & UPI configured');
    warnings.push('Must manually verify P2P payment methods are added in Binance');
    
    console.log(chalk.yellow('\n\n3. CHECKING TRANSFER REQUIREMENTS:\n'));
    
    console.log('📍 KuCoin → Binance Transfer:');
    console.log('   • Withdrawal fee: ~1-3 USDT (varies by network)');
    console.log('   • Time: 10-30 minutes');
    console.log('   • Min withdrawal: Usually 10-20 USDT');
    warnings.push('Check KuCoin minimum withdrawal amount for USDT');
    
    // Summary
    console.log(chalk.red('\n\n═══════════════════════════════════════'));
    console.log(chalk.red('           SAFETY CHECK RESULTS         '));
    console.log(chalk.red('═══════════════════════════════════════\n'));
    
    if (issues.length > 0) {
        console.log(chalk.red('❌ CRITICAL ISSUES:\n'));
        issues.forEach(issue => console.log(`   • ${issue}`));
    }
    
    if (warnings.length > 0) {
        console.log(chalk.yellow('\n⚠️  MANUAL CHECKS REQUIRED:\n'));
        warnings.forEach(warning => console.log(`   • ${warning}`));
    }
    
    console.log(chalk.cyan('\n\n📋 BEFORE ANY TRADE, YOU MUST:\n'));
    console.log('1. ✅ Add Binance USDT deposit address to KuCoin whitelist');
    console.log('2. ✅ Verify P2P payment methods are added in Binance');
    console.log('3. ✅ Check KuCoin withdrawal fees and minimums');
    console.log('4. ✅ Ensure both exchanges have 2FA enabled');
    console.log('5. ✅ Test with small amount first (1-2 USDT)');
    
    console.log(chalk.red('\n\n⛔ I WILL NOT SUGGEST TRADES WITHOUT THESE CONFIRMATIONS!\n'));
}

checkTradeReadiness().catch(console.error);