# 🤖 Automated USDT Buying Setup Guide

This guide explains how to set up automated USDT buying when prices drop, using either browser automation or workflow automation tools.

## 📋 Table of Contents
1. [Overview](#overview)
2. [Method 1: Browser Automation (No API)](#method-1-browser-automation)
3. [Method 2: n8n Workflow](#method-2-n8n-workflow)
4. [Method 3: Make.com (Integromat)](#method-3-makecom)
5. [Security Best Practices](#security)
6. [Preloading INR Strategy](#preloading-strategy)

## Overview

The system allows you to:
- **Monitor USDT prices** across exchanges continuously
- **Automatically buy** when price drops below your target
- **Preload INR** on platforms for instant execution
- **Manage multiple wallets** without API access
- **Get notifications** when trades execute

## Method 1: Browser Automation (No API) 🌐

### Setup

1. **Install Dependencies**
```bash
npm install playwright @playwright/test
npx playwright install chromium
```

2. **Configure Environment**
```env
# Add to .env file
BINANCE_EMAIL=your-email@example.com
BINANCE_PASSWORD=your-password
ZEBPAY_EMAIL=your-email@example.com
ZEBPAY_PASSWORD=your-password
```

3. **Run Auto-Buyer**
```bash
npm run auto:buy
```

### How It Works

The browser automation script:
1. Opens a real Chrome browser (visible for transparency)
2. Logs into your exchange account
3. Monitors prices every minute
4. Executes buy orders when target price is hit
5. Handles CAPTCHAs and security checks
6. Logs all transactions

### Configuration Options

```typescript
{
  exchange: 'binance',      // or 'zebpay'
  targetPrice: 88.5,        // Buy when USDT <= ₹88.5
  buyAmount: 100,           // Buy 100 USDT each time
  maxSpend: 10000,          // Stop after spending ₹10,000
  checkInterval: 60000      // Check every 60 seconds
}
```

### Anti-Detection Features

- Random mouse movements and typing delays
- Browser fingerprint masking
- Proxy rotation support
- Human-like scrolling and interactions
- Session persistence

## Method 2: n8n Workflow 🔄

### Installation

1. **Self-Hosted (Recommended)**
```bash
# Using Docker
docker run -it --rm \
  --name n8n \
  -p 5678:5678 \
  -v ~/.n8n:/home/node/.n8n \
  n8nio/n8n
```

2. **Access n8n**
```
http://localhost:5678
```

### Import Workflow

1. Copy the workflow from `src/scripts/n8nWorkflowExample.json`
2. In n8n, go to Workflows → Import from File
3. Configure your credentials:
   - Binance API (if available)
   - Telegram Bot Token
   - Local API endpoint

### Workflow Features

- **Multi-source price checking** (Binance + CoinGecko)
- **Conditional buying** based on price thresholds
- **Telegram notifications** for every trade
- **Error handling** and retry logic
- **Execution history** tracking

### Custom Nodes

Install the Crypto APIs Community Node:
```bash
npm install n8n-nodes-crypto-apis
```

## Method 3: Make.com (Integromat) 🔧

### Scenario Setup

1. **Create New Scenario**
2. **Add Modules:**
   - HTTP Request (for price checking)
   - Router (for conditional logic)
   - HTTP Request (for buy execution)
   - Telegram/Email (for notifications)

### Configuration

```json
{
  "trigger": "Schedule (every 5 minutes)",
  "priceCheck": {
    "url": "https://api.binance.com/api/v3/ticker/price",
    "params": {"symbol": "USDTINR"}
  },
  "condition": "price <= 88.5",
  "action": {
    "url": "http://your-server:3001/api/p2p/execute",
    "method": "POST",
    "body": {
      "exchange": "binance",
      "amount": 100,
      "type": "buy"
    }
  }
}
```

## Security Best Practices 🔐

### 1. Credential Management
- Never hardcode passwords
- Use encrypted environment variables
- Rotate credentials regularly
- Enable 2FA on all exchanges

### 2. Browser Automation Security
```typescript
// Use isolated browser contexts
const context = await browser.newContext({
  viewport: { width: 1920, height: 1080 },
  userAgent: 'Your-Custom-UA',
  httpCredentials: {
    username: 'proxy-user',
    password: 'proxy-pass'
  }
});
```

### 3. API Security
- Use API keys with limited permissions
- Whitelist IP addresses
- Set daily limits
- Monitor unusual activity

### 4. Wallet Security
- Use separate wallets for automation
- Keep minimal balances
- Regular security audits
- Multi-signature where possible

## Preloading INR Strategy 💰

### Optimal Preloading Amounts

1. **Calculate Daily Volume**
```
Daily USDT Target: 1000 USDT
Average Price: ₹89
Buffer: 10%
Preload Amount: ₹97,900
```

2. **Distribution Strategy**
```
Binance: 40% (₹39,160)
WazirX: 30% (₹29,370)
ZebPay: 20% (₹19,580)
CoinDCX: 10% (₹9,790)
```

### Auto-Deposit Setup

1. **Bank Integration**
```javascript
// Example with ICICI Bank API
const deposit = await bankAPI.initiateTransfer({
  from: 'savings_account',
  to: 'binance_vpa@icici',
  amount: 50000,
  remarks: 'USDT-AUTO-DEPOSIT'
});
```

2. **UPI Automation**
```javascript
// Using UPI deep links
const upiLink = `upi://pay?pa=binance@paytm&pn=Binance&am=50000&cu=INR`;
```

### Monitoring Dashboard

Access the testing dashboard:
```bash
open P2P-TESTING-DASHBOARD.html
```

Features:
- Real-time balance tracking
- Automated deposit alerts
- Profit/loss calculations
- Transaction history

## Troubleshooting 🔧

### Common Issues

1. **Login Failures**
   - Check 2FA settings
   - Update credentials in .env
   - Clear browser cache

2. **Detection Issues**
   - Enable proxy rotation
   - Reduce check frequency
   - Use residential proxies

3. **Order Failures**
   - Verify INR balance
   - Check minimum order amounts
   - Review exchange limits

### Debug Mode

```bash
# Run with debug logging
DEBUG=* npm run auto:buy
```

## Performance Tips 🚀

1. **Optimize Check Intervals**
   - High volatility: 30 seconds
   - Normal market: 60 seconds
   - Low volatility: 5 minutes

2. **Parallel Processing**
   - Monitor multiple exchanges
   - Use worker threads
   - Implement queue system

3. **Resource Management**
   - Close unused browser tabs
   - Limit concurrent contexts
   - Regular memory cleanup

## Next Steps

1. Set up monitoring dashboard
2. Configure notification channels
3. Test with small amounts first
4. Gradually increase automation
5. Monitor and optimize

Remember: Start small, test thoroughly, and always maintain security!