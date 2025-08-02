#!/usr/bin/env node
import axios from 'axios';
import crypto from 'crypto';
import { config } from 'dotenv';
import chalk from 'chalk';

config();

class BinanceWalletFinder {
  private apiKey: string;
  private apiSecret: string;
  private baseURL = 'https://api.binance.com';
  private headers: any;

  constructor() {
    this.apiKey = process.env.BINANCE_API_KEY || '';
    this.apiSecret = process.env.BINANCE_API_SECRET || '';
    this.headers = {
      'X-MBX-APIKEY': this.apiKey,
      'Content-Type': 'application/json'
    };
  }

  private createSignature(params: string): string {
    return crypto.createHmac('sha256', this.apiSecret).update(params).digest('hex');
  }

  private async request(endpoint: string, params: any = {}): Promise<any> {
    const timestamp = Date.now();
    const queryParams = { ...params, timestamp, recvWindow: 10000 };
    const queryString = Object.entries(queryParams)
      .map(([key, val]) => `${key}=${val}`)
      .join('&');
    const signature = this.createSignature(queryString);
    const url = `${this.baseURL}${endpoint}?${queryString}&signature=${signature}`;

    try {
      const response = await axios.get(url, { headers: this.headers });
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 401 && error.response?.data?.code === -2015) {
        throw new Error(`API Key Error: ${error.response.data.msg}`);
      }
      throw error;
    }
  }

  async findUSDT(): Promise<void> {
    console.log(chalk.bgMagenta.white('\n 🔍 BINANCE USDT WALLET FINDER \n'));
    console.log('Looking for your 13.78 USDT from KuCoin...\n');

    const results: { [key: string]: number } = {};

    // 1. Check Spot Wallet
    console.log(chalk.blue('1️⃣  Checking SPOT wallet...'));
    try {
      const account = await this.request('/api/v3/account');
      const usdtBalance = account.balances.find((b: any) => b.asset === 'USDT');
      if (usdtBalance) {
        const total = parseFloat(usdtBalance.free) + parseFloat(usdtBalance.locked);
        if (total > 0) {
          results['Spot'] = total;
          console.log(chalk.green(`   ✅ Found ${total} USDT in Spot wallet`));
        } else {
          console.log(chalk.gray('   ❌ No USDT in Spot wallet'));
        }
      }
    } catch (error: any) {
      console.log(chalk.red(`   ❌ Error: ${error.message}`));
    }

    // 2. Check Funding Wallet (Multiple Methods)
    console.log(chalk.blue('\n2️⃣  Checking FUNDING wallet...'));
    
    // Method A: getUserAsset
    try {
      const assets = await this.request('/sapi/v3/asset/getUserAsset', { asset: 'USDT' });
      if (assets && assets.length > 0) {
        const usdt = assets[0];
        const total = parseFloat(usdt.free) + parseFloat(usdt.locked);
        if (total > 0) {
          results['Funding'] = total;
          console.log(chalk.green(`   ✅ Found ${total} USDT in Funding wallet`));
        }
      }
    } catch (error) {
      // Try alternative method
      try {
        const config = await this.request('/sapi/v1/capital/config/getall');
        const usdt = config.find((c: any) => c.coin === 'USDT');
        if (usdt && parseFloat(usdt.free) > 0) {
          results['Funding'] = parseFloat(usdt.free);
          console.log(chalk.green(`   ✅ Found ${usdt.free} USDT in Funding wallet`));
        }
      } catch (err) {
        console.log(chalk.gray('   ❌ Could not access Funding wallet'));
      }
    }

    // 3. Check Earn/Savings
    console.log(chalk.blue('\n3️⃣  Checking EARN products...'));
    try {
      // Flexible Savings
      const flexiblePosition = await this.request('/sapi/v1/lending/daily/token/position', { asset: 'USDT' });
      if (flexiblePosition && flexiblePosition.length > 0) {
        const total = flexiblePosition.reduce((sum: number, pos: any) => 
          sum + parseFloat(pos.totalAmount), 0);
        if (total > 0) {
          results['Flexible Earn'] = total;
          console.log(chalk.green(`   ✅ Found ${total} USDT in Flexible Earn`));
        }
      }

      // Locked Staking
      const stakingPosition = await this.request('/sapi/v1/staking/position', { product: 'STAKING', asset: 'USDT' });
      if (stakingPosition && stakingPosition.length > 0) {
        const total = stakingPosition.reduce((sum: number, pos: any) => 
          sum + parseFloat(pos.amount), 0);
        if (total > 0) {
          results['Locked Staking'] = total;
          console.log(chalk.green(`   ✅ Found ${total} USDT in Locked Staking`));
        }
      }
    } catch (error) {
      console.log(chalk.gray('   ❌ No USDT in Earn products'));
    }

    // 4. Check Sub-accounts
    console.log(chalk.blue('\n4️⃣  Checking SUB-ACCOUNTS...'));
    try {
      const subAccounts = await this.request('/sapi/v1/sub-account/list');
      if (subAccounts.subAccounts && subAccounts.subAccounts.length > 0) {
        for (const sub of subAccounts.subAccounts) {
          try {
            const assets = await this.request('/sapi/v1/sub-account/assets', { email: sub.email });
            const usdt = assets.balances?.find((b: any) => b.asset === 'USDT');
            if (usdt && parseFloat(usdt.free) > 0) {
              results[`Sub-account (${sub.email})`] = parseFloat(usdt.free);
              console.log(chalk.green(`   ✅ Found ${usdt.free} USDT in sub-account ${sub.email}`));
            }
          } catch (err) {}
        }
      } else {
        console.log(chalk.gray('   ❌ No sub-accounts found'));
      }
    } catch (error) {
      console.log(chalk.gray('   ❌ Could not check sub-accounts'));
    }

    // 5. Check Recent Deposits
    console.log(chalk.blue('\n5️⃣  Checking DEPOSIT HISTORY...'));
    try {
      const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
      const deposits = await this.request('/sapi/v1/capital/deposit/hisrec', {
        coin: 'USDT',
        startTime: thirtyDaysAgo,
        endTime: Date.now()
      });

      if (deposits && deposits.length > 0) {
        console.log(chalk.yellow('   Recent USDT deposits:'));
        deposits.forEach((dep: any) => {
          const date = new Date(dep.insertTime).toLocaleString();
          const status = dep.status === 1 ? 'Success' : 'Pending';
          console.log(`   ${date}: ${dep.amount} USDT - ${status}`);
          
          if (Math.abs(parseFloat(dep.amount) - 13.78) < 0.01) {
            console.log(chalk.green('   ⭐ This matches your 13.78 USDT transfer!'));
          }
        });
      } else {
        console.log(chalk.gray('   ❌ No recent USDT deposits found'));
      }
    } catch (error) {
      console.log(chalk.gray('   ❌ Could not check deposit history'));
    }

    // 6. Check Universal Transfer History
    console.log(chalk.blue('\n6️⃣  Checking TRANSFER HISTORY...'));
    try {
      const transfers = await this.request('/sapi/v1/asset/transfer', {
        startTime: Date.now() - (7 * 24 * 60 * 60 * 1000),
        endTime: Date.now()
      });

      if (transfers.rows && transfers.rows.length > 0) {
        const usdtTransfers = transfers.rows.filter((t: any) => t.asset === 'USDT');
        if (usdtTransfers.length > 0) {
          console.log(chalk.yellow('   Recent USDT transfers:'));
          usdtTransfers.forEach((transfer: any) => {
            const date = new Date(transfer.timestamp).toLocaleString();
            console.log(`   ${date}: ${transfer.amount} USDT (${transfer.type})`);
          });
        }
      }
    } catch (error) {
      console.log(chalk.gray('   ❌ Could not check transfer history'));
    }

    // Summary
    console.log(chalk.yellow('\n📊 SUMMARY:'));
    const totalFound = Object.values(results).reduce((sum, val) => sum + val, 0);
    
    if (Object.keys(results).length > 0) {
      console.log(chalk.white('USDT found in:'));
      Object.entries(results).forEach(([location, amount]) => {
        console.log(`  ${location}: ${amount} USDT`);
      });
      console.log(chalk.green(`\nTotal USDT found: ${totalFound}`));
      
      if (Math.abs(totalFound - 13.78) < 0.01) {
        console.log(chalk.green('✅ This matches your expected 13.78 USDT!'));
      }
    } else {
      console.log(chalk.red('❌ No USDT found in any accessible wallet'));
      
      console.log(chalk.yellow('\n⚠️  USDT might be in:'));
      console.log('1. P2P Wallet (check in app)');
      console.log('2. Open orders');
      console.log('3. Futures wallet');
      console.log('4. Still processing from KuCoin');
      
      console.log(chalk.yellow('\n💡 NEXT STEPS:'));
      console.log('1. Check Binance app → Wallets → P2P');
      console.log('2. Check transaction history for KuCoin withdrawal');
      console.log('3. Contact Binance support if transfer is missing');
    }
  }

  async run(): Promise<void> {
    if (!this.apiKey || !this.apiSecret) {
      console.log(chalk.red('❌ API credentials not found!'));
      console.log('Please set BINANCE_API_KEY and BINANCE_API_SECRET in .env file');
      return;
    }

    try {
      await this.findUSDT();
    } catch (error: any) {
      console.log(chalk.red('\n❌ Fatal Error:'), error.message);
      
      if (error.message.includes('Invalid API-key')) {
        console.log(chalk.yellow('\n💡 Quick Fix:'));
        console.log('1. Go to binance.com → API Management');
        console.log('2. Create new API key with "Enable Reading" only');
        console.log('3. Set IP access to "Unrestricted"');
        console.log('4. Update .env file with new credentials');
      }
    }
  }
}

// Execute
const finder = new BinanceWalletFinder();
finder.run().catch(console.error);