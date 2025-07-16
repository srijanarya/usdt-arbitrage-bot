#!/bin/bash

echo "🔧 Fixing localhost connection issue..."
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if port 3000 is in use
echo "1. Checking port 3000..."
if lsof -i :3000 > /dev/null 2>&1; then
    echo -e "${YELLOW}⚠️  Port 3000 is in use. Killing process...${NC}"
    lsof -ti:3000 | xargs kill -9 2>/dev/null
    sleep 1
else
    echo -e "${GREEN}✅ Port 3000 is available${NC}"
fi

# Check if express is installed
echo ""
echo "2. Checking Express installation..."
if [ ! -d "node_modules/express" ]; then
    echo -e "${YELLOW}⚠️  Express not found. Installing...${NC}"
    npm install express axios
else
    echo -e "${GREEN}✅ Express is installed${NC}"
fi

# Create a working test server
echo ""
echo "3. Creating debug server..."
cat > debug-localhost.js << 'EOF'
const express = require('express');
const app = express();
const PORT = 3000;

// Simple HTML response
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>USDT Arbitrage Bot - Debug</title>
      <style>
        body { font-family: Arial; padding: 40px; background: #f0f0f0; }
        .container { max-width: 600px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .status { color: green; font-size: 24px; }
        .info { background: #e8f4f8; padding: 15px; border-radius: 5px; margin: 20px 0; }
        button { background: #007bff; color: white; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer; }
        button:hover { background: #0056b3; }
      </style>
    </head>
    <body>
      <div class="container">
        <h1 class="status">✅ Server is Working!</h1>
        <div class="info">
          <h3>Debug Information:</h3>
          <p>📍 URL: http://localhost:${PORT}</p>
          <p>⏰ Time: ${new Date().toLocaleString()}</p>
          <p>🖥️ Platform: ${process.platform}</p>
          <p>🚀 Node: ${process.version}</p>
        </div>
        <button onclick="location.reload()">🔄 Refresh</button>
        <button onclick="window.open('/api/test')">📊 Test API</button>
      </div>
    </body>
    </html>
  `);
});

// API test endpoint
app.get('/api/test', (req, res) => {
  res.json({
    success: true,
    message: 'API is working!',
    timestamp: new Date()
  });
});

// Start server with proper error handling
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log('\\n✅ Server started successfully!');
  console.log('\\n📍 Open these URLs in your browser:');
  console.log('   http://localhost:3000');
  console.log('   http://127.0.0.1:3000');
  console.log('\\n🛑 Press Ctrl+C to stop\\n');
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error('\\n❌ Port 3000 is still in use!');
    console.error('Try: sudo lsof -ti:3000 | xargs kill -9\\n');
  } else if (err.code === 'EACCES') {
    console.error('\\n❌ Permission denied! Try a different port.\\n');
  } else {
    console.error('\\n❌ Server error:', err.message, '\\n');
  }
  process.exit(1);
});

// Handle shutdown gracefully
process.on('SIGINT', () => {
  console.log('\\n👋 Shutting down server...');
  server.close(() => {
    process.exit(0);
  });
});
EOF

# Make it executable
chmod +x debug-localhost.js

# Try to start the server
echo ""
echo "4. Starting debug server..."
echo -e "${GREEN}═══════════════════════════════════════${NC}"
node debug-localhost.js