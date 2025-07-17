import { config } from 'dotenv';
import { OAuth2Client } from 'google-auth-library';
import { writeFileSync, readFileSync } from 'fs';
import { logger } from '../utils/logger';

// Load environment variables
config();

const CLIENT_ID = process.env.GMAIL_CLIENT_ID;
const CLIENT_SECRET = process.env.GMAIL_CLIENT_SECRET;

async function simpleGmailSetup() {
    if (!CLIENT_ID || !CLIENT_SECRET) {
        logger.error('Gmail Client ID and Secret must be set in .env file');
        process.exit(1);
    }

    logger.info('🔐 Simple Gmail OAuth Setup...');
    logger.info('This method works without redirect URI configuration');

    // Create OAuth2 client with urn:ietf:wg:oauth:2.0:oob (out-of-band)
    const oauth2Client = new OAuth2Client(
        CLIENT_ID,
        CLIENT_SECRET,
        'urn:ietf:wg:oauth:2.0:oob'  // Special redirect URI that doesn't need configuration
    );

    // Generate auth URL
    const scopes = [
        'https://www.googleapis.com/auth/gmail.readonly',
        'https://www.googleapis.com/auth/gmail.modify'
    ];

    const authUrl = oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: scopes,
        prompt: 'consent'
    });

    logger.info('📋 Step 1: Open this URL in your browser:');
    logger.info(`\n${authUrl}\n`);
    logger.info('📝 Step 2: After authorization, Google will show you an authorization code');
    logger.info('📋 Step 3: Copy the authorization code and paste it below when prompted');
    logger.info('');

    // Wait for user input
    const { createInterface } = await import('readline');
    const rl = createInterface({
        input: process.stdin,
        output: process.stdout
    });

    return new Promise((resolve, reject) => {
        rl.question('🔑 Enter the authorization code: ', async (code) => {
            rl.close();
            
            try {
                logger.info('🔄 Exchanging authorization code for tokens...');
                
                // Exchange code for tokens
                const { tokens } = await oauth2Client.getToken(code.trim());
                
                if (tokens.refresh_token) {
                    logger.info('✅ Successfully obtained refresh token!');
                    
                    // Update .env file
                    updateEnvFile(tokens.refresh_token);
                    
                    // Test the connection
                    await testGmailConnection(tokens.refresh_token);
                    
                    logger.info('🎉 Gmail setup completed successfully!');
                    resolve(tokens.refresh_token);
                    
                } else {
                    throw new Error('No refresh token received. Make sure to approve all permissions.');
                }
                
            } catch (error) {
                logger.error('❌ Error exchanging code for tokens:', error);
                reject(error);
            }
        });
    });
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

async function testGmailConnection(refreshToken: string) {
    try {
        logger.info('🧪 Testing Gmail connection...');
        
        const oauth2Client = new OAuth2Client(
            CLIENT_ID,
            CLIENT_SECRET,
            'urn:ietf:wg:oauth:2.0:oob'
        );
        oauth2Client.setCredentials({ refresh_token: refreshToken });
        
        const { google } = await import('googleapis');
        const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
        
        const profile = await gmail.users.getProfile({ userId: 'me' });
        logger.info(`✅ Gmail connection successful! Email: ${profile.data.emailAddress}`);
        
        return true;
    } catch (error) {
        logger.error('❌ Gmail connection test failed:', error);
        return false;
    }
}

if (import.meta.url === `file://${process.argv[1]}`) {
    simpleGmailSetup()
        .then(() => {
            logger.info('🎉 Setup completed successfully!');
            process.exit(0);
        })
        .catch(error => {
            logger.error('💥 Setup failed:', error);
            process.exit(1);
        });
}

export { simpleGmailSetup };