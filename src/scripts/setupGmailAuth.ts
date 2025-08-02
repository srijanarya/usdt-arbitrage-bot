import { config } from 'dotenv';
import { OAuth2Client } from 'google-auth-library';
import { createServer } from 'http';
import { parse } from 'url';
import { writeFileSync, readFileSync } from 'fs';
import { logger } from '../utils/logger';

// Load environment variables
config();

const CLIENT_ID = process.env.GMAIL_CLIENT_ID;
const CLIENT_SECRET = process.env.GMAIL_CLIENT_SECRET;
const REDIRECT_URI = process.env.GMAIL_REDIRECT_URI || 'http://localhost:3000/auth/gmail/callback';

async function setupGmailAuth() {
    if (!CLIENT_ID || !CLIENT_SECRET) {
        logger.error('Gmail Client ID and Secret must be set in .env file');
        process.exit(1);
    }

    logger.info('🔐 Setting up Gmail OAuth authentication...');
    logger.info(`Client ID: ${CLIENT_ID}`);
    logger.info(`Redirect URI: ${REDIRECT_URI}`);

    // Create OAuth2 client
    const oauth2Client = new OAuth2Client(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);

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

    // Create temporary server to handle callback
    const server = createServer(async (req, res) => {
        const url = parse(req.url || '', true);
        
        if (url.pathname === '/auth/gmail/callback') {
            const code = url.query.code as string;
            
            if (code) {
                try {
                    logger.info('🔄 Exchanging authorization code for tokens...');
                    
                    // Exchange code for tokens
                    const { tokens } = await oauth2Client.getToken(code);
                    
                    if (tokens.refresh_token) {
                        logger.info('✅ Successfully obtained refresh token!');
                        
                        // Update .env file
                        updateEnvFile(tokens.refresh_token);
                        
                        res.writeHead(200, { 'Content-Type': 'text/html' });
                        res.end(`
                            <html>
                                <head><title>Gmail Auth Success</title></head>
                                <body style="font-family: Arial; text-align: center; margin-top: 50px;">
                                    <h1 style="color: green;">✅ Gmail Authentication Successful!</h1>
                                    <p>Your refresh token has been saved to the .env file.</p>
                                    <p>You can now close this window and return to the terminal.</p>
                                    <p><strong>Refresh Token:</strong> ${tokens.refresh_token}</p>
                                </body>
                            </html>
                        `);
                        
                        setTimeout(() => {
                            server.close();
                            process.exit(0);
                        }, 1000);
                        
                    } else {
                        throw new Error('No refresh token received. Make sure to approve all permissions.');
                    }
                    
                } catch (error) {
                    logger.error('❌ Error exchanging code for tokens:', error);
                    res.writeHead(500, { 'Content-Type': 'text/html' });
                    res.end(`
                        <html>
                            <head><title>Gmail Auth Error</title></head>
                            <body style="font-family: Arial; text-align: center; margin-top: 50px;">
                                <h1 style="color: red;">❌ Authentication Error</h1>
                                <p>Error: ${error.message}</p>
                                <p>Please try again or check your credentials.</p>
                            </body>
                        </html>
                    `);
                }
            } else {
                res.writeHead(400, { 'Content-Type': 'text/html' });
                res.end(`
                    <html>
                        <head><title>Gmail Auth Error</title></head>
                        <body style="font-family: Arial; text-align: center; margin-top: 50px;">
                            <h1 style="color: red;">❌ No Authorization Code</h1>
                            <p>No authorization code received. Please try again.</p>
                        </body>
                    </html>
                `);
            }
        } else {
            res.writeHead(404);
            res.end('Not found');
        }
    });

    // Start server
    server.listen(3000, () => {
        logger.info('🚀 OAuth callback server started on http://localhost:3000');
        logger.info('⏳ Waiting for authorization...');
        logger.info('💡 After authorizing, you will be redirected back automatically.');
    });

    // Handle process termination
    process.on('SIGINT', () => {
        logger.info('\n🛑 Setup cancelled by user');
        server.close();
        process.exit(0);
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

// Test Gmail connection after setup
async function testGmailConnection(refreshToken: string) {
    try {
        logger.info('🧪 Testing Gmail connection...');
        
        const oauth2Client = new OAuth2Client(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);
        oauth2Client.setCredentials({ refresh_token: refreshToken });
        
        const { google } = require('googleapis');
        const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
        
        const profile = await gmail.users.getProfile({ userId: 'me' });
        logger.info(`✅ Gmail connection successful! Email: ${profile.data.emailAddress}`);
        
        return true;
    } catch (error) {
        logger.error('❌ Gmail connection test failed:', error);
        return false;
    }
}

// Run if executed directly
if (require.main === module) {
    setupGmailAuth().catch(error => {
        logger.error('💥 Setup failed:', error);
        process.exit(1);
    });
}

export { setupGmailAuth, testGmailConnection };