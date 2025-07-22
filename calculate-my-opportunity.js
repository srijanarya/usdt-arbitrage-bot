const axios = require('axios');
const chalk = require('chalk').default || require('chalk');

async function calculateMyOpportunity() {
    console.log(chalk.cyan('\n💰 Calculating Your Real P2P Opportunity\n'));
    console.log('━'.repeat(60));
    
    // Your actual situation
    const yourUSDT = 15.28;
    const yourLocation = 'KuCoin';
    const yourPaymentMethods = ['UPI', 'BankIndia'];
    
    console.log('Your Status:');
    console.log(`  USDT: ${yourUSDT} on ${yourLocation}`);
    console.log(`  Payment Methods: ${yourPaymentMethods.join(', ')}`);
    console.log(`  Value at ₹91: ₹${(yourUSDT * 91).toFixed(2)}\n`);
    
    // Fetch real P2P merchants
    try {
        const response = await axios.post('https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search', {
            page: 1,
            rows: 20,
            asset: 'USDT',
            fiat: 'INR',
            tradeType: 'BUY', // They buy, you sell
            transAmount: yourUSDT * 91 // Your INR amount
        });
        
        const merchants = response.data.data || [];
        console.log(chalk.yellow(`\nFound ${merchants.length} P2P buyers:\n`));
        
        // Filter compatible merchants
        const compatible = merchants.filter(ad => {
            const merchantMethods = ad.adv.tradeMethods.map(m => m.identifier || m.tradeMethodName);
            const hasCompatible = merchantMethods.some(method => 
                yourPaymentMethods.includes(method) ||
                (method === 'IMPS' && yourPaymentMethods.includes('BankIndia')) ||
                (method === 'Bank Transfer' && yourPaymentMethods.includes('BankIndia'))
            );
            
            const meetsMin = parseFloat(ad.adv.minSingleTransAmount) <= (yourUSDT * parseFloat(ad.adv.price));
            const meetsMax = parseFloat(ad.adv.maxSingleTransAmount) >= (yourUSDT * parseFloat(ad.adv.price));
            
            return hasCompatible && meetsMin && meetsMax;
        });
        
        console.log(`✅ ${compatible.length} merchants accept your payment methods and amount\n`);
        
        // Calculate profit for each
        console.log(chalk.cyan('Top 5 Compatible Opportunities:\n'));
        
        compatible.slice(0, 5).forEach((ad, i) => {
            const price = parseFloat(ad.adv.price);
            const revenue = yourUSDT * price;
            const merchantMethods = ad.adv.tradeMethods.map(m => m.identifier || m.tradeMethodName);
            
            // Fees
            const withdrawalFee = 0; // Already on exchange
            const p2pFee = revenue * 0.001; // 0.1% taker fee
            const bankFee = 10; // Bank transfer fee
            const totalFees = withdrawalFee + p2pFee + bankFee;
            
            const netRevenue = revenue - totalFees;
            
            // If you had bought at ZebPay
            const zebPayCost = yourUSDT * 86.80;
            const profit = netRevenue - zebPayCost;
            const roi = (profit / zebPayCost) * 100;
            
            console.log(`${i + 1}. Merchant: ${ad.advertiser.nickName}`);
            console.log(`   Price: ₹${price}`);
            console.log(`   Revenue: ₹${revenue.toFixed(2)}`);
            console.log(`   Fees: ₹${totalFees.toFixed(2)}`);
            console.log(`   Net: ₹${netRevenue.toFixed(2)}`);
            console.log(`   Methods: ${merchantMethods.join(', ')}`);
            console.log(`   Orders: ${ad.advertiser.monthOrderCount} (${ad.advertiser.monthFinishRate}% completion)`);
            console.log(`   Limits: ₹${ad.adv.minSingleTransAmount} - ₹${ad.adv.maxSingleTransAmount}`);
            
            if (yourLocation === 'KuCoin') {
                console.log(chalk.green(`   💡 Profit if bought at ₹86.80: ₹${profit.toFixed(2)} (${roi.toFixed(2)}% ROI)`));
            }
            
            console.log('');
        });
        
        // Best opportunity
        if (compatible.length > 0) {
            const best = compatible[0];
            const bestPrice = parseFloat(best.adv.price);
            const bestRevenue = yourUSDT * bestPrice;
            
            console.log(chalk.green('\n✅ RECOMMENDED ACTION:\n'));
            console.log(`1. Transfer ${yourUSDT} USDT from KuCoin to Binance`);
            console.log(`2. Create P2P sell order at ₹${bestPrice}`);
            console.log(`3. Receive ₹${bestRevenue.toFixed(2)} via ${best.adv.tradeMethods[0].identifier}`);
            console.log(`4. Net after fees: ₹${(bestRevenue - 11.4).toFixed(2)}`);
            
            console.log(chalk.yellow('\n⚠️  Note: Since you already own USDT on KuCoin,'));
            console.log('your profit depends on your original purchase price.');
        }
        
    } catch (error) {
        console.log('Error fetching P2P data:', error.message);
    }
}

calculateMyOpportunity();