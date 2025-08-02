#!/usr/bin/env node
import crypto from 'crypto';
import axios from 'axios';
import { config } from 'dotenv';
import chalk from 'chalk';
import readline from 'readline';

config();

interface AuthTestResult {
  success: boolean;
  error?: string;
  details?: any;
}

class BinanceAuthFixer {
  private apiKey: string;
  private apiSecret: string;
  private rl: readline.Interface;

  constructor() {
    this.apiKey = process.env.BINANCE_API_KEY || '';
    this.apiSecret = process.env.BINANCE_API_SECRET || '';
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
  }

  private question(query: string): Promise<string> {
    return new Promise(resolve => this.rl.question(query, resolve));
  }

  private createSignature(queryString: string, secret: string): string {
    return crypto
      .createHmac('sha256', secret)
      .update(queryString)
      .digest('hex');
  }

  async testAuthentication(key: string, secret: string): Promise<AuthTestResult> {
    const timestamp = Date.now();
    const recvWindow = 5000;
    const queryString = `recvWindow=${recvWindow}&timestamp=${timestamp}`;
    const signature = this.createSignature(queryString, secret);
    
    try {
      const response = await axios.get(
        `https://api.binance.com/api/v3/account?${queryString}&signature=${signature}`,
        {
          headers: {
            'X-MBX-APIKEY': key,
            'Content-Type': 'application/json'
          },
          timeout: 10000
        }
      );

      return {
        success: true,
        details: {
          accountType: response.data.accountType,
          canTrade: response.data.canTrade,
          balances: response.data.balances.filter((b: any) => 
            parseFloat(b.free) > 0 || parseFloat(b.locked) > 0
          )
        }
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.msg || error.message,
        details: {
          status: error.response?.status,
          code: error.response?.data?.code
        }
      };
    }
  }

  async diagnoseAuthIssue(): Promise<void> {
    console.log(chalk.bgYellow.black('\n 🔧 BINANCE API AUTHENTICATION DIAGNOSTIC \n'));
    console.log('━'.repeat(60));

    // Test 1: Check if credentials exist
    console.log(chalk.blue('\n1. Checking environment variables:'));
    if (!this.apiKey || !this.apiSecret) {
      console.log(chalk.red('   ❌ API credentials not found in .env file'));
      console.log('   Please add BINANCE_API_KEY and BINANCE_API_SECRET to your .env file');
      return;
    }
    console.log(chalk.green('   ✅ API credentials found'));

    // Test 2: Validate credential format
    console.log(chalk.blue('\n2. Validating credential format:'));
    const keyIssues = [];
    
    if (this.apiKey.length !== 64) {
      keyIssues.push(`API Key length is ${this.apiKey.length}, expected 64`);
    }
    if (this.apiSecret.length !== 64) {
      keyIssues.push(`API Secret length is ${this.apiSecret.length}, expected 64`);
    }
    if (this.apiKey.includes(' ') || this.apiSecret.includes(' ')) {
      keyIssues.push('Credentials contain spaces');
    }
    if (!/^[A-Za-z0-9]+$/.test(this.apiKey) || !/^[A-Za-z0-9]+$/.test(this.apiSecret)) {
      keyIssues.push('Credentials contain invalid characters');
    }

    if (keyIssues.length > 0) {
      console.log(chalk.red('   ❌ Credential format issues:'));
      keyIssues.forEach(issue => console.log(`      - ${issue}`));
    } else {
      console.log(chalk.green('   ✅ Credential format is valid'));
    }

    // Test 3: Test authentication
    console.log(chalk.blue('\n3. Testing authentication:'));
    const authResult = await this.testAuthentication(this.apiKey, this.apiSecret);
    
    if (authResult.success) {
      console.log(chalk.green('   ✅ Authentication successful!'));
      console.log(`   Account Type: ${authResult.details.accountType}`);
      console.log(`   Can Trade: ${authResult.details.canTrade}`);
    } else {
      console.log(chalk.red(`   ❌ Authentication failed: ${authResult.error}`));
      console.log(`   Error Code: ${authResult.details.code}`);
      console.log(`   HTTP Status: ${authResult.details.status}`);

      // Provide specific solutions based on error
      console.log(chalk.yellow('\n   SOLUTIONS:'));
      
      if (authResult.details.code === -2015) {
        console.log('   1. IP Restriction Issue:');
        console.log('      - Login to Binance → API Management');
        console.log('      - Edit your API key');
        console.log('      - Either add your current IP or select "Unrestricted"');
        console.log('      - Your current IP can be found at: https://whatismyip.com');
        
        console.log('\n   2. Permission Issue:');
        console.log('      - Ensure "Enable Reading" is checked in API settings');
        console.log('      - Save the settings and wait 1-2 minutes');
        
        console.log('\n   3. Wrong API Key:');
        console.log('      - Verify you\'re using the correct API key');
        console.log('      - Check if you\'re using Binance.com (not Binance.US) keys');
        console.log('      - Ensure no extra spaces or characters in .env file');
      } else if (authResult.details.code === -1021) {
        console.log('   Time synchronization issue:');
        console.log('   - Your system time is out of sync with Binance servers');
        console.log('   - On macOS: System Preferences → Date & Time → Set automatically');
        console.log('   - On Linux: sudo ntpdate -s time.nist.gov');
      }
    }
  }

  async interactiveKeySetup(): Promise<void> {
    console.log(chalk.blue('\n4. Interactive API Key Setup:'));
    
    const setupNew = await this.question('\n   Would you like to set up new API credentials? (y/n): ');
    
    if (setupNew.toLowerCase() === 'y') {
      console.log(chalk.yellow('\n   Instructions:'));
      console.log('   1. Go to https://www.binance.com/en/my/settings/api-management');
      console.log('   2. Create a new API key with label "USDT Bot Reader"');
      console.log('   3. Enable only "Enable Reading" permission');
      console.log('   4. For IP access, choose "Unrestricted" or add your current IP');
      console.log('   5. Save the API Key and Secret Key\n');

      const newKey = await this.question('   Enter new API Key (64 characters): ');
      const newSecret = await this.question('   Enter new API Secret (64 characters): ');

      // Validate new credentials
      console.log(chalk.blue('\n   Testing new credentials...'));
      const testResult = await this.testAuthentication(newKey.trim(), newSecret.trim());

      if (testResult.success) {
        console.log(chalk.green('   ✅ New credentials work successfully!'));
        
        // Show how to update .env
        console.log(chalk.yellow('\n   Update your .env file with:'));
        console.log(chalk.gray('   BINANCE_API_KEY=' + newKey.trim()));
        console.log(chalk.gray('   BINANCE_API_SECRET=' + newSecret.trim()));
        
        // Test for USDT balance
        if (testResult.details.balances) {
          const usdtBalance = testResult.details.balances.find((b: any) => b.asset === 'USDT');
          if (usdtBalance) {
            const total = parseFloat(usdtBalance.free) + parseFloat(usdtBalance.locked);
            console.log(chalk.green(`\n   ✅ Found ${total} USDT in your spot wallet!`));
          }
        }
      } else {
        console.log(chalk.red('   ❌ New credentials failed:'), testResult.error);
        console.log('   Please check the credentials and try again');
      }
    }
  }

  async suggestAlternatives(): Promise<void> {
    console.log(chalk.blue('\n5. Alternative Methods to Check Balance:'));
    
    console.log('\n   Option 1 - Using Binance Website:');
    console.log('   1. Login to https://www.binance.com');
    console.log('   2. Go to Wallet → Spot Wallet');
    console.log('   3. Search for USDT');
    console.log('   4. Check both "Spot" and "Funding" tabs');

    console.log('\n   Option 2 - Using Binance Mobile App:');
    console.log('   1. Open Binance app');
    console.log('   2. Go to Wallets tab');
    console.log('   3. Check Spot, Funding, and P2P wallets');
    console.log('   4. Look for 13.78 USDT');

    console.log('\n   Option 3 - Check Transfer History:');
    console.log('   1. In Binance, go to Wallet → Transaction History');
    console.log('   2. Filter by USDT and check deposits');
    console.log('   3. Look for transfer from KuCoin');
    console.log('   4. Note which wallet it went to');

    console.log('\n   Option 4 - Create Read-Only API:');
    console.log('   1. Create a new API key specifically for reading');
    console.log('   2. Only enable "Enable Reading" - nothing else');
    console.log('   3. Set IP access to "Unrestricted" temporarily');
    console.log('   4. Test immediately after creation');
  }

  async run(): Promise<void> {
    try {
      await this.diagnoseAuthIssue();
      await this.interactiveKeySetup();
      await this.suggestAlternatives();
      
      console.log(chalk.yellow('\n\n📌 SUMMARY:'));
      console.log('If API authentication continues to fail:');
      console.log('1. Create a fresh API key with minimal permissions');
      console.log('2. Ensure IP restrictions are disabled or your IP is whitelisted');
      console.log('3. Check balance manually via website/app');
      console.log('4. Verify the KuCoin transfer was successful');
      
    } catch (error: any) {
      console.error(chalk.red('Error:'), error.message);
    } finally {
      this.rl.close();
    }
  }
}

// Run the auth fixer
const fixer = new BinanceAuthFixer();
fixer.run().catch(console.error);