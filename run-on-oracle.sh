#!/bin/bash

echo "🚀 Running Balance Check on Oracle Cloud"
echo "Using whitelisted IP: 150.230.235.0"
echo "========================================"

# SSH to Oracle and run balance check
ssh -i ~/Downloads/ssh-key-2025-07-21.key opc@150.230.235.0 << 'EOF'
cd /home/opc/usdt-arbitrage-bot

# Create and run balance checker
cat > check-oracle-balance.js << 'SCRIPT'
const ccxt = require('ccxt');
require('dotenv').config();

async function checkBalances() {
    console.log('\n💰 Checking Balances from Oracle Cloud\n');
    console.log('IP: 150.230.235.0 (whitelisted)\n');
    
    let totalUSDT = 0;
    
    // Check Binance
    try {
        console.log('1. Binance:');
        const binance = new ccxt.binance({
            apiKey: process.env.BINANCE_API_KEY,
            secret: process.env.BINANCE_API_SECRET,
            enableRateLimit: true
        });
        
        const balance = await binance.fetchBalance();
        const usdt = balance.USDT || { free: 0, used: 0, total: 0 };
        
        console.log('   ✅ Connected!');
        console.log('   Free USDT:', usdt.free);
        console.log('   Locked USDT:', usdt.used);
        console.log('   Total USDT:', usdt.total);
        
        totalUSDT += usdt.total;
        
    } catch (e) {
        console.log('   ❌ Error:', e.message);
    }
    
    // Check KuCoin
    try {
        console.log('\n2. KuCoin:');
        const kucoin = new ccxt.kucoin({
            apiKey: process.env.KUCOIN_API_KEY,
            secret: process.env.KUCOIN_API_SECRET,
            password: process.env.KUCOIN_PASSPHRASE,
            enableRateLimit: true
        });
        
        const balance = await kucoin.fetchBalance();
        const usdt = balance.USDT || { free: 0, used: 0, total: 0 };
        
        console.log('   ✅ Connected!');
        console.log('   Free USDT:', usdt.free);
        console.log('   Total USDT:', usdt.total);
        
        totalUSDT += usdt.total;
        
    } catch (e) {
        console.log('   ❌ Error:', e.message);
    }
    
    console.log('\n📊 TOTAL USDT:', totalUSDT);
    
    if (totalUSDT >= 100) {
        console.log('✅ Ready for P2P trading!');
    } else if (totalUSDT > 0) {
        console.log('⚠️  Have', totalUSDT, 'USDT - need', (100 - totalUSDT), 'more for optimal trading');
    }
}

checkBalances().catch(console.error);
SCRIPT

node check-oracle-balance.js
EOF