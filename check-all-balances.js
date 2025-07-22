const ccxt = require('ccxt');
require('dotenv').config();

async function checkAllBalances() {
    console.log('\n💰 CHECKING ALL EXCHANGE BALANCES\n');
    console.log('━'.repeat(60));
    
    // Initialize exchanges
    const exchanges = {
        // binance: new ccxt.binance({
        //     apiKey: process.env.BINANCE_API_KEY,
        //     secret: process.env.BINANCE_API_SECRET,
        //     enableRateLimit: true
        // }),
        kucoin: new ccxt.kucoin({
            apiKey: process.env.KUCOIN_API_KEY,
            secret: process.env.KUCOIN_API_SECRET,
            password: process.env.KUCOIN_PASSPHRASE,
            enableRateLimit: true
        })
    };
    
    let totalUSDT = 0;
    let totalINR = 0;
    
    for (const [name, exchange] of Object.entries(exchanges)) {
        try {
            console.log(`\n📊 ${name.toUpperCase()} Balance:`);
            const balance = await exchange.fetchBalance();
            
            // Show USDT balance
            const usdtBalance = balance.USDT?.free || 0;
            const usdtTotal = balance.USDT?.total || 0;
            const usdtUsed = balance.USDT?.used || 0;
            
            console.log(`   USDT Free: ${usdtBalance.toFixed(2)}`);
            if (usdtUsed > 0) {
                console.log(`   USDT Locked: ${usdtUsed.toFixed(2)}`);
            }
            console.log(`   USDT Total: ${usdtTotal.toFixed(2)}`);
            
            totalUSDT += usdtBalance;
            
            // Show INR if available
            if (balance.INR) {
                const inrBalance = balance.INR.free || 0;
                console.log(`   INR: ₹${inrBalance.toFixed(2)}`);
                totalINR += inrBalance;
            }
            
        } catch (error) {
            console.log(`   ❌ Error: ${error.message}`);
        }
    }
    
    // Check ZebPay manually (if not in CCXT)
    console.log(`\n📊 ZEBPAY Balance:`);
    console.log(`   ⚠️  Please check manually in ZebPay app`);
    console.log(`   Expected: Some INR balance for buying USDT`);
    
    // Check Binance P2P
    console.log(`\n📊 BINANCE P2P Balance:`);
    console.log(`   ⚠️  Please check in Binance app:`);
    console.log(`   Wallet → Spot → USDT`);
    console.log(`   P2P → Orders → Check active/completed orders`);
    
    console.log('\n' + '━'.repeat(60));
    console.log('\n📈 SUMMARY:');
    console.log(`Total USDT (from APIs): ${totalUSDT.toFixed(2)} USDT`);
    console.log(`Total INR (from APIs): ₹${totalINR.toFixed(2)}`);
    
    console.log('\n💡 TRADING CAPACITY:');
    if (totalUSDT >= 100) {
        console.log(`✅ You have ${totalUSDT.toFixed(2)} USDT available`);
        console.log(`✅ Can execute 100 USDT P2P trades`);
        console.log(`✅ Can access merchants with ₹9,000-10,000 minimums`);
    } else if (totalUSDT > 0) {
        console.log(`⚠️  Only ${totalUSDT.toFixed(2)} USDT available`);
        console.log(`⚠️  May be limited to smaller P2P trades`);
    }
    
    console.log('\n🔍 MANUAL CHECKS NEEDED:');
    console.log('1. ZebPay: Check INR balance for buying');
    console.log('2. ZebPay: Check USDT balance if any');
    console.log('3. Binance: Check Spot wallet USDT');
    console.log('4. Binance: Check P2P order history');
    console.log('5. CoinDCX: Check if withdrawals enabled');
}

checkAllBalances().catch(console.error);