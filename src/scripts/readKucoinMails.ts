import { config } from 'dotenv';
import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { logger } from '../utils/logger';

config();

interface KucoinEmail {
  id: string;
  subject: string;
  from: string;
  date: Date;
  snippet: string;
  body: string;
  labels: string[];
}

async function readKucoinEmails() {
  try {
    logger.info('🔍 Searching for KuCoin emails...');

    // Initialize OAuth2 client
    const oauth2Client = new OAuth2Client(
      process.env.GMAIL_CLIENT_ID,
      process.env.GMAIL_CLIENT_SECRET,
      process.env.GMAIL_REDIRECT_URI
    );

    // Set credentials
    oauth2Client.setCredentials({
      refresh_token: process.env.GMAIL_REFRESH_TOKEN
    });

    // Initialize Gmail API
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    // Test connection
    const profile = await gmail.users.getProfile({ userId: 'me' });
    logger.info(`📧 Connected to Gmail: ${profile.data.emailAddress}`);

    // Search for KuCoin emails
    const kucoinQueries = [
      'from:noreply@kucoin.com',
      'from:service@kucoin.com', 
      'from:no-reply@kucoin.com',
      'from:support@kucoin.com',
      'from:kucoin.com',
      'subject:kucoin',
      'subject:KuCoin'
    ];

    const allEmails: KucoinEmail[] = [];

    for (const query of kucoinQueries) {
      try {
        const searchQuery = `${query} newer_than:30d`;
        logger.info(`🔎 Searching: ${searchQuery}`);

        const response = await gmail.users.messages.list({
          userId: 'me',
          q: searchQuery,
          maxResults: 50
        });

        if (response.data.messages) {
          logger.info(`📬 Found ${response.data.messages.length} emails for query: ${query}`);

          for (const message of response.data.messages) {
            try {
              const emailData = await gmail.users.messages.get({
                userId: 'me',
                id: message.id!
              });

              const email = parseEmailData(emailData.data);
              if (email && !allEmails.find(e => e.id === email.id)) {
                allEmails.push(email);
              }
            } catch (error) {
              logger.error(`Failed to fetch email ${message.id}:`, error);
            }
          }
        }
      } catch (error) {
        logger.error(`Query failed for ${query}:`, error);
      }
    }

    // Sort by date (newest first)
    allEmails.sort((a, b) => b.date.getTime() - a.date.getTime());

    if (allEmails.length === 0) {
      logger.info('📭 No KuCoin emails found in the last 30 days');
      return;
    }

    logger.info(`📊 Found ${allEmails.length} KuCoin emails total`);
    
    // Display summary
    console.log('\n🎯 KuCoin Email Summary:');
    console.log('=' .repeat(60));
    
    allEmails.forEach((email, index) => {
      console.log(`\n📧 Email #${index + 1}`);
      console.log(`From: ${email.from}`);
      console.log(`Date: ${email.date.toLocaleString()}`);
      console.log(`Subject: ${email.subject}`);
      console.log(`Snippet: ${email.snippet}`);
      console.log('─'.repeat(60));
    });

    // Show detailed content of most recent emails
    console.log('\n📋 Recent KuCoin Email Details:');
    console.log('='.repeat(60));
    
    const recentEmails = allEmails.slice(0, 5);
    
    for (const email of recentEmails) {
      console.log(`\n📬 ${email.subject}`);
      console.log(`📅 ${email.date.toLocaleString()}`);
      console.log(`👤 ${email.from}`);
      console.log('─'.repeat(40));
      console.log(email.body.substring(0, 1000));
      if (email.body.length > 1000) {
        console.log('\n... (truncated)');
      }
      console.log('\n' + '='.repeat(60));
    }

    // Categorize emails
    const categories = categorizeEmails(allEmails);
    
    console.log('\n📊 Email Categories:');
    console.log('─'.repeat(30));
    Object.entries(categories).forEach(([category, emails]) => {
      console.log(`${category}: ${emails.length} emails`);
      if (emails.length > 0) {
        emails.slice(0, 3).forEach(email => {
          console.log(`  • ${email.subject} (${email.date.toLocaleDateString()})`);
        });
        if (emails.length > 3) {
          console.log(`  • ... and ${emails.length - 3} more`);
        }
      }
    });

    return allEmails;

  } catch (error) {
    logger.error('❌ Failed to read KuCoin emails:', error);
    throw error;
  }
}

function parseEmailData(messageData: any): KucoinEmail | null {
  try {
    const headers = messageData.payload?.headers || [];
    const subject = headers.find((h: any) => h.name === 'Subject')?.value || 'No Subject';
    const from = headers.find((h: any) => h.name === 'From')?.value || 'Unknown';
    const date = headers.find((h: any) => h.name === 'Date')?.value;
    
    let body = '';
    if (messageData.payload?.body?.data) {
      body = Buffer.from(messageData.payload.body.data, 'base64').toString();
    } else if (messageData.payload?.parts) {
      for (const part of messageData.payload.parts) {
        if (part.mimeType === 'text/plain' && part.body?.data) {
          body = Buffer.from(part.body.data, 'base64').toString();
          break;
        } else if (part.mimeType === 'text/html' && part.body?.data) {
          body = Buffer.from(part.body.data, 'base64').toString();
        }
      }
    }

    return {
      id: messageData.id,
      subject,
      from,
      date: date ? new Date(date) : new Date(parseInt(messageData.internalDate)),
      snippet: messageData.snippet || '',
      body: body.replace(/<[^>]*>/g, ''), // Remove HTML tags
      labels: messageData.labelIds || []
    };
  } catch (error) {
    logger.error('Failed to parse email data:', error);
    return null;
  }
}

function categorizeEmails(emails: KucoinEmail[]) {
  const categories = {
    'Security & Verification': [] as KucoinEmail[],
    'Trading & Orders': [] as KucoinEmail[],
    'Deposits & Withdrawals': [] as KucoinEmail[],
    'Account Updates': [] as KucoinEmail[],
    'Promotions & News': [] as KucoinEmail[],
    'Other': [] as KucoinEmail[]
  };

  emails.forEach(email => {
    const subject = email.subject.toLowerCase();
    const body = email.body.toLowerCase();
    
    if (subject.includes('verification') || subject.includes('2fa') || subject.includes('login') || 
        subject.includes('security') || body.includes('verify') || body.includes('authenticate')) {
      categories['Security & Verification'].push(email);
    } else if (subject.includes('order') || subject.includes('trade') || subject.includes('buy') || 
               subject.includes('sell') || body.includes('trading')) {
      categories['Trading & Orders'].push(email);
    } else if (subject.includes('deposit') || subject.includes('withdrawal') || subject.includes('transfer') ||
               body.includes('deposit') || body.includes('withdraw')) {
      categories['Deposits & Withdrawals'].push(email);
    } else if (subject.includes('account') || subject.includes('profile') || subject.includes('update')) {
      categories['Account Updates'].push(email);
    } else if (subject.includes('promotion') || subject.includes('bonus') || subject.includes('news') ||
               subject.includes('announcement') || body.includes('promo')) {
      categories['Promotions & News'].push(email);
    } else {
      categories['Other'].push(email);
    }
  });

  return categories;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  readKucoinEmails().catch(error => {
    logger.error('💥 Script failed:', error);
    process.exit(1);
  });
}

export { readKucoinEmails };