# 📱 Telegram Bot Setup Guide

## 🔒 Security First!
**NEVER** share your bot token publicly or commit it to GitHub!

## 📋 Setup Steps

### 1. Get Your New Bot Token
1. Open Telegram and search for **@BotFather**
2. Send `/newbot` and follow the prompts
3. Copy the token (looks like: `1234567890:ABCdefGHIjklMNOpqrsTUVwxyz`)

### 2. Get Your Chat ID
1. Start a chat with your new bot
2. Send any message to your bot (like "Hello")
3. Open this URL in your browser (replace YOUR_BOT_TOKEN):
   ```
   https://api.telegram.org/botYOUR_BOT_TOKEN/getUpdates
   ```
4. Look for: `"chat":{"id":123456789}` - that's your Chat ID

### 3. Configure Your .env File
Create a `.env` file in the project root with:

```env
# Telegram Configuration
TELEGRAM_BOT_TOKEN=paste_your_bot_token_here
TELEGRAM_CHAT_ID=paste_your_chat_id_here
TELEGRAM_ENABLED=true

# Other required settings
DB_HOST=localhost
DB_PORT=5432
DB_NAME=arbitrage_bot
DB_USER=postgres
DB_PASSWORD=your_password

# Exchange APIs (optional)
BINANCE_API_KEY=
BINANCE_API_SECRET=
```

### 4. Test Your Bot
Run this command to test:
```bash
npm run test:telegram
```

## 📨 What You'll Receive

### 💰 Arbitrage Alerts
```
🚀 ARBITRAGE OPPORTUNITY DETECTED!

📊 Pair: USDT/USDC
💸 Net Profit: 0.25%

📈 Buy on: Binance
   Price: 0.9975

📉 Sell on: KuCoin
   Price: 1.0000

⏰ Time: 2:30:45 PM
```

### 📊 Daily Summary
```
📊 DAILY ARBITRAGE SUMMARY

📈 Total Opportunities: 145
✅ Profitable: 23 (15.86%)
💵 Total Volume: $45,230.00

🏆 Best Opportunity Today:
   Profit: 0.35%
   Route: Binance → KuCoin

📅 1/16/2025
```

## 🛠️ Troubleshooting

### Bot not responding?
- Check token is correct
- Ensure bot is started (send /start)
- Verify TELEGRAM_ENABLED=true

### Not receiving messages?
- Check Chat ID is correct
- Make sure you've messaged the bot first
- Check firewall/network settings

## 🔐 Security Tips
1. Keep your `.env` file local only
2. Add `.env` to `.gitignore`
3. Regenerate token if exposed
4. Use environment variables in production

---

Need help? Check the logs or create an issue on GitHub!