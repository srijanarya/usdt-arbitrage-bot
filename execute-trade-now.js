const ccxt = require('ccxt');
const chalk = require('chalk').default || require('chalk');
require('dotenv').config();

async function executeZebPayTrade() {
    console.log(chalk.cyan('\n🚀 Executing ZebPay USDT Purchase\n'));
    
    // Initialize ZebPay exchange
    const zebpay = new ccxt.zebpay({
        apiKey: process.env.ZEBPAY_API_KEY,
        secret: process.env.ZEBPAY_API_SECRET,
        enableRateLimit: true
    });
    
    try {
        // 1. Check markets
        console.log(chalk.yellow('Loading markets...'));
        await zebpay.loadMarkets();
        
        // 2. Get current price
        console.log(chalk.yellow('Fetching current price...'));
        const ticker = await zebpay.fetchTicker('USDT/INR');
        console.log(`\nCurrent USDT/INR Price:`);
        console.log(`Buy Price (Ask): ₹${ticker.ask}`);
        console.log(`Sell Price (Bid): ₹${ticker.bid}`);
        
        // 3. Check balance
        console.log(chalk.yellow('\nChecking balance...'));
        const balance = await zebpay.fetchBalance();
        console.log(`INR Balance: ₹${balance.INR.free.toFixed(2)}`);
        console.log(`USDT Balance: ${balance.USDT.free.toFixed(2)} USDT`);
        
        // 4. Calculate trade
        const tradeAmount = 100; // USDT to buy
        const cost = tradeAmount * ticker.ask;
        const expectedP2PPrice = 90; // Conservative P2P price
        const expectedProfit = (expectedP2PPrice - ticker.ask) * tradeAmount;
        
        console.log(chalk.cyan(`\n📊 Trade Analysis:`));
        console.log(`Buy ${tradeAmount} USDT at ₹${ticker.ask} = ₹${cost.toFixed(2)}`);
        console.log(`Sell on P2P at ₹${expectedP2PPrice} = ₹${expectedP2PPrice * tradeAmount}`);
        console.log(chalk.green(`Expected Profit: ₹${expectedProfit.toFixed(2)} (${((expectedProfit/cost)*100).toFixed(2)}%)`));
        
        if (balance.INR.free < cost) {
            console.log(chalk.red('\n❌ Insufficient INR balance!'));
            return;
        }
        
        // 5. Execute trade
        console.log(chalk.yellow('\n⚠️  Ready to buy USDT. Press Enter to execute or Ctrl+C to cancel...'));
        
        const readline = require('readline').createInterface({
            input: process.stdin,
            output: process.stdout
        });
        
        readline.question('', async () => {
            try {
                console.log(chalk.green('\n✅ Placing market buy order...'));
                
                // Create market buy order
                const order = await zebpay.createMarketBuyOrder('USDT/INR', tradeAmount);
                
                console.log(chalk.green('\n✅ ORDER EXECUTED SUCCESSFULLY!'));
                console.log(`Order ID: ${order.id}`);
                console.log(`Status: ${order.status}`);
                console.log(`Amount: ${order.amount} USDT`);
                console.log(`Cost: ₹${order.cost || (order.amount * ticker.ask)}`);
                
                console.log(chalk.cyan('\n📱 Next Steps:'));
                console.log('1. Go to Binance P2P: https://p2p.binance.com/en/trade/sell/USDT');
                console.log('2. Set sell price: ₹90-95');
                console.log('3. Complete the P2P trade');
                console.log(`4. Your profit: ₹${expectedProfit.toFixed(2)}+`);
                
            } catch (error) {
                console.error(chalk.red('\n❌ Order failed:'), error.message);
            }
            
            readline.close();
        });
        
    } catch (error) {
        console.error(chalk.red('❌ Error:'), error.message);
    }
}

// Run the trade
executeZebPayTrade();