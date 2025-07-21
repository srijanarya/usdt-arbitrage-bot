# 📱 Mobile Access Guide for USDT Arbitrage Bot

## 🚀 Quick Start

1. **Start the mobile server:**
   ```bash
   npm run mobile:trading
   ```

2. **Look for the QR code** in the terminal
3. **Scan with your phone** or enter the URL shown
4. **Enter PIN** (default: 1234)

## 📲 Features

### Real-Time Dashboard
- Live price monitoring from all exchanges
- Arbitrage opportunities with instant alerts
- Trading P&L and performance metrics
- Risk management indicators

### Trading Controls
- Start/Stop automated trading
- Adjust trading parameters on-the-fly
- Set profit thresholds and limits
- Emergency stop button

### Reports & Analytics
- Daily profit reports
- Win rate and performance metrics
- Trade history and execution details
- Export reports for analysis

## 🔐 Security Setup

### 1. Change Default PIN
Add to your `.env` file:
```
MOBILE_PIN=your-secure-pin
JWT_SECRET=your-secret-key
```

### 2. Local Network Only (Recommended)
The server runs on your local network by default. This is the most secure option.

### 3. Remote Access Options

#### Option A: Tailscale (Recommended for Security)
1. Install Tailscale on your computer and phone
2. Connect both devices to your Tailscale network
3. Access using your Tailscale IP

#### Option B: ngrok (For Testing)
```bash
# Install ngrok
npm install -g ngrok

# In a new terminal, expose your mobile server
ngrok http 3333
```

#### Option C: Port Forwarding (Advanced)
1. Configure your router to forward port 3333
2. Use dynamic DNS for stable access
3. **IMPORTANT**: Add additional authentication

### 4. Enhanced Security
For production use, add these to your `.env`:
```
MOBILE_PIN=complex-pin-here
JWT_SECRET=long-random-string
MOBILE_WHITELIST=your-phone-ip
SSL_CERT_PATH=/path/to/cert
SSL_KEY_PATH=/path/to/key
```

## 📱 Mobile App Experience

### Add to Home Screen (iOS)
1. Open in Safari
2. Tap Share button
3. Select "Add to Home Screen"
4. Name it "USDT Trading"

### Add to Home Screen (Android)
1. Open in Chrome
2. Tap menu (3 dots)
3. Select "Add to Home Screen"

## 🎯 Usage Tips

### Best Practices
- Keep phone on same WiFi for best performance
- Enable notifications for trade alerts
- Set daily limits to manage risk
- Review reports daily

### Troubleshooting
- **Can't connect?** Check firewall settings
- **Slow updates?** Restart the mobile server
- **Auth issues?** Clear browser cache

## 🛡️ Safety Features

1. **View-Only Mode**: Can monitor without trading
2. **PIN Protection**: Prevents unauthorized access
3. **Auto-Logout**: After 30 minutes of inactivity
4. **Trade Confirmations**: Optional 2-step verification
5. **Emergency Stop**: Instantly halt all trading

## 📊 Dashboard Layout

### Header
- Trading status (Active/Inactive)
- Connection indicator
- Emergency stop button

### Stats Grid
- Daily P&L
- Win Rate
- Trading Volume  
- Active Trades

### Control Panel
- Start/Stop Trading
- Min Profit Setting
- ROI Threshold
- Position Limits

### Price Monitor
- Real-time prices from all exchanges
- Spread indicators
- Last update time

### Opportunities Feed
- Live arbitrage opportunities
- Profit calculations
- One-tap execution (if enabled)

## 🔧 Advanced Configuration

### Custom Alerts
```javascript
// In mobileTradingServer.ts
const ALERT_THRESHOLDS = {
  minProfit: 500,      // Alert for opportunities > ₹500
  maxLoss: -1000,      // Alert if daily loss > ₹1000
  lowBalance: 5000     // Alert if balance < ₹5000
}
```

### Performance Tuning
- Adjust WebSocket update interval
- Enable/disable certain exchanges
- Set data retention period

## 📞 Support

- Check logs: `logs/mobile-server.log`
- Debug mode: `MOBILE_DEBUG=true npm run mobile:trading`
- Common issues documented in `/docs/mobile-troubleshooting.md`

---

**Note**: This mobile interface is designed for monitoring and basic controls. Complex operations should be performed on the desktop interface for safety.