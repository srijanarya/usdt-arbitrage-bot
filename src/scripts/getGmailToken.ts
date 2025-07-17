import { config } from 'dotenv';
import { OAuth2Client } from 'google-auth-library';
import { logger } from '../utils/logger';
import { writeFileSync, readFileSync } from 'fs';

config();

async function getGmailToken(authCode: string) {
  try {
    const clientId = process.env.GMAIL_CLIENT_ID;
    const clientSecret = process.env.GMAIL_CLIENT_SECRET;
    
    if (!clientId || !clientSecret) {
      logger.error('❌ Gmail Client ID or Secret not found in .env file');
      return;
    }
    
    logger.info('🔄 Converting authorization code to refresh token...');
    
    const oauth2Client = new OAuth2Client(clientId, clientSecret, 'urn:ietf:wg:oauth:2.0:oob');
    
    // Exchange authorization code for tokens
    const { tokens } = await oauth2Client.getToken(authCode);
    
    if (!tokens.refresh_token) {
      logger.error('❌ No refresh token received. Make sure to approve all permissions.');
      return;
    }
    
    logger.info('✅ Successfully obtained refresh token!');
    logger.info(`🔑 Refresh Token: ${tokens.refresh_token}`);
    
    // Update .env file
    updateEnvFile(tokens.refresh_token);
    
    // Test the connection
    logger.info('🧪 Testing Gmail connection with new token...');
    oauth2Client.setCredentials({ refresh_token: tokens.refresh_token });
    
    const { google } = await import('googleapis');
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
    const profile = await gmail.users.getProfile({ userId: 'me' });
    
    logger.info(`✅ Gmail connection successful! Email: ${profile.data.emailAddress}`);
    logger.info('🎉 Gmail setup completed! You can now search for KuCoin emails.');
    
  } catch (error) {
    logger.error('❌ Failed to get refresh token:', error);
  }
}

function updateEnvFile(refreshToken: string) {
  try {
    const envPath = '.env';
    let envContent = readFileSync(envPath, 'utf8');
    
    // Replace the refresh token line
    envContent = envContent.replace(
      /GMAIL_REFRESH_TOKEN=.*/,
      `GMAIL_REFRESH_TOKEN=${refreshToken}`
    );
    
    writeFileSync(envPath, envContent);
    logger.info('📝 Updated .env file with refresh token');
    
  } catch (error) {
    logger.error('❌ Failed to update .env file:', error);
    logger.info(`📋 Please manually add this to your .env file:`);
    logger.info(`GMAIL_REFRESH_TOKEN=${refreshToken}`);
  }
}

// Get auth code from command line argument
const authCode = process.argv[2];

if (!authCode) {
  logger.error('❌ Please provide the authorization code as an argument');
  logger.info('Usage: npx tsx src/scripts/getGmailToken.ts YOUR_AUTH_CODE');
  logger.info('');
  logger.info('First, go to this URL to get your authorization code:');
  
  const CLIENT_ID = process.env.GMAIL_CLIENT_ID;
  if (CLIENT_ID) {
    const oauth2Client = new OAuth2Client(CLIENT_ID, process.env.GMAIL_CLIENT_SECRET, 'urn:ietf:wg:oauth:2.0:oob');
    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: [
        'https://www.googleapis.com/auth/gmail.readonly',
        'https://www.googleapis.com/auth/gmail.modify'
      ],
      prompt: 'consent'
    });
    logger.info(`\n${authUrl}\n`);
  }
} else {
  getGmailToken(authCode);
}