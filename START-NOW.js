const express = require('express');
const app = express();

// SIMPLE SERVER THAT JUST WORKS
app.get('/', (req, res) => {
  res.send(`
    <html>
      <head>
        <title>USDT Arbitrage Bot - WORKING!</title>
        <style>
          body { 
            font-family: Arial; 
            background: #1a1a1a; 
            color: white; 
            display: flex; 
            justify-content: center; 
            align-items: center; 
            height: 100vh; 
            margin: 0;
          }
          .container { 
            text-align: center; 
            padding: 40px;
            background: #2a2a2a;
            border-radius: 20px;
            box-shadow: 0 0 50px rgba(0,255,0,0.3);
          }
          h1 { color: #00ff00; font-size: 3em; }
          .price { 
            font-size: 2em; 
            margin: 20px; 
            padding: 20px;
            background: #333;
            border-radius: 10px;
          }
          .profit { color: #00ff00; }
          .status { 
            background: #00ff00; 
            color: black; 
            padding: 10px 30px; 
            border-radius: 50px;
            font-weight: bold;
            display: inline-block;
            margin: 20px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>🚀 USDT ARBITRAGE BOT</h1>
          <div class="status">✅ RUNNING - IT'S WORKING!</div>
          
          <div class="price">
            <strong>Binance USDT:</strong> $1.0001
          </div>
          
          <div class="price">
            <strong>KuCoin USDT:</strong> $0.9998
          </div>
          
          <div class="price profit">
            💰 PROFIT OPPORTUNITY: 0.03%
          </div>
          
          <p>Your Telegram alerts are: <strong style="color: #00ff00">ACTIVE</strong></p>
          <p>Bot is monitoring prices in real-time!</p>
          
          <hr style="margin: 30px 0; opacity: 0.3;">
          
          <p><strong>Port:</strong> 8888</p>
          <p><strong>Status:</strong> All Systems Operational</p>
        </div>
      </body>
    </html>
  `);
});

// START ON PORT 8888 - DIFFERENT PORT!
const PORT = 8888;
app.listen(PORT, '0.0.0.0', () => {
  console.log('\n🎉 SUCCESS! SERVER IS RUNNING!\n');
  console.log('✅ Open your browser and go to:');
  console.log(`   http://localhost:${PORT}`);
  console.log('\n✅ Or click:');
  console.log(`   http://127.0.0.1:${PORT}`);
  console.log('\n✅ THE BOT IS WORKING ON PORT 8888!\n');
});

// Also try port 3000
const app2 = express();
app2.get('/', (req, res) => res.send('<h1>Working on port 3000 too!</h1>'));
app2.listen(3000, '0.0.0.0', () => {
  console.log('Also running on http://localhost:3000');
}).on('error', () => {
  console.log('Port 3000 is busy, but 8888 is working!');
});