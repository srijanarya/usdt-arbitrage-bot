# Telegram Alert System Setup

This guide will help you set up Telegram alerts for arbitrage opportunities.

## Step 1: Create a Telegram Bot

1. Open Telegram and search for `@BotFather`
2. Start a chat and send `/newbot`
3. Choose a name for your bot (e.g., "USDT Arbitrage Bot")
4. Choose a username (must end with 'bot', e.g., `usdt_arbitrage_bot`)
5. Save the bot token you receive (looks like: `1234567890:ABCdefGHIjklMNOpqrsTUVwxyz`)

## Step 2: Get Your Chat ID

1. Start a chat with your new bot
2. Send any message to the bot
3. Visit: `https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getUpdates`
4. Look for `"chat":{"id":123456789}` - this is your chat ID
5. Save this chat ID

## Step 3: Configure Environment Variables

Add to your `.env` file:

```env
# Telegram Configuration
TELEGRAM_BOT_TOKEN=your_bot_token_here
TELEGRAM_CHAT_ID=your_chat_id_here
```

## Step 4: Test the Connection

Run the test script:

```bash
npm run test:telegram
```

You should receive a test message in your Telegram chat.

## Alert Types

The system will send various alerts:

### 1. Arbitrage Opportunities
- 🚀 High profit (>₹500)
- 💰 Good profit (₹200-500)
- 📈 Low profit (<₹200)

### 2. Price Alerts
- 🎯 Price below threshold
- 📉 Price above threshold

### 3. System Alerts
- ⚠️ Warnings
- ❌ Errors

### 4. Daily Summary
- 📊 Daily statistics and performance

## Usage in Code

```typescript
import { telegramAlert } from './services/telegram/TelegramAlertService';

// Send arbitrage alert
await telegramAlert.sendArbitrageAlert(
  'ZebPay',      // Buy exchange
  'P2P',         // Sell exchange
  85.00,         // Buy price
  90.00,         // Sell price
  400.00,        // Profit
  4.7,           // ROI %
  100            // Amount USDT
);

// Send price alert
await telegramAlert.sendPriceAlert('ZebPay', 84.50, 85.00);

// Send system alert
await telegramAlert.sendSystemAlert(
  'Connection Error',
  'Failed to connect to ZebPay API',
  'error'
);
```

## Customization

### Rate Limiting
The system automatically rate-limits messages to prevent spam (1 message per second).

### Priority Queue
High-priority messages are retried if they fail to send.

### Enable/Disable
You can toggle alerts on/off without changing configuration:

```typescript
telegramAlert.setEnabled(false); // Disable
telegramAlert.setEnabled(true);  // Enable
```

## Troubleshooting

1. **No messages received**
   - Check bot token is correct
   - Ensure you've started a chat with the bot
   - Verify chat ID is correct

2. **Connection errors**
   - Check internet connection
   - Verify Telegram API is accessible
   - Check for firewall/proxy issues

3. **Rate limit errors**
   - The system handles this automatically
   - Reduce alert frequency if persistent

## Security Notes

- Never commit your bot token to git
- Keep your chat ID private
- Use environment variables for sensitive data
- Consider using a dedicated Telegram account for trading alerts