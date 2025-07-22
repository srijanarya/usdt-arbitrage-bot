const axios = require('axios');
const chalk = require('chalk').default || require('chalk');

async function checkP2PPaymentMethods() {
    console.log(chalk.cyan('\n💳 P2P Payment Methods Analysis\n'));
    console.log('━'.repeat(60));
    
    // Your configured payment methods
    console.log(chalk.yellow('\n📱 Your Configured Payment Methods:\n'));
    console.log('1. Bank Transfer:');
    console.log('   • Bank: Axis Bank');
    console.log('   • Account: 914010032212511');
    console.log('   • IFSC: UTIB0000455');
    console.log('   • Name: SRIJAN INDERJEET ARYA');
    console.log('\n2. UPI:');
    console.log('   • UPI ID: srijanaryay@okaxis');
    
    // Common P2P payment methods on Binance
    console.log(chalk.yellow('\n\n📊 Binance P2P Payment Methods:\n'));
    
    const paymentMethods = [
        { 
            name: 'Bank Transfer (IMPS/NEFT/RTGS)',
            code: 'BankIndia',
            minAmount: '₹1,000',
            maxAmount: '₹2,00,000',
            yourStatus: '✅ Ready (Axis Bank configured)',
            merchants: 'Most merchants',
            speed: '5-30 mins'
        },
        {
            name: 'UPI',
            code: 'UPI',
            minAmount: '₹100',
            maxAmount: '₹1,00,000',
            yourStatus: '✅ Ready (srijanaryay@okaxis)',
            merchants: '90% of merchants',
            speed: 'Instant'
        },
        {
            name: 'Paytm',
            code: 'Paytm',
            minAmount: '₹100',
            maxAmount: '₹50,000',
            yourStatus: '❌ Not configured',
            merchants: '30% of merchants',
            speed: 'Instant'
        },
        {
            name: 'PhonePe',
            code: 'PhonePe',
            minAmount: '₹100',
            maxAmount: '₹1,00,000',
            yourStatus: '❌ Not configured',
            merchants: '40% of merchants',
            speed: 'Instant'
        },
        {
            name: 'Google Pay',
            code: 'GooglePay',
            minAmount: '₹100',
            maxAmount: '₹1,00,000',
            yourStatus: '❌ Not configured',
            merchants: '35% of merchants',
            speed: 'Instant'
        }
    ];
    
    paymentMethods.forEach(method => {
        console.log(`${method.name}:`);
        console.log(`   Status: ${method.yourStatus}`);
        console.log(`   Limits: ${method.minAmount} - ${method.maxAmount}`);
        console.log(`   Speed: ${method.speed}`);
        console.log(`   Availability: ${method.merchants}`);
        console.log('');
    });
    
    // Check current P2P ads
    console.log(chalk.yellow('\n🔍 Checking Live P2P Ads...\n'));
    
    try {
        const response = await axios.post('https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search', {
            page: 1,
            rows: 10,
            payTypes: [],
            countries: [],
            proMerchantAds: false,
            asset: 'USDT',
            fiat: 'INR',
            tradeType: 'BUY', // Merchants buying USDT (you sell)
            transAmount: 1500 // For 15 USDT at ~₹100
        });
        
        const ads = response.data.data || [];
        console.log(`Found ${ads.length} buyers for your USDT:\n`);
        
        // Analyze payment methods
        const methodCount = {};
        ads.forEach(ad => {
            ad.adv.tradeMethods.forEach(method => {
                const name = method.identifier || method.tradeMethodName;
                methodCount[name] = (methodCount[name] || 0) + 1;
            });
        });
        
        console.log('Payment methods accepted by buyers:');
        Object.entries(methodCount)
            .sort((a, b) => b[1] - a[1])
            .forEach(([method, count]) => {
                const percentage = (count / ads.length * 100).toFixed(0);
                const status = (method === 'BankIndia' || method === 'UPI') ? '✅' : '❌';
                console.log(`   ${status} ${method}: ${count}/${ads.length} buyers (${percentage}%)`);
            });
        
        // Show best buyers accepting your payment methods
        console.log(chalk.yellow('\n\n💰 Best Buyers Accepting Your Payment Methods:\n'));
        
        const yourMethodBuyers = ads.filter(ad => 
            ad.adv.tradeMethods.some(m => 
                m.identifier === 'BankIndia' || 
                m.identifier === 'UPI' ||
                m.tradeMethodName === 'Bank Transfer' ||
                m.tradeMethodName === 'UPI'
            )
        );
        
        yourMethodBuyers.slice(0, 5).forEach((ad, i) => {
            const methods = ad.adv.tradeMethods.map(m => m.identifier || m.tradeMethodName).join(', ');
            console.log(`${i + 1}. Price: ₹${ad.adv.price}`);
            console.log(`   Min-Max: ₹${ad.adv.minSingleTransAmount} - ₹${ad.adv.maxSingleTransAmount}`);
            console.log(`   Methods: ${methods}`);
            console.log(`   Completion: ${ad.advertiser.monthFinishRate}% (${ad.advertiser.monthOrderCount} orders)`);
            console.log('');
        });
        
    } catch (error) {
        console.log('Could not fetch live P2P data');
    }
    
    // Setup recommendations
    console.log(chalk.cyan('\n\n📋 Recommendations:\n'));
    console.log('1. ✅ You\'re ready to trade with Bank Transfer & UPI');
    console.log('2. 💡 Most merchants accept your payment methods');
    console.log('3. 🎯 For 15.28 USDT (~₹1,450), use UPI for instant payment');
    console.log('4. ⚡ Bank transfer works for larger amounts');
    
    console.log(chalk.yellow('\n\n🔧 To Add More Payment Methods in Binance:\n'));
    console.log('1. Go to Binance P2P → Payment Methods');
    console.log('2. Click "Add Payment Method"');
    console.log('3. Popular additions:');
    console.log('   • Paytm (for more merchant options)');
    console.log('   • PhonePe/Google Pay (widely accepted)');
    console.log('   • Another bank account');
}

checkP2PPaymentMethods();