import { ZebPayService } from './src/services/ZebPayService';
import { logger } from './src/utils/logger';
import chalk from 'chalk';
import dotenv from 'dotenv';

dotenv.config();

async function executeZebPayToP2PTrade() {
    console.log(chalk.cyan('\n🚀 Executing ZebPay to P2P Arbitrage Trade\n'));
    
    const zebpay = new ZebPayService();
    
    try {
        // 1. Check current ZebPay price
        console.log(chalk.yellow('📊 Checking current ZebPay prices...'));
        const ticker = await zebpay.fetchTicker('USDT/INR');
        console.log(`Current ZebPay Buy Price: ₹${ticker.ask}`);
        console.log(`Current ZebPay Sell Price: ₹${ticker.bid}\n`);
        
        // 2. Check ZebPay balance
        console.log(chalk.yellow('💰 Checking ZebPay balance...'));
        const balance = await zebpay.fetchBalance();
        console.log(`USDT Balance: ${balance.USDT.free} USDT`);
        console.log(`INR Balance: ₹${balance.INR.free}\n`);
        
        // 3. Calculate trade amount (start small)
        const tradeAmount = Math.min(100, balance.INR.free / ticker.ask); // Max 100 USDT or available balance
        const costInINR = tradeAmount * ticker.ask;
        
        console.log(chalk.cyan(`📈 Trade Details:`));
        console.log(`- Buy Amount: ${tradeAmount.toFixed(2)} USDT`);
        console.log(`- Cost: ₹${costInINR.toFixed(2)}`);
        console.log(`- Expected P2P Sell Price: ₹90-95`);
        console.log(`- Expected Profit: ₹${((90 - ticker.ask) * tradeAmount).toFixed(2)} to ₹${((95 - ticker.ask) * tradeAmount).toFixed(2)}\n`);
        
        // 4. Confirm trade
        console.log(chalk.yellow('⚠️  Ready to execute trade. Type "yes" to proceed:'));
        const readline = require('readline').createInterface({
            input: process.stdin,
            output: process.stdout
        });
        
        readline.question('Proceed with trade? (yes/no): ', async (answer) => {
            if (answer.toLowerCase() === 'yes') {
                console.log(chalk.green('\n✅ Executing buy order on ZebPay...'));
                
                try {
                    // Place market buy order
                    const order = await zebpay.createMarketBuyOrder('USDT/INR', tradeAmount);
                    console.log(chalk.green(`✅ Order placed successfully!`));
                    console.log(`Order ID: ${order.id}`);
                    console.log(`Status: ${order.status}`);
                    console.log(`Filled: ${order.filled} USDT at ₹${order.average || ticker.ask}`);
                    
                    console.log(chalk.cyan('\n📱 Next Steps:'));
                    console.log('1. Go to Binance P2P or other P2P platform');
                    console.log('2. Create a sell order at ₹90-95');
                    console.log('3. Complete the P2P trade');
                    console.log(`4. Expected profit: ₹${((90 - ticker.ask) * order.filled).toFixed(2)}+`);
                    
                } catch (error: any) {
                    console.error(chalk.red('❌ Trade failed:'), error.message);
                }
            } else {
                console.log(chalk.yellow('Trade cancelled.'));
            }
            
            readline.close();
            process.exit(0);
        });
        
    } catch (error: any) {
        console.error(chalk.red('❌ Error:'), error.message);
        process.exit(1);
    }
}

// Run the trade
executeZebPayToP2PTrade();