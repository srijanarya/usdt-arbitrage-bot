#!/usr/bin/env node
import crypto from 'crypto';
import axios from 'axios';
import ccxt from 'ccxt';
import { config } from 'dotenv';
import chalk from 'chalk';

config();

interface BinanceBalance {
  asset: string;
  free: string;
  locked: string;
}

interface TransferRecord {
  amount: string;
  asset: string;
  status: string;
  timestamp: number;
  type: string;
  tranId: number;
  fromAccountType?: string;
  toAccountType?: string;
}

class BinanceComprehensiveChecker {
  private apiKey: string;
  private apiSecret: string;
  private baseURL = 'https://api.binance.com';
  private recvWindow = 10000;

  constructor() {
    this.apiKey = process.env.BINANCE_API_KEY || '';
    this.apiSecret = process.env.BINANCE_API_SECRET || '';
  }

  private createSignature(queryString: string): string {
    return crypto
      .createHmac('sha256', this.apiSecret)
      .update(queryString)
      .digest('hex');
  }

  private async makeRequest(endpoint: string, params: any = {}): Promise<any> {
    const timestamp = Date.now();
    const queryParams = {
      ...params,
      recvWindow: this.recvWindow,
      timestamp
    };

    const queryString = Object.entries(queryParams)
      .map(([key, value]) => `${key}=${value}`)
      .join('&');

    const signature = this.createSignature(queryString);
    const url = `${this.baseURL}${endpoint}?${queryString}&signature=${signature}`;

    try {
      const response = await axios.get(url, {
        headers: {
          'X-MBX-APIKEY': this.apiKey,
          'Content-Type': 'application/json'
        }
      });
      return response.data;
    } catch (error: any) {
      throw new Error(`API Error: ${error.response?.data?.msg || error.message}`);
    }
  }

  async checkTimeSync(): Promise<boolean> {
    try {
      const response = await axios.get(`${this.baseURL}/api/v3/time`);
      const serverTime = response.data.serverTime;
      const localTime = Date.now();
      const timeDiff = Math.abs(serverTime - localTime);
      
      console.log(chalk.blue('⏰ Time Synchronization:'));
      console.log(`   Server Time: ${new Date(serverTime).toISOString()}`);
      console.log(`   Local Time:  ${new Date(localTime).toISOString()}`);
      console.log(`   Difference:  ${timeDiff}ms ${timeDiff > 5000 ? chalk.red('⚠️  Too high!') : chalk.green('✅ OK')}`);
      
      return timeDiff < 5000;
    } catch (error) {
      console.log(chalk.red('❌ Failed to check server time'));
      return false;
    }
  }

  async checkAPIPermissions(): Promise<void> {
    console.log(chalk.blue('\n🔑 API Key Permissions:'));
    try {
      const data = await this.makeRequest('/sapi/v1/account/apiRestrictions');
      
      console.log(`   IP Restrict: ${data.ipRestrict ? chalk.yellow('Yes') : chalk.green('No')}`);
      console.log(`   Enable Reading: ${data.enableReading ? chalk.green('✅') : chalk.red('❌')}`);
      console.log(`   Enable Spot Trading: ${data.enableSpotAndMarginTrading ? chalk.green('✅') : chalk.gray('❌')}`);
      console.log(`   Enable Withdrawals: ${data.enableWithdrawals ? chalk.yellow('✅') : chalk.gray('❌')}`);
      console.log(`   Enable Internal Transfer: ${data.enableInternalTransfer ? chalk.green('✅') : chalk.gray('❌')}`);
      console.log(`   Enable Universal Transfer: ${data.permitsUniversalTransfer ? chalk.green('✅') : chalk.gray('❌')}`);
      console.log(`   Enable Futures: ${data.enableFutures ? chalk.green('✅') : chalk.gray('❌')}`);
      
      if (data.ipRestrict && data.ipList) {
        console.log(`   Allowed IPs: ${data.ipList.join(', ')}`);
      }
    } catch (error: any) {
      console.log(chalk.red(`   ❌ Could not check permissions: ${error.message}`));
    }
  }

  async getSpotBalance(): Promise<void> {
    console.log(chalk.blue('\n💰 SPOT WALLET:'));
    try {
      const data = await this.makeRequest('/api/v3/account');
      const balances = data.balances.filter((b: BinanceBalance) => 
        parseFloat(b.free) > 0 || parseFloat(b.locked) > 0
      );

      if (balances.length === 0) {
        console.log('   No balances found');
      } else {
        balances.forEach((balance: BinanceBalance) => {
          const free = parseFloat(balance.free);
          const locked = parseFloat(balance.locked);
          const total = free + locked;
          console.log(`   ${balance.asset}: ${total} (${free} free + ${locked} locked)`);
        });
      }
    } catch (error: any) {
      console.log(chalk.red(`   ❌ Error: ${error.message}`));
    }
  }

  async getFundingBalance(): Promise<void> {
    console.log(chalk.blue('\n💼 FUNDING WALLET:'));
    try {
      // Method 1: Using user asset endpoint
      const data = await this.makeRequest('/sapi/v3/asset/getUserAsset');
      
      if (Array.isArray(data) && data.length > 0) {
        data.forEach((asset: any) => {
          if (parseFloat(asset.free) > 0 || parseFloat(asset.locked) > 0) {
            const free = parseFloat(asset.free);
            const locked = parseFloat(asset.locked);
            console.log(`   ${asset.asset}: ${free + locked} (${free} free + ${locked} locked)`);
          }
        });
      } else {
        console.log('   No funding wallet balances found');
      }
    } catch (error: any) {
      console.log(chalk.red(`   ❌ Error accessing funding wallet: ${error.message}`));
      
      // Try alternative method
      console.log('   Trying alternative method...');
      try {
        const data = await this.makeRequest('/sapi/v1/capital/config/getall');
        const assets = data.filter((asset: any) => parseFloat(asset.free) > 0);
        
        if (assets.length > 0) {
          assets.forEach((asset: any) => {
            console.log(`   ${asset.coin}: ${asset.free} (free)`);
          });
        } else {
          console.log('   No assets found in funding wallet');
        }
      } catch (altError: any) {
        console.log(chalk.red(`   ❌ Alternative method also failed: ${altError.message}`));
      }
    }
  }

  async getAllWalletBalances(): Promise<void> {
    console.log(chalk.blue('\n🏦 ALL WALLET BALANCES:'));
    try {
      // This endpoint shows all assets across all wallets
      const data = await this.makeRequest('/sapi/v1/asset/wallet/balance');
      
      if (Array.isArray(data) && data.length > 0) {
        const nonZeroBalances = data.filter((asset: any) => parseFloat(asset.balance) > 0);
        
        if (nonZeroBalances.length > 0) {
          console.log('   Assets across all wallets:');
          nonZeroBalances.forEach((asset: any) => {
            console.log(`   ${asset.asset}: ${asset.balance} (Wallet: ${asset.walletName || 'Unknown'})`);
          });
        } else {
          console.log('   No balances found across all wallets');
        }
      }
    } catch (error: any) {
      console.log(chalk.red(`   ❌ Could not fetch all wallet balances: ${error.message}`));
    }
  }

  async getTransferHistory(): Promise<void> {
    console.log(chalk.blue('\n📋 TRANSFER HISTORY (Last 30 days):'));
    try {
      const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
      
      // Universal transfer history
      const transfers = await this.makeRequest('/sapi/v1/asset/transfer', {
        type: 'MAIN_FUNDING',
        startTime: thirtyDaysAgo,
        endTime: Date.now(),
        size: 100
      });

      if (transfers.rows && transfers.rows.length > 0) {
        console.log('   Recent transfers:');
        transfers.rows.forEach((transfer: TransferRecord) => {
          const date = new Date(transfer.timestamp).toLocaleString();
          console.log(`   ${date}: ${transfer.amount} ${transfer.asset} (${transfer.status})`);
        });
      } else {
        console.log('   No recent transfers found');
      }

      // Also check for deposits
      console.log(chalk.blue('\n💵 DEPOSIT HISTORY (Last 30 days):'));
      const deposits = await this.makeRequest('/sapi/v1/capital/deposit/hisrec', {
        startTime: thirtyDaysAgo,
        endTime: Date.now()
      });

      if (deposits && deposits.length > 0) {
        deposits.forEach((deposit: any) => {
          const date = new Date(deposit.insertTime).toLocaleString();
          console.log(`   ${date}: ${deposit.amount} ${deposit.coin} - Status: ${deposit.status === 1 ? 'Success' : 'Pending'}`);
        });
      } else {
        console.log('   No recent deposits found');
      }
    } catch (error: any) {
      console.log(chalk.red(`   ❌ Could not fetch transfer history: ${error.message}`));
    }
  }

  async checkWithCCXT(): Promise<void> {
    console.log(chalk.blue('\n🔄 CCXT Library Check:'));
    
    try {
      const exchange = new ccxt.binance({
        apiKey: this.apiKey,
        secret: this.apiSecret,
        enableRateLimit: true,
        options: {
          recvWindow: 10000,
          adjustForTimeDifference: true
        }
      });

      // Load markets
      await exchange.loadMarkets();
      console.log('   ✅ Markets loaded successfully');

      // Check spot balance
      console.log('\n   Spot Balance via CCXT:');
      const spotBalance = await exchange.fetchBalance();
      const spotAssets = Object.keys(spotBalance.total).filter(asset => spotBalance.total[asset] > 0);
      
      if (spotAssets.length > 0) {
        spotAssets.forEach(asset => {
          console.log(`   ${asset}: ${spotBalance.total[asset]}`);
        });
      } else {
        console.log('   No spot balances found');
      }

      // Try funding wallet
      console.log('\n   Funding Balance via CCXT:');
      try {
        const fundingBalance = await exchange.fetchBalance({ type: 'funding' });
        const fundingAssets = Object.keys(fundingBalance.total).filter(asset => fundingBalance.total[asset] > 0);
        
        if (fundingAssets.length > 0) {
          fundingAssets.forEach(asset => {
            console.log(`   ${asset}: ${fundingBalance.total[asset]}`);
          });
        } else {
          console.log('   No funding balances found');
        }
      } catch (fundingError: any) {
        console.log(`   ❌ Could not fetch funding balance: ${fundingError.message}`);
      }

    } catch (error: any) {
      console.log(chalk.red(`   ❌ CCXT error: ${error.message}`));
    }
  }

  async searchForUSDT(): Promise<void> {
    console.log(chalk.yellow('\n🔍 SEARCHING FOR 13.78 USDT:'));
    
    let totalUSDT = 0;
    const usdtLocations: { location: string; amount: number }[] = [];

    // Check spot
    try {
      const spotData = await this.makeRequest('/api/v3/account');
      const usdtBalance = spotData.balances.find((b: BinanceBalance) => b.asset === 'USDT');
      if (usdtBalance) {
        const amount = parseFloat(usdtBalance.free) + parseFloat(usdtBalance.locked);
        if (amount > 0) {
          totalUSDT += amount;
          usdtLocations.push({ location: 'Spot Wallet', amount });
        }
      }
    } catch (error) {
      console.log('   Could not check spot wallet');
    }

    // Check funding
    try {
      const fundingData = await this.makeRequest('/sapi/v3/asset/getUserAsset');
      const usdtAsset = fundingData.find((a: any) => a.asset === 'USDT');
      if (usdtAsset) {
        const amount = parseFloat(usdtAsset.free) + parseFloat(usdtAsset.locked);
        if (amount > 0) {
          totalUSDT += amount;
          usdtLocations.push({ location: 'Funding Wallet', amount });
        }
      }
    } catch (error) {
      console.log('   Could not check funding wallet');
    }

    // Check all wallets
    try {
      const allWallets = await this.makeRequest('/sapi/v1/asset/wallet/balance');
      const usdtWallets = allWallets.filter((w: any) => w.asset === 'USDT' && parseFloat(w.balance) > 0);
      usdtWallets.forEach((wallet: any) => {
        const amount = parseFloat(wallet.balance);
        if (!usdtLocations.some(loc => loc.location === wallet.walletName)) {
          totalUSDT += amount;
          usdtLocations.push({ location: wallet.walletName || 'Unknown Wallet', amount });
        }
      });
    } catch (error) {
      console.log('   Could not check all wallets');
    }

    // Display results
    console.log(chalk.yellow('\n   USDT SUMMARY:'));
    if (usdtLocations.length > 0) {
      usdtLocations.forEach(loc => {
        console.log(`   ${loc.location}: ${loc.amount} USDT`);
      });
      console.log(chalk.green(`   Total USDT found: ${totalUSDT}`));
      
      if (Math.abs(totalUSDT - 13.78) < 0.01) {
        console.log(chalk.green('   ✅ Found your 13.78 USDT!'));
      } else if (totalUSDT > 13.78) {
        console.log(chalk.yellow(`   ℹ️  You have more USDT than expected (${totalUSDT} vs 13.78)`));
      } else {
        console.log(chalk.yellow(`   ⚠️  Found ${totalUSDT} USDT, but looking for 13.78 USDT`));
      }
    } else {
      console.log(chalk.red('   ❌ No USDT found in any wallet'));
      console.log(chalk.yellow('\n   NEXT STEPS:'));
      console.log('   1. Check if USDT is in P2P wallet (app only)');
      console.log('   2. Check if USDT is in Earn/Savings products');
      console.log('   3. Check if USDT is in open orders');
      console.log('   4. Verify the transfer from KuCoin was successful');
    }
  }

  async runComprehensiveCheck(): Promise<void> {
    console.log(chalk.bgCyan.black('\n 🔍 BINANCE COMPREHENSIVE API CHECK \n'));
    console.log('━'.repeat(60));

    // Check credentials
    if (!this.apiKey || !this.apiSecret) {
      console.log(chalk.red('❌ API credentials not found in environment!'));
      console.log('Please set BINANCE_API_KEY and BINANCE_API_SECRET in .env file');
      return;
    }

    console.log(chalk.green('✅ API credentials found'));
    console.log(`API Key: ${this.apiKey.substring(0, 10)}...${this.apiKey.substring(this.apiKey.length - 10)}`);

    // Run all checks
    await this.checkTimeSync();
    await this.checkAPIPermissions();
    await this.getSpotBalance();
    await this.getFundingBalance();
    await this.getAllWalletBalances();
    await this.getTransferHistory();
    await this.checkWithCCXT();
    await this.searchForUSDT();

    console.log('\n' + '━'.repeat(60));
    console.log(chalk.green('✅ Comprehensive check completed'));
  }
}

// Main execution
const checker = new BinanceComprehensiveChecker();
checker.runComprehensiveCheck().catch(error => {
  console.error(chalk.red('Fatal error:'), error.message);
  process.exit(1);
});