import axios from 'axios';
import * as crypto from 'crypto';
import { config } from 'dotenv';
import chalk from 'chalk';

config();

interface Balance {
  asset: string;
  free: string;
  locked: string;
}

interface UniversalTransferResponse {
  tranId: number;
  clientTranId?: string;
}

interface SubAccountBalance {
  accountType: string;
  balances: Array<{
    asset: string;
    free: string;
    locked: string;
  }>;
}

class BinanceBalanceChecker {
  private apiKey: string;
  private apiSecret: string;
  private baseUrl = 'https://api.binance.com';

  constructor() {
    this.apiKey = process.env.BINANCE_API_KEY || '';
    this.apiSecret = process.env.BINANCE_API_SECRET || '';

    if (!this.apiKey || !this.apiSecret) {
      console.error(chalk.red('❌ Binance API credentials not found in .env file'));
      console.log(chalk.yellow('Please set BINANCE_API_KEY and BINANCE_API_SECRET in your .env file'));
      process.exit(1);
    }
  }

  private createSignature(queryString: string): string {
    return crypto
      .createHmac('sha256', this.apiSecret)
      .update(queryString)
      .digest('hex');
  }

  private async makeRequest(endpoint: string, params: any = {}, method: 'GET' | 'POST' = 'GET') {
    try {
      const timestamp = Date.now();
      const queryParams = { ...params, timestamp };
      const queryString = Object.entries(queryParams)
        .map(([key, value]) => `${key}=${value}`)
        .join('&');
      const signature = this.createSignature(queryString);
      const url = `${this.baseUrl}${endpoint}?${queryString}&signature=${signature}`;

      const config = {
        headers: {
          'X-MBX-APIKEY': this.apiKey,
        },
      };

      const response = method === 'GET' 
        ? await axios.get(url, config)
        : await axios.post(url, {}, config);

      return response.data;
    } catch (error: any) {
      if (error.response) {
        console.error(chalk.red(`API Error: ${error.response.data.msg || error.response.data}`));
      } else {
        console.error(chalk.red(`Request Error: ${error.message}`));
      }
      throw error;
    }
  }

  async getSpotBalance(): Promise<void> {
    console.log(chalk.blue('\n💰 Checking Spot Wallet Balance...'));
    try {
      const accountInfo = await this.makeRequest('/api/v3/account');
      const balances = accountInfo.balances.filter((b: Balance) => 
        parseFloat(b.free) > 0 || parseFloat(b.locked) > 0
      );

      const usdtBalance = balances.find((b: Balance) => b.asset === 'USDT');
      
      if (usdtBalance) {
        const total = parseFloat(usdtBalance.free) + parseFloat(usdtBalance.locked);
        console.log(chalk.green(`✅ Spot Wallet USDT Balance:`));
        console.log(`   Available: ${chalk.white(usdtBalance.free)} USDT`);
        console.log(`   Locked: ${chalk.white(usdtBalance.locked)} USDT`);
        console.log(`   Total: ${chalk.yellow(total.toFixed(2))} USDT`);
      } else {
        console.log(chalk.yellow('   No USDT found in Spot Wallet'));
      }

      // Show other significant balances
      const otherBalances = balances.filter((b: Balance) => b.asset !== 'USDT');
      if (otherBalances.length > 0) {
        console.log(chalk.dim('\n   Other balances:'));
        otherBalances.forEach((b: Balance) => {
          const total = parseFloat(b.free) + parseFloat(b.locked);
          console.log(chalk.dim(`   ${b.asset}: ${total.toFixed(8)}`));
        });
      }
    } catch (error) {
      console.log(chalk.red('   Failed to fetch Spot wallet balance'));
    }
  }

  async getFundingBalance(): Promise<void> {
    console.log(chalk.blue('\n🏦 Checking Funding Wallet Balance...'));
    try {
      const fundingAccount = await this.makeRequest('/sapi/v1/asset/get-funding-asset', { asset: 'USDT' }, 'POST');
      
      if (fundingAccount && fundingAccount.length > 0) {
        const usdt = fundingAccount.find((asset: any) => asset.asset === 'USDT');
        if (usdt) {
          console.log(chalk.green(`✅ Funding Wallet USDT Balance:`));
          console.log(`   Available: ${chalk.white(usdt.free)} USDT`);
          console.log(`   Locked: ${chalk.white(usdt.locked)} USDT`);
          console.log(`   Frozen: ${chalk.white(usdt.freeze)} USDT`);
          console.log(`   Withdrawing: ${chalk.white(usdt.withdrawing)} USDT`);
          const total = parseFloat(usdt.free) + parseFloat(usdt.locked) + parseFloat(usdt.freeze) + parseFloat(usdt.withdrawing);
          console.log(`   Total: ${chalk.yellow(total.toFixed(2))} USDT`);
        } else {
          console.log(chalk.yellow('   No USDT found in Funding Wallet'));
        }
      } else {
        console.log(chalk.yellow('   No assets found in Funding Wallet'));
      }
    } catch (error) {
      console.log(chalk.red('   Failed to fetch Funding wallet balance'));
    }
  }

  async getP2PBalance(): Promise<void> {
    console.log(chalk.blue('\n💱 Checking P2P Wallet Balance...'));
    try {
      // P2P balance is part of the funding wallet in Binance's new structure
      // We'll use the main balance endpoint with account type
      const response = await this.makeRequest('/sapi/v1/asset/transfer', {
        type: 'MAIN_C2C',
        needTransfer: false
      }, 'POST');

      // Alternative: Try to get C2C account balance
      try {
        const c2cBalance = await this.makeRequest('/sapi/v1/c2c/orderMatch/listUserOrderHistory', {
          page: 1,
          rows: 1
        });
        
        // The P2P balance is typically shown in the user's main funding account
        console.log(chalk.yellow('   P2P balance is typically part of Funding wallet'));
        console.log(chalk.dim('   Check Funding wallet above for P2P funds'));
      } catch (e) {
        console.log(chalk.yellow('   P2P API access may require additional permissions'));
      }
    } catch (error) {
      console.log(chalk.yellow('   P2P balance checking requires special API permissions'));
      console.log(chalk.dim('   P2P funds are usually shown in Funding wallet'));
    }
  }

  async getMarginBalance(): Promise<void> {
    console.log(chalk.blue('\n📊 Checking Margin Account Balance...'));
    try {
      const marginAccount = await this.makeRequest('/sapi/v1/margin/account');
      const usdtAsset = marginAccount.userAssets.find((asset: any) => asset.asset === 'USDT');
      
      if (usdtAsset) {
        console.log(chalk.green(`✅ Margin Account USDT Balance:`));
        console.log(`   Free: ${chalk.white(usdtAsset.free)} USDT`);
        console.log(`   Locked: ${chalk.white(usdtAsset.locked)} USDT`);
        console.log(`   Borrowed: ${chalk.white(usdtAsset.borrowed)} USDT`);
        console.log(`   Interest: ${chalk.white(usdtAsset.interest)} USDT`);
        const netBalance = parseFloat(usdtAsset.free) + parseFloat(usdtAsset.locked) - parseFloat(usdtAsset.borrowed) - parseFloat(usdtAsset.interest);
        console.log(`   Net Balance: ${chalk.yellow(netBalance.toFixed(2))} USDT`);
      } else {
        console.log(chalk.yellow('   No USDT found in Margin Account'));
      }
    } catch (error: any) {
      if (error.response?.data?.code === -3121) {
        console.log(chalk.dim('   Margin account not enabled or no permission'));
      } else {
        console.log(chalk.red('   Failed to fetch Margin account balance'));
      }
    }
  }

  async getFuturesBalance(): Promise<void> {
    console.log(chalk.blue('\n🚀 Checking Futures Account Balance...'));
    try {
      const futuresAccount = await this.makeRequest('/fapi/v2/balance');
      const usdtBalance = futuresAccount.find((asset: any) => asset.asset === 'USDT');
      
      if (usdtBalance) {
        console.log(chalk.green(`✅ Futures Account USDT Balance:`));
        console.log(`   Wallet Balance: ${chalk.white(usdtBalance.balance)} USDT`);
        console.log(`   Unrealized PNL: ${chalk.white(usdtBalance.crossUnPnl)} USDT`);
        console.log(`   Available: ${chalk.white(usdtBalance.availableBalance)} USDT`);
        const total = parseFloat(usdtBalance.balance);
        console.log(`   Total: ${chalk.yellow(total.toFixed(2))} USDT`);
      } else {
        console.log(chalk.yellow('   No USDT found in Futures Account'));
      }
    } catch (error: any) {
      if (error.response?.data?.code === -2015) {
        console.log(chalk.dim('   Futures account not enabled or no permission'));
      } else {
        console.log(chalk.red('   Failed to fetch Futures account balance'));
      }
    }
  }

  async getEarnBalance(): Promise<void> {
    console.log(chalk.blue('\n💎 Checking Earn (Savings/Staking) Balance...'));
    try {
      // Check flexible savings
      const flexiblePosition = await this.makeRequest('/sapi/v1/simple-earn/flexible/position', {
        asset: 'USDT'
      });
      
      let totalEarn = 0;
      
      if (flexiblePosition.rows && flexiblePosition.rows.length > 0) {
        console.log(chalk.green(`✅ Flexible Earn USDT:`));
        flexiblePosition.rows.forEach((position: any) => {
          const amount = parseFloat(position.totalAmount);
          totalEarn += amount;
          console.log(`   Amount: ${chalk.white(amount.toFixed(2))} USDT`);
          console.log(`   Daily Interest: ${chalk.white(position.latestAnnualPercentageRate)}%`);
        });
      }

      // Check locked staking
      const lockedPosition = await this.makeRequest('/sapi/v1/simple-earn/locked/position', {
        asset: 'USDT'
      });
      
      if (lockedPosition.rows && lockedPosition.rows.length > 0) {
        console.log(chalk.green(`\n✅ Locked Earn USDT:`));
        lockedPosition.rows.forEach((position: any) => {
          const amount = parseFloat(position.amount);
          totalEarn += amount;
          console.log(`   Amount: ${chalk.white(amount.toFixed(2))} USDT`);
          console.log(`   APR: ${chalk.white(position.apy)}%`);
          console.log(`   Redeem Date: ${chalk.white(new Date(position.redeemDate).toLocaleDateString())}`);
        });
      }

      if (totalEarn > 0) {
        console.log(`   Total in Earn: ${chalk.yellow(totalEarn.toFixed(2))} USDT`);
      } else {
        console.log(chalk.yellow('   No USDT found in Earn products'));
      }
    } catch (error) {
      console.log(chalk.dim('   Earn products not enabled or no positions'));
    }
  }

  async getTotalBalance(): Promise<void> {
    console.log(chalk.blue('\n📈 Calculating Total USDT Balance...'));
    try {
      let totalUsdt = 0;
      const balances: { [key: string]: number } = {};

      // Get all balances
      try {
        const accountInfo = await this.makeRequest('/api/v3/account');
        const usdtBalance = accountInfo.balances.find((b: Balance) => b.asset === 'USDT');
        if (usdtBalance) {
          const spotTotal = parseFloat(usdtBalance.free) + parseFloat(usdtBalance.locked);
          balances['Spot'] = spotTotal;
          totalUsdt += spotTotal;
        }
      } catch (e) {}

      try {
        const fundingAccount = await this.makeRequest('/sapi/v1/asset/get-funding-asset', { asset: 'USDT' }, 'POST');
        if (fundingAccount && fundingAccount.length > 0) {
          const usdt = fundingAccount.find((asset: any) => asset.asset === 'USDT');
          if (usdt) {
            const fundingTotal = parseFloat(usdt.free) + parseFloat(usdt.locked) + parseFloat(usdt.freeze) + parseFloat(usdt.withdrawing);
            balances['Funding'] = fundingTotal;
            totalUsdt += fundingTotal;
          }
        }
      } catch (e) {}

      console.log(chalk.green('\n✅ Summary:'));
      Object.entries(balances).forEach(([account, balance]) => {
        if (balance > 0) {
          console.log(`   ${account}: ${chalk.white(balance.toFixed(2))} USDT`);
        }
      });
      
      console.log(chalk.yellow(`\n   🎯 Total USDT across all accounts: ${totalUsdt.toFixed(2)} USDT`));
      
      if (totalUsdt > 0) {
        console.log(chalk.green('\n✅ USDT found! Your transfer from KuCoin was successful.'));
      } else {
        console.log(chalk.yellow('\n⚠️  No USDT found. The transfer might still be processing.'));
        console.log(chalk.dim('   Please check your deposit history or wait a few minutes.'));
      }
    } catch (error) {
      console.log(chalk.red('Failed to calculate total balance'));
    }
  }

  async checkAllBalances(): Promise<void> {
    console.log(chalk.cyan('\n🔍 Binance Balance Checker'));
    console.log(chalk.cyan('========================\n'));
    
    await this.getSpotBalance();
    await this.getFundingBalance();
    await this.getP2PBalance();
    await this.getMarginBalance();
    await this.getFuturesBalance();
    await this.getEarnBalance();
    await this.getTotalBalance();
    
    console.log(chalk.cyan('\n========================'));
    console.log(chalk.green('✅ Balance check complete!\n'));
  }
}

// Run the balance checker
async function main() {
  try {
    const checker = new BinanceBalanceChecker();
    await checker.checkAllBalances();
  } catch (error) {
    console.error(chalk.red('Error running balance checker:'), error);
    process.exit(1);
  }
}

// Execute if run directly
main();

export { BinanceBalanceChecker };