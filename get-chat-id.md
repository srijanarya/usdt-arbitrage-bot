# 📱 How to Get Your Telegram Chat ID

Since the API is returning 401, here are alternative methods to get your Chat ID:

## Method 1: Use IDBot (Recommended)
1. Open Telegram
2. Search for **@myidbot**
3. Send `/getid`
4. Copy the number shown as "Your user ID"

## Method 2: Use Get My ID Bot
1. Search for **@getmyid_bot**
2. Send `/start`
3. Copy your User ID

## Method 3: Use Raw Data Bot
1. Search for **@RawDataBot**
2. Send any message
3. Look for `"from": {"id": YOUR_CHAT_ID}`

## Method 4: Forward Message Method
1. Send a message to your bot (@Usdt_srijan_bot)
2. Forward that message to **@getidsbot**
3. It will show the chat ID

## Method 5: Web Telegram
1. Open https://web.telegram.org
2. Click on your bot chat
3. Look at the URL: `#/im?p=@Usdt_srijan_bot`
4. The number after `p=` or in the URL is related to your chat

## 🔧 Manual Configuration

Once you have your Chat ID, update your `.env` file:

```bash
TELEGRAM_CHAT_ID=123456789  # Replace with your actual ID
```

## 🤔 About the 401 Error

The 401 error suggests:
1. **Token might be for a different bot** - Double-check in BotFather
2. **Regional restrictions** - Some regions block Telegram API
3. **Token needs regeneration** - Try `/revoke` then get new token

## 🆘 If Nothing Works

1. Create a completely new bot:
   ```
   /newbot
   Test USDT Bot
   test_usdt_bot
   ```

2. Use the new token immediately

3. Or try using the bot without the API:
   - Your bot will still work for sending messages
   - You just need to manually add your chat ID