#!/usr/bin/env node

const axios = require('axios');
const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Serve static files
app.use(express.static('public'));

// Simple arbitrage monitor that works without API keys
class SimpleArbitrageMonitor {
  constructor() {
    this.prices = {};
    this.opportunities = [];
    this.isRunning = false;
  }

  async fetchPrices() {
    try {
      // Fetch from public APIs only
      const [binanceResponse, coingeckoResponse] = await Promise.allSettled([
        axios.get('https://api.binance.com/api/v3/ticker/price?symbol=USDCUSDT'),
        axios.get('https://api.coingecko.com/api/v3/simple/price?ids=tether,usd-coin&vs_currencies=usd,inr')
      ]);

      if (binanceResponse.status === 'fulfilled') {
        this.prices.binance = {
          symbol: 'USDC/USDT',
          price: parseFloat(binanceResponse.value.data.price),
          source: 'Binance',
          timestamp: new Date()
        };
      }

      if (coingeckoResponse.status === 'fulfilled') {
        const data = coingeckoResponse.value.data;
        this.prices.coingecko = {
          usdt_usd: data.tether?.usd || 1,
          usdt_inr: data.tether?.inr || 84,
          usdc_usd: data['usd-coin']?.usd || 1,
          usdc_inr: data['usd-coin']?.inr || 84,
          source: 'CoinGecko',
          timestamp: new Date()
        };
      }

      this.detectArbitrage();
      this.displayResults();
    } catch (error) {
      console.error('Error fetching prices:', error.message);
    }
  }

  detectArbitrage() {
    if (!this.prices.binance || !this.prices.coingecko) return;

    const binancePrice = this.prices.binance.price;
    const usdtInr = this.prices.coingecko.usdt_inr;
    const usdcInr = this.prices.coingecko.usdc_inr;

    // Calculate arbitrage opportunity
    const usdtToUsdcViaBinance = binancePrice; // 1 USDT → X USDC
    const usdcToUsdtViaBinance = 1 / binancePrice; // 1 USDC → X USDT

    // Indian market arbitrage
    const usdtInrPrice = usdtInr;
    const usdcInrPrice = usdcInr;
    const spreadInr = ((usdtInrPrice - usdcInrPrice) / usdcInrPrice) * 100;

    // International arbitrage
    const spreadBinance = ((1 - binancePrice) / binancePrice) * 100;

    this.opportunities = [
      {
        type: 'USDT/USDC Binance',
        buyPrice: binancePrice,
        sellPrice: 1 / binancePrice,
        spread: spreadBinance,
        profitable: Math.abs(spreadBinance) > 0.1,
        timestamp: new Date()
      },
      {
        type: 'USDT/USDC India',
        buyPrice: usdcInrPrice,
        sellPrice: usdtInrPrice,
        spread: spreadInr,
        profitable: Math.abs(spreadInr) > 0.5,
        timestamp: new Date()
      }
    ];
  }

  displayResults() {
    console.clear();
    console.log('🚀 Simple USDT Arbitrage Monitor');
    console.log('═'.repeat(50));
    console.log(`📊 Current Prices (${new Date().toLocaleTimeString()}):`);
    
    if (this.prices.binance) {
      console.log(`   Binance USDC/USDT: ${this.prices.binance.price.toFixed(6)}`);
    }
    
    if (this.prices.coingecko) {
      const cg = this.prices.coingecko;
      console.log(`   USDT/USD: $${cg.usdt_usd.toFixed(4)}`);
      console.log(`   USDC/USD: $${cg.usdc_usd.toFixed(4)}`);
      console.log(`   USDT/INR: ₹${cg.usdt_inr.toFixed(2)}`);
      console.log(`   USDC/INR: ₹${cg.usdc_inr.toFixed(2)}`);
    }

    console.log('\n💰 Arbitrage Opportunities:');
    this.opportunities.forEach((opp, index) => {
      const status = opp.profitable ? '✅ PROFITABLE' : '❌ NOT PROFITABLE';
      console.log(`   ${index + 1}. ${opp.type}`);
      console.log(`      Spread: ${opp.spread > 0 ? '+' : ''}${opp.spread.toFixed(3)}% ${status}`);
    });

    console.log('\n═'.repeat(50));
  }

  async start() {
    if (this.isRunning) return;
    
    this.isRunning = true;
    console.log('Starting Simple Arbitrage Monitor...');
    
    // Initial fetch
    await this.fetchPrices();
    
    // Set up interval
    this.interval = setInterval(() => {
      this.fetchPrices();
    }, 5000); // Update every 5 seconds
  }

  stop() {
    if (!this.isRunning) return;
    
    this.isRunning = false;
    if (this.interval) {
      clearInterval(this.interval);
    }
    console.log('Monitor stopped');
  }
}

// API Routes
const monitor = new SimpleArbitrageMonitor();

app.get('/api/prices', (req, res) => {
  res.json({
    success: true,
    data: monitor.prices,
    timestamp: new Date()
  });
});

app.get('/api/opportunities', (req, res) => {
  res.json({
    success: true,
    data: monitor.opportunities,
    timestamp: new Date()
  });
});

app.get('/api/status', (req, res) => {
  res.json({
    success: true,
    data: {
      status: monitor.isRunning ? 'running' : 'stopped',
      uptime: process.uptime(),
      timestamp: new Date()
    }
  });
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log('API endpoints:');
  console.log(`  - http://localhost:${PORT}/api/prices`);
  console.log(`  - http://localhost:${PORT}/api/opportunities`);
  console.log(`  - http://localhost:${PORT}/api/status`);
  
  // Start monitoring
  monitor.start();
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down...');
  monitor.stop();
  process.exit(0);
});