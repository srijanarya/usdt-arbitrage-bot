const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 42156;

const server = http.createServer((req, res) => {
  console.log(`Request: ${req.method} ${req.url}`);
  
  if (req.url === '/') {
    // Serve the dashboard HTML
    const htmlPath = path.join(__dirname, 'public', 'index.html');
    
    fs.readFile(htmlPath, 'utf8', (err, data) => {
      if (err) {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(`
          <html>
            <body style="font-family: Arial; padding: 20px;">
              <h1>USDT Arbitrage Bot</h1>
              <p>Server is running successfully!</p>
              <p>Dashboard file not found. Creating a simple status page...</p>
              <hr>
              <h2>Status:</h2>
              <ul>
                <li>✅ Server: Running on port ${PORT}</li>
                <li>✅ Time: ${new Date().toLocaleString()}</li>
                <li>✅ API: <a href="/api/test">/api/test</a></li>
              </ul>
            </body>
          </html>
        `);
      } else {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(data);
      }
    });
  } else if (req.url === '/api/test') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'ok',
      message: 'API is working',
      timestamp: new Date()
    }));
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`\n✅ Server is running!`);
  console.log(`📍 Open in your browser: http://localhost:${PORT}`);
  console.log(`📍 Or try: http://127.0.0.1:${PORT}`);
  console.log('\nPress Ctrl+C to stop\n');
});

// Handle errors
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n❌ Port ${PORT} is already in use!`);
    console.error('Try running: lsof -ti:3000 | xargs kill -9');
  } else {
    console.error('Server error:', err);
  }
  process.exit(1);
});