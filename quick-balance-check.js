const ccxt = require('ccxt');
require('dotenv').config();

console.log('\n💰 Quick Balance Check\n');
console.log('Testing with your whitelisted IPs...\n');

async function quickCheck() {
    // Test Binance
    try {
        console.log('1. Checking Binance...');
        const binance = new ccxt.binance({
            apiKey: process.env.BINANCE_API_KEY,
            secret: process.env.BINANCE_API_SECRET,
            enableRateLimit: true,
            options: { defaultType: 'spot' }
        });
        
        const balance = await binance.fetchBalance();
        const usdt = balance.USDT || { free: 0, used: 0, total: 0 };
        
        console.log('✅ Binance Connected!');
        console.log(`   Free USDT: ${usdt.free}`);
        console.log(`   Locked USDT: ${usdt.used}`);
        console.log(`   Total USDT: ${usdt.total}`);
        
        if (usdt.total > 0) {
            console.log(`\n   💡 You have ${usdt.total} USDT on Binance!`);
            if (usdt.total >= 100) {
                console.log('   ✅ Ready for P2P trading!');
            }
        }
    } catch (e) {
        console.log('❌ Binance Error:', e.message);
        if (e.message.includes('IP')) {
            console.log('   → Add your IP to Binance API whitelist');
        }
    }
    
    // Test KuCoin
    try {
        console.log('\n2. Checking KuCoin...');
        const kucoin = new ccxt.kucoin({
            apiKey: process.env.KUCOIN_API_KEY,
            secret: process.env.KUCOIN_API_SECRET,
            password: process.env.KUCOIN_PASSPHRASE,
            enableRateLimit: true
        });
        
        const balance = await kucoin.fetchBalance();
        const usdt = balance.USDT || { free: 0, used: 0, total: 0 };
        
        console.log('✅ KuCoin Connected!');
        console.log(`   Free USDT: ${usdt.free}`);
        console.log(`   Total USDT: ${usdt.total}`);
        
    } catch (e) {
        console.log('❌ KuCoin Error:', e.message);
        if (e.message.includes('400006')) {
            console.log('   → Add 150.230.235.0 to KuCoin API whitelist');
        }
    }
    
    console.log('\n📋 Summary:');
    console.log('- Oracle Cloud IP: 150.230.235.0');
    console.log('- Your current IP: 45.127.45.93');
    console.log('- Make sure both are whitelisted if testing locally');
}

quickCheck();