import { config } from 'dotenv';
import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { logger } from '../utils/logger';

config();

async function testGmailConnection() {
  try {
    logger.info('🧪 Testing Gmail connection...');
    
    // Check environment variables
    const clientId = process.env.GMAIL_CLIENT_ID;
    const clientSecret = process.env.GMAIL_CLIENT_SECRET;
    const refreshToken = process.env.GMAIL_REFRESH_TOKEN;
    
    if (!clientId || !clientSecret) {
      logger.error('❌ Gmail Client ID or Secret not found in .env file');
      return false;
    }
    
    if (!refreshToken || refreshToken === 'your_gmail_refresh_token') {
      logger.error('❌ Gmail refresh token not configured');
      logger.info('📋 To configure Gmail access:');
      logger.info('1. Open this URL in your browser:');
      
      const oauth2Client = new OAuth2Client(clientId, clientSecret, 'urn:ietf:wg:oauth:2.0:oob');
      const authUrl = oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: [
          'https://www.googleapis.com/auth/gmail.readonly',
          'https://www.googleapis.com/auth/gmail.modify'
        ],
        prompt: 'consent'
      });
      
      logger.info(`\n${authUrl}\n`);
      logger.info('2. Authorize the application and copy the authorization code');
      logger.info('3. Update your .env file by replacing:');
      logger.info('   GMAIL_REFRESH_TOKEN=your_gmail_refresh_token');
      logger.info('   with the refresh token you get from the authorization process');
      
      return false;
    }
    
    // Test the connection
    const oauth2Client = new OAuth2Client(clientId, clientSecret);
    oauth2Client.setCredentials({ refresh_token: refreshToken });
    
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
    const profile = await gmail.users.getProfile({ userId: 'me' });
    
    logger.info(`✅ Gmail connection successful!`);
    logger.info(`📧 Connected email: ${profile.data.emailAddress}`);
    logger.info(`📊 Total messages: ${profile.data.messagesTotal}`);
    
    return true;
    
  } catch (error) {
    logger.error('❌ Gmail connection failed:', error);
    
    if (error.message?.includes('invalid_grant')) {
      logger.error('🔄 Refresh token expired. Please re-authorize Gmail access.');
    }
    
    return false;
  }
}

testGmailConnection();