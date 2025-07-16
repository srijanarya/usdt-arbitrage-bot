#!/usr/bin/env node

require('dotenv').config();
const axios = require('axios');

async function testTelegramBot() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  console.log('🤖 Testing Telegram Bot Setup...\n');

  // Check if credentials are set
  if (!token || token === 'your_new_telegram_bot_token_here') {
    console.error('❌ TELEGRAM_BOT_TOKEN not set in .env file');
    console.log('\nPlease add your bot token to the .env file:');
    console.log('TELEGRAM_BOT_TOKEN=your_actual_token_here\n');
    return;
  }

  if (!chatId || chatId === 'your_telegram_chat_id_here') {
    console.error('❌ TELEGRAM_CHAT_ID not set in .env file');
    console.log('\nTo get your chat ID:');
    console.log('1. Send a message to your bot');
    console.log(`2. Visit: https://api.telegram.org/bot${token}/getUpdates`);
    console.log('3. Find "chat":{"id":YOUR_CHAT_ID}\n');
    return;
  }

  console.log('✅ Credentials found in .env file');
  console.log(`📱 Bot Token: ${token.substring(0, 10)}...${token.substring(token.length - 5)}`);
  console.log(`💬 Chat ID: ${chatId}\n`);

  try {
    // Test bot connection
    console.log('🔄 Testing bot connection...');
    const botInfo = await axios.get(`https://api.telegram.org/bot${token}/getMe`);
    console.log('✅ Bot connected successfully!');
    console.log(`🤖 Bot Name: ${botInfo.data.result.first_name}`);
    console.log(`🏷️ Username: @${botInfo.data.result.username}\n`);

    // Send test message
    console.log('📨 Sending test message...');
    const message = `
🎉 <b>Telegram Integration Test Successful!</b>

Your USDT Arbitrage Bot is now connected and ready to send notifications.

You will receive:
• 💰 Arbitrage opportunity alerts
• 📊 Daily trading summaries
• ⚠️ System alerts
• ❌ Error notifications

<i>Time: ${new Date().toLocaleString()}</i>
    `.trim();

    const response = await axios.post(`https://api.telegram.org/bot${token}/sendMessage`, {
      chat_id: chatId,
      text: message,
      parse_mode: 'HTML'
    });

    if (response.data.ok) {
      console.log('✅ Test message sent successfully!');
      console.log('📱 Check your Telegram for the test message\n');
      console.log('🎯 Your Telegram bot is ready to use!');
    } else {
      console.error('❌ Failed to send message:', response.data.description);
    }

  } catch (error) {
    console.error('❌ Error:', error.response?.data?.description || error.message);
    
    if (error.response?.status === 400) {
      console.log('\n💡 Common issues:');
      console.log('1. Wrong chat ID - make sure you sent a message to your bot first');
      console.log('2. Bot is blocked - unblock and send /start to your bot');
      console.log('3. Invalid token - check for typos or regenerate token');
    }
  }

  console.log('\n📖 Next steps:');
  console.log('1. Run: npm run dev');
  console.log('2. Your bot will send alerts when arbitrage opportunities are found');
  console.log('3. Check TELEGRAM_SETUP.md for more details');
}

// Run the test
testTelegramBot();