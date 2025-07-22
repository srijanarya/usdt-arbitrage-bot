#!/bin/bash

echo "🔍 Testing Exchange APIs from Oracle Cloud (150.230.235.0)"
echo "=========================================================="
echo

# SSH to Oracle and run balance check
ssh opc@150.230.235.0 << 'EOF'
cd /home/opc/usdt-arbitrage-bot

# Create a simple balance checker
cat > test-apis.js << 'SCRIPT'
const ccxt = require('ccxt');
require('dotenv').config();

async function testAPIs() {
    console.log('Testing from Oracle Cloud IP: 150.230.235.0\n');
    
    // Test Binance
    try {
        console.log('1. Testing Binance API...');
        const binance = new ccxt.binance({
            apiKey: process.env.BINANCE_API_KEY,
            secret: process.env.BINANCE_API_SECRET,
            enableRateLimit: true
        });
        
        const balance = await binance.fetchBalance();
        console.log('✅ Binance connected!');
        console.log('   USDT:', balance.USDT?.free || 0);
        console.log('   Total USDT:', balance.USDT?.total || 0);
    } catch (e) {
        console.log('❌ Binance:', e.message);
    }
    
    // Test KuCoin
    try {
        console.log('\n2. Testing KuCoin API...');
        const kucoin = new ccxt.kucoin({
            apiKey: process.env.KUCOIN_API_KEY,
            secret: process.env.KUCOIN_API_SECRET,
            password: process.env.KUCOIN_PASSPHRASE,
            enableRateLimit: true
        });
        
        const balance = await kucoin.fetchBalance();
        console.log('✅ KuCoin connected!');
        console.log('   USDT:', balance.USDT?.free || 0);
        console.log('   Total USDT:', balance.USDT?.total || 0);
    } catch (e) {
        console.log('❌ KuCoin:', e.message);
    }
}

testAPIs().catch(console.error);
SCRIPT

# Run the test
node test-apis.js
EOF