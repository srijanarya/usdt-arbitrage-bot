import { config } from 'dotenv';
import { OAuth2Client } from 'google-auth-library';
import { google } from 'googleapis';
import { logger } from '../utils/logger';

config();

async function fetchUPIPayments() {
  try {
    const CLIENT_ID = process.env.GMAIL_CLIENT_ID;
    const CLIENT_SECRET = process.env.GMAIL_CLIENT_SECRET;
    const REFRESH_TOKEN = process.env.GMAIL_REFRESH_TOKEN;

    if (!REFRESH_TOKEN || REFRESH_TOKEN === 'your_gmail_refresh_token') {
      logger.error('Gmail refresh token not configured. Run Gmail setup first.');
      return;
    }

    const oauth2Client = new OAuth2Client(CLIENT_ID, CLIENT_SECRET);
    oauth2Client.setCredentials({ refresh_token: REFRESH_TOKEN });

    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    // Search for UPI payment emails from Axis Bank
    const query = 'from:alerts@axisbank.com OR from:axisbank (UPI OR "credited to your account" OR "received payment")';
    
    const response = await gmail.users.messages.list({
      userId: 'me',
      q: query,
      maxResults: 10
    });

    if (!response.data.messages) {
      logger.info('No UPI payment emails found');
      return;
    }

    logger.info(`Found ${response.data.messages.length} potential UPI payment emails\n`);

    const upiPayments = [];

    for (const message of response.data.messages) {
      const fullMessage = await gmail.users.messages.get({
        userId: 'me',
        id: message.id
      });

      const headers = fullMessage.data.payload.headers;
      const subject = headers.find(h => h.name === 'Subject')?.value || '';
      const from = headers.find(h => h.name === 'From')?.value || '';
      const date = headers.find(h => h.name === 'Date')?.value || '';

      // Get message body
      let body = '';
      const parts = fullMessage.data.payload.parts || [fullMessage.data.payload];
      for (const part of parts) {
        if (part.mimeType === 'text/plain' && part.body.data) {
          body += Buffer.from(part.body.data, 'base64').toString();
        }
      }

      // Extract UPI payment details
      const amountMatch = body.match(/(?:Rs\.?|INR|₹)\s*([\d,]+(?:\.\d{2})?)/);
      const upiMatch = body.match(/UPI.*?(?:from|by|ID:?)\s*([^\s]+)/i);
      const refMatch = body.match(/(?:Reference|Ref|Transaction ID|UTR)[:\s]*([\w\d]+)/i);

      if (amountMatch) {
        upiPayments.push({
          date: new Date(date).toLocaleString('en-IN'),
          amount: amountMatch[1],
          from: upiMatch ? upiMatch[1] : 'Unknown',
          reference: refMatch ? refMatch[1] : 'N/A',
          subject: subject.substring(0, 50)
        });
      }
    }

    console.log('\n📊 Last 10 UPI Payments Received:\n');
    console.log('━'.repeat(80));
    
    upiPayments.forEach((payment, index) => {
      console.log(`${index + 1}. Date: ${payment.date}`);
      console.log(`   Amount: ₹${payment.amount}`);
      console.log(`   From: ${payment.from}`);
      console.log(`   Reference: ${payment.reference}`);
      console.log(`   Subject: ${payment.subject}`);
      console.log('─'.repeat(80));
    });

  } catch (error) {
    logger.error('Failed to fetch UPI payments:', error);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  fetchUPIPayments();
}

export { fetchUPIPayments };