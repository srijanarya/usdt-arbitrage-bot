# Quick P2P Trading Guide

## Current Market Status (Live)
- **Market Price**: ₹94.80
- **Your Sell Price**: ₹94.75
- **Your Profit**: 6.5% (₹66.36 on 11.54 USDT)

## Manual Trading Steps

### 1. Open Binance P2P
```
https://p2p.binance.com/en/trade/sell/USDT?fiat=INR&payment=UPI
```

### 2. Create Sell Order
- Click "Post new Ad" (orange button)
- Select "I want to sell"
- Asset: USDT
- Fiat: INR

### 3. Enter Details
- **Total amount**: 11.54 USDT
- **Fixed price**: ₹94.75
- **Payment method**: UPI
- **Payment details**: 
  - UPI ID: srijanaryay@okaxis
  - Name: SRIJAN INDERJEET ARYA
  - Bank: Axis Bank

### 4. Set Limits
- **Min order limit**: ₹500
- **Max order limit**: ₹11,000 (or your total)

### 5. Payment Time
- Set to 15 minutes

### 6. Counterparty conditions (Optional)
- Registered 30+ days
- Completion rate > 90%

### 7. Post the Ad

## After Posting

### When Someone Buys:
1. You'll get notification
2. Chat opens automatically
3. Share your UPI: srijanaryay@okaxis
4. Wait for payment
5. Check Axis Bank app
6. Verify exact amount: ₹1,093.43
7. Click "Release" only after confirming

## Quick Commands

Monitor prices:
```bash
npx ts-node src/scripts/simpleP2PMonitor.ts
```

Check your IP:
```bash
npx ts-node src/scripts/checkMyIP.ts
```

## Important Reminders
- Never release before payment
- Check sender name matches
- Exact amount must match
- Save payment screenshots