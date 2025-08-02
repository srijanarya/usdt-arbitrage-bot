#!/bin/bash

echo "🔐 USDT Arbitrage Bot - Secure Setup"
echo "===================================="
echo ""
echo "This script will:"
echo "1. Fix Gmail authentication"
echo "2. Encrypt all API credentials"
echo "3. Set up secure bot startup"
echo ""

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check Node.js installation
if ! command_exists node; then
    echo "❌ Node.js is not installed. Please install Node.js first."
    exit 1
fi

# Check npm installation
if ! command_exists npm; then
    echo "❌ npm is not installed. Please install npm first."
    exit 1
fi

echo "✅ Node.js version: $(node --version)"
echo "✅ npm version: $(npm --version)"
echo ""

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
    echo ""
fi

# Step 1: Fix Gmail Authentication
echo "📧 Step 1: Gmail Authentication Setup"
echo "------------------------------------"
echo ""

# Check if Gmail credentials exist
if grep -q "GMAIL_CLIENT_ID=" .env && grep -q "GMAIL_CLIENT_SECRET=" .env; then
    GMAIL_ID=$(grep "GMAIL_CLIENT_ID=" .env | cut -d'=' -f2)
    GMAIL_SECRET=$(grep "GMAIL_CLIENT_SECRET=" .env | cut -d'=' -f2)
    
    if [ -n "$GMAIL_ID" ] && [ "$GMAIL_ID" != "ENCRYPTED" ] && [ -n "$GMAIL_SECRET" ] && [ "$GMAIL_SECRET" != "ENCRYPTED" ]; then
        echo "✅ Gmail credentials found in .env"
        read -p "Do you want to reconfigure Gmail? (y/n): " RECONFIGURE_GMAIL
        
        if [ "$RECONFIGURE_GMAIL" != "y" ]; then
            echo "Skipping Gmail setup..."
            echo ""
        else
            ./fix-gmail-auth.sh
        fi
    else
        echo "Gmail credentials not found or encrypted. Running setup..."
        ./fix-gmail-auth.sh
    fi
else
    echo "Gmail credentials not found. Running setup..."
    ./fix-gmail-auth.sh
fi

echo ""
echo "📐 Step 2: Credential Encryption"
echo "--------------------------------"
echo ""

# Check if credentials are already encrypted
if [ -f ".credentials.enc" ]; then
    echo "✅ Found encrypted credentials file"
    echo ""
else
    echo "🔒 Setting up credential encryption..."
    echo ""
fi

# Run credential encryption setup
npx ts-node setup-credential-encryption.ts

echo ""
echo "🚀 Step 3: Creating Secure Startup Scripts"
echo "-----------------------------------------"
echo ""

# Create main secure startup script
cat > start-secure.sh << 'EOF'
#!/bin/bash

echo "🚀 Starting USDT Arbitrage Bot (Secure Mode)"
echo "==========================================="
echo ""

# Check if encrypted credentials exist
if [ ! -f ".credentials.enc" ]; then
    echo "❌ Encrypted credentials not found!"
    echo "Please run ./secure-setup.sh first"
    exit 1
fi

# Start the secure bot
echo "🔐 Starting bot with encrypted credentials..."
npx ts-node start-secure-bot.ts
EOF

chmod +x start-secure.sh

# Create development mode script (with safety warnings)
cat > start-dev.sh << 'EOF'
#!/bin/bash

echo "⚠️  Starting USDT Arbitrage Bot (Development Mode)"
echo "================================================"
echo ""
echo "WARNING: This mode uses unencrypted credentials from .env"
echo "Only use this for development and testing!"
echo ""
read -p "Continue? (y/n): " CONTINUE

if [ "$CONTINUE" != "y" ]; then
    echo "Exiting..."
    exit 0
fi

# Check if .env has actual credentials (not ENCRYPTED placeholders)
if grep -q "BINANCE_API_KEY=ENCRYPTED" .env; then
    echo "❌ Credentials are encrypted. Use ./start-secure.sh instead"
    exit 1
fi

# Start in development mode
npm run bot
EOF

chmod +x start-dev.sh

# Create credential rotation script
cat > rotate-credentials.sh << 'EOF'
#!/bin/bash

echo "🔄 Rotating Credential Encryption"
echo "================================="
echo ""
echo "This will re-encrypt all credentials with a new master password"
echo ""

npx ts-node -e "
import { credentialManager } from './src/services/security/CredentialManager';
import * as readline from 'readline';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

async function rotate() {
  try {
    console.log('Enter current master password:');
    const currentPassword = await new Promise(resolve => {
      process.stdin.setRawMode(true);
      let password = '';
      process.stdin.on('data', char => {
        const charCode = char.toString().charCodeAt(0);
        if (charCode === 13) {
          process.stdin.setRawMode(false);
          console.log();
          resolve(password);
        } else if (charCode === 3) {
          process.exit();
        } else {
          password += char.toString();
          process.stdout.write('*');
        }
      });
    });

    await credentialManager.initialize(currentPassword);
    
    console.log('Enter new master password:');
    const newPassword = await new Promise(resolve => {
      process.stdin.setRawMode(true);
      let password = '';
      process.stdin.on('data', char => {
        const charCode = char.toString().charCodeAt(0);
        if (charCode === 13) {
          process.stdin.setRawMode(false);
          console.log();
          resolve(password);
        } else if (charCode === 3) {
          process.exit();
        } else {
          password += char.toString();
          process.stdout.write('*');
        }
      });
    });

    await credentialManager.rotateKeys(newPassword);
    console.log('✅ Credentials re-encrypted with new password');
    
  } catch (error) {
    console.error('❌ Rotation failed:', error.message);
  }
  
  rl.close();
}

rotate();
"
EOF

chmod +x rotate-credentials.sh

echo "✅ Created startup scripts:"
echo "   • ./start-secure.sh - Start bot with encrypted credentials"
echo "   • ./start-dev.sh - Start bot in development mode"
echo "   • ./rotate-credentials.sh - Rotate encryption password"
echo ""

# Final summary
echo "🎉 Secure Setup Complete!"
echo "========================"
echo ""
echo "✅ Gmail authentication configured"
echo "✅ API credentials encrypted"
echo "✅ Secure startup scripts created"
echo ""
echo "📝 Important Security Notes:"
echo "   1. Store your master password securely"
echo "   2. Never commit .credentials.enc or .salt files"
echo "   3. Use ./start-secure.sh for production"
echo "   4. Rotate credentials regularly with ./rotate-credentials.sh"
echo ""
echo "🚀 To start the bot securely:"
echo "   ./start-secure.sh"
echo ""