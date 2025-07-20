#!/usr/bin/env node
import { config } from 'dotenv';
import axios from 'axios';
import crypto from 'crypto';
import { Pool } from 'pg';

config();

console.log(`
🔍 SYSTEM CHECK
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`);

async function checkSystem() {
  const results = {
    database: false,
    binanceApi: false,
    binanceBalance: 0,
    environment: false,
    p2pReady: false
  };

  // 1. Check Environment
  console.log('1️⃣  Checking Environment Variables...');
  const requiredVars = [
    'BINANCE_API_KEY',
    'BINANCE_API_SECRET',
    'DB_HOST',
    'DB_USER',
    'DB_PASSWORD',
    'BANK_ACCOUNT',
    'UPI_ID'
  ];

  const missingVars = requiredVars.filter(v => !process.env[v]);
  if (missingVars.length === 0) {
    console.log('   ✅ All required environment variables set');
    results.environment = true;
  } else {
    console.log('   ❌ Missing:', missingVars.join(', '));
  }

  // 2. Check Database
  console.log('\n2️⃣  Checking Database Connection...');
  try {
    const pool = new Pool({
      host: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD
    });

    await pool.query('SELECT NOW()');
    console.log('   ✅ Database connected');
    results.database = true;
    await pool.end();
  } catch (error) {
    console.log('   ❌ Database connection failed');
  }

  // 3. Check Binance API
  console.log('\n3️⃣  Checking Binance API...');
  try {
    const timestamp = Date.now();
    const queryString = `timestamp=${timestamp}`;
    const signature = crypto
      .createHmac('sha256', process.env.BINANCE_API_SECRET!)
      .update(queryString)
      .digest('hex');

    const response = await axios.get(
      `https://api.binance.com/api/v3/account?${queryString}&signature=${signature}`,
      {
        headers: {
          'X-MBX-APIKEY': process.env.BINANCE_API_KEY
        }
      }
    );

    console.log('   ✅ Binance API connected');
    results.binanceApi = true;

    // Find USDT balance
    const usdtBalance = response.data.balances.find((b: any) => b.asset === 'USDT');
    if (usdtBalance) {
      const totalBalance = parseFloat(usdtBalance.free) + parseFloat(usdtBalance.locked);
      results.binanceBalance = totalBalance;
      console.log(`   💰 USDT Balance: ${totalBalance} (Free: ${usdtBalance.free}, Locked: ${usdtBalance.locked})`);
    }
  } catch (error: any) {
    if (error.response?.status === 401) {
      console.log('   ❌ Invalid API keys');
    } else {
      console.log('   ❌ API connection failed:', error.message);
    }
  }

  // 4. Check P2P Market
  console.log('\n4️⃣  Checking P2P Market Access...');
  try {
    const response = await axios.post(
      'https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search',
      {
        page: 1,
        rows: 1,
        payTypes: ["UPI"],
        tradeType: "SELL",
        asset: "USDT",
        fiat: "INR"
      },
      { headers: { 'Content-Type': 'application/json' } }
    );

    if (response.data.data && response.data.data.length > 0) {
      console.log('   ✅ P2P market accessible');
      console.log(`   📊 Current top price: ₹${response.data.data[0].adv.price}`);
      results.p2pReady = true;
    }
  } catch (error) {
    console.log('   ❌ P2P market check failed');
  }

  // Summary
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 SYSTEM STATUS SUMMARY\n');
  
  const ready = Object.values(results).filter(v => v === true).length;
  const total = Object.keys(results).filter(k => k !== 'binanceBalance').length;
  
  if (ready === total) {
    console.log('✅ SYSTEM READY FOR TRADING!');
    console.log(`💰 Available USDT: ${results.binanceBalance}`);
    console.log('\nYou can now run:');
    console.log('  npm run test-0.5    - Test with 0.5% profit');
    console.log('  npm run p2p         - Start P2P automation');
  } else {
    console.log(`⚠️  System Check: ${ready}/${total} passed`);
    console.log('\nIssues to fix:');
    if (!results.environment) console.log('  - Set missing environment variables');
    if (!results.database) console.log('  - Fix database connection');
    if (!results.binanceApi) console.log('  - Fix Binance API keys');
    if (!results.p2pReady) console.log('  - Check internet/firewall for P2P');
  }

  console.log('\n');
}

checkSystem().catch(console.error);