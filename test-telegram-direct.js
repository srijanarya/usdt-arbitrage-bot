const https = require('https');
require('dotenv').config();

const token = process.env.TELEGRAM_BOT_TOKEN;

if (!token) {
  console.error('❌ TELEGRAM_BOT_TOKEN not set in .env file');
  process.exit(1);
}

// Test 1: Direct HTTPS request
const options = {
  hostname: 'api.telegram.org',
  port: 443,
  path: `/bot${token}/getMe`,
  method: 'GET'
};

console.log('Testing Telegram Bot Token...\n');
console.log('Token:', token);
console.log('Bot Link: https://t.me/Usdt_srijan_bot\n');

const req = https.request(options, (res) => {
  console.log('Status Code:', res.statusCode);
  console.log('Headers:', res.headers);
  
  let data = '';
  
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    console.log('\nResponse:');
    try {
      const parsed = JSON.parse(data);
      console.log(JSON.stringify(parsed, null, 2));
      
      if (parsed.ok) {
        console.log('\n✅ Bot is valid!');
        console.log('Bot Username: @' + parsed.result.username);
        console.log('Bot Name:', parsed.result.first_name);
        console.log('\nNow send a message to your bot and run:');
        console.log(`curl https://api.telegram.org/bot${token}/getUpdates`);
      }
    } catch (e) {
      console.log(data);
    }
  });
});

req.on('error', (e) => {
  console.error('Request error:', e);
});

req.end();