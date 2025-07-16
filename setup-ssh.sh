#!/bin/bash

echo "🔐 Setting up SSH for GitHub (More Secure than Tokens)"
echo "===================================================="
echo ""

# Check if SSH key exists
if [ -f ~/.ssh/id_ed25519 ]; then
    echo "✅ SSH key already exists"
else
    echo "📝 Creating new SSH key..."
    echo "Enter your GitHub email:"
    read github_email
    ssh-keygen -t ed25519 -C "$github_email" -f ~/.ssh/id_ed25519 -N ""
    echo "✅ SSH key created"
fi

# Start SSH agent
eval "$(ssh-agent -s)"

# Add SSH key to agent
ssh-add ~/.ssh/id_ed25519

# Copy public key to clipboard
pbcopy < ~/.ssh/id_ed25519.pub

echo ""
echo "✅ SSH public key copied to clipboard!"
echo ""
echo "Now:"
echo "1. Go to: https://github.com/settings/keys"
echo "2. Click 'New SSH key'"
echo "3. Title: 'MacBook USDT Bot'"
echo "4. Paste the key (Cmd+V)"
echo "5. Click 'Add SSH key'"
echo ""
echo "Then update your repository to use SSH:"
echo "cd /Users/srijan/Desktop/usdt-arbitrage-bot"
echo "git remote set-url origin git@github.com:srijanarya/usdt-arbitrage-bot.git"
echo ""
echo "Future pushes will use SSH (no tokens needed)!"