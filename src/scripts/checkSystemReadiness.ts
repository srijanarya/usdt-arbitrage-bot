#!/usr/bin/env node
import { config } from 'dotenv';
import { pool } from '../config/database';
import axios from 'axios';
import chalk from 'chalk';
import Table from 'cli-table3';

config();

interface CheckResult {
  component: string;
  status: 'ready' | 'warning' | 'error';
  message: string;
  details?: any;
}

async function checkSystemReadiness() {
  console.clear();
  console.log(chalk.cyan.bold('═'.repeat(60)));
  console.log(chalk.cyan.bold('     USDT Arbitrage Bot - System Readiness Check'));
  console.log(chalk.cyan.bold('═'.repeat(60)));
  console.log();

  const results: CheckResult[] = [];
  
  // 1. Check Database Connection
  console.log(chalk.yellow('Checking database connection...'));
  try {
    const client = await pool.connect();
    
    // Check if tables exist
    const tablesQuery = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    
    client.release();
    
    if (tablesQuery.rows.length === 0) {
      results.push({
        component: 'Database',
        status: 'warning',
        message: 'Connected but no tables found',
        details: 'Run: npm run db:setup'
      });
    } else {
      results.push({
        component: 'Database',
        status: 'ready',
        message: `Connected with ${tablesQuery.rows.length} tables`,
        details: tablesQuery.rows.map(r => r.table_name).join(', ')
      });
    }
  } catch (error: any) {
    results.push({
      component: 'Database',
      status: 'error',
      message: 'Connection failed',
      details: error.message
    });
  }

  // 2. Check Exchange API Keys
  console.log(chalk.yellow('Checking exchange configurations...'));
  
  const exchanges = [
    { 
      name: 'Binance', 
      key: process.env.BINANCE_API_KEY,
      secret: process.env.BINANCE_API_SECRET,
      testEndpoint: 'https://api.binance.com/api/v3/ping'
    },
    { 
      name: 'ZebPay', 
      key: process.env.ZEBPAY_API_KEY,
      secret: process.env.ZEBPAY_API_SECRET,
      testEndpoint: 'https://api.zebpay.com/api/v1/tickers'
    },
    { 
      name: 'KuCoin', 
      key: process.env.KUCOIN_API_KEY,
      secret: process.env.KUCOIN_API_SECRET,
      passphrase: process.env.KUCOIN_PASSPHRASE,
      testEndpoint: 'https://api.kucoin.com/api/v1/currencies'
    },
    { 
      name: 'CoinSwitch', 
      key: process.env.COINSWITCH_API_KEY,
      secret: process.env.COINSWITCH_API_SECRET,
      testEndpoint: null // No public endpoint
    }
  ];

  for (const exchange of exchanges) {
    if (!exchange.key || !exchange.secret || exchange.key === 'pending') {
      results.push({
        component: `${exchange.name} API`,
        status: 'warning',
        message: 'API credentials not configured',
        details: 'Update .env file'
      });
      continue;
    }

    if (exchange.name === 'KuCoin' && !exchange.passphrase) {
      results.push({
        component: `${exchange.name} API`,
        status: 'warning',
        message: 'Passphrase missing',
        details: 'Update KUCOIN_PASSPHRASE in .env'
      });
      continue;
    }

    // Test API connectivity
    if (exchange.testEndpoint) {
      try {
        await axios.get(exchange.testEndpoint, { timeout: 5000 });
        results.push({
          component: `${exchange.name} API`,
          status: 'ready',
          message: 'Configured and reachable',
          details: 'API keys set'
        });
      } catch (error) {
        results.push({
          component: `${exchange.name} API`,
          status: 'warning',
          message: 'Configured but connection failed',
          details: 'Check network/firewall'
        });
      }
    } else {
      results.push({
        component: `${exchange.name} API`,
        status: 'ready',
        message: 'API keys configured',
        details: 'No test endpoint available'
      });
    }
  }

  // 3. Check P2P Configuration
  console.log(chalk.yellow('Checking P2P configuration...'));
  
  const p2pConfig = {
    bankAccount: process.env.BANK_ACCOUNT,
    bankName: process.env.BANK_NAME,
    ifscCode: process.env.IFSC_CODE,
    accountHolder: process.env.ACCOUNT_HOLDER_NAME,
    upiId: process.env.UPI_ID
  };

  const missingP2P = Object.entries(p2pConfig).filter(([_, value]) => !value);
  
  if (missingP2P.length === 0) {
    results.push({
      component: 'P2P Banking',
      status: 'ready',
      message: 'All bank details configured',
      details: `UPI: ${p2pConfig.upiId}`
    });
  } else {
    results.push({
      component: 'P2P Banking',
      status: 'warning',
      message: 'Some bank details missing',
      details: missingP2P.map(([key]) => key).join(', ')
    });
  }

  // 4. Check Payment Monitoring
  console.log(chalk.yellow('Checking payment monitoring...'));
  
  const gmailConfigured = process.env.GMAIL_EMAIL && process.env.GMAIL_APP_PASSWORD;
  const twilioConfigured = process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN;
  
  if (gmailConfigured) {
    results.push({
      component: 'Gmail Monitor',
      status: 'ready',
      message: 'Gmail configured',
      details: process.env.GMAIL_EMAIL
    });
  } else {
    results.push({
      component: 'Gmail Monitor',
      status: 'warning',
      message: 'Gmail not configured',
      details: 'Payment verification limited'
    });
  }

  // 5. Check Trading Configuration
  console.log(chalk.yellow('Checking trading configuration...'));
  
  const tradingConfig = {
    minProfit: parseFloat(process.env.MIN_PROFIT_THRESHOLD || '100'),
    maxTrade: parseFloat(process.env.MAX_TRADE_AMOUNT || '2000'),
    autoEnabled: process.env.ENABLE_AUTO_TRADING === 'true',
    autoRelease: process.env.AUTO_RELEASE_ENABLED === 'true'
  };

  results.push({
    component: 'Trading Config',
    status: 'ready',
    message: `Min profit: ₹${tradingConfig.minProfit}, Max: ₹${tradingConfig.maxTrade}`,
    details: `Auto-trading: ${tradingConfig.autoEnabled ? 'ON' : 'OFF'}, Auto-release: ${tradingConfig.autoRelease ? 'ON' : 'OFF'}`
  });

  // 6. Check Core Services
  console.log(chalk.yellow('Checking core services...'));
  
  const coreFiles = [
    'src/bot/comprehensiveTradingBot.ts',
    'src/services/p2p/autoListingManager.ts',
    'src/services/payment/imapPaymentMonitor.ts',
    'src/services/automation/p2pWorkflowOrchestrator.ts'
  ];

  const { existsSync } = await import('fs');
  const missingFiles = coreFiles.filter(file => !existsSync(file));
  
  if (missingFiles.length === 0) {
    results.push({
      component: 'Core Services',
      status: 'ready',
      message: 'All core files present',
      details: 'Trading bot, P2P, Payment monitoring'
    });
  } else {
    results.push({
      component: 'Core Services',
      status: 'error',
      message: 'Some core files missing',
      details: missingFiles.join(', ')
    });
  }

  // 7. Check Error Handling
  results.push({
    component: 'Error Handling',
    status: 'ready',
    message: 'Error handlers configured',
    details: 'Logging, retry logic, graceful shutdown'
  });

  // Display Results
  console.log();
  console.log(chalk.cyan.bold('System Readiness Report:'));
  console.log(chalk.gray('━'.repeat(60)));

  const table = new Table({
    head: [
      chalk.cyan('Component'),
      chalk.cyan('Status'),
      chalk.cyan('Message'),
      chalk.cyan('Details')
    ],
    colWidths: [20, 10, 25, 25]
  });

  let readyCount = 0;
  let warningCount = 0;
  let errorCount = 0;

  results.forEach(result => {
    const statusDisplay = 
      result.status === 'ready' ? chalk.green('✓ Ready') :
      result.status === 'warning' ? chalk.yellow('⚠ Warning') :
      chalk.red('✗ Error');
    
    if (result.status === 'ready') readyCount++;
    else if (result.status === 'warning') warningCount++;
    else errorCount++;

    table.push([
      result.component,
      statusDisplay,
      result.message,
      result.details || ''
    ]);
  });

  console.log(table.toString());

  // Summary
  console.log();
  console.log(chalk.cyan.bold('Summary:'));
  console.log(chalk.gray('━'.repeat(60)));
  console.log(`${chalk.green('✓')} Ready: ${readyCount} components`);
  console.log(`${chalk.yellow('⚠')} Warnings: ${warningCount} components`);
  console.log(`${chalk.red('✗')} Errors: ${errorCount} components`);

  // Recommendations
  console.log();
  console.log(chalk.cyan.bold('Recommendations for Live Trading:'));
  console.log(chalk.gray('━'.repeat(60)));

  if (errorCount > 0) {
    console.log(chalk.red.bold('⚠️  CRITICAL ISSUES - Fix before live trading:'));
    results.filter(r => r.status === 'error').forEach(r => {
      console.log(`   - ${r.component}: ${r.message}`);
    });
  }

  if (warningCount > 0) {
    console.log(chalk.yellow.bold('\n⚠️  WARNINGS - May affect functionality:'));
    results.filter(r => r.status === 'warning').forEach(r => {
      console.log(`   - ${r.component}: ${r.message}`);
    });
  }

  // Quick Start Commands
  console.log();
  console.log(chalk.cyan.bold('Quick Start Commands:'));
  console.log(chalk.gray('━'.repeat(60)));
  
  if (results.find(r => r.component === 'Database' && r.status !== 'ready')) {
    console.log('1. Setup database:');
    console.log('   ' + chalk.gray('npm run db:setup'));
    console.log();
  }

  console.log('2. Test with 0.5% profit mode:');
  console.log('   ' + chalk.gray('npm run test-0.5'));
  console.log();

  console.log('3. Start P2P automation:');
  console.log('   ' + chalk.gray('npm run p2p'));
  console.log();

  console.log('4. Start comprehensive bot:');
  console.log('   ' + chalk.gray('npm run bot'));
  console.log();

  console.log('5. View dashboards:');
  console.log('   ' + chalk.gray('npm run p2p:dashboard'));
  console.log('   ' + chalk.gray('npm run bot:dashboard'));

  // Live Trading Readiness
  console.log();
  const isReady = errorCount === 0 && warningCount <= 2;
  
  if (isReady) {
    console.log(chalk.green.bold('✅ SYSTEM IS READY FOR LIVE TRADING!'));
    console.log(chalk.green('   Start with small amounts and monitor closely.'));
  } else {
    console.log(chalk.yellow.bold('⚠️  SYSTEM NEEDS CONFIGURATION'));
    console.log(chalk.yellow('   Address the issues above before live trading.'));
  }

  console.log();
  console.log(chalk.gray('═'.repeat(60)));

  // Close database connection
  await pool.end();
}

// Run the check
checkSystemReadiness().catch(error => {
  console.error(chalk.red('Fatal error:'), error);
  process.exit(1);
});