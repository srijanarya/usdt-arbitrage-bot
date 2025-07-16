const express = require('express');
const net = require('net');

console.log('🔧 Debugging localhost connection issue...\n');

// First, let's check if the port is available
const portChecker = net.createServer();

portChecker.once('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.log('❌ Port 3000 is already in use!');
    console.log('💡 Fix: Run this command:');
    console.log('   lsof -ti:3000 | xargs kill -9\n');
    process.exit(1);
  }
});

portChecker.once('listening', () => {
  portChecker.close();
  console.log('✅ Port 3000 is available\n');
  
  // Now try to start Express
  try {
    const app = express();
    
    // Add comprehensive logging
    app.use((req, res, next) => {
      console.log(`📥 ${new Date().toISOString()} - ${req.method} ${req.url}`);
      next();
    });
    
    // Main route
    app.get('/', (req, res) => {
      res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>✅ Server Fixed!</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              display: flex;
              justify-content: center;
              align-items: center;
              height: 100vh;
              margin: 0;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            }
            .container {
              background: white;
              padding: 40px;
              border-radius: 10px;
              box-shadow: 0 10px 30px rgba(0,0,0,0.2);
              text-align: center;
            }
            h1 { color: #28a745; }
            .info {
              background: #f8f9fa;
              padding: 20px;
              border-radius: 5px;
              margin: 20px 0;
            }
            button {
              background: #007bff;
              color: white;
              border: none;
              padding: 10px 20px;
              border-radius: 5px;
              cursor: pointer;
              margin: 5px;
            }
            button:hover { background: #0056b3; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>✅ Localhost Fixed!</h1>
            <p>Your server is now working correctly!</p>
            <div class="info">
              <p><strong>Time:</strong> ${new Date().toLocaleString()}</p>
              <p><strong>Port:</strong> 3000</p>
              <p><strong>Status:</strong> Operational</p>
            </div>
            <button onclick="location.href='/api/test'">Test API</button>
            <button onclick="location.reload()">Refresh</button>
            <button onclick="location.href='/dashboard'">Open Dashboard</button>
          </div>
        </body>
        </html>
      `);
    });
    
    // API test endpoint
    app.get('/api/test', (req, res) => {
      res.json({
        success: true,
        message: 'API is working perfectly!',
        server: 'Express',
        port: 3000,
        timestamp: new Date()
      });
    });
    
    // Dashboard route (redirect to your actual dashboard)
    app.get('/dashboard', (req, res) => {
      res.redirect('/simple-dashboard.html');
    });
    
    // Serve static files
    app.use(express.static('.'));
    
    // Start server with all interfaces
    const server = app.listen(3000, '0.0.0.0', () => {
      console.log('🚀 Express server started successfully!\n');
      console.log('📍 Access your server at:');
      console.log('   • http://localhost:3000');
      console.log('   • http://127.0.0.1:3000');
      console.log('   • http://0.0.0.0:3000\n');
      console.log('📊 API endpoint: http://localhost:3000/api/test');
      console.log('🌐 Dashboard: http://localhost:3000/simple-dashboard.html\n');
      console.log('✅ Everything is working! The browser should now connect.\n');
      console.log('🛑 Press Ctrl+C to stop the server\n');
    });
    
    // Error handling
    server.on('error', (err) => {
      console.error('\n❌ Server Error:', err.message);
      if (err.code === 'EACCES') {
        console.error('💡 Permission denied. Try sudo or use a different port.');
      }
      process.exit(1);
    });
    
    // Graceful shutdown
    process.on('SIGINT', () => {
      console.log('\n👋 Shutting down gracefully...');
      server.close(() => {
        console.log('✅ Server closed');
        process.exit(0);
      });
    });
    
  } catch (error) {
    console.error('❌ Failed to start Express:', error.message);
    console.log('\n💡 Try installing Express:');
    console.log('   npm install express\n');
    process.exit(1);
  }
});

// Check the port
console.log('📍 Checking port 3000...');
portChecker.listen(3000);