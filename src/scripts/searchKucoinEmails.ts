import { config } from 'dotenv';
import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { logger } from '../utils/logger';

// Load environment variables
config();

interface KucoinEmail {
  id: string;
  subject: string;
  from: string;
  date: Date;
  body: string;
  snippet: string;
  labels: string[];
}

class KucoinEmailSearcher {
  private gmail: any;
  private oauth2Client: OAuth2Client;

  constructor() {
    this.oauth2Client = new OAuth2Client(
      process.env.GMAIL_CLIENT_ID,
      process.env.GMAIL_CLIENT_SECRET,
      process.env.GMAIL_REDIRECT_URI
    );
  }

  async initialize() {
    try {
      // Set credentials
      this.oauth2Client.setCredentials({
        refresh_token: process.env.GMAIL_REFRESH_TOKEN
      });

      // Initialize Gmail API
      this.gmail = google.gmail({ version: 'v1', auth: this.oauth2Client });

      // Test connection
      const profile = await this.gmail.users.getProfile({ userId: 'me' });
      logger.info(`✅ Gmail connected: ${profile.data.emailAddress}`);
      
      return true;
    } catch (error) {
      logger.error('❌ Gmail connection failed:', error);
      throw error;
    }
  }

  async searchKucoinEmails(maxResults: number = 20, days: number = 30): Promise<KucoinEmail[]> {
    try {
      // Build search query for KuCoin emails
      const queries = [
        'from:noreply@kucoin.com',
        'from:service@kucoin.com', 
        'from:support@kucoin.com',
        'from:security@kucoin.com',
        'from:alerts@kucoin.com',
        'subject:KuCoin',
        'subject:kucoin'
      ];

      const timeQuery = `newer_than:${days}d`;
      const fullQuery = `(${queries.join(' OR ')}) ${timeQuery}`;

      logger.info(`🔍 Searching for KuCoin emails with query: ${fullQuery}`);

      const response = await this.gmail.users.messages.list({
        userId: 'me',
        q: fullQuery,
        maxResults: maxResults
      });

      if (!response.data.messages || response.data.messages.length === 0) {
        logger.info('📭 No KuCoin emails found');
        return [];
      }

      logger.info(`📬 Found ${response.data.messages.length} KuCoin email(s)`);

      // Fetch detailed information for each email
      const emails: KucoinEmail[] = [];
      
      for (const message of response.data.messages) {
        try {
          const emailDetails = await this.getEmailDetails(message.id);
          if (emailDetails) {
            emails.push(emailDetails);
          }
        } catch (error) {
          logger.error(`Error processing email ${message.id}:`, error);
        }
      }

      // Sort by date (newest first)
      emails.sort((a, b) => b.date.getTime() - a.date.getTime());

      return emails;

    } catch (error) {
      logger.error('Error searching KuCoin emails:', error);
      throw error;
    }
  }

  private async getEmailDetails(messageId: string): Promise<KucoinEmail | null> {
    try {
      const message = await this.gmail.users.messages.get({
        userId: 'me',
        id: messageId
      });

      const payload = message.data.payload;
      const headers = payload.headers;

      // Extract headers
      const subject = this.getHeader(headers, 'Subject') || 'No Subject';
      const from = this.getHeader(headers, 'From') || 'Unknown Sender';
      const date = new Date(parseInt(message.data.internalDate));

      // Extract body
      const body = this.extractEmailBody(payload);

      // Get labels
      const labels = message.data.labelIds || [];

      return {
        id: messageId,
        subject,
        from,
        date,
        body,
        snippet: message.data.snippet || '',
        labels
      };

    } catch (error) {
      logger.error(`Error getting email details for ${messageId}:`, error);
      return null;
    }
  }

  private getHeader(headers: any[], name: string): string | null {
    const header = headers.find(h => h.name.toLowerCase() === name.toLowerCase());
    return header ? header.value : null;
  }

  private extractEmailBody(payload: any): string {
    let body = '';

    if (payload.body && payload.body.data) {
      // Simple body
      body = Buffer.from(payload.body.data, 'base64').toString('utf-8');
    } else if (payload.parts) {
      // Multipart body
      for (const part of payload.parts) {
        if (part.mimeType === 'text/plain' && part.body.data) {
          body += Buffer.from(part.body.data, 'base64').toString('utf-8');
        } else if (part.mimeType === 'text/html' && part.body.data && !body) {
          // Use HTML if no plain text is available
          body = Buffer.from(part.body.data, 'base64').toString('utf-8');
        }
      }
    }

    return body.trim();
  }

  async searchSpecificTypes(type: 'verification' | 'trading' | 'security' | 'all' = 'all'): Promise<KucoinEmail[]> {
    const typeQueries = {
      verification: 'subject:(verify OR verification OR confirm OR activation)',
      trading: 'subject:(order OR trade OR buy OR sell OR deposit OR withdraw OR transfer)',
      security: 'subject:(security OR login OR password OR 2FA OR suspicious OR alert)',
      all: ''
    };

    const baseQuery = '(from:noreply@kucoin.com OR from:service@kucoin.com OR from:support@kucoin.com OR from:security@kucoin.com OR subject:KuCoin OR subject:kucoin)';
    const typeQuery = typeQueries[type];
    const timeQuery = 'newer_than:30d';

    const fullQuery = typeQuery 
      ? `${baseQuery} ${typeQuery} ${timeQuery}`
      : `${baseQuery} ${timeQuery}`;

    logger.info(`🔍 Searching for ${type} KuCoin emails`);

    const response = await this.gmail.users.messages.list({
      userId: 'me',
      q: fullQuery,
      maxResults: 10
    });

    if (!response.data.messages) {
      return [];
    }

    const emails: KucoinEmail[] = [];
    for (const message of response.data.messages) {
      const emailDetails = await this.getEmailDetails(message.id);
      if (emailDetails) {
        emails.push(emailDetails);
      }
    }

    return emails.sort((a, b) => b.date.getTime() - a.date.getTime());
  }

  formatEmailSummary(emails: KucoinEmail[]): string {
    if (emails.length === 0) {
      return '📭 No KuCoin emails found';
    }

    let summary = `📬 Found ${emails.length} KuCoin email(s):\n\n`;

    emails.forEach((email, index) => {
      summary += `${index + 1}. 📧 **${email.subject}**\n`;
      summary += `   📅 Date: ${email.date.toLocaleString()}\n`;
      summary += `   📨 From: ${email.from}\n`;
      summary += `   📝 Preview: ${email.snippet.substring(0, 100)}${email.snippet.length > 100 ? '...' : ''}\n`;
      summary += `   🆔 ID: ${email.id}\n\n`;
    });

    return summary;
  }

  formatEmailContent(email: KucoinEmail): string {
    return `
📧 **KuCoin Email Details**
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📧 **Subject:** ${email.subject}
📨 **From:** ${email.from}  
📅 **Date:** ${email.date.toLocaleString()}
🆔 **Message ID:** ${email.id}
🏷️ **Labels:** ${email.labels.join(', ')}

📝 **Content:**
${email.body}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    `.trim();
  }
}

async function searchKucoinEmails() {
  const searcher = new KucoinEmailSearcher();
  
  try {
    logger.info('🚀 Starting KuCoin email search...');
    
    // Check if Gmail is properly configured
    if (process.env.GMAIL_REFRESH_TOKEN === 'your_gmail_refresh_token') {
      logger.error('❌ Gmail not configured. Please run Gmail setup first:');
      logger.info('npm run setup:gmail');
      return;
    }

    await searcher.initialize();

    // Search for all KuCoin emails
    logger.info('🔍 Searching for all KuCoin emails...');
    const allEmails = await searcher.searchKucoinEmails(20, 30);
    
    console.log('\n' + searcher.formatEmailSummary(allEmails));

    // Search for specific types
    logger.info('\n🔒 Searching for security/verification emails...');
    const securityEmails = await searcher.searchSpecificTypes('security');
    
    if (securityEmails.length > 0) {
      console.log('\n🔒 **SECURITY/VERIFICATION EMAILS:**');
      console.log(searcher.formatEmailSummary(securityEmails));
    }

    logger.info('\n💰 Searching for trading-related emails...');
    const tradingEmails = await searcher.searchSpecificTypes('trading');
    
    if (tradingEmails.length > 0) {
      console.log('\n💰 **TRADING-RELATED EMAILS:**');
      console.log(searcher.formatEmailSummary(tradingEmails));
    }

    // Show detailed content of the 3 most recent emails
    if (allEmails.length > 0) {
      console.log('\n📄 **DETAILED CONTENT OF RECENT EMAILS:**');
      console.log('═'.repeat(80));
      
      const recentEmails = allEmails.slice(0, 3);
      recentEmails.forEach((email, index) => {
        console.log(searcher.formatEmailContent(email));
        if (index < recentEmails.length - 1) {
          console.log('\n' + '═'.repeat(80) + '\n');
        }
      });
    }

    logger.info('✅ KuCoin email search completed');

  } catch (error) {
    logger.error('💥 KuCoin email search failed:', error);
    
    if (error.message?.includes('invalid_grant')) {
      logger.error('❌ Gmail token expired. Please re-run Gmail setup:');
      logger.info('npm run setup:gmail');
    } else if (error.message?.includes('insufficient permissions')) {
      logger.error('❌ Insufficient Gmail permissions. Please re-run Gmail setup:');
      logger.info('npm run setup:gmail');
    }
  }
}

// Export for programmatic use
export { KucoinEmailSearcher, searchKucoinEmails };

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  searchKucoinEmails().catch(error => {
    logger.error('💥 Script execution failed:', error);
    process.exit(1);
  });
}