#!/usr/bin/env node
import { credentialManager } from './src/services/security/CredentialManager';
import * as readline from 'readline';
import * as fs from 'fs';
import { logger } from './src/utils/logger';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

function hiddenQuestion(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    const stdin = process.stdin;
    const stdout = process.stdout;

    stdout.write(prompt);
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');

    let password = '';
    stdin.on('data', (char: string) => {
      const charCode = char.charCodeAt(0);

      if (charCode === 13) { // Enter
        stdin.setRawMode(false);
        stdin.pause();
        stdout.write('\n');
        resolve(password);
      } else if (charCode === 127) { // Backspace
        if (password.length > 0) {
          password = password.slice(0, -1);
          stdout.clearLine(0);
          stdout.cursorTo(prompt.length);
          stdout.write('*'.repeat(password.length));
        }
      } else if (charCode === 3) { // Ctrl+C
        process.exit();
      } else {
        password += char;
        stdout.write('*');
      }
    });
  });
}

async function setupEncryption() {
  console.log('🔐 USDT Arbitrage Bot - Credential Encryption Setup');
  console.log('================================================\n');

  try {
    // Check current status
    const status = credentialManager.getStatus();
    
    if (status.encrypted) {
      console.log('✅ Credentials are already encrypted');
      console.log(`📅 Last modified: ${status.lastModified}`);
      console.log(`🔑 Number of encrypted credentials: ${status.credentialCount}\n`);
      
      const action = await question('What would you like to do?\n1. Re-encrypt with new password\n2. Decrypt credentials\n3. Exit\nChoice (1-3): ');
      
      if (action === '3') {
        console.log('\n👋 Exiting...');
        process.exit(0);
      }
      
      if (action === '2') {
        const password = await hiddenQuestion('\nEnter master password to decrypt: ');
        await credentialManager.initialize(password);
        const decrypted = await credentialManager.decryptCredentials();
        
        console.log('\n✅ Credentials decrypted successfully!');
        const save = await question('\nSave decrypted credentials back to .env? (y/n): ');
        
        if (save.toLowerCase() === 'y') {
          // Update .env with decrypted values
          const envPath = '.env';
          let envContent = fs.readFileSync(envPath, 'utf-8');
          
          for (const [key, value] of Object.entries(decrypted)) {
            envContent = envContent.replace(
              new RegExp(`${key}=.*`),
              `${key}=${value}`
            );
          }
          
          fs.writeFileSync(envPath, envContent);
          console.log('✅ Decrypted credentials saved to .env');
          
          // Remove encrypted file
          fs.unlinkSync('.credentials.enc');
          console.log('✅ Removed encrypted credentials file');
        }
        
        rl.close();
        return;
      }
    }

    // Setup encryption
    console.log('🔒 Setting up credential encryption...\n');
    console.log('⚠️  IMPORTANT: Choose a strong master password and store it securely!');
    console.log('    This password will be required to decrypt your API keys.\n');

    const password = await hiddenQuestion('Enter master password: ');
    const confirmPassword = await hiddenQuestion('Confirm master password: ');

    if (password !== confirmPassword) {
      console.log('\n❌ Passwords do not match!');
      process.exit(1);
    }

    console.log('\n🔄 Initializing credential manager...');
    await credentialManager.initialize(password);

    console.log('🔐 Encrypting credentials...');
    await credentialManager.encryptCredentials();

    console.log('\n✅ Credential encryption setup complete!\n');
    console.log('📝 Next steps:');
    console.log('   1. Your API keys are now encrypted in .credentials.enc');
    console.log('   2. The .env file now contains ENCRYPTED placeholders');
    console.log('   3. Add .credentials.enc to .gitignore (if not already)');
    console.log('   4. Never commit .credentials.enc or .salt files');
    console.log('   5. Store your master password securely\n');

    // Update .gitignore
    const gitignorePath = '.gitignore';
    if (fs.existsSync(gitignorePath)) {
      let gitignoreContent = fs.readFileSync(gitignorePath, 'utf-8');
      
      const toAdd = ['.credentials.enc', '.salt', '.env.bak'];
      let updated = false;
      
      for (const item of toAdd) {
        if (!gitignoreContent.includes(item)) {
          gitignoreContent += `\n${item}`;
          updated = true;
        }
      }
      
      if (updated) {
        fs.writeFileSync(gitignorePath, gitignoreContent);
        console.log('✅ Updated .gitignore with encrypted files');
      }
    }

    // Create secure bot startup script
    const startupScript = `#!/usr/bin/env node
import { credentialManager } from './src/services/security/CredentialManager';
import * as readline from 'readline';

async function startBot() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  // Get master password
  process.stdout.write('Enter master password: ');
  process.stdin.setRawMode(true);
  
  let password = '';
  process.stdin.on('data', (char) => {
    const charCode = char.toString().charCodeAt(0);
    
    if (charCode === 13) { // Enter
      process.stdin.setRawMode(false);
      process.stdout.write('\\n');
      
      // Initialize and decrypt
      credentialManager.initialize(password)
        .then(() => credentialManager.loadCredentials())
        .then(() => {
          console.log('✅ Credentials loaded successfully');
          rl.close();
          
          // Start the bot
          require('./src/bot/comprehensiveTradingBot');
        })
        .catch(err => {
          console.error('❌ Failed to decrypt credentials:', err.message);
          process.exit(1);
        });
    } else if (charCode === 3) { // Ctrl+C
      process.exit();
    } else {
      password += char.toString();
      process.stdout.write('*');
    }
  });
}

startBot();
`;

    fs.writeFileSync('start-secure-bot.ts', startupScript);
    fs.chmodSync('start-secure-bot.ts', 0o755);
    console.log('✅ Created secure bot startup script: start-secure-bot.ts\n');

    console.log('🚀 To start the bot with encrypted credentials:');
    console.log('   npx ts-node start-secure-bot.ts\n');

  } catch (error) {
    console.error('\n❌ Setup failed:', error.message);
    process.exit(1);
  } finally {
    rl.close();
  }
}

// Run setup
setupEncryption().catch(console.error);