import dotenv from 'dotenv';
import { config } from 'dotenv';

// Try multiple ways to load env
dotenv.config();
config();

console.log('Environment Debug:');
console.log('==================');
console.log('TELEGRAM_BOT_TOKEN exists:', !!process.env.TELEGRAM_BOT_TOKEN);
console.log('TELEGRAM_BOT_TOKEN length:', process.env.TELEGRAM_BOT_TOKEN?.length);
console.log('First 10 chars:', process.env.TELEGRAM_BOT_TOKEN?.substring(0, 10));
console.log('TELEGRAM_CHAT_ID:', process.env.TELEGRAM_CHAT_ID);
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('CWD:', process.cwd());

// Check if .env file exists
import fs from 'fs';
console.log('.env exists:', fs.existsSync('.env'));

// Try reading .env directly
if (fs.existsSync('.env')) {
  const envContent = fs.readFileSync('.env', 'utf8');
  const lines = envContent.split('\n');
  const telegramLine = lines.find(line => line.startsWith('TELEGRAM_BOT_TOKEN'));
  console.log('Telegram line from file:', telegramLine);
}