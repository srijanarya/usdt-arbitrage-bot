# 🧪 Testing Phase Guide - 0.5% Profit Target

## 📊 Current Setup
- **Your USDT**: 11.5 USDT in Binance
- **Buy Price**: ₹89.00
- **Target Sell Price**: ₹89.45 (0.5% profit)
- **Goal**: Maximum transactions for data gathering

## 🚀 Quick Start Commands

### 1. Start 0.5% Profit Testing Mode
```bash
npm run test-0.5
```
This will:
- Set fixed price at ₹89.45
- Create 3 concurrent orders
- Auto-relist every 10 minutes
- Show real-time statistics

### 2. Check Current Status
```bash
npm run check-status
```
Shows:
- Current USDT balance
- Market prices
- Your previous orders

### 3. Monitor Dashboard
Open `AUTO-LISTING-DASHBOARD.html` in your browser for visual monitoring.

## 🔄 Wallet Transfer Process (Semi-Automated)

Since you don't trust the fully automated wallet transfers yet, here's the current workflow:

1. **Manual Buy** on cheapest exchange (WazirX, CoinDCX)
2. **Get Deposit Address** - Bot provides Binance TRC20 address
3. **Manual Transfer** - You initiate from source exchange
4. **Auto Monitor** - Bot tracks the transfer
5. **Auto List** - Bot creates P2P sell orders

### Monitor Transfers
Open `WALLET-TRANSFER-MONITOR.html` to track the process step-by-step.

## 📋 UPI Configuration

Currently using:
```
UPI ID: srijanaryay@okaxis
Holder Name: Srijan Arya
```

This is configured in the system and will be used for:
- P2P payment details
- Payment verification (when ICICI API is ready)

## 📈 Expected Results (0.5% Profit)

Per Trade:
- Amount: 11.5 USDT
- Profit: ₹5.18 per trade
- Time: 10-30 minutes (depending on market)

Daily Projections (if 20 trades):
- Volume: 230 USDT
- Profit: ₹103.60
- Data points: 20 transactions

## ⚠️ Important Notes

1. **Balance Protection**: System keeps 0.5 USDT minimum
2. **Order Expiry**: 10 minutes (then auto-relist)
3. **Network**: Always use TRC20 for lowest fees
4. **Market Check**: System shows if your price is competitive

## 🛠️ Troubleshooting

### Orders Not Selling?
- Check market price: `npm run check-status`
- Lower price if needed in dashboard
- Market might be below ₹89.45

### Transfer Issues?
- Verify TRC20 network selected
- Check minimum transfer amount (10 USDT)
- Allow 1-3 minutes for confirmation

### System Crashed?
- Restart: `npm run test-0.5`
- Check logs in terminal
- Orders remain on Binance P2P

## 📞 Next Steps

1. **Run testing mode** for 1-2 hours
2. **Gather data** on sale times and success rate
3. **Adjust strategy** based on results
4. **Scale up** once comfortable with flow

## 🏦 Pending: ICICI Bank Integration

Once ICICI provides API credentials:
- Automated UPI payment verification
- Instant order completion
- Higher trust in automation

For now, the semi-automated approach gives you full control while testing the system.

---

Remember: The goal is DATA, not maximum profit. More transactions = better understanding of the market dynamics.