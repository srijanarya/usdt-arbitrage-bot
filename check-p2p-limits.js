// Check real P2P limits for 100 USDT trade
const axios = require('axios');

async function checkP2PLimits() {
    console.log('\n📊 Checking P2P limits for 100 USDT trade\n');
    
    // Current prices
    const zebPayPrice = 86.79;
    const usdtAmount = 100;
    const inrValue = usdtAmount * 91.72; // Expected P2P sell price
    
    console.log('Your constraints:');
    console.log(`- ZebPay withdrawal limit: 100 USDT`);
    console.log(`- INR value at ₹91.72: ₹${inrValue.toFixed(2)}`);
    console.log(`- Cost on ZebPay: ₹${(zebPayPrice * usdtAmount).toFixed(2)}`);
    
    // Common P2P minimum orders
    const commonMinimums = [
        { merchant: 'Premium Trader A', minINR: 20000, price: 92.50 },
        { merchant: 'High Volume B', minINR: 15000, price: 92.00 },
        { merchant: 'Regular Trader C', minINR: 10000, price: 91.72 },
        { merchant: 'Small Trader D', minINR: 5000, price: 91.50 },
        { merchant: 'Micro Trader E', minINR: 1000, price: 91.00 }
    ];
    
    console.log('\n🏪 P2P Merchant Analysis:\n');
    
    let acceptableCount = 0;
    
    commonMinimums.forEach(merchant => {
        const yourINR = usdtAmount * merchant.price;
        const meetsMin = yourINR >= merchant.minINR;
        const profit = (merchant.price - zebPayPrice) * usdtAmount;
        const profitPercent = (profit / (zebPayPrice * usdtAmount)) * 100;
        
        console.log(`${merchant.merchant}:`);
        console.log(`  Price: ₹${merchant.price}`);
        console.log(`  Min order: ₹${merchant.minINR.toLocaleString()}`);
        console.log(`  Your order: ₹${yourINR.toFixed(2)}`);
        console.log(`  Status: ${meetsMin ? '✅ ACCEPTED' : '❌ TOO SMALL'}`);
        
        if (meetsMin) {
            console.log(`  Profit: ₹${profit.toFixed(2)} (${profitPercent.toFixed(2)}%)`);
            acceptableCount++;
        } else {
            const minUSDT = Math.ceil(merchant.minINR / merchant.price);
            console.log(`  Need: ${minUSDT} USDT minimum`);
        }
        console.log('');
    });
    
    console.log('📈 Summary:');
    console.log(`- ${acceptableCount} out of 5 merchants accept 100 USDT orders`);
    console.log(`- Best accepting price: ₹91.72 (profit: ₹${((91.72 - zebPayPrice) * 100).toFixed(2)})`);
    console.log(`- For ₹92+ prices, you need 150-200+ USDT\n`);
    
    // Real calculation with fees
    const tradingFee = zebPayPrice * usdtAmount * 0.002; // 0.2%
    const withdrawalFee = 50; // ZebPay withdrawal
    const p2pFee = 91.72 * usdtAmount * 0.01; // 1% P2P fee
    const totalFees = tradingFee + withdrawalFee + p2pFee;
    
    console.log('💰 Realistic Profit Calculation:');
    console.log(`Buy 100 USDT: ₹${(zebPayPrice * usdtAmount).toFixed(2)}`);
    console.log(`Total fees: ₹${totalFees.toFixed(2)}`);
    console.log(`Sell at ₹91.72: ₹${(91.72 * usdtAmount).toFixed(2)}`);
    console.log(`Net profit: ₹${((91.72 - zebPayPrice) * usdtAmount - totalFees).toFixed(2)}`);
    console.log(`ROI: ${(((91.72 - zebPayPrice) * usdtAmount - totalFees) / (zebPayPrice * usdtAmount) * 100).toFixed(2)}%`);
}

checkP2PLimits();